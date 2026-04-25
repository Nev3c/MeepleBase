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

// ── POST /api/play-sessions/[id]/complete ─────────────────────────────────────
// Organizer completes a session: creates play entries for all accepted
// participants (including organizer) for every game in the session.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const sessionId = params.id;

  // Fetch session with games and invites
  type RawSession = {
    id: string;
    created_by: string;
    session_date: string;
    location: string | null;
    session_games: { game_id: string }[];
    invites: { invited_user_id: string; status: string }[];
  };

  const { data: session, error: sessionErr } = await admin
    .from("play_sessions")
    .select(`
      id, created_by, session_date, location,
      session_games:play_session_games(game_id),
      invites:play_session_invites(invited_user_id, status)
    `)
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  }

  const s = session as unknown as RawSession;

  // Only organizer can complete
  if (s.created_by !== user.id) {
    return NextResponse.json({ error: "Nur der Organisator kann abschließen" }, { status: 403 });
  }

  // Collect participant IDs: organizer + all accepted invitees
  const acceptedIds = s.invites
    .filter((i) => i.status === "accepted")
    .map((i) => i.invited_user_id);
  const participantIds = [user.id, ...acceptedIds];

  // Fetch profiles for display names
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", participantIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { display_name: (p.display_name as string | null) ?? (p.username as string) ?? "Spieler" },
    ])
  );

  const gameIds = s.session_games.map((sg) => sg.game_id);

  if (gameIds.length === 0) {
    // No games in session — just mark as completed
    await admin.from("play_sessions").update({ status: "completed" }).eq("id", sessionId);
    return NextResponse.json({ ok: true, plays_created: 0 });
  }

  // Build play insert rows: one per participant per game
  const playsToInsert = participantIds.flatMap((participantId) =>
    gameIds.map((gameId) => ({
      user_id: participantId,
      game_id: gameId,
      played_at: s.session_date,
      location: s.location,
      cooperative: false,
    }))
  );

  const { data: createdPlays, error: playsErr } = await admin
    .from("plays")
    .insert(playsToInsert)
    .select("id, user_id, game_id");

  if (playsErr) {
    return NextResponse.json({ error: playsErr.message }, { status: 500 });
  }

  // Build play_players: for each created play, add all participants
  const playPlayersToInsert = (createdPlays ?? []).flatMap((play) =>
    participantIds.map((participantId) => ({
      play_id: play.id,
      user_id: participantId,
      display_name: profileMap.get(participantId)?.display_name ?? "Spieler",
      score: null,
      winner: false,
    }))
  );

  if (playPlayersToInsert.length > 0) {
    const { error: ppErr } = await admin.from("play_players").insert(playPlayersToInsert);
    if (ppErr) console.error("play_players insert error:", ppErr.message);
  }

  // Mark session as completed
  await admin.from("play_sessions").update({ status: "completed" }).eq("id", sessionId);

  return NextResponse.json({ ok: true, plays_created: playsToInsert.length });
}
