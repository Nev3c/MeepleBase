import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type PlaylistGame = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  min_players: number | null;
  max_players: number | null;
};

type PlaylistRow = {
  user_id: string;
  game_id: string;
  rank: number;
  game: PlaylistGame | null;
};

type TicketEntry = {
  game: PlaylistGame;
  count: number;
};

/**
 * POST /api/play-sessions/[id]/lottery
 *
 * Runs the weighted lottery algorithm:
 * - Collects playlists of all non-declined participants
 * - Filters each playlist to games eligible for the participant count
 * - Assigns tickets by rank position in eligible list (1st eligible = 10, 2nd = 9, …)
 * - Aggregates tickets across all participants
 * - Weighted random draw
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load session + invites
  const { data: session } = await admin
    .from("play_sessions")
    .select("id, created_by, invites:play_session_invites(invited_user_id, status)")
    .eq("id", params.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  if (session.created_by !== user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  type Invite = { invited_user_id: string; status: string };
  const invites = (session.invites as Invite[]) ?? [];

  // Participants: organizer + all non-declined invitees
  const participantIds = [
    session.created_by,
    ...invites.filter((i) => i.status !== "declined").map((i) => i.invited_user_id),
  ];
  const participantCount = participantIds.length;

  // Fetch all participants' playlists (admin client bypasses RLS)
  const { data: rawPlaylists } = await admin
    .from("game_playlist")
    .select("user_id, game_id, rank, game:games(id, name, thumbnail_url, min_players, max_players)")
    .in("user_id", participantIds)
    .order("rank", { ascending: true });

  const playlists = (rawPlaylists ?? []) as unknown as PlaylistRow[];

  if (playlists.length === 0) {
    return NextResponse.json({ game: null, reason: "no_playlists" });
  }

  // Group by user
  const byUser = new Map<string, PlaylistRow[]>();
  for (const entry of playlists) {
    if (!byUser.has(entry.user_id)) byUser.set(entry.user_id, []);
    byUser.get(entry.user_id)!.push(entry);
  }

  // Build weighted ticket pool
  const tickets = new Map<string, TicketEntry>();

  for (const userEntries of Array.from(byUser.values())) {
    const sorted = [...userEntries].sort((a, b) => a.rank - b.rank);

    // Filter to eligible games (player count must fit)
    const eligible = sorted.filter((entry) => {
      const g = entry.game;
      if (!g) return false;
      const minP = g.min_players ?? 1;
      const maxP = g.max_players ?? 99;
      return participantCount >= minP && participantCount <= maxP;
    });

    // Assign tickets by position in eligible list
    eligible.forEach((entry, i) => {
      const ticketCount = 10 - i; // 1st eligible = 10, 2nd = 9, …, 10th = 1
      if (ticketCount <= 0 || !entry.game) return;

      const existing = tickets.get(entry.game_id);
      if (existing) {
        existing.count += ticketCount;
      } else {
        tickets.set(entry.game_id, { game: entry.game, count: ticketCount });
      }
    });
  }

  if (tickets.size === 0) {
    return NextResponse.json({ game: null, reason: "no_eligible_games", participant_count: participantCount });
  }

  // Weighted random draw
  const pool = Array.from(tickets.values());
  const totalTickets = pool.reduce((sum, item) => sum + item.count, 0);
  let rand = Math.random() * totalTickets;

  let selected = pool[0];
  for (const item of pool) {
    rand -= item.count;
    if (rand <= 0) {
      selected = item;
      break;
    }
  }

  return NextResponse.json({
    game: selected.game,
    total_tickets: totalTickets,
    participant_count: participantCount,
  });
}
