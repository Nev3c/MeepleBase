import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// POST /api/games/ensure
// Body: { bgg_id: number }
// Ensures a game with the given bgg_id exists in the `games` table.
// If it doesn't exist, fetches it from BGG and inserts it (without adding to user_games).
// Returns: { game_id: string }

const GEEKITEMS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
  "Referer": "https://boardgamegeek.com/",
};

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { bgg_id: number };
  if (!body.bgg_id) return NextResponse.json({ error: "bgg_id erforderlich" }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if game already exists
  const { data: existing } = await admin
    .from("games")
    .select("id")
    .eq("bgg_id", body.bgg_id)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json({ game_id: existing.id });
  }

  // Fetch from BGG geekitems
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${body.bgg_id}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(8000), cache: "no-store", headers: GEEKITEMS_HEADERS }
    );
    if (!res.ok) return NextResponse.json({ error: "BGG nicht erreichbar" }, { status: 502 });

    const data = await res.json() as Record<string, unknown>;
    const item = data?.item as Record<string, unknown> | undefined;
    if (!item) return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });

    const name = String((item.primaryname as Record<string, unknown>)?.name ?? "Unbekannt");
    const year = Number((item as Record<string, unknown>).yearpublished ?? 0) || null;
    const minPlayers = Number((item as Record<string, unknown>).minplayers ?? 1) || null;
    const maxPlayers = Number((item as Record<string, unknown>).maxplayers ?? 1) || null;
    const minPlaytime = Number((item as Record<string, unknown>).minplaytime ?? 0) || null;
    const maxPlaytime = Number((item as Record<string, unknown>).maxplaytime ?? 0) || null;

    interface ImageItem { url?: string }
    const images = item.images as Record<string, unknown> | undefined;
    const thumbnail_url = (images?.thumb as ImageItem)?.url ?? null;
    const image_url = (images?.original as ImageItem)?.url ?? thumbnail_url;

    const description = String((item as Record<string, unknown>).description ?? "").trim() || null;

    interface LinkItem { name: string }
    const links = item.links as Record<string, unknown> | undefined;
    const categories = ((links?.boardgamecategory as LinkItem[] | undefined) ?? []).map((l) => l.name);
    const mechanics = ((links?.boardgamemechanic as LinkItem[] | undefined) ?? []).map((l) => l.name);

    const { data: inserted, error: insertErr } = await admin
      .from("games")
      .upsert({
        bgg_id: body.bgg_id,
        name,
        year,
        min_players: minPlayers,
        max_players: maxPlayers,
        min_playtime: minPlaytime,
        max_playtime: maxPlaytime,
        thumbnail_url,
        image_url,
        description,
        categories,
        mechanics,
      }, { onConflict: "bgg_id" })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
    }

    return NextResponse.json({ game_id: inserted.id });
  } catch {
    return NextResponse.json({ error: "Fehler beim BGG-Abruf" }, { status: 502 });
  }
}
