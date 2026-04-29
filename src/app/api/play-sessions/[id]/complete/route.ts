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
// Skips plays that already exist (e.g. recorded via "Scores & Fotos erfassen")
// to prevent duplicates in the Vergangen list.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const sessionId = params.id;

  // Fetch session with games, invites, and status
  type RawSession = {
    id: string;
    created_by: string;
    session_date: string;
    location: string | null;
    status: string;
    session_games: { game_id: string }[];
    invites: { invited_user_id: string; status: string }[];
  };

  const { data: session, error: sessionErr } = await admin
    .from("play_sessions")
    .select(`
      id, created_by, session_date, location, status,
      session_games:play_session_games(game_id),
      invites:play_session_invites(invited_user_id, status)
    `)
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  }

  const s = session as unknown as RawSession;

  // Guard: already completed — don't create duplicate plays
  if (s.status === "completed") {
    return NextResponse.json({ error: "Session wurde bereits abgeschlossen" }, { status: 409 });
  }

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

  // Check for already-existing plays (same user + game + calendar date) to skip duplicates.
  // This prevents double entries when "Scores & Fotos erfassen" was used before completing.
  //
  // IMPORTANT: session_date is timestamptz (e.g. "2026-04-30T19:00:00+00:00"), but plays
  // created via POST /api/plays use only the date portion (e.g. "2026-04-30"), stored at
  // midnight UTC. A strict .eq() would never match. Use a date-range query instead.
  const sessionDateOnly = s.session_date.slice(0, 10); // "YYYY-MM-DD"
  const nextDayDate = new Date(sessionDateOnly + "T00:00:00.000Z");
  nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
  const nextDayStr = nextDayDate.toISOString().slice(0, 10); // "YYYY-MM-DD" of next day

  const { data: existingPlays } = await admin
    .from("plays")
    .select("id, user_id, game_id, incomplete")
    .in("user_id", participantIds)
    .in("game_id", gameIds)
    .gte("played_at", sessionDateOnly)
    .lt("played_at", nextDayStr);

  // Separate existing plays into:
  // - drafts (incomplete=true): created by "Scores & Fotos erfassen" → UPDATE to complete
  // - complete (incomplete=false): already finalised → skip
  const incompleteMap = new Map<string, string>(); // "userId:gameId" → play.id
  const completeSet = new Set<string>();            // "userId:gameId" → already done

  for (const p of existingPlays ?? []) {
    const key = `${p.user_id}:${p.game_id}`;
    if (p.incomplete) {
      incompleteMap.set(key, p.id);
    } else {
      completeSet.add(key);
    }
  }

  // 1. Promote draft plays → complete (these already have play_players from scoring)
  const idsToPromote = Array.from(incompleteMap.values());
  if (idsToPromote.length > 0) {
    const { error: promoteErr } = await admin
      .from("plays")
      .update({ incomplete: false })
      .in("id", idsToPromote);
    if (promoteErr) console.error("promote incomplete plays error:", promoteErr.message);
  }

  // 2. INSERT new plays only for participants who have NO play at all for this game/date
  const playsToInsert = participantIds.flatMap((participantId) =>
    gameIds
      .filter((gameId) => {
        const key = `${participantId}:${gameId}`;
        return !incompleteMap.has(key) && !completeSet.has(key);
      })
      .map((gameId) => ({
        user_id: participantId,
        game_id: gameId,
        played_at: s.session_date,
        location: s.location,
        cooperative: false,
        incomplete: false,
      }))
  );

  let createdPlays: { id: string; user_id: string; game_id: string }[] = [];

  if (playsToInsert.length > 0) {
    const { data, error: playsErr } = await admin
      .from("plays")
      .insert(playsToInsert)
      .select("id, user_id, game_id");

    if (playsErr) {
      return NextResponse.json({ error: playsErr.message }, { status: 500 });
    }

    createdPlays = data ?? [];
  }

  // Build play_players only for newly inserted plays (promoted ones already have players)
  const playPlayersToInsert = createdPlays.flatMap((play) =>
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

  return NextResponse.json({ ok: true, plays_created: playsToInsert.length, plays_promoted: idsToPromote.length });
}
