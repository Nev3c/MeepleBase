import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CsvGame {
  bgg_id: number;
  name: string;
  year_published: number | null;
  status: string;
}

interface GeekItemLink { name: string }

async function enrichGame(bggId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      {
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Referer": "https://boardgamegeek.com/",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.item;
    if (!item) return null;
    const links = item.links ?? {};
    const names = (arr: GeekItemLink[] | undefined) => (arr ?? []).map((l) => l.name).filter(Boolean);
    return {
      min_players: item.minplayers ? Number(item.minplayers) : null,
      max_players: item.maxplayers ? Number(item.maxplayers) : null,
      min_playtime: item.minplaytime ? Number(item.minplaytime) : null,
      max_playtime: item.maxplaytime ? Number(item.maxplaytime) : null,
      thumbnail_url: item.imageurl ?? null,
      image_url: item.topimageurl ?? null,
      description: item.short_description ?? null,
      categories: names(links.boardgamecategory).length ? names(links.boardgamecategory) : null,
      mechanics: names(links.boardgamemechanic).length ? names(links.boardgamemechanic) : null,
      designers: names(links.boardgamedesigner).length ? names(links.boardgamedesigner) : null,
      publishers: names(links.boardgamepublisher).length ? names(links.boardgamepublisher) : null,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  let games: CsvGame[];
  try {
    const body = await request.json();
    games = body.games;
    if (!Array.isArray(games) || games.length === 0) {
      return NextResponse.json({ error: "Keine Spiele in der CSV gefunden." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  const BATCH = 5;

  for (let i = 0; i < games.length; i += BATCH) {
    const batch = games.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (csvGame) => {
        if (!csvGame.bgg_id) return;

        // Base data from CSV (always available)
        let gameData: Record<string, unknown> = {
          bgg_id: csvGame.bgg_id,
          name: csvGame.name,
          year_published: csvGame.year_published,
          last_synced_at: new Date().toISOString(),
        };

        // Try to enrich with geekitems (works from Vercel)
        const details = await enrichGame(csvGame.bgg_id);
        if (details) {
          gameData = { ...gameData, ...details, bgg_id: csvGame.bgg_id, last_synced_at: new Date().toISOString() };
        }

        // Check if this game already has a user override — if so, don't overwrite name/description
        const { data: existingGame } = await supabase
          .from("games")
          .select("id")
          .eq("bgg_id", csvGame.bgg_id)
          .single();

        const { data: hasOverride } = existingGame
          ? await supabase
              .from("user_games")
              .select("id")
              .eq("game_id", existingGame.id)
              .eq("user_id", user.id)
              .not("custom_fields", "is", null)
              .single()
          : { data: null };

        if (hasOverride) {
          // Only update non-text fields (players, time, thumbnail) — never overwrite user edits
          const safeData: Record<string, unknown> = {
            bgg_id: csvGame.bgg_id,
            last_synced_at: new Date().toISOString(),
            ...(gameData.min_players != null ? { min_players: gameData.min_players } : {}),
            ...(gameData.max_players != null ? { max_players: gameData.max_players } : {}),
            ...(gameData.min_playtime != null ? { min_playtime: gameData.min_playtime } : {}),
            ...(gameData.max_playtime != null ? { max_playtime: gameData.max_playtime } : {}),
            ...(gameData.thumbnail_url != null ? { thumbnail_url: gameData.thumbnail_url } : {}),
            ...(gameData.image_url != null ? { image_url: gameData.image_url } : {}),
          };
          await supabase.from("games").upsert(safeData, { onConflict: "bgg_id" });
          skipped++;
          return;
        }

        const { data: game, error: gameErr } = await supabase
          .from("games")
          .upsert(gameData, { onConflict: "bgg_id" })
          .select("id")
          .single();

        if (gameErr || !game) return;

        const { error: ugErr } = await supabase
          .from("user_games")
          .insert({ user_id: user.id, game_id: game.id, status: csvGame.status })
          .select("id")
          .single();

        if (!ugErr) imported++;
        else skipped++; // already in library
      })
    );

    if (i + BATCH < games.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return NextResponse.json({ imported, skipped, total: games.length });
}
