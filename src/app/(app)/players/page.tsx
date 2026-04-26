import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayersClient } from "./players-client";
import type { FriendProfile, ForSaleGame, LibraryVisibility, ConversationSummary, SessionInviteForPlayer } from "@/types";
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

  // Friends' for-sale games + own for-sale games (combined later for the Markt tab)
  const fsUserIds = Array.from(new Set([user.id, ...acceptedFriendIds]));

  const [profilesResult, fsGamesResult] = await Promise.all([
    allOtherIds.length > 0
      ? admin
          .from("profiles")
          .select("id, username, display_name, avatar_url, location, library_visibility")
          .in("id", allOtherIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    admin
      .from("user_games")
      .select("id, user_id, sale_price, game:games(id, name, thumbnail_url)")
      .in("user_id", fsUserIds)
      .eq("status", "for_sale"),
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

  // ── 8. Build for-sale games — own + friends' (own marked via user_id === me) ──
  // Fetch own profile in parallel later if needed; for now, owner_username left blank for me
  const { data: myProfile } = await admin
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  const forSaleGames: ForSaleGame[] = ((fsGamesResult.data ?? []) as RawFsGame[]).map((ug) => {
    const isMe = ug.user_id === user.id;
    const owner = isMe ? null : profileMap.get(ug.user_id);
    const game = Array.isArray(ug.game) ? ug.game[0] ?? null : ug.game;
    return {
      id: ug.id,
      user_id: ug.user_id,
      sale_price: ug.sale_price ?? null,
      owner_username: isMe ? (myProfile?.username ?? "Du") : (owner?.username ?? "?"),
      owner_display_name: isMe ? (myProfile?.display_name ?? null) : (owner?.display_name ?? null),
      game: game as { id: string; name: string; thumbnail_url: string | null } | null,
    };
  });

  // ── 9. Fetch pending session invites ─────────────────────────────────────────
  type RawSessForInvite = {
    id: string; title: string | null; session_date: string; location: string | null; created_by: string;
    session_games: { game: { id: string; name: string; thumbnail_url: string | null } }[];
  };
  type RawInviteRow = { id: string; session_id: string; status: string; session: RawSessForInvite | null };

  const { data: rawInvites } = await supabase
    .from("play_session_invites")
    .select(`
      id, session_id, status,
      session:play_sessions(
        id, title, session_date, location, created_by,
        session_games:play_session_games(game:games(id, name, thumbnail_url))
      )
    `)
    .eq("invited_user_id", user.id)
    .order("created_at", { ascending: false });

  const rawInviteRows = (rawInvites ?? []) as unknown as RawInviteRow[];

  // Fetch organizer profiles for sessions I'm invited to
  const organizerIds = Array.from(new Set(
    rawInviteRows
      .map((i) => i.session?.created_by)
      .filter((id): id is string => !!id && id !== user.id)
  ));
  type OrgProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null };
  const organizerProfileMap = new Map<string, OrgProfile>();
  if (organizerIds.length > 0) {
    const { data: orgProfiles } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", organizerIds);
    for (const p of (orgProfiles ?? []) as OrgProfile[]) {
      organizerProfileMap.set(p.id, p);
    }
  }

  const pendingInvites: SessionInviteForPlayer[] = rawInviteRows.map((inv) => {
    const sess = inv.session;
    const org = sess ? organizerProfileMap.get(sess.created_by) : null;
    const games = (sess?.session_games ?? []).map((sg) => sg.game);
    return {
      invite_id: inv.id,
      session_id: inv.session_id,
      status: inv.status as "invited" | "accepted" | "declined",
      session_date: sess?.session_date ?? "",
      title: sess?.title ?? null,
      location: sess?.location ?? null,
      organizer_id: sess?.created_by ?? "",
      organizer_username: org?.username ?? "?",
      organizer_display_name: org?.display_name ?? null,
      organizer_avatar_url: org?.avatar_url ?? null,
      games,
    };
  });

  // ── 10. Build search result list with friendship status ──────────────────────
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
      pendingInvites={pendingInvites}
    />
  );
}
