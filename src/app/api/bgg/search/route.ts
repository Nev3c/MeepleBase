import { NextRequest, NextResponse } from "next/server";

interface GeekdoItem {
  id: number;
  objectid: number;
  name: string;
  yearpublished?: number;
  thumbnailhref?: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = `https://api.geekdo.com/api/geekdo_v2/search?q=${encodeURIComponent(q.trim())}&nosession=1&objecttype=boardgame&start=0&count=30&fuzzy_hit=1`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://boardgamegeek.com/",
        "Origin": "https://boardgamegeek.com",
      },
    });

    if (!res.ok) {
      console.error("[BGG search] geekdo status:", res.status);
      return NextResponse.json({ results: [], error: "BGG nicht erreichbar", debug: `HTTP ${res.status}` });
    }

    const data = await res.json();
    const items: GeekdoItem[] = data?.items ?? [];

    const results = items.map((item) => ({
      bgg_id: item.objectid ?? item.id,
      name: item.name,
      year_published: item.yearpublished ?? null,
      thumbnail_url: item.thumbnailhref
        ? `https:${item.thumbnailhref}`
        : null,
    }));

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[BGG search error]", msg);
    return NextResponse.json({ results: [], error: "Timeout oder Netzwerkfehler", debug: msg });
  }
}
