import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

function buildQuery(q: string): string {
  const escaped = q.toLowerCase().replace(/"/g, '\\"');
  // No P31 class constraint — any Wikidata item with a BGG ID property (P2339)
  // qualifies. This catches newer games not yet classified as Q131436 (board game)
  // in Wikidata while still being BGG-relevant (P2339 is exclusively a BGG property).
  return `
SELECT DISTINCT ?itemLabel ?bggId WHERE {
  ?item wdt:P2339 ?bggId .
  ?item rdfs:label ?itemLabel .
  FILTER(CONTAINS(LCASE(?itemLabel), "${escaped}"))
  FILTER(LANG(?itemLabel) = "en")
}
LIMIT 15
`.trim();
}

async function fetchThumbnail(bggId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      {
        signal: AbortSignal.timeout(4000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Referer": "https://boardgamegeek.com/",
        },
        next: { revalidate: 86400 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.item?.imageurl ?? null;
  } catch {
    return null;
  }
}

// Strip leading articles so "the hunger" also searches "hunger" on BGG.
// BGG autocomplete returns "The Hunger" when querying "hunger" but may not
// surface it when the full query is "the hunger" (article-heavy prefix matching).
function stripLeadingArticle(q: string): string | null {
  const articles = ["the ", "a ", "an ", "die ", "das ", "der ", "les ", "le ", "la ", "los ", "las "];
  const lower = q.toLowerCase();
  for (const art of articles) {
    if (lower.startsWith(art)) {
      const stripped = q.slice(art.length).trim();
      return stripped.length >= 2 ? stripped : null;
    }
  }
  return null;
}

// BGG's internal geekdo endpoint: returns autocomplete-style hits by name.
// Works from Vercel IPs (returns JSON when called with Accept: application/json).
// Note: nosession=1 returns a limited result set; some games may be missing.
async function bggNameFallback(q: string): Promise<{ bgg_id: number; name: string; thumbnail_url: string | null }[]> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekdo?search=${encodeURIComponent(q)}&objecttype=boardgame&nosession=1&showcount=30`,
      {
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Referer": "https://boardgamegeek.com/",
        },
        next: { revalidate: 1800 },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = (data?.items ?? data?.results ?? []) as Record<string, unknown>[];
    return items
      .map((item) => ({
        bgg_id: Number(item.objectid ?? item.id ?? 0),
        name: String(item.name ?? ""),
        thumbnail_url: item.thumbnailhref ? `https:${String(item.thumbnailhref)}` : null,
      }))
      .filter((r) => r.bgg_id > 0 && r.name.length > 0)
      .slice(0, 20);
  } catch {
    return [];
  }
}

// BGG geeksearch.php HTML scrape — the classic PHP search page is not a REST
// API and is unlikely to be blocked from Vercel IPs (unlike /xmlapi2/).
// Extracts game IDs and names from the HTML link structure.
async function bggSearchScrape(q: string): Promise<{ bgg_id: number; name: string; thumbnail_url: string | null }[]> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(q)}`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://boardgamegeek.com/",
        },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const html = await res.text();
    if (!html.includes("/boardgame/")) return [];

    // Extract: <a href="/boardgame/324844/the-hunger">The Hunger</a>
    const results: { bgg_id: number; name: string; thumbnail_url: null }[] = [];
    const linkRe = /href="\/boardgame\/(\d+)\/[^"]*"[^>]*>([^<]{1,80})<\/a>/g;
    const seenIds = new Set<number>();
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      const bgg_id = Number(m[1]);
      const name = m[2].trim().replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"');
      if (bgg_id > 0 && name.length > 1 && !seenIds.has(bgg_id)) {
        seenIds.add(bgg_id);
        results.push({ bgg_id, name, thumbnail_url: null });
      }
    }
    return results.slice(0, 15);
  } catch {
    return [];
  }
}

// BGG XML API v2 full-text search — returns a proper ranked search index
// (not just autocomplete prefix matching). This finds games that geekdo misses,
// e.g. "The Hunger" which doesn't appear in the nosession geekdo result.
// May return 401 if BGG requires auth from this IP; handled gracefully.
async function bggXmlSearch(q: string): Promise<{ bgg_id: number; name: string; thumbnail_url: string | null }[]> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(q)}&type=boardgame`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/xml, text/xml, */*",
          "Referer": "https://boardgamegeek.com/",
        },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    if (!xml.includes("<items")) return [];

    // Parse XML with regex — no DOMParser on server, no external parser needed
    const results: { bgg_id: number; name: string; thumbnail_url: null }[] = [];
    const itemRe = /<item\s+type="boardgame"\s+id="(\d+)">([\s\S]*?)<\/item>/g;
    const nameRe = /<name\s+type="primary"\s+sortindex="\d+"\s+value="([^"]*)"\s*\/>/;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null) {
      const bgg_id = Number(m[1]);
      const nameMatch = nameRe.exec(m[2]);
      if (bgg_id > 0 && nameMatch) {
        // Decode XML entities
        const name = nameMatch[1]
          .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'");
        results.push({ bgg_id, name, thumbnail_url: null });
      }
    }
    return results.slice(0, 20);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // ── Step 0: Search local games table first (fast, no external calls) ─────────
  // Games table has public read RLS — admin client not needed but used for
  // consistency and to avoid needing a per-request auth cookie here.
  try {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: localGames } = await admin
      .from("games")
      .select("bgg_id, name, thumbnail_url, year")
      .ilike("name", `%${q}%`)
      .not("bgg_id", "is", null)
      .order("name", { ascending: true })
      .limit(15);

    if (localGames && localGames.length >= 5) {
      // Enough local results — return immediately, no external API needed
      return NextResponse.json({
        results: localGames.map((g) => ({
          bgg_id: g.bgg_id as number,
          name: g.name as string,
          thumbnail_url: (g.thumbnail_url as string | null) ?? null,
          year_published: (g.year as number | null) ?? null,
        })),
        source: "local",
      });
    }
  } catch { /* local DB unavailable → fall through to external search */ }

  // Run Wikidata and BGG geekdo IN PARALLEL.
  //
  // Previous approach was sequential: Wikidata → BGG only if Wikidata returned 0
  // results OR threw. But if Wikidata returned !res.ok, we returned early and
  // never reached BGG — meaning games like "The Hunger" (not yet in Wikidata
  // with a P2339 statement) were lost.
  //
  // Now both run simultaneously. We use Wikidata results if present (richer data
  // with BGG IDs for lookup); otherwise fall back to BGG geekdo results which
  // already include thumbnails (thumbnailhref field).
  const wikidataUrl = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(buildQuery(q))}`;

  // Also search without leading article ("the hunger" → "hunger") so BGG
  // autocomplete can surface games whose titles begin with an article.
  const strippedQ = stripLeadingArticle(q);

  // Run everything in parallel: Wikidata + BGG geekdo (+ stripped) + BGG XML + BGG HTML scrape
  const bggGeekdoSearches: Promise<{ bgg_id: number; name: string; thumbnail_url: string | null }[]>[] = [
    bggNameFallback(q),
  ];
  if (strippedQ) bggGeekdoSearches.push(bggNameFallback(strippedQ));

  const [wikidataSettled, xmlSettled, scrapeSettled, ...geekdoSettledAll] = await Promise.allSettled([
    fetch(wikidataUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "Accept": "application/sparql-results+json",
        "User-Agent": "MeepleBase/1.0 (https://meeple-base.vercel.app)",
      },
      next: { revalidate: 3600 },
    }),
    bggXmlSearch(q),
    bggSearchScrape(q),
    ...bggGeekdoSearches,
  ]);

  // Parse Wikidata result
  let wikidataBase: { bgg_id: number; name: string }[] = [];
  if (wikidataSettled.status === "fulfilled" && wikidataSettled.value.ok) {
    try {
      const data = await wikidataSettled.value.json();
      const bindings: Array<{ itemLabel: { value: string }; bggId: { value: string } }> =
        data.results?.bindings ?? [];
      wikidataBase = bindings
        .map((b) => ({ bgg_id: Number(b.bggId.value), name: b.itemLabel.value }))
        .filter((r) => r.bgg_id > 0);
    } catch { /* parse error → treat as empty */ }
  }

  // BGG XML results (may be empty if 401/blocked)
  const xmlHits = xmlSettled.status === "fulfilled" ? xmlSettled.value : [];
  // BGG HTML scrape results (geeksearch.php — full-text, usually not IP-blocked)
  const scrapeHits = scrapeSettled.status === "fulfilled" ? scrapeSettled.value : [];

  // Merge geekdo results from both queries, deduplicate by bgg_id
  const rawGeekdoHits = geekdoSettledAll.flatMap((s) =>
    s.status === "fulfilled" ? s.value : []
  );

  // Combine all BGG sources: XML first, then scrape (has proper names), then geekdo
  const allBggRaw = [...xmlHits, ...scrapeHits, ...rawGeekdoHits];
  const seenIds = new Set<number>();
  const bggHits = allBggRaw.filter((g) => {
    if (seenIds.has(g.bgg_id)) return false;
    seenIds.add(g.bgg_id);
    return true;
  }).slice(0, 15);

  // Prefer Wikidata (has stable BGG IDs), enrich with thumbnails
  if (wikidataBase.length > 0) {
    const thumbnails = await Promise.all(wikidataBase.map((r) => fetchThumbnail(r.bgg_id)));
    return NextResponse.json({
      results: wikidataBase.map((r, i) => ({ ...r, thumbnail_url: thumbnails[i] ?? null })),
    });
  }

  // XML results have no thumbnails — fetch them; geekdo results already have thumbnails
  if (bggHits.length > 0) {
    // Fetch thumbnails only for results that don't already have one (geekdo provides them)
    const enriched = await Promise.all(
      bggHits.map(async (r) => {
        if (r.thumbnail_url) return r;
        const thumb = await fetchThumbnail(r.bgg_id);
        return { ...r, thumbnail_url: thumb };
      })
    );
    return NextResponse.json({ results: enriched });
  }

  return NextResponse.json({ results: [] });
}
