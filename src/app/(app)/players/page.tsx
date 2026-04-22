import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayersClient } from "./players-client";
import type { FriendProfile, GameStatus } from "@/types";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Spieler" };

interface LibraryGame {
  game_id: string;
  status: GameStatus;
  personal_rating: number | null;
  game: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    min_players: number | null;
    max_players: number | null;
    min_playtime: number | null;
    max_playtime: number | null;
    rating_avg: number | null;
    year_published: number | null;
  } | null;
}

export default async function PlayersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all data in parallel
  const [
    { data: friendships },
    { data: userGames },
    { data: plays },
    { data: messages },
  ] = await Promise.all([
    supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_games")
      .select("game_id, status, personal_rating, game:games(id, name, thumbnail_url, min_players, max_players, min_playtime, max_playtime, rating_avg, year_published)")
      .eq("user_id", user.id),
    supabase
      .from("plays")
      .select("game_id")
      .eq("user_id", user.id),
    supabase
      .from("messages")
      .select("id, from_id, to_id, read_at")
      .eq("to_id", user.id)
      .is("read_at", null),
  ]);

  // Build play count map
  const playCountMap: Record<string, number> = {};
  for (const p of plays ?? []) {
    playCountMap[p.game_id] = (playCountMap[p.game_id] ?? 0) + 1;
  }

  // Unread message count
  const unreadCount = (messages ?? []).length;

  // Build friend profiles
  const friends: FriendProfile[] = [];
  const pendingReceived: FriendProfile[] = [];
  const pendingSent: FriendProfile[] = [];

  if (friendships?.length) {
    const otherIds = Array.from(new Set(friendships.map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )));

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, location, library_visibility")
      .in("id", otherIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    for (const f of friendships) {
      const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      const profile = profileMap.get(otherId);
      if (!profile) continue;

      const entry: FriendProfile = {
        friendship_id: f.id,
        friendship_status: f.status as FriendProfile["friendship_status"],
        is_requester: f.requester_id === user.id,
        profile: {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          location: profile.location,
          library_visibility: profile.library_visibility ?? "friends",
        },
      };

      if (f.status === "accepted") friends.push(entry);
      else if (f.status === "pending" && f.addressee_id === user.id) pendingReceived.push(entry);
      else if (f.status === "pending" && f.requester_id === user.id) pendingSent.push(entry);
    }
  }

  return (
    <PlayersClient
      currentUserId={user.id}
      friends={friends}
      pendingReceived={pendingReceived}
      pendingSent={pendingSent}
      unreadCount={unreadCount}
      userGames={(userGames ?? []) as unknown as LibraryGame[]}
      playCountMap={playCountMap}
    />
  );
}
