import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function makeClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) =>
          c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

function makeAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── GET /api/plays/[id]/shared ────────────────────────────────────────────────
// Returns public play metadata for sharing/import.
// Requires the viewer to be authenticated (not truly public).

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const playId = params.id;

  // Fetch the play via admin (owner's RLS would block other users)
  const { data: play, error } = await admin
    .from("plays")
    .select(`
      id, user_id, game_id, played_at, location, duration_minutes, cooperative,
      game:games(id, name, thumbnail_url),
      players:play_players(display_name, score, winner, user_id)
    `)
    .eq("id", playId)
    .single();

  if (error || !play) {
    return NextResponse.json({ error: "Partie nicht gefunden" }, { status: 404 });
  }

  type RawGame = { id: string; name: string; thumbnail_url: string | null } | null;
  type RawPlayer = { display_name: string; score: number | null; winner: boolean; user_id: string | null };

  const game = (Array.isArray(play.game) ? play.game[0] : play.game) as RawGame;
  const players = (play.players as unknown as RawPlayer[]) ?? [];

  // Check if current user already has this exact play (same game, same date)
  const playedAtDay = play.played_at.slice(0, 10);
  const { count: existingCount } = await supabase
    .from("plays")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)
    .eq("game_id", play.game_id)
    .gte("played_at", `${playedAtDay}T00:00:00`)
    .lte("played_at", `${playedAtDay}T23:59:59`);

  return NextResponse.json({
    play: {
      id: play.id,
      game_id: play.game_id,
      played_at: play.played_at,
      location: play.location,
      duration_minutes: play.duration_minutes,
      cooperative: play.cooperative,
      game: game ? { id: game.id, name: game.name, thumbnail_url: game.thumbnail_url } : null,
      players: players.map((p) => ({
        display_name: p.display_name,
        score: p.score,
        winner: p.winner,
      })),
    },
    already_imported: (existingCount ?? 0) > 0,
  });
}

// ── POST /api/plays/[id]/shared ───────────────────────────────────────────────
// Import a shared play into the current user's account

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const playId = params.id;

  // Fetch the original play
  const { data: original, error } = await admin
    .from("plays")
    .select(`
      game_id, played_at, location, duration_minutes, cooperative,
      players:play_players(display_name, score, winner)
    `)
    .eq("id", playId)
    .single();

  if (error || !original) {
    return NextResponse.json({ error: "Partie nicht gefunden" }, { status: 404 });
  }

  type RawPlayer = { display_name: string; score: number | null; winner: boolean };
  const players = (original.players as unknown as RawPlayer[]) ?? [];

  // Duplicate check
  const playedAtDay = original.played_at.slice(0, 10);
  const { count: existingCount } = await supabase
    .from("plays")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)
    .eq("game_id", original.game_id)
    .gte("played_at", `${playedAtDay}T00:00:00`)
    .lte("played_at", `${playedAtDay}T23:59:59`);

  if ((existingCount ?? 0) > 0) {
    return NextResponse.json({ error: "Du hast diese Partie bereits eingetragen" }, { status: 409 });
  }

  // Create play for current user
  const { data: newPlay, error: playErr } = await supabase
    .from("plays")
    .insert({
      user_id: user.id,
      game_id: original.game_id,
      played_at: original.played_at,
      location: original.location,
      duration_minutes: original.duration_minutes,
      cooperative: original.cooperative,
    })
    .select("id")
    .single();

  if (playErr || !newPlay) {
    return NextResponse.json({ error: playErr?.message ?? "Fehler" }, { status: 500 });
  }

  // Copy play_players
  if (players.length > 0) {
    await supabase.from("play_players").insert(
      players.map((p) => ({
        play_id: newPlay.id,
        display_name: p.display_name,
        score: p.score,
        winner: p.winner,
      }))
    );
  }

  return NextResponse.json({ play_id: newPlay.id }, { status: 201 });
}
