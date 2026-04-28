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

// BGG's internal geekdo endpoint: autocomplete-style hits by name.
async function bggNameFallback(q: string): Promise<{ bgg_id: number; name: string; thumbnail_url: string | null }[]> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekdo?search=${encodeURIComponent(q)}&objecttype=boardgame&nosession=1&showcount=50`,
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
      .slice(0, 30);
  } catch {
    return [];
  }
}

// BGG geeksearch.php HTML scrape — the classic PHP search page, not blocked from Vercel.
// Accepts an optional page number (pageid) to fetch further result pages.
// Each page contains up to 25 results; fetching pages 1+2 gives coverage of ~50 results.
async function bggSearchScrape(q: string, page = 1): Promise<{ bgg_id: number; name: string; thumbnail_url: string | null }[]> {
  try {
    const url = `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(q)}${page > 1 ? `&pageid=${page}` : ""}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://boardgamegeek.com/",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const html = await res.text();
    if (!html.includes("/boardgame/")) return [];

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
    return results.slice(0, 30); // up to 30 per page
  } catch {
    return [];
  }
}

// BGG XML API v2 full-text search. May return 401 from Vercel IPs; handled gracefully.
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

    const results: { bgg_id: number; name: string; thumbnail_url: null }[] = [];
    const itemRe = /<item\s+type="boardgame"\s+id="(\d+)">([\s\S]*?)<\/item>/g;
    const nameRe = /<name\s+type="primary"\s+sortindex="\d+"\s+value="([^"]*)"\s*\/>/;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null) {
      const bgg_id = Number(m[1]);
      const nameMatch = nameRe.exec(m[2]);
      if (bgg_id > 0 && nameMatch) {
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

type Hit = { bgg_id: number; name: string; thumbnail_url: string | null };
type LocalHit = Hit & { year_published?: number | null };

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const strippedQ = stripLeadingArticle(q);
  const wikidataUrl = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(buildQuery(q))}`;

  const bggGeekdoSearches: Promise<Hit[]>[] = [bggNameFallback(q)];
  if (strippedQ) bggGeekdoSearches.push(bggNameFallback(strippedQ));

  // ── All sources run in parallel ────────────────────────────────────────────
  //
  // Key design decisions:
  //
  // 1. No early-return on local results. Previously we returned when ≥5 local
  //    results were found — this caused "Dune: Geheimnisse der Häuser" to be
  //    invisible because 7 popular Dune games were already in the local DB.
  //
  // 2. Both Wikidata AND BGG results are always merged. Previously the code
  //    returned Wikidata OR BGG (exclusive): if Wikidata had even 1 result not
  //    in local, BGG was skipped entirely — so a game absent from Wikidata
  //    but present in BGG's search would never appear.
  //
  // 3. BGG geeksearch page 1 + page 2 are fetched in parallel, giving ~50
  //    results coverage instead of 25.
  const [
    localSettled,
    wikidataSettled,
    xmlSettled,
    scrape1Settled,
    scrape2Settled,
    ...geekdoSettledAll
  ] = await Promise.allSettled([
    // ① Local games table (fast, has thumbnails)
    (async (): Promise<LocalHit[]> => {
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
    // ③ BGG XML search (may 401 from Vercel)
    bggXmlSearch(q),
    // ④ BGG geeksearch.php page 1
    bggSearchScrape(q, 1),
    // ⑤ BGG geeksearch.php page 2 (doubles coverage to ~50 results)
    bggSearchScrape(q, 2),
    // ⑥ BGG geekdo autocomplete (+ stripped variant)
    ...bggGeekdoSearches,
  ]);

  // ── Local results (shown first — already have thumbnails) ─────────────────
  const localHits: LocalHit[] = localSettled.status === "fulfilled" ? localSettled.value : [];
  const seenIds = new Set<number>(localHits.map((g) => g.bgg_id));
  const TOTAL_LIMIT = 15;
  const slots = Math.max(0, TOTAL_LIMIT - localHits.length);

  if (slots === 0) {
    return NextResponse.json({ results: localHits.slice(0, TOTAL_LIMIT), source: "local" });
  }

  // ── Parse Wikidata (EN + DE, dedup by bgg_id, prefer EN label) ────────────
  // SPARQL JSON: language-tagged literals carry "xml:lang" on the binding.
  let wikidataHits: Hit[] = [];
  if (wikidataSettled.status === "fulfilled" && wikidataSettled.value.ok) {
    try {
      const data = await wikidataSettled.value.json();
      type Binding = {
        itemLabel: { value: string; "xml:lang"?: string };
        bggId: { value: string };
      };
      const bindings: Binding[] = data.results?.bindings ?? [];
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
      wikidataHits = Array.from(byId.entries())
        .map(([bggId, { name }]) => ({ bgg_id: bggId, name, thumbnail_url: null as string | null }))
        .filter((r) => !seenIds.has(r.bgg_id));
    } catch { /* parse error → treat as empty */ }
  }

  // ── Parse BGG results — merge XML + scrape pages 1+2 + geekdo ────────────
  const xmlHits    = (xmlSettled.status     === "fulfilled" ? xmlSettled.value     : []).filter((g) => !seenIds.has(g.bgg_id));
  const scrape1    = (scrape1Settled.status === "fulfilled" ? scrape1Settled.value : []).filter((g) => !seenIds.has(g.bgg_id));
  const scrape2    = (scrape2Settled.status === "fulfilled" ? scrape2Settled.value : []).filter((g) => !seenIds.has(g.bgg_id));
  const geekdoHits = geekdoSettledAll
    .flatMap((s) => (s.status === "fulfilled" ? s.value : []))
    .filter((g) => !seenIds.has(g.bgg_id));

  // Deduplicate all BGG sources (XML first → scrape p1 → scrape p2 → geekdo)
  const bggSeen = new Set<number>(seenIds);
  const bggHits: Hit[] = [];
  for (const g of [...xmlHits, ...scrape1, ...scrape2, ...geekdoHits]) {
    if (!bggSeen.has(g.bgg_id)) {
      bggSeen.add(g.bgg_id);
      bggHits.push(g);
    }
  }

  // ── Merge Wikidata + BGG — ALWAYS use both, never exclusive ───────────────
  // Previous bug: `if (wikidata) return wikidata; else if (bgg) return bgg` —
  // if Wikidata had 1 result, BGG was skipped. Now both are always combined.
  // Wikidata results come first (curated, stable BGG IDs); BGG fills the rest.
  const externalSeen = new Set<number>(seenIds);
  const allExternal: Hit[] = [];
  for (const g of [...wikidataHits, ...bggHits]) {
    if (!externalSeen.has(g.bgg_id)) {
      externalSeen.add(g.bgg_id);
      allExternal.push(g);
    }
  }

  if (allExternal.length === 0) {
    return NextResponse.json({ results: localHits.slice(0, TOTAL_LIMIT) });
  }

  // Fetch thumbnails for external results that don't have one (scrape/Wikidata)
  const externalSlice = allExternal.slice(0, slots);
  const enriched = await Promise.all(
    externalSlice.map(async (r) => {
      if (r.thumbnail_url) return r;
      const thumb = await fetchThumbnail(r.bgg_id);
      return { ...r, thumbnail_url: thumb };
    })
  );

  return NextResponse.json({
    results: ([...localHits, ...enriched] as (Hit & { year_published?: number | null })[]).slice(0, TOTAL_LIMIT),
  });
}
