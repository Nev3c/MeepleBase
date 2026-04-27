import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { parseBestPlayers } from "@/lib/bgg-utils";

const GEEKITEMS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://boardgamegeek.com/",
};

interface LinkItem { name: string }

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) =>
          c.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  // Admin client for games table (protected by RLS — needs service_role)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const bggId = Number(body.bgg_id);
  const status = body.status ?? "owned";

  if (!bggId) {
    return NextResponse.json({ error: "bgg_id fehlt" }, { status: 400 });
  }

  // ── 1. Spieldetails via geekitems holen ───────────────────────────────────
  // Fallback: use name + thumbnail from the client's search result so the game
  // always has at least a cover image even if the geekitems fetch fails.
  const clientThumbnail: string | null = body.thumbnail_url ?? null;

  let upsertData: Record<string, unknown> = {
    bgg_id: bggId,
    name: body.name ?? `BGG #${bggId}`,
    // Use the thumbnail passed from the search result as a safe fallback.
    // Both fields are set so the game detail hero already shows something.
    thumbnail_url: clientThumbnail,
    image_url: clientThumbnail,
    last_synced_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(10000), cache: "no-store", headers: GEEKITEMS_HEADERS }
    );

    if (res.ok) {
      const data = await res.json();
      const item = data?.item;
      if (item) {
        const links = item.links ?? {};
        const getNames = (arr: LinkItem[] | undefined) =>
          (arr ?? []).map((l) => l.name).filter(Boolean);

        // Complexity: geekitems sometimes has stats.avgweight (less common than XML API
        // but available in geekitems responses for many games).
        const stats = item.stats as Record<string, unknown> | undefined;
        const rawWeight = stats?.avgweight ?? stats?.averageweight ?? null;
        const complexity = rawWeight && !isNaN(parseFloat(String(rawWeight))) && parseFloat(String(rawWeight)) > 0
          ? parseFloat(String(rawWeight))
          : null;

        // Best-players poll (from geekitems community poll — same poll data as XML API).
        const bestPlayers = parseBestPlayers(item.polls);

        // Hero image: topimageurl is the large/official cover art; fall back to imageurl
        // (the smaller thumbnail) so image_url is never null when any image is available.
        const thumbnailUrl: string | null = (item.imageurl as string | null) ?? clientThumbnail;
        const imageUrl: string | null = (item.topimageurl as string | null) ?? thumbnailUrl;

        upsertData = {
          bgg_id: bggId,
          name: item.name ?? (item.primaryname as Record<string, unknown> | undefined)?.name ?? upsertData.name,
          year_published: item.yearpublished ? Number(item.yearpublished) : null,
          min_players: item.minplayers ? Number(item.minplayers) : null,
          max_players: item.maxplayers ? Number(item.maxplayers) : null,
          min_playtime: item.minplaytime ? Number(item.minplaytime) : null,
          max_playtime: item.maxplaytime ? Number(item.maxplaytime) : null,
          thumbnail_url: thumbnailUrl,
          image_url: imageUrl,
          description: item.short_description ?? null,
          categories: getNames(links.boardgamecategory as LinkItem[] | undefined).length
            ? getNames(links.boardgamecategory as LinkItem[] | undefined)
            : null,
          mechanics: getNames(links.boardgamemechanic as LinkItem[] | undefined).length
            ? getNames(links.boardgamemechanic as LinkItem[] | undefined)
            : null,
          designers: getNames(links.boardgamedesigner as LinkItem[] | undefined).length
            ? getNames(links.boardgamedesigner as LinkItem[] | undefined)
            : null,
          publishers: getNames(links.boardgamepublisher as LinkItem[] | undefined).length
            ? getNames(links.boardgamepublisher as LinkItem[] | undefined)
            : null,
          ...(complexity !== null ? { complexity } : {}),
          ...(bestPlayers !== null ? { best_players: bestPlayers } : {}),
          last_synced_at: new Date().toISOString(),
        };
      }
    }
  } catch (e) {
    console.error("[games/add] BGG fetch failed, continuing with client fallback data:", e);
  }

  // ── 2. Spiel in games-Tabelle upserten (admin — RLS bypassed) ────────────
  const { data: game, error: gameError } = await admin
    .from("games")
    .upsert(upsertData, { onConflict: "bgg_id" })
    .select()
    .single();

  if (gameError || !game) {
    return NextResponse.json(
      { error: "Spiel konnte nicht gespeichert werden", detail: gameError?.message },
      { status: 500 }
    );
  }

  // ── 3. user_games-Eintrag anlegen ─────────────────────────────────────────
  const { data: userGame, error: ugError } = await supabase
    .from("user_games")
    .insert({ user_id: user.id, game_id: game.id, status })
    .select("*, game:games(*)")
    .single();

  if (ugError) {
    if (ugError.code === "23505") {
      return NextResponse.json({ error: "already_in_library" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Bibliothekseintrag fehlgeschlagen", detail: ugError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ userGame });
}
