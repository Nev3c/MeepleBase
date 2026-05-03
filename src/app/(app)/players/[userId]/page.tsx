import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PlayerProfileClient } from "./player-profile-client";
import type { FriendProfile, LibraryVisibility } from "@/types";

interface Props {
  params: { userId: string };
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Spieler-Profil" };
}

interface FriendGame {
  id: string;
  game_id: string;
  status: string;
  sale_price?: number | null;
  game: {
    id: string;
    name: string;
    thumbnail_url: string | null;
  } | null;
}

export default async function PlayerProfilePage({ params }: Props) {
  const { userId } = params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Redirect to own profile
  if (userId === user.id) redirect("/profile");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch target profile + friendship status in parallel
  const [{ data: targetProfile }, { data: friendship }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, location, library_visibility")
      .eq("id", userId)
      .single(),
    supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`
      )
      .maybeSingle(),
  ]);

  if (!targetProfile) redirect("/players");

  // Determine friendship status
  const friendProfileData: FriendProfile | null = friendship
    ? {
        friendship_id: friendship.id,
        friendship_status: friendship.status as FriendProfile["friendship_status"],
        is_requester: friendship.requester_id === user.id,
        profile: {
          id: targetProfile.id,
          username: targetProfile.username,
          display_name: targetProfile.display_name,
          avatar_url: targetProfile.avatar_url,
          location: targetProfile.location,
          library_visibility: (targetProfile.library_visibility ?? "friends") as LibraryVisibility,
        },
      }
    : null;

  const isFriend = friendship?.status === "accepted";
  const visibility = (targetProfile.library_visibility ?? "friends") as LibraryVisibility;
  const canSeeLibrary =
    visibility === "public" || (visibility === "friends" && isFriend);

  // Fetch library, play counts, playlist and unread in parallel
  let library: FriendGame[] = [];
  const playCountMap: Record<string, number> = {};
  type PlaylistEntry = { rank: number; game: { id: string; name: string; thumbnail_url: string | null; min_playtime: number | null; max_playtime: number | null; min_players: number | null; max_players: number | null } };
  let playlist: PlaylistEntry[] = [];
  const playlistHidden = !canSeeLibrary;
  let unreadCount = 0;

  if (canSeeLibrary) {
    const [gamesRes, playsRes, playlistRes, unreadRes] = await Promise.all([
      supabase
        .from("user_games")
        .select("id, game_id, status, sale_price, game:games(id, name, thumbnail_url)")
        .eq("user_id", userId)
        .in("status", ["owned", "wishlist", "for_sale"])
        .order("created_at", { ascending: false }),
      supabase
        .from("plays")
        .select("game_id")
        .eq("user_id", userId),
      admin
        .from("game_playlist")
        .select("game_id, rank, game:games(id, name, thumbnail_url, min_playtime, max_playtime, min_players, max_players)")
        .eq("user_id", userId)
        .order("rank", { ascending: true }),
      supabase
        .from("messages")
        .select("id")
        .eq("from_id", userId)
        .eq("to_id", user.id)
        .is("read_at", null),
    ]);

    library = ((gamesRes.data ?? []) as unknown as FriendGame[]).filter((g) => g.game !== null);

    for (const p of playsRes.data ?? []) {
      playCountMap[p.game_id] = (playCountMap[p.game_id] ?? 0) + 1;
    }

    type RawPlaylist = { game_id: string; rank: number; game: PlaylistEntry["game"] | null };
    playlist = ((playlistRes.data ?? []) as unknown as RawPlaylist[])
      .filter((e) => e.game !== null)
      .map((e) => ({ rank: e.rank, game: e.game! }));

    unreadCount = (unreadRes.data ?? []).length;
  } else {
    const { data: unread } = await supabase
      .from("messages")
      .select("id")
      .eq("from_id", userId)
      .eq("to_id", user.id)
      .is("read_at", null);
    unreadCount = (unread ?? []).length;
  }

  return (
    <PlayerProfileClient
      currentUserId={user.id}
      targetProfile={{
        id: targetProfile.id,
        username: targetProfile.username,
        display_name: targetProfile.display_name,
        avatar_url: targetProfile.avatar_url,
        bio: targetProfile.bio,
        location: targetProfile.location,
        library_visibility: visibility,
      }}
      friendData={friendProfileData}
      library={library}
      playCountMap={playCountMap}
      canSeeLibrary={canSeeLibrary}
      playlist={playlist}
      playlistHidden={playlistHidden}
      unreadFromUser={unreadCount}
    />
  );
}
