import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayersClient } from "./players-client";
import type { FriendProfile, ForSaleGame, LibraryVisibility } from "@/types";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Spieler" };

export default async function PlayersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch friendships, unread messages, and all players in parallel
  const [
    { data: friendships },
    { data: messages },
    { data: allProfiles },
  ] = await Promise.all([
    supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id, from_id, to_id, read_at")
      .eq("to_id", user.id)
      .is("read_at", null),
    admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, location")
      .neq("id", user.id)
      .order("username", { ascending: true })
      .limit(50),
  ]);

  // Unread messages per sender
  const unreadByUser: Record<string, number> = {};
  for (const msg of (messages ?? [])) {
    unreadByUser[msg.from_id] = (unreadByUser[msg.from_id] ?? 0) + 1;
  }
  const totalUnread = Object.values(unreadByUser).reduce((s, c) => s + c, 0);

  // Build friend profiles
  const friends: FriendProfile[] = [];
  const pendingReceived: FriendProfile[] = [];
  const pendingSent: FriendProfile[] = [];

  let friendshipProfiles: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; location: string | null; library_visibility: string }> = [];

  if (friendships?.length) {
    const otherIds = Array.from(new Set(friendships.map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )));

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, location, library_visibility")
      .in("id", otherIds);

    friendshipProfiles = profiles ?? [];
    const profileMap = new Map(friendshipProfiles.map((p) => [p.id, p]));

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
          library_visibility: (profile.library_visibility ?? "friends") as LibraryVisibility,
        },
      };

      if (f.status === "accepted") friends.push(entry);
      else if (f.status === "pending" && f.addressee_id === user.id) pendingReceived.push(entry);
      else if (f.status === "pending" && f.requester_id === user.id) pendingSent.push(entry);
    }
  }

  // Fetch for_sale games from accepted friends
  const acceptedFriendIds = friends.map((f) => f.profile.id);
  let forSaleGames: ForSaleGame[] = [];
  if (acceptedFriendIds.length > 0) {
    const { data: fsGames } = await admin
      .from("user_games")
      .select("id, user_id, sale_price, game:games(id, name, thumbnail_url)")
      .in("user_id", acceptedFriendIds)
      .eq("status", "for_sale");

    const profileLookup = new Map(friendshipProfiles.map((p) => [p.id, p]));
    type RawFsGame = { id: string; user_id: string; sale_price: number | null; game: { id: string; name: string; thumbnail_url: string | null } | { id: string; name: string; thumbnail_url: string | null }[] | null };
    forSaleGames = (fsGames ?? []).map((ug: RawFsGame) => {
      const owner = profileLookup.get(ug.user_id);
      const game = Array.isArray(ug.game) ? ug.game[0] ?? null : ug.game;
      return {
        id: ug.id,
        user_id: ug.user_id,
        sale_price: ug.sale_price ?? null,
        owner_username: owner?.username ?? "?",
        owner_display_name: owner?.display_name ?? null,
        game: game as { id: string; name: string; thumbnail_url: string | null } | null,
      };
    });
  }

  // Build friendship map for the initial player list
  const friendshipMap = new Map<string, { id: string; status: string; is_requester: boolean }>();
  for (const f of friendships ?? []) {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    friendshipMap.set(otherId, {
      id: f.id,
      status: f.status,
      is_requester: f.requester_id === user.id,
    });
  }

  const initialSearchResults = (allProfiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    location: p.location,
    friendship: friendshipMap.get(p.id) ?? null,
  }));

  return (
    <PlayersClient
      currentUserId={user.id}
      friends={friends}
      pendingReceived={pendingReceived}
      pendingSent={pendingSent}
      unreadByUser={unreadByUser}
      totalUnread={totalUnread}
      initialSearchResults={initialSearchResults}
      forSaleGames={forSaleGames}
    />
  );
}
