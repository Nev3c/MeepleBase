import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayersClient } from "./players-client";
import type { FriendProfile, ForSaleGame, LibraryVisibility, ConversationSummary } from "@/types";
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

  // ── 1. Parallel: friendships, ALL messages (unread + conversations), A-Z list ─
  const [
    { data: friendships },
    { data: allMessages },
    { data: allProfiles },
  ] = await Promise.all([
    supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id, from_id, to_id, content, read_at, created_at")
      .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, location")
      .neq("id", user.id)
      .order("username", { ascending: true })
      .limit(50),
  ]);

  // ── 2. Derive unread counts ───────────────────────────────────────────────────
  const unreadByUser: Record<string, number> = {};
  for (const msg of (allMessages ?? [])) {
    if (msg.to_id === user.id && !msg.read_at) {
      unreadByUser[msg.from_id] = (unreadByUser[msg.from_id] ?? 0) + 1;
    }
  }
  const totalUnread = Object.values(unreadByUser).reduce((s, c) => s + c, 0);

  // ── 3. Build conversation map (already sorted desc by created_at) ────────────
  const convMap = new Map<string, {
    other_user_id: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    is_last_from_me: boolean;
  }>();
  for (const msg of (allMessages ?? [])) {
    const otherId = msg.from_id === user.id ? msg.to_id : msg.from_id;
    if (!convMap.has(otherId)) {
      convMap.set(otherId, {
        other_user_id: otherId,
        last_message: msg.content,
        last_message_at: msg.created_at,
        unread_count: unreadByUser[otherId] ?? 0,
        is_last_from_me: msg.from_id === user.id,
      });
    }
  }

  // ── 4. Compute IDs for second fetch ──────────────────────────────────────────
  const friendOtherIds = (friendships ?? []).map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );
  const acceptedFriendIds = (friendships ?? [])
    .filter((f) => f.status === "accepted")
    .map((f) => f.requester_id === user.id ? f.addressee_id : f.requester_id);
  const convOtherIds = Array.from(convMap.keys());
  const allOtherIds = Array.from(new Set([...friendOtherIds, ...convOtherIds]));

  // ── 5. Parallel: extended profiles + for-sale games ──────────────────────────
  type ProfileRow = {
    id: string; username: string; display_name: string | null;
    avatar_url: string | null; location: string | null; library_visibility: string | null;
  };
  type RawFsGame = {
    id: string; user_id: string; sale_price: number | null;
    game: { id: string; name: string; thumbnail_url: string | null }
        | { id: string; name: string; thumbnail_url: string | null }[] | null;
  };

  const [profilesResult, fsGamesResult] = await Promise.all([
    allOtherIds.length > 0
      ? admin
          .from("profiles")
          .select("id, username, display_name, avatar_url, location, library_visibility")
          .in("id", allOtherIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    acceptedFriendIds.length > 0
      ? admin
          .from("user_games")
          .select("id, user_id, sale_price, game:games(id, name, thumbnail_url)")
          .in("user_id", acceptedFriendIds)
          .eq("status", "for_sale")
      : Promise.resolve({ data: [] as RawFsGame[] }),
  ]);

  const profileMap = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((p) => [p.id, p]));

  // ── 6. Build conversation summaries ──────────────────────────────────────────
  const conversations: ConversationSummary[] = Array.from(convMap.values()).map((conv) => {
    const p = profileMap.get(conv.other_user_id);
    return {
      ...conv,
      other_username: p?.username ?? "?",
      other_display_name: p?.display_name ?? null,
      other_avatar_url: p?.avatar_url ?? null,
    };
  });

  // ── 7. Build friendship lists ─────────────────────────────────────────────────
  const friends: FriendProfile[] = [];
  const pendingReceived: FriendProfile[] = [];
  const pendingSent: FriendProfile[] = [];

  for (const f of (friendships ?? [])) {
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

  // ── 8. Build for-sale games ───────────────────────────────────────────────────
  const forSaleGames: ForSaleGame[] = ((fsGamesResult.data ?? []) as RawFsGame[]).map((ug) => {
    const owner = profileMap.get(ug.user_id);
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

  // ── 9. Build search result list with friendship status ───────────────────────
  const friendshipMap = new Map<string, { id: string; status: string; is_requester: boolean }>();
  for (const f of (friendships ?? [])) {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    friendshipMap.set(otherId, { id: f.id, status: f.status, is_requester: f.requester_id === user.id });
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
      conversations={conversations}
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
