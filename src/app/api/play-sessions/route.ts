import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { PlannedSession, InviteStatus, PlaySessionStatus, GameSelectionMode } from "@/types";
import { sendPushToUser } from "@/lib/push";

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

// ── GET /api/play-sessions ────────────────────────────────────────────────────
// Returns planned/confirmed sessions where user is organizer OR accepted/invited

export async function GET() {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // Fetch sessions visible to user (RLS handles organizer + invitee filter)
  const { data: sessions, error } = await supabase
    .from("play_sessions")
    .select(`
      id, title, session_date, location, notes, status, created_by,
      game_selection_mode, voting_closed, planned_duration_minutes,
      session_games:play_session_games(
        game:games(id, name, thumbnail_url, min_playtime, max_playtime)
      ),
      invites:play_session_invites(invited_user_id, status)
    `)
    .in("status", ["planned", "confirmed"])
    .order("session_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Collect all user IDs we need profiles for
  const userIds = new Set<string>();
  for (const s of sessions ?? []) {
    if (s.created_by !== user.id) userIds.add(s.created_by);
    for (const inv of (s.invites as { invited_user_id: string; status: string }[]) ?? []) {
      userIds.add(inv.invited_user_id);
    }
  }

  // Fetch profiles via admin (bypasses RLS)
  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
  if (userIds.size > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", Array.from(userIds));
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
    }
  }

  // Build PlannedSession objects
  const result: PlannedSession[] = (sessions ?? []).map((s) => {
    const invites = (s.invites as { invited_user_id: string; status: string }[]) ?? [];
    const myInvite = invites.find((i) => i.invited_user_id === user.id);

    type RawSG = { game: { id: string; name: string; thumbnail_url: string | null } };
    const rawGames = (s.session_games as unknown as RawSG[]) ?? [];
    const games = rawGames.map((sg) => sg.game);

    const invitees = invites.map((inv) => {
      const p = profileMap.get(inv.invited_user_id);
      return {
        user_id: inv.invited_user_id,
        username: p?.username ?? "?",
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        status: inv.status as InviteStatus,
      };
    });

    return {
      id: s.id,
      title: s.title ?? null,
      session_date: s.session_date,
      location: s.location ?? null,
      notes: s.notes ?? null,
      status: s.status as PlaySessionStatus,
      created_by: s.created_by,
      is_organizer: s.created_by === user.id,
      my_invite_status: myInvite ? (myInvite.status as InviteStatus) : null,
      game_selection_mode: (s.game_selection_mode ?? "fixed") as GameSelectionMode,
      voting_closed: s.voting_closed ?? false,
      planned_duration_minutes: s.planned_duration_minutes ?? null,
      games,
      invitees,
    };
  });

  return NextResponse.json({ sessions: result });
}

// ── POST /api/play-sessions ───────────────────────────────────────────────────
// Creates a planned session with games and invites

export async function POST(req: NextRequest) {
  // Auth check via user client (validates JWT), writes via admin client (bypasses
  // circular RLS: play_sessions_select references play_session_invites and vice versa)
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as {
    title?: string;
    session_date: string;
    location?: string;
    notes?: string;
    game_ids?: string[];
    invited_user_ids?: string[];
    game_selection_mode?: string;
    planned_duration_minutes?: number | null;
  };

  if (!body.session_date) {
    return NextResponse.json({ error: "session_date ist erforderlich" }, { status: 400 });
  }

  // Create session — admin bypasses RLS so the SELECT-policy (which queries
  // play_session_invites) doesn't trigger during the INSERT's WITH CHECK evaluation
  const { data: session, error: sessionErr } = await admin
    .from("play_sessions")
    .insert({
      created_by: user.id,
      title: body.title?.trim() || null,
      session_date: body.session_date,
      location: body.location?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "planned",
      game_selection_mode: body.game_selection_mode ?? "fixed",
      planned_duration_minutes: body.planned_duration_minutes ?? null,
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: sessionErr?.message ?? "Fehler" }, { status: 500 });
  }

  // Insert games — for vote_organizer mode: games become proposals (for voting)
  // For fixed mode: games go directly to session_games
  if (body.game_ids && body.game_ids.length > 0) {
    if (body.game_selection_mode === "vote_organizer") {
      const { error: propErr } = await admin.from("play_session_proposals").insert(
        body.game_ids.map((game_id) => ({
          session_id: session.id,
          game_id,
          proposed_by: user.id,
        }))
      );
      if (propErr) console.error("play_session_proposals insert error:", propErr.message);
    } else {
      const { error: gamesErr } = await admin.from("play_session_games").insert(
        body.game_ids.map((game_id, i) => ({
          session_id: session.id,
          game_id,
          sort_order: i,
        }))
      );
      if (gamesErr) console.error("play_session_games insert error:", gamesErr.message);
    }
  }

  // Insert invites — also via admin to avoid the circular RLS with play_sessions
  if (body.invited_user_ids && body.invited_user_ids.length > 0) {
    const { error: invitesErr } = await admin.from("play_session_invites").insert(
      body.invited_user_ids.map((invited_user_id) => ({
        session_id: session.id,
        invited_user_id,
        status: "invited",
      }))
    );
    if (invitesErr) console.error("play_session_invites insert error:", invitesErr.message);

    // Push invited users (fire-and-forget)
    try {
      const { data: organizer } = await admin
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .single();

      const organizerName = organizer?.display_name ?? organizer?.username ?? "Jemand";
      const sessionLabel = body.title?.trim() ? `„${body.title.trim()}"` : "einen Spieleabend";

      void Promise.allSettled(
        body.invited_user_ids.map((invitedId) =>
          sendPushToUser(invitedId, {
            title: "Neue Einladung!",
            body: `${organizerName} lädt dich zu ${sessionLabel} ein`,
            url: "/plays",
          })
        )
      );
    } catch { /* push errors must never break the response */ }
  }

  return NextResponse.json({ session_id: session.id }, { status: 201 });
}
