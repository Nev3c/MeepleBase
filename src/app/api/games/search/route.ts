import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

function buildQuery(q: string): string {
  const escaped = q.toLowerCase().replace(/"/g, '\\"');
  // No P31 class constraint — any Wikidata item with a BGG ID property (P2339)
  // qualifies. Search both English AND German labels so localized titles like
  // "Dune: Geheimnisse der Häuser" are found alongside English counterparts.
  return `
SELECT DISTINCT ?itemLabel ?bggId WHERE {
  ?item wdt:P2339 ?bggId .
  ?item rdfs:label ?itemLabel .
  FILTER(CONTAINS(LCASE(?itemLabel), "${escaped}"))
  FILTER(LANG(?itemLabel) IN ("en", "de"))
}
LIMIT 20
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
    // IMPORTANT: always use item.imageurl — NEVER item.topimageurl (community upload, privacy risk).
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
// Limit raised to 25 to catch lower-ranked localised titles.
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
    return results.slice(0, 25); // raised from 15 → 25 to catch less-popular localised titles
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

type SearchResult = { bgg_id: number; name: string; thumbnail_url: string | null; year_published?: number | null };

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Also search without leading article ("the hunger" → "hunger") so BGG
  // autocomplete can surface games whose titles begin with an article.
  const strippedQ = stripLeadingArticle(q);

  const wikidataUrl = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(buildQuery(q))}`;

  const bggGeekdoSearches: Promise<{ bgg_id: number; name: string; thumbnail_url: string | null }[]>[] = [
    bggNameFallback(q),
  ];
  if (strippedQ) bggGeekdoSearches.push(bggNameFallback(strippedQ));

  // ── Run local DB AND all external searches in parallel ─────────────────────
  //
  // IMPORTANT: No early-return on local results any more.
  //
  // Previous approach: return immediately when local DB returned ≥5 results.
  // Problem: when a user has many popular games with the same prefix already in
  // the local DB (e.g. 7 "Dune: …" games), external sources are never queried
  // and localized/less-popular titles like "Dune: Geheimnisse der Häuser" are
  // invisible — even though BGG would find them.
  //
  // New approach: all sources start at the same time. Local results (which
  // already have thumbnails) are shown first; external fills the remaining slots
  // up to TOTAL_LIMIT. Total latency = max(local_time, external_time) ≈
  // external_time either way, so there is no meaningful performance regression.
  const [localSettled, wikidataSettled, xmlSettled, scrapeSettled, ...geekdoSettledAll] =
    await Promise.allSettled([
      // ① Local games table (fast Supabase query, results have thumbnails)
      (async (): Promise<SearchResult[]> => {
        try {
          const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          const { data } = await admin
            .from("games")
            .select("bgg_id, name, thumbnail_url, year")
            .ilike("name", `%${q}%`)
            .not("bgg_id", "is", null)
            .order("name", { ascending: true })
            .limit(10);
          return (data ?? []).map((g) => ({
            bgg_id: g.bgg_id as number,
            name: g.name as string,
            thumbnail_url: (g.thumbnail_url as string | null) ?? null,
            year_published: (g.year as number | null) ?? null,
          }));
        } catch {
          return [];
        }
      })(),
      // ② Wikidata SPARQL (EN + DE labels)
      fetch(wikidataUrl, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "Accept": "application/sparql-results+json",
          "User-Agent": "MeepleBase/1.0 (https://meeple-base.vercel.app)",
        },
        next: { revalidate: 3600 },
      }),
      // ③ BGG XML search
      bggXmlSearch(q),
      // ④ BGG HTML scrape (geeksearch.php)
      bggSearchScrape(q),
      // ⑤ BGG geekdo autocomplete (+ stripped variant)
      ...bggGeekdoSearches,
    ]);

  // ── Local results (shown first — already have thumbnails) ─────────────────
  const localHits: SearchResult[] = localSettled.status === "fulfilled" ? localSettled.value : [];
  const seenIds = new Set<number>(localHits.map((g) => g.bgg_id));
  const TOTAL_LIMIT = 15;
  const slots = Math.max(0, TOTAL_LIMIT - localHits.length);

  if (slots === 0) {
    // Local already fills all slots — return immediately (fast path preserved
    // when user has ≥15 matching games in the local DB).
    return NextResponse.json({ results: localHits.slice(0, TOTAL_LIMIT), source: "local" });
  }

  // ── Parse Wikidata results ─────────────────────────────────────────────────
  // Deduplicate by bgg_id and prefer English label over German.
  // SPARQL JSON: language-tagged literals carry "xml:lang" on the binding object.
  let wikidataBase: { bgg_id: number; name: string }[] = [];
  if (wikidataSettled.status === "fulfilled" && wikidataSettled.value.ok) {
    try {
      const data = await wikidataSettled.value.json();
      type Binding = {
        itemLabel: { value: string; "xml:lang"?: string };
        bggId: { value: string };
      };
      const bindings: Binding[] = data.results?.bindings ?? [];

      // Prefer English label; accept German as fallback
      const byId = new Map<number, { name: string; isEn: boolean }>();
      for (const b of bindings) {
        const bggId = Number(b.bggId.value);
        if (!bggId) continue;
        const isEn = (b.itemLabel["xml:lang"] ?? "") === "en";
        const existing = byId.get(bggId);
        if (!existing || (!existing.isEn && isEn)) {
          byId.set(bggId, { name: b.itemLabel.value, isEn });
        }
      }
      wikidataBase = Array.from(byId.entries())
        .map(([bggId, { name }]) => ({ bgg_id: bggId, name }))
        .filter((r) => !seenIds.has(r.bgg_id));
    } catch { /* parse error → treat as empty */ }
  }

  // ── Parse BGG results ──────────────────────────────────────────────────────
  const xmlHits   = (xmlSettled.status    === "fulfilled" ? xmlSettled.value    : []).filter((g) => !seenIds.has(g.bgg_id));
  const scrapeHits = (scrapeSettled.status === "fulfilled" ? scrapeSettled.value : []).filter((g) => !seenIds.has(g.bgg_id));
  const rawGeekdoHits = geekdoSettledAll
    .flatMap((s) => (s.status === "fulfilled" ? s.value : []))
    .filter((g) => !seenIds.has(g.bgg_id));

  // Merge all BGG sources (XML first → scrape → geekdo), dedup
  const bggMergedSeen = new Set<number>(seenIds);
  const mergedBgg: { bgg_id: number; name: string; thumbnail_url: string | null }[] = [];
  for (const g of [...xmlHits, ...scrapeHits, ...rawGeekdoHits]) {
    if (!bggMergedSeen.has(g.bgg_id)) {
      bggMergedSeen.add(g.bgg_id);
      mergedBgg.push(g);
    }
  }

  // ── Build final result: local first, external fills remaining slots ─────────
  // Wikidata preferred (stable BGG IDs, curated data); BGG direct as fallback.

  if (wikidataBase.length > 0) {
    const wikiSlice = wikidataBase.slice(0, slots);
    const thumbnails = await Promise.all(wikiSlice.map((r) => fetchThumbnail(r.bgg_id)));
    return NextResponse.json({
      results: [
        ...localHits,
        ...wikiSlice.map((r, i) => ({ ...r, thumbnail_url: thumbnails[i] ?? null })),
      ].slice(0, TOTAL_LIMIT),
    });
  }

  if (mergedBgg.length > 0) {
    const bggSlice = mergedBgg.slice(0, slots);
    // Fetch thumbnails only for results that don't already have one (geekdo provides them)
    const enriched = await Promise.all(
      bggSlice.map(async (r) => {
        if (r.thumbnail_url) return r;
        const thumb = await fetchThumbnail(r.bgg_id);
        return { ...r, thumbnail_url: thumb };
      })
    );
    return NextResponse.json({
      results: [
        ...localHits,
        ...enriched,
      ].slice(0, TOTAL_LIMIT),
    });
  }

  // Only local results available
  return NextResponse.json({ results: localHits.slice(0, TOTAL_LIMIT) });
}
