import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/play-sessions/[id]/games
// Adds a game to an existing planned session (organizer only)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { game_id: string };
  const { game_id } = body;
  if (!game_id) return NextResponse.json({ error: "game_id fehlt" }, { status: 400 });

  // Verify the user is the organizer
  const { data: session } = await supabase
    .from("play_sessions")
    .select("created_by")
    .eq("id", params.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  if (session.created_by !== user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  // Check if game is already in session
  const { data: existing } = await supabase
    .from("play_session_games")
    .select("id")
    .eq("session_id", params.id)
    .eq("game_id", game_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Spiel bereits in der Session" }, { status: 409 });
  }

  const { error } = await supabase
    .from("play_session_games")
    .insert({ session_id: params.id, game_id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the game details for optimistic UI update
  const { data: game } = await supabase
    .from("games")
    .select("id, name, thumbnail_url")
    .eq("id", game_id)
    .single();

  return NextResponse.json({ game }, { status: 201 });
}
