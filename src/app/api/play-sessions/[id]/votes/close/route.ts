import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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

// ── POST /api/play-sessions/[id]/votes/close ─────────────────────────────────
// Organizer closes voting → Borda count → winner added to session games

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // Only organizer can close
  const { data: session } = await admin
    .from("play_sessions")
    .select("created_by, voting_closed")
    .eq("id", params.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  if (session.created_by !== user.id) return NextResponse.json({ error: "Nur der Organisator kann die Abstimmung schließen" }, { status: 403 });
  if (session.voting_closed) return NextResponse.json({ error: "Abstimmung bereits geschlossen" }, { status: 400 });

  // Load proposals
  const { data: proposals } = await admin
    .from("play_session_proposals")
    .select("game_id, game:games(id, name, thumbnail_url)")
    .eq("session_id", params.id);

  if (!proposals || proposals.length === 0) {
    return NextResponse.json({ error: "Keine Vorschläge vorhanden" }, { status: 400 });
  }

  // Load all votes
  const { data: votes } = await admin
    .from("play_session_votes")
    .select("user_id, game_id, rank")
    .eq("session_id", params.id);

  const n = proposals.length;

  // Borda count
  const bordaMap = new Map<string, number>();
  for (const proposal of proposals) {
    bordaMap.set(proposal.game_id, 0);
  }
  for (const vote of votes ?? []) {
    const pts = n - vote.rank + 1;
    bordaMap.set(vote.game_id, (bordaMap.get(vote.game_id) ?? 0) + pts);
  }

  // Find winner (highest Borda score; ties broken by first proposed)
  let winnerGameId = proposals[0].game_id;
  let maxPts = bordaMap.get(winnerGameId) ?? 0;
  for (const proposal of proposals) {
    const pts = bordaMap.get(proposal.game_id) ?? 0;
    if (pts > maxPts) { maxPts = pts; winnerGameId = proposal.game_id; }
  }

  type RawGame = { id: string; name: string; thumbnail_url: string | null };
  const winnerProposal = proposals.find((p) => p.game_id === winnerGameId);
  const winnerGame = winnerProposal?.game as unknown as RawGame | null;

  // Mark voting as closed
  await admin
    .from("play_sessions")
    .update({ voting_closed: true })
    .eq("id", params.id);

  // Add winner to play_session_games (only if not already there)
  const { data: existing } = await admin
    .from("play_session_games")
    .select("id")
    .eq("session_id", params.id)
    .eq("game_id", winnerGameId)
    .single();

  if (!existing) {
    const { data: maxOrder } = await admin
      .from("play_session_games")
      .select("sort_order")
      .eq("session_id", params.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    await admin.from("play_session_games").insert({
      session_id: params.id,
      game_id: winnerGameId,
      sort_order: (maxOrder?.sort_order ?? -1) + 1,
    });
  }

  // Push all participants (fire-and-forget)
  try {
    const { data: invites } = await admin
      .from("play_session_invites")
      .select("invited_user_id, status")
      .eq("session_id", params.id);

    const participantIds = [
      // Guests who didn't decline
      ...((invites ?? []).filter((i) => i.status !== "declined").map((i) => i.invited_user_id)),
    ];

    const payload = {
      title: "Abstimmungsergebnis steht fest!",
      body: winnerGame?.name
        ? `„${winnerGame.name}" hat die Abstimmung gewonnen`
        : "Die Abstimmung ist abgeschlossen",
      url: "/plays",
    };

    void Promise.allSettled(participantIds.map((id) => sendPushToUser(id, payload)));
  } catch { /* push errors must never break the response */ }

  return NextResponse.json({
    winner: winnerGame,
    points: maxPts,
    total_proposals: n,
  });
}
