import { NextRequest, NextResponse } from "next/server";

// Wikidata SPARQL endpoint — public, no auth, CORS-open
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

// Board game type in Wikidata: Q131436
function buildQuery(q: string): string {
  const escaped = q.toLowerCase().replace(/"/g, '\\"');
  return `
SELECT DISTINCT ?itemLabel ?bggId WHERE {
  ?item wdt:P31 wd:Q131436 ;
        wdt:P2339 ?bggId .
  ?item rdfs:label ?itemLabel .
  FILTER(CONTAINS(LCASE(?itemLabel), "${escaped}"))
  FILTER(LANG(?itemLabel) = "en")
}
LIMIT 15
`.trim();
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

    const results = bindings
      .map((b) => ({
        bgg_id: Number(b.bggId.value),
        name: b.itemLabel.value,
      }))
      .filter((r) => r.bgg_id > 0);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "fetch_failed" });
  }
}
