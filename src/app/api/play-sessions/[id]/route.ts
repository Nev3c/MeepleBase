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

// ── PATCH /api/play-sessions/[id] ─────────────────────────────────────────────
// Organizer edits session metadata and/or adds new invitees.
// Changing game_selection_mode resets proposals + votes (if confirmed by client).

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // Only organizer can edit
  const { data: session } = await admin
    .from("play_sessions")
    .select("created_by, game_selection_mode")
    .eq("id", params.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  if (session.created_by !== user.id)
    return NextResponse.json({ error: "Nur der Organisator kann bearbeiten" }, { status: 403 });

  const body = await req.json() as {
    title?: string | null;
    session_date?: string;
    location?: string | null;
    notes?: string | null;
    game_selection_mode?: string;
    planned_duration_minutes?: number | null;
    new_invited_user_ids?: string[];
    reset_votes?: boolean; // client sends true when mode changed
  };

  // Update session fields
  const updatePayload: Record<string, unknown> = {};
  if (body.title !== undefined) updatePayload.title = body.title;
  if (body.session_date !== undefined) updatePayload.session_date = body.session_date;
  if (body.location !== undefined) updatePayload.location = body.location;
  if (body.notes !== undefined) updatePayload.notes = body.notes;
  if (body.game_selection_mode !== undefined) updatePayload.game_selection_mode = body.game_selection_mode;
  if (body.planned_duration_minutes !== undefined) updatePayload.planned_duration_minutes = body.planned_duration_minutes;

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateErr } = await admin
      .from("play_sessions")
      .update(updatePayload)
      .eq("id", params.id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // If mode changed and client requested reset: delete proposals + votes
  if (body.reset_votes) {
    await admin.from("play_session_votes").delete().eq("session_id", params.id);
    await admin.from("play_session_proposals").delete().eq("session_id", params.id);
    // Also reset voting_closed flag
    await admin.from("play_sessions").update({ voting_closed: false }).eq("id", params.id);
  }

  // Add new invitees (ignore existing ones to avoid duplicates)
  if (body.new_invited_user_ids && body.new_invited_user_ids.length > 0) {
    // Filter out already-invited users
    const { data: existing } = await admin
      .from("play_session_invites")
      .select("invited_user_id")
      .eq("session_id", params.id);

    const alreadyInvited = new Set((existing ?? []).map((i: { invited_user_id: string }) => i.invited_user_id));
    const toInvite = body.new_invited_user_ids.filter((id) => !alreadyInvited.has(id));

    if (toInvite.length > 0) {
      await admin.from("play_session_invites").insert(
        toInvite.map((invited_user_id) => ({
          session_id: params.id,
          invited_user_id,
          status: "invited",
        }))
      );
    }
  }

  return NextResponse.json({ ok: true });
}
