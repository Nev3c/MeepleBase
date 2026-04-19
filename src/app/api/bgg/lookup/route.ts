import { NextRequest, NextResponse } from "next/server";

const GEEKITEMS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://boardgamegeek.com/",
};

interface LinkItem { name: string }

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "Ungültige BGG-ID" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${id}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(8000), cache: "no-store", headers: GEEKITEMS_HEADERS }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });
    }

    const data = await res.json();
    const item = data?.item;
    if (!item) {
      return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });
    }

    const links = item.links ?? {};
    const getNames = (arr: LinkItem[] | undefined) =>
      (arr ?? []).map((l) => l.name).filter(Boolean);

    const stats = item.stats as Record<string, unknown> | undefined;
    const rawWeight = stats?.avgweight ?? stats?.averageweight ?? stats?.average_weight ?? null;
    const complexity = rawWeight ? parseFloat(String(rawWeight)) : null;

    return NextResponse.json({
      bgg_id: Number(item.objectid),
      name: item.name ?? item.primaryname?.name ?? `BGG #${id}`,
      year_published: item.yearpublished ? Number(item.yearpublished) : null,
      min_players: item.minplayers ? Number(item.minplayers) : null,
      max_players: item.maxplayers ? Number(item.maxplayers) : null,
      min_playtime: item.minplaytime ? Number(item.minplaytime) : null,
      max_playtime: item.maxplaytime ? Number(item.maxplaytime) : null,
      complexity: complexity && !isNaN(complexity) ? complexity : null,
      thumbnail_url: item.imageurl ?? null,
      image_url: item.imageurl ?? null,
      description: item.short_description ?? null,
      categories: getNames(links.boardgamecategory),
      mechanics: getNames(links.boardgamemechanic),
      designers: getNames(links.boardgamedesigner),
      publishers: getNames(links.boardgamepublisher),
    });
  } catch (e) {
    console.error("[BGG lookup]", e);
    return NextResponse.json({ error: "Netzwerkfehler" }, { status: 500 });
  }
}
