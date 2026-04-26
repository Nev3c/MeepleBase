import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(buildQuery(q))}`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/sparql-results+json",
        "User-Agent": "MeepleBase/1.0 (https://meeple-base.vercel.app)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [], error: "wikidata_unavailable" });
    }

    const data = await res.json();
    const bindings: Array<{ itemLabel: { value: string }; bggId: { value: string } }> =
      data.results?.bindings ?? [];

    const base = bindings
      .map((b) => ({ bgg_id: Number(b.bggId.value), name: b.itemLabel.value }))
      .filter((r) => r.bgg_id > 0);

    // Fetch thumbnails in parallel
    const thumbnails = await Promise.all(base.map((r) => fetchThumbnail(r.bgg_id)));

    const results = base.map((r, i) => ({
      ...r,
      thumbnail_url: thumbnails[i] ?? null,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "fetch_failed" });
  }
}
