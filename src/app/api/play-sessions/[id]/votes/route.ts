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

// ── GET /api/play-sessions/[id]/votes ────────────────────────────────────────
// Returns all votes + Borda aggregation for a session

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // All votes for this session (RLS allows participants to read all)
  const { data: votes, error } = await supabase
    .from("play_session_votes")
    .select("session_id, user_id, game_id, rank")
    .eq("session_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // My votes
  const myVotes = (votes ?? []).filter((v) => v.user_id === user.id);

  // Borda count: for each user, N proposals → rank 1 gets N pts, rank 2 gets N-1, ...
  // We need proposals to know N for each user
  const { data: proposals } = await supabase
    .from("play_session_proposals")
    .select("game_id, game:games(id, name, thumbnail_url, min_playtime, max_playtime)")
    .eq("session_id", params.id);

  const n = (proposals ?? []).length;
  const bordaMap = new Map<string, number>(); // game_id → total Borda points
  const voterGames = new Map<string, Set<string>>(); // game_id → set of user_ids who voted for it

  for (const vote of votes ?? []) {
    const pts = n - vote.rank + 1; // rank 1 → n pts, rank n → 1 pt
    bordaMap.set(vote.game_id, (bordaMap.get(vote.game_id) ?? 0) + pts);
    if (!voterGames.has(vote.game_id)) voterGames.set(vote.game_id, new Set());
    voterGames.get(vote.game_id)!.add(vote.user_id);
  }

  type RawGame = { id: string; name: string; thumbnail_url: string | null; min_playtime?: number | null; max_playtime?: number | null };
  const bordaResults = (proposals ?? [])
    .map((p) => {
      const g = p.game as unknown as RawGame;
      return {
        game: g,
        points: bordaMap.get(p.game_id) ?? 0,
        voter_count: voterGames.get(p.game_id)?.size ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points);

  return NextResponse.json({ votes: votes ?? [], my_votes: myVotes, borda_results: bordaResults });
}

// ── POST /api/play-sessions/[id]/votes ───────────────────────────────────────
// Submit or update a participant's full ranking
// Body: { rankings: { game_id: string; rank: number }[] }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { rankings: { game_id: string; rank: number }[] };
  if (!body.rankings || body.rankings.length === 0) {
    return NextResponse.json({ error: "rankings fehlt" }, { status: 400 });
  }

  // Check session is open for voting
  const { data: session } = await admin
    .from("play_sessions")
    .select("voting_closed")
    .eq("id", params.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  if (session.voting_closed) return NextResponse.json({ error: "Abstimmung bereits geschlossen" }, { status: 400 });

  // Delete existing votes from this user for this session, then insert fresh
  await admin
    .from("play_session_votes")
    .delete()
    .eq("session_id", params.id)
    .eq("user_id", user.id);

  const { error } = await admin
    .from("play_session_votes")
    .insert(
      body.rankings.map(({ game_id, rank }) => ({
        session_id: params.id,
        user_id: user.id,
        game_id,
        rank,
      }))
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
