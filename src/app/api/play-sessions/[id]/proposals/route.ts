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

// ── GET /api/play-sessions/[id]/proposals ────────────────────────────────────
// Returns all proposals for a session with game details

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data, error } = await supabase
    .from("play_session_proposals")
    .select("*, game:games(id, name, thumbnail_url, min_playtime, max_playtime)")
    .eq("session_id", params.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ proposals: data ?? [] });
}

// ── POST /api/play-sessions/[id]/proposals ───────────────────────────────────
// Adds a game proposal to a session
// vote_organizer: only organizer can propose; vote_free: any participant can

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { game_id: string };
  if (!body.game_id) return NextResponse.json({ error: "game_id fehlt" }, { status: 400 });

  // Load session to check mode + organizer + duration
  const { data: session } = await admin
    .from("play_sessions")
    .select("id, created_by, game_selection_mode, voting_closed, planned_duration_minutes")
    .eq("id", params.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  if (session.voting_closed) return NextResponse.json({ error: "Abstimmung bereits geschlossen" }, { status: 400 });

  // Mode check: vote_organizer → only organizer can add proposals
  if (session.game_selection_mode === "vote_organizer" && session.created_by !== user.id) {
    return NextResponse.json({ error: "Nur der Organisator kann Vorschläge hinzufügen" }, { status: 403 });
  }

  // vote_free → check participant (organizer or accepted invitee)
  if (session.game_selection_mode === "vote_free") {
    const isOrganizer = session.created_by === user.id;
    if (!isOrganizer) {
      const { data: invite } = await supabase
        .from("play_session_invites")
        .select("status")
        .eq("session_id", params.id)
        .eq("invited_user_id", user.id)
        .single();
      if (!invite) return NextResponse.json({ error: "Nicht Teilnehmer dieser Session" }, { status: 403 });
    }

    // vote_free: check game fits session duration
    if (session.planned_duration_minutes) {
      const { data: game } = await admin
        .from("games")
        .select("min_playtime")
        .eq("id", body.game_id)
        .single();
      if (game?.min_playtime && game.min_playtime > session.planned_duration_minutes) {
        return NextResponse.json({ error: "Spiel überschreitet geplante Spielzeit" }, { status: 400 });
      }
    }
  }

  const { data, error } = await admin
    .from("play_session_proposals")
    .insert({ session_id: params.id, game_id: body.game_id, proposed_by: user.id })
    .select("*, game:games(id, name, thumbnail_url, min_playtime, max_playtime)")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Spiel bereits vorgeschlagen" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proposal: data }, { status: 201 });
}

// ── DELETE /api/play-sessions/[id]/proposals?game_id=... ─────────────────────
// Removes a proposal — organizer can remove any; proposer can remove their own

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const gameId = new URL(req.url).searchParams.get("game_id");
  if (!gameId) return NextResponse.json({ error: "game_id fehlt" }, { status: 400 });

  const { data: session } = await admin
    .from("play_sessions")
    .select("created_by, voting_closed")
    .eq("id", params.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  if (session.voting_closed) return NextResponse.json({ error: "Abstimmung bereits geschlossen" }, { status: 400 });

  const { data: proposal } = await admin
    .from("play_session_proposals")
    .select("proposed_by")
    .eq("session_id", params.id)
    .eq("game_id", gameId)
    .single();

  if (!proposal) return NextResponse.json({ error: "Vorschlag nicht gefunden" }, { status: 404 });

  const isOrganizer = session.created_by === user.id;
  const isProposer = proposal.proposed_by === user.id;
  if (!isOrganizer && !isProposer) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  await admin
    .from("play_session_proposals")
    .delete()
    .eq("session_id", params.id)
    .eq("game_id", gameId);

  return NextResponse.json({ ok: true });
}
