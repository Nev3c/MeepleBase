import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * GET /api/users/[id]/playlist
 *
 * Returns another user's ranked "want to play" playlist.
 * Visibility follows the same rules as library_visibility:
 *   - public  → anyone can see
 *   - friends → only accepted friends can see
 *   - private → only the owner (redirect to own profile handles that)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const targetUserId = params.id;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check target profile visibility
  const { data: profile } = await admin
    .from("profiles")
    .select("library_visibility")
    .eq("id", targetUserId)
    .single();

  if (!profile) return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 });

  const visibility = profile.library_visibility ?? "friends";

  // For non-public profiles, verify friendship
  if (visibility !== "public") {
    const { data: friendship } = await supabase
      .from("friendships")
      .select("status")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`
      )
      .maybeSingle();

    const isFriend = friendship?.status === "accepted";

    if (visibility === "private" || !isFriend) {
      return NextResponse.json({ playlist: [], hidden: true });
    }
  }

  // Fetch playlist (admin bypasses RLS on game_playlist)
  const { data: entries } = await admin
    .from("game_playlist")
    .select("game_id, rank, game:games(id, name, thumbnail_url, min_playtime, max_playtime, min_players, max_players)")
    .eq("user_id", targetUserId)
    .order("rank", { ascending: true });

  type RawEntry = {
    game_id: string;
    rank: number;
    game: {
      id: string;
      name: string;
      thumbnail_url: string | null;
      min_playtime: number | null;
      max_playtime: number | null;
      min_players: number | null;
      max_players: number | null;
    } | null;
  };

  const playlist = ((entries ?? []) as unknown as RawEntry[])
    .filter((e) => e.game !== null)
    .map((e) => ({
      rank: e.rank,
      game: e.game!,
    }));

  return NextResponse.json({ playlist, hidden: false });
}
