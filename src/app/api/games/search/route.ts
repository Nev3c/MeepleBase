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

// BGG's internal geekdo endpoint behaves differently than the XML API:
// it's not blocked from Vercel IPs and returns autocomplete-style hits by name.
// Used as fallback when Wikidata has no match (e.g. niche or new releases not yet
// labelled in Wikidata).
async function bggNameFallback(q: string): Promise<{ bgg_id: number; name: string; thumbnail_url: string | null }[]> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekdo?search=${encodeURIComponent(q)}&objecttype=boardgame&nosession=1&showcount=15`,
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
      .slice(0, 15);
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

    // Fallback: if Wikidata has nothing, ask BGG directly by name (geekdo endpoint
    // works from Vercel IPs unlike the XML API). Catches games like "The Hunger"
    // where Wikidata has no English label or no P2339 BGG-ID statement.
    if (base.length === 0) {
      const bggHits = await bggNameFallback(q);
      if (bggHits.length > 0) {
        return NextResponse.json({ results: bggHits });
      }
    }

    // Fetch thumbnails in parallel for Wikidata hits
    const thumbnails = await Promise.all(base.map((r) => fetchThumbnail(r.bgg_id)));

    const results = base.map((r, i) => ({
      ...r,
      thumbnail_url: thumbnails[i] ?? null,
    }));

    return NextResponse.json({ results });
  } catch {
    // Last-resort fallback: try BGG by name if everything else explodes
    const bggHits = await bggNameFallback(q);
    return NextResponse.json({ results: bggHits });
  }
}
