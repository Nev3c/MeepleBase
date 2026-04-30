import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/playlist — return current user's playlist (ordered by rank)
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data, error } = await supabase
    .from("game_playlist")
    .select(`
      id, user_id, game_id, rank, created_at,
      game:games(id, name, thumbnail_url, min_players, max_players, min_playtime, max_playtime)
    `)
    .eq("user_id", user.id)
    .order("rank", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

// POST /api/playlist — add a game to the playlist
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { game_id: string };
  const { game_id } = body;
  if (!game_id) return NextResponse.json({ error: "game_id fehlt" }, { status: 400 });

  // Count existing entries
  const { count } = await supabase
    .from("game_playlist")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: "Playlist voll (max. 10 Spiele)" }, { status: 400 });
  }

  // Check if already in playlist
  const { data: existing } = await supabase
    .from("game_playlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_id", game_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Spiel bereits in der Playlist" }, { status: 409 });
  }

  const newRank = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("game_playlist")
    .insert({ user_id: user.id, game_id, rank: newRank })
    .select(`
      id, user_id, game_id, rank, created_at,
      game:games(id, name, thumbnail_url, min_players, max_players, min_playtime, max_playtime)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data }, { status: 201 });
}
