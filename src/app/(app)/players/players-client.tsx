"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  UserPlus, UserCheck, UserX, Clock, X, Search,
  Users, MessageSquare, MapPin, LocateFixed, ArrowDownAZ,
  Tag, ShoppingBag, BookOpen, Dices, ChevronRight, Bell, BellOff,
  Calendar, Check, Gamepad2, CheckCircle2, XCircle,
} from "lucide-react";
import type { ForSaleGame, ConversationSummary, SessionInviteForPlayer } from "@/types";
import { cn } from "@/lib/utils";
import type { FriendProfile } from "@/types";
import { usePushNotifications } from "@/hooks/use-push-notifications";

// ── Types ──────────────────────────────────────────────────────────────────────

type NearbyStatus = "idle" | "locating" | "loading" | "done" | "denied" | "error";
type SortMode = "az" | "entfernung";
type PlayersTab = "chats" | "freunde" | "einladungen" | "markt" | "suche";

interface SearchPlayer {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
  friendship: { id: string; status: string; is_requester: boolean } | null;
  distance_km?: number;
}

interface Props {
  currentUserId: string;
  conversations: ConversationSummary[];
  friends: FriendProfile[];
  pendingReceived: FriendProfile[];
  pendingSent: FriendProfile[];
  unreadByUser: Record<string, number>;
  totalUnread: number;
  initialSearchResults: SearchPlayer[];
  forSaleGames: ForSaleGame[];
  pendingInvites: SessionInviteForPlayer[];
  hasLocation: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Gestern";
  if (diffDays < 7) return date.toLocaleDateString("de-DE", { weekday: "short" });
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PlayersClient({
  currentUserId,
  conversations,
  friends: initialFriends,
  pendingReceived: initialPendingReceived,
  pendingSent: initialPendingSent,
  unreadByUser,
  totalUnread,
  initialSearchResults,
  forSaleGames,
  pendingInvites: initialPendingInvites,
  hasLocation,
}: Props) {
  const router = useRouter();

  const [pendingInvites, setPendingInvites] = useState<SessionInviteForPlayer[]>(initialPendingInvites);
  const actionableInvites = pendingInvites.filter((i) => i.status === "invited");

  // Active tab — default to chats if unread messages, einladungen if pending invites
  const [activeTab, setActiveTab] = useState<PlayersTab>(
    totalUnread > 0 ? "chats" : actionableInvites.length > 0 ? "einladungen" : "freunde"
  );

  // Friend state
  const [friends, setFriends] = useState(initialFriends);
  const [pendingReceived, setPendingReceived] = useState(initialPendingReceived);
  const [pendingSent, setPendingSent] = useState(initialPendingSent);

  // Optimistic unread — cleared immediately when user opens a chat
  const [localUnreadByUser, setLocalUnreadByUser] = useState(unreadByUser);
  useEffect(() => { setLocalUnreadByUser(unreadByUser); }, [unreadByUser]);
  const localTotalUnread = Object.values(localUnreadByUser).reduce((s, c) => s + c, 0);

  // Conversations with local unread applied
  const localConversations = conversations.map((c) => ({
    ...c,
    unread_count: localUnreadByUser[c.other_user_id] ?? 0,
  }));

  function clearUnreadForUser(userId: string) {
    setLocalUnreadByUser((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  // Refresh data when user comes back from a chat
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  // Friend bottom sheet
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openSheet(fp: FriendProfile) {
    setSelectedFriend(fp);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setTimeout(() => setSelectedFriend(null), 260);
  }

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlayer[] | null>(initialSearchResults);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>("idle");
  const [nearbyResults, setNearbyResults] = useState<SearchPlayer[] | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState(50);
  const [sortMode, setSortMode] = useState<SortMode>("az");

  // PLZ banner — dismissable, persisted in localStorage
  const [plzBannerDismissed, setPlzBannerDismissed] = useState(() => {
    try { return localStorage.getItem("meeplebase_plz_banner_dismissed") === "1"; } catch { return false; }
  });
  function dismissPlzBanner() {
    try { localStorage.setItem("meeplebase_plz_banner_dismissed", "1"); } catch { /* ignore */ }
    setPlzBannerDismissed(true);
  }
  const showPlzBanner = !hasLocation && !plzBannerDismissed;

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (val.trim().length < 2) { setSearchResults(initialSearchResults); return; }
    setSearching(true);
    searchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json() as { players: SearchPlayer[] };
        setSearchResults(data.players ?? []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }

  function handleNearbySearch(radius = nearbyRadius) {
    if (!navigator.geolocation) { setNearbyStatus("error"); return; }
    setNearbyStatus("locating");
    setNearbyResults(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setNearbyStatus("loading");
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/players/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}`);
          const data = await res.json() as { players: SearchPlayer[] };
          setNearbyResults(data.players ?? []);
          setNearbyStatus("done");
        } catch { setNearbyStatus("error"); }
      },
      () => setNearbyStatus("denied"),
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    if (mode === "entfernung" && nearbyStatus === "idle") handleNearbySearch(nearbyRadius);
  }

  async function sendRequest(player: SearchPlayer) {
    const res = await fetch("/api/friendships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressee_id: player.id }),
    });
    if (res.ok) {
      const data = await res.json() as { id: string };
      const updateFn = (p: SearchPlayer) =>
        p.id === player.id ? { ...p, friendship: { id: data.id, status: "pending", is_requester: true } } : p;
      setSearchResults((prev) => prev?.map(updateFn) ?? null);
      setNearbyResults((prev) => prev?.map(updateFn) ?? null);
      setPendingSent((prev) => [{
        friendship_id: data.id, friendship_status: "pending", is_requester: true,
        profile: { id: player.id, username: player.username, display_name: player.display_name,
          avatar_url: player.avatar_url, location: player.location, library_visibility: "friends" },
      }, ...prev]);
    }
  }

  async function cancelRequest(friendshipId: string, playerId: string) {
    const res = await fetch(`/api/friendships/${friendshipId}`, { method: "DELETE" });
    if (res.ok) {
      setPendingSent((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
      const clearFn = (p: SearchPlayer) => p.id === playerId ? { ...p, friendship: null } : p;
      setSearchResults((prev) => prev?.map(clearFn) ?? null);
      setNearbyResults((prev) => prev?.map(clearFn) ?? null);
    }
  }

  async function respondToRequest(friendshipId: string, action: "accept" | "decline") {
    const res = await fetch(`/api/friendships/${friendshipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const entry = pendingReceived.find((f) => f.friendship_id === friendshipId);
      setPendingReceived((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
      if (action === "accept" && entry) setFriends((prev) => [...prev, { ...entry, friendship_status: "accepted" }]);
    }
  }

  async function removeFriend(friendshipId: string) {
    const removed = friends.find((f) => f.friendship_id === friendshipId);
    const res = await fetch(`/api/friendships/${friendshipId}`, { method: "DELETE" });
    if (res.ok) {
      setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
      if (removed) {
        const uid = removed.profile.id;
        const clearFn = (p: SearchPlayer) => p.id === uid ? { ...p, friendship: null } : p;
        setSearchResults((prev) => prev?.map(clearFn) ?? null);
        setNearbyResults((prev) => prev?.map(clearFn) ?? null);
      }
    }
  }

  const totalPending = pendingReceived.length;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Spieler</h1>
          </div>

          {/* ── Tab Bar ── */}
          <div className="flex gap-0">
            <TabButton
              active={activeTab === "chats"}
              onClick={() => setActiveTab("chats")}
              badge={localTotalUnread > 0 ? localTotalUnread : undefined}
              icon={<MessageSquare size={18} />}
            >
              Chats
            </TabButton>
            <TabButton
              active={activeTab === "freunde"}
              onClick={() => setActiveTab("freunde")}
              badge={totalPending > 0 ? totalPending : undefined}
              icon={<Users size={18} />}
            >
              Freunde
            </TabButton>
            <TabButton
              active={activeTab === "einladungen"}
              onClick={() => setActiveTab("einladungen")}
              badge={actionableInvites.length > 0 ? actionableInvites.length : undefined}
              icon={<Calendar size={18} />}
            >
              Termine
            </TabButton>
            <TabButton
              active={activeTab === "markt"}
              onClick={() => setActiveTab("markt")}
              badge={(() => {
                const friendCount = forSaleGames.filter((g) => g.user_id !== currentUserId).length;
                return friendCount > 0 ? friendCount : undefined;
              })()}
              icon={<Tag size={18} />}
            >
              Markt
            </TabButton>
            <TabButton
              active={activeTab === "suche"}
              onClick={() => setActiveTab("suche")}
              icon={<Search size={18} />}
            >
              Suche
            </TabButton>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 max-w-2xl mx-auto w-full">
        {activeTab === "chats" && (
          <ChatsTab
            conversations={localConversations}
            onClearUnread={clearUnreadForUser}
          />
        )}
        {activeTab === "freunde" && (
          <FreundeTab
            friends={friends}
            pendingReceived={pendingReceived}
            pendingSent={pendingSent}
            localUnreadByUser={localUnreadByUser}
            onRespondToRequest={respondToRequest}
            onCancelRequest={cancelRequest}
            onOpenSheet={openSheet}
          />
        )}
        {activeTab === "einladungen" && (
          <EinladungenTab
            invites={pendingInvites}
            onRespond={(inviteId, sessionId, status) => {
              setPendingInvites((prev) =>
                prev.map((i) => i.invite_id === inviteId ? { ...i, status } : i)
              );
              fetch(`/api/play-sessions/${sessionId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
              });
            }}
          />
        )}
        {activeTab === "markt" && (
          <MarktTab forSaleGames={forSaleGames} currentUserId={currentUserId} />
        )}
        {activeTab === "suche" && (
          <>
            {/* PLZ missing banner */}
            {showPlzBanner && (
              <div className="mx-4 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                <MapPin size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-semibold">Keine PLZ hinterlegt.</span> Ohne Postleitzahl können dich andere Spieler nicht finden und du siehst keine Spieler in deiner Nähe.
                  </p>
                  <Link href="/settings" className="inline-block mt-1.5 text-xs font-semibold text-amber-700 underline underline-offset-2">
                    Jetzt in Einstellungen ergänzen →
                  </Link>
                </div>
                <button onClick={dismissPlzBanner} className="p-0.5 text-amber-400 hover:text-amber-600 shrink-0" aria-label="Banner schließen">
                  <X size={14} />
                </button>
              </div>
            )}
            <SucheTab
              searchQuery={searchQuery}
              searchResults={searchResults}
              searching={searching}
              nearbyStatus={nearbyStatus}
              nearbyResults={nearbyResults}
              nearbyRadius={nearbyRadius}
              sortMode={sortMode}
              onSearchInput={handleSearchInput}
              onNearbySearch={handleNearbySearch}
              onNearbyRadiusChange={setNearbyRadius}
              onClearSearch={() => { setSearchQuery(""); setSearchResults(initialSearchResults); }}
              onSortChange={handleSortChange}
              onSendRequest={sendRequest}
              onCancelRequest={cancelRequest}
            />
          </>
        )}
      </div>

      {/* ── Friend Sheet (bottom sheet overlay) ── */}
      <FriendSheet
        friend={selectedFriend}
        open={sheetOpen}
        unreadCount={selectedFriend ? (localUnreadByUser[selectedFriend.profile.id] ?? 0) : 0}
        onClose={closeSheet}
        onRemove={removeFriend}
        onClearUnread={clearUnreadForUser}
      />
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, children, badge, icon,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
  badge?: number; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2 text-[11px] font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
      )}
    >
      <div className="relative flex items-center justify-center">
        {icon}
        {badge !== undefined && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      <span className="leading-none truncate w-full text-center">{children}</span>
      <span className={cn(
        "absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-all duration-200",
        active ? "bg-amber-500 opacity-100" : "opacity-0"
      )} />
    </button>
  );
}

// ── Chats Tab ─────────────────────────────────────────────────────────────────

function ChatsTab({
  conversations, onClearUnread,
}: {
  conversations: ConversationSummary[];
  onClearUnread: (userId: string) => void;
}) {
  const { state: pushState, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showBanner = !bannerDismissed && pushState === "unsubscribed";

  return (
    <div className="flex flex-col pb-10">

      {/* Push notification banner */}
      {showBanner && (
        <div className="mx-4 mt-3 flex items-center gap-3 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Bell size={15} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Benachrichtigungen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Erhalte Meldungen bei neuen Nachrichten.</p>
          </div>
          <button
            onClick={subscribe}
            disabled={pushLoading}
            className="flex-shrink-0 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {pushLoading ? "…" : "Aktivieren"}
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Subscribed status */}
      {pushState === "subscribed" && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-2 px-3.5 py-2 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-green-600" />
            <p className="text-xs text-green-700 font-medium">Benachrichtigungen aktiv</p>
          </div>
          <button
            onClick={unsubscribe}
            disabled={pushLoading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
          >
            <BellOff size={12} />
            Deaktivieren
          </button>
        </div>
      )}

      {/* Empty state */}
      {conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={26} className="text-amber-400" />}
          iconBg="bg-amber-50"
          title="Noch keine Chats"
          subtitle="Tippe auf einen Freund und schreib ihm eine Nachricht."
        />
      ) : (
        <div className="flex flex-col mt-2">
          {conversations.map((conv, i) => {
            const displayName = conv.other_display_name ?? conv.other_username;
            const isUnread = conv.unread_count > 0;
            return (
              <Link
                key={conv.other_user_id}
                href={`/players/messages/${conv.other_user_id}`}
                onClick={() => onClearUnread(conv.other_user_id)}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5 active:bg-muted/40 transition-colors",
                  i < conversations.length - 1 && "border-b border-border/40",
                  isUnread && "bg-amber-50/60"
                )}
              >
                {/* Avatar with unread dot */}
                <div className="relative flex-shrink-0">
                  <PlayerAvatar name={conv.other_username} avatarUrl={conv.other_avatar_url} size="md" />
                  {isUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-background leading-none">
                      {conv.unread_count > 9 ? "9+" : conv.unread_count}
                    </span>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn("text-sm truncate", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                      {displayName}
                    </p>
                    <p className={cn("text-[11px] flex-shrink-0 tabular-nums", isUnread ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                      {formatTime(conv.last_message_at)}
                    </p>
                  </div>
                  <p className={cn("text-xs truncate mt-0.5", isUnread ? "text-foreground/75 font-medium" : "text-muted-foreground")}>
                    {conv.is_last_from_me && <span className="text-muted-foreground/60 font-normal">Du: </span>}
                    {conv.last_message}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Freunde Tab ───────────────────────────────────────────────────────────────

function FreundeTab({
  friends, pendingReceived, pendingSent, localUnreadByUser,
  onRespondToRequest, onCancelRequest, onOpenSheet,
}: {
  friends: FriendProfile[];
  pendingReceived: FriendProfile[];
  pendingSent: FriendProfile[];
  localUnreadByUser: Record<string, number>;
  onRespondToRequest: (fId: string, action: "accept" | "decline") => Promise<void>;
  onCancelRequest: (fId: string, pId: string) => Promise<void>;
  onOpenSheet: (fp: FriendProfile) => void;
}) {
  const isEmpty = friends.length === 0 && pendingReceived.length === 0;

  return (
    <div className="flex flex-col px-4 pt-5 pb-10 gap-6">

      {/* Incoming requests */}
      {pendingReceived.length > 0 && (
        <section>
          <SectionLabel count={pendingReceived.length}>Anfragen</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {pendingReceived.map((fp) => (
              <PendingRequestCard key={fp.friendship_id} fp={fp} onRespond={onRespondToRequest} />
            ))}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section>
        {!isEmpty && <SectionLabel count={friends.length}>Freunde</SectionLabel>}
        {isEmpty ? (
          <EmptyState
            icon={<Users size={26} className="text-amber-400" />}
            iconBg="bg-amber-50"
            title="Noch keine Freunde"
            subtitle='Wechsle zum Tab "Suche" um andere Spieler zu finden.'
          />
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            {friends.map((fp, i) => (
              <FriendCard
                key={fp.friendship_id}
                fp={fp}
                unreadCount={localUnreadByUser[fp.profile.id] ?? 0}
                isLast={i === friends.length - 1}
                onClick={() => onOpenSheet(fp)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Sent requests */}
      {pendingSent.length > 0 && (
        <section>
          <SectionLabel count={pendingSent.length}>Gesendete Anfragen</SectionLabel>
          <div className="flex flex-col gap-2">
            {pendingSent.map((fp) => (
              <PendingSentCard key={fp.friendship_id} fp={fp} onCancel={onCancelRequest} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Markt Tab ─────────────────────────────────────────────────────────────────

function MarktTab({ forSaleGames, currentUserId }: {
  forSaleGames: ForSaleGame[];
  currentUserId: string;
}) {
  const ownGames    = forSaleGames.filter((g) => g.user_id === currentUserId);
  const friendGames = forSaleGames.filter((g) => g.user_id !== currentUserId);

  if (forSaleGames.length === 0) {
    return (
      <EmptyState
        icon={<Tag size={26} className="text-amber-400" />}
        iconBg="bg-amber-50"
        title="Markt leer"
        subtitle={`Markiere Spiele in deiner Bibliothek als „zum Verkauf", oder warte bis Freunde Angebote einstellen.`}
      />
    );
  }

  return (
    <div className="px-4 pt-5 pb-10 flex flex-col gap-5">
      {/* Eigene Angebote */}
      {ownGames.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold tracking-widest uppercase text-amber-700/80">
              Deine Angebote · {ownGames.length}
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {ownGames.map((item) => <ForSaleCard key={item.id} item={item} isOwn />)}
          </div>
        </section>
      )}

      {/* Freunde-Angebote */}
      {friendGames.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60">
              Von Freunden · {friendGames.length}
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {friendGames.map((item) => <ForSaleCard key={item.id} item={item} />)}
          </div>
          <p className="text-xs text-muted-foreground/50 text-center pt-1">
            Schreib dem Anbieter eine Nachricht, um Interesse zu bekunden.
          </p>
        </section>
      )}

      {/* Hint when only own listings */}
      {friendGames.length === 0 && ownGames.length > 0 && (
        <p className="text-xs text-muted-foreground/50 text-center pt-1">
          Noch keine Angebote von Freunden — sobald sie Spiele zum Verkauf einstellen, erscheinen sie hier.
        </p>
      )}
    </div>
  );
}

// ── Friend Card (tappable row, no inline buttons) ─────────────────────────────

function FriendCard({ fp, unreadCount, isLast, onClick }: {
  fp: FriendProfile; unreadCount: number; isLast: boolean; onClick: () => void;
}) {
  const p = fp.profile;
  const displayName = p.display_name ?? p.username;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-muted/40 transition-colors",
        !isLast && "border-b border-border/40"
      )}
    >
      {/* Avatar with unread dot */}
      <div className="relative flex-shrink-0">
        <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-background leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">{displayName}</p>
        {p.display_name && p.display_name !== p.username && (
          <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
        )}
        {p.location && (
          <p className="text-xs text-muted-foreground/50 truncate flex items-center gap-1 mt-0.5">
            <MapPin size={9} />
            {p.location}
          </p>
        )}
      </div>

      <ChevronRight size={16} className="text-muted-foreground/30 flex-shrink-0" />
    </button>
  );
}

// ── Friend Bottom Sheet ────────────────────────────────────────────────────────

function FriendSheet({ friend, open, unreadCount, onClose, onRemove, onClearUnread }: {
  friend: FriendProfile | null;
  open: boolean;
  unreadCount: number;
  onClose: () => void;
  onRemove: (fId: string) => Promise<void>;
  onClearUnread: (userId: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!friend) return;
    setRemoving(true);
    await onRemove(friend.friendship_id);
    setRemoving(false);
    onClose();
  }

  if (!friend) return null;
  const p = friend.profile;
  const displayName = p.display_name ?? p.username;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-end transition-all duration-200",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          "relative bg-background rounded-t-3xl max-w-2xl w-full mx-auto shadow-2xl",
          "transition-transform duration-[260ms] ease-out",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
        </div>

        {/* Profile header */}
        <div className="px-6 pt-3 pb-5 flex items-center gap-4">
          <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="lg" ring />
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg font-semibold text-foreground truncate leading-tight">{displayName}</p>
            {p.display_name && p.display_name !== p.username && (
              <p className="text-sm text-muted-foreground">@{p.username}</p>
            )}
            {p.location && (
              <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                <MapPin size={10} />
                {p.location}
              </p>
            )}
          </div>
        </div>

        <div className="h-px bg-border/60 mx-4" />

        {/* Actions */}
        <div className="px-4 py-2">
          {/* Chat */}
          <Link
            href={`/players/messages/${p.id}`}
            onClick={() => { onClearUnread(p.id); onClose(); }}
            className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-muted/60 active:bg-muted transition-colors"
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              unreadCount > 0 ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-600"
            )}>
              <MessageSquare size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Nachricht schreiben</p>
              {unreadCount > 0 && (
                <p className="text-xs text-amber-600 font-medium">
                  {unreadCount} ungelesene{unreadCount > 1 ? " Nachrichten" : " Nachricht"}
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          {/* Library */}
          <Link
            href={`/players/${p.id}`}
            onClick={onClose}
            className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-muted/60 active:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
              <BookOpen size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Bibliothek ansehen</p>
              <p className="text-xs text-muted-foreground">Spielesammlung &amp; Partien</p>
            </div>
          </Link>

          {/* Record play */}
          <Link
            href={`/plays?player=${encodeURIComponent(p.display_name ?? p.username)}`}
            onClick={onClose}
            className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-muted/60 active:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
              <Dices size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Partie aufzeichnen</p>
              <p className="text-xs text-muted-foreground">Gemeinsame Partie eintragen</p>
            </div>
          </Link>
        </div>

        <div className="h-px bg-border/60 mx-4" />

        {/* Danger */}
        <div className="px-4 py-2 pb-8">
          <button
            onClick={handleRemove}
            disabled={removing}
            className="w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <UserX size={18} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-red-600">
              {removing ? "Wird entfernt…" : "Freund entfernen"}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section Label ──────────────────────────────────────────────────────────────

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60">{children}</p>
      {count !== undefined && (
        <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle, iconBg = "bg-muted" }: {
  icon: React.ReactNode; title: string; subtitle: string; iconBg?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm", iconBg)}>
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{subtitle}</p>
    </div>
  );
}

// ── Pending Request Card ───────────────────────────────────────────────────────

function PendingRequestCard({ fp, onRespond }: {
  fp: FriendProfile;
  onRespond: (fId: string, action: "accept" | "decline") => Promise<void>;
}) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const p = fp.profile;

  async function handle(action: "accept" | "decline") {
    setLoading(action);
    await onRespond(fp.friendship_id, action);
    setLoading(null);
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
      <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" ring />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">{p.display_name ?? p.username}</p>
        {p.display_name && p.display_name !== p.username && (
          <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
        )}
        {p.location && (
          <p className="text-xs text-amber-700/60 truncate flex items-center gap-1 mt-0.5">
            <MapPin size={9} />{p.location}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => handle("decline")}
          disabled={!!loading}
          className="w-9 h-9 rounded-full bg-white border border-amber-200 flex items-center justify-center text-muted-foreground hover:border-red-200 hover:text-red-500 active:bg-red-50 transition-colors disabled:opacity-50"
          aria-label="Ablehnen"
        >
          {loading === "decline"
            ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <X size={14} />}
        </button>
        <button
          onClick={() => handle("accept")}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 active:bg-amber-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading === "accept"
            ? <span className="w-3 h-3 border-2 border-white/60 border-t-white rounded-full animate-spin" />
            : <UserCheck size={18} />}
          {loading === "accept" ? "…" : "Annehmen"}
        </button>
      </div>
    </div>
  );
}

// ── Pending Sent Card ──────────────────────────────────────────────────────────

function PendingSentCard({ fp, onCancel }: {
  fp: FriendProfile;
  onCancel: (fId: string, pId: string) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const p = fp.profile;

  async function handle() {
    setCancelling(true);
    await onCancel(fp.friendship_id, p.id);
    setCancelling(false);
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-dashed border-border">
      <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.display_name ?? p.username}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock size={10} className="text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground/60">Anfrage ausstehend</p>
        </div>
      </div>
      <button
        onClick={handle}
        disabled={cancelling}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium border border-border hover:border-red-200 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 active:bg-red-100 transition-colors"
      >
        <X size={11} />
        {cancelling ? "…" : "Widerrufen"}
      </button>
    </div>
  );
}

// ── For Sale Card ─────────────────────────────────────────────────────────────

function ForSaleCard({ item, isOwn = false }: { item: ForSaleGame; isOwn?: boolean }) {
  const ownerName = item.owner_display_name ?? item.owner_username;
  const priceLabel = item.sale_price != null
    ? `€\u202f${item.sale_price.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    : "Preis auf Anfrage";

  // Own listing → link to library detail; friend listing → link to friend profile
  const href = isOwn && item.game?.id ? `/games/${item.game.id}` : `/players/${item.user_id}`;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 p-3 bg-card rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.99]",
        isOwn ? "border border-amber-200 hover:border-amber-300" : "border border-green-200 hover:border-green-300"
      )}
    >
      <div className={cn("relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden", isOwn ? "bg-amber-50" : "bg-green-50")}>
        {item.game?.thumbnail_url ? (
          <Image src={item.game.thumbnail_url} alt={item.game.name} fill className="object-cover" sizes="56px" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag size={20} className={isOwn ? "text-amber-400" : "text-green-400"} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground text-sm leading-tight truncate">{item.game?.name ?? "Unbekanntes Spiel"}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {isOwn ? "Dein Angebot" : `von ${ownerName}`}
        </p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className={cn("text-sm font-bold tabular-nums", isOwn ? "text-amber-700" : "text-green-700")}>{priceLabel}</span>
        {isOwn ? (
          <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
            <Tag size={9} />Bearbeiten
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full font-medium">
            <ShoppingBag size={9} />Anfragen
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Suche Tab ─────────────────────────────────────────────────────────────────

// ── Einladungen Tab ───────────────────────────────────────────────────────────

function EinladungenTab({
  invites,
  onRespond,
}: {
  invites: SessionInviteForPlayer[];
  onRespond: (inviteId: string, sessionId: string, status: "accepted" | "declined") => void;
}) {
  const pending  = invites.filter((i) => i.status === "invited");
  const responded = invites.filter((i) => i.status !== "invited");

  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-4">
          <Calendar size={36} className="text-amber-400" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">Keine Einladungen</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Wenn Freunde dich zu einem Spieleabend einladen, erscheinen die Anfragen hier.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ausstehend · {pending.length}
          </p>
          {pending.map((invite) => (
            <InviteCard key={invite.invite_id} invite={invite} onRespond={onRespond} />
          ))}
        </div>
      )}

      {/* Already responded */}
      {responded.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Beantwortet · {responded.length}
          </p>
          {responded.map((invite) => (
            <InviteCard key={invite.invite_id} invite={invite} onRespond={onRespond} />
          ))}
        </div>
      )}
    </div>
  );
}

function InviteCard({
  invite,
  onRespond,
}: {
  invite: SessionInviteForPlayer;
  onRespond: (inviteId: string, sessionId: string, status: "accepted" | "declined") => void;
}) {
  const date = new Date(invite.session_date);
  const dateStr = date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const isPending = invite.status === "invited";

  return (
    <div className={cn(
      "bg-card border rounded-2xl overflow-hidden",
      isPending ? "border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]" : "border-border"
    )}>
      {/* Game covers strip */}
      {invite.games.length > 0 && (
        <div className="flex gap-0 h-14 overflow-hidden">
          {invite.games.slice(0, 4).map((game) => (
            <div key={game.id} className="relative flex-1 min-w-0 overflow-hidden">
              {game.thumbnail_url ? (
                <Image src={game.thumbnail_url} alt={game.name} fill className="object-cover" sizes="100px" />
              ) : (
                <div className="w-full h-full bg-amber-100 flex items-center justify-center">
                  <Gamepad2 size={16} className="text-amber-400" />
                </div>
              )}
            </div>
          ))}
          <div className="absolute inset-0 h-14 bg-gradient-to-b from-transparent to-black/30 pointer-events-none" />
        </div>
      )}

      <div className="p-3">
        {/* Organizer + title */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-amber-100 flex-shrink-0">
            {invite.organizer_avatar_url ? (
              <Image src={invite.organizer_avatar_url} alt={invite.organizer_username} width={28} height={28} className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-amber-600 font-bold text-[10px]">{invite.organizer_username[0].toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {invite.title ?? `Spieleabend bei ${invite.organizer_display_name ?? invite.organizer_username}`}
            </p>
            <p className="text-xs text-muted-foreground">
              von {invite.organizer_display_name ?? invite.organizer_username}
            </p>
          </div>
          {!isPending && (
            invite.status === "accepted"
              ? <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0"><CheckCircle2 size={10} /> Zugesagt</span>
              : <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0"><XCircle size={10} /> Abgelehnt</span>
          )}
        </div>

        {/* Date + location */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={11} />{dateStr} · {timeStr} Uhr
          </span>
          {invite.location && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={11} />{invite.location}
            </span>
          )}
        </div>

        {/* Games list */}
        {invite.games.length > 0 && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
            <Gamepad2 size={10} className="inline mr-1 -mt-0.5" />
            {invite.games.map((g) => g.name).join(", ")}
          </p>
        )}

        {/* Action buttons */}
        {isPending && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onRespond(invite.invite_id, invite.session_id, "declined")}
              className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Ablehnen
            </button>
            <button
              onClick={() => onRespond(invite.invite_id, invite.session_id, "accepted")}
              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> Zusagen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const RADIUS_OPTIONS = [5, 15, 25, 50, 100] as const;

function SucheTab({
  searchQuery, searchResults, searching, nearbyStatus, nearbyResults,
  nearbyRadius, sortMode, onSearchInput, onNearbySearch, onNearbyRadiusChange,
  onClearSearch, onSortChange, onSendRequest, onCancelRequest,
}: {
  searchQuery: string; searchResults: SearchPlayer[] | null; searching: boolean;
  nearbyStatus: NearbyStatus; nearbyResults: SearchPlayer[] | null; nearbyRadius: number;
  sortMode: SortMode; onSearchInput: (v: string) => void; onNearbySearch: (r?: number) => void;
  onNearbyRadiusChange: (r: number) => void; onClearSearch: () => void;
  onSortChange: (m: SortMode) => void; onSendRequest: (p: SearchPlayer) => Promise<void>;
  onCancelRequest: (fId: string, pId: string) => Promise<void>;
}) {
  const isNearby = sortMode === "entfernung";
  const [localFilter, setLocalFilter] = useState("");
  const rawResults: SearchPlayer[] = isNearby ? (nearbyResults ?? []) : (searchResults ?? []);
  const visible = isNearby && localFilter.trim().length > 0
    ? rawResults.filter((p) =>
        p.username.toLowerCase().includes(localFilter.toLowerCase()) ||
        (p.display_name ?? "").toLowerCase().includes(localFilter.toLowerCase()))
    : rawResults;
  const sorted = isNearby
    ? [...visible].sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))
    : [...visible].sort((a, b) => a.username.localeCompare(b.username, "de", { sensitivity: "base" }));

  const isLoading = searching || nearbyStatus === "locating" || nearbyStatus === "loading";
  const nearbyDone = nearbyStatus === "done" && nearbyResults !== null;

  return (
    <div className="flex flex-col px-4 pt-4 pb-10 gap-3">
      {/* Mode switcher */}
      <div className="flex p-1 bg-muted/60 rounded-xl gap-1">
        <ModeButton active={!isNearby} icon={<ArrowDownAZ size={14} />} onClick={() => onSortChange("az")}>A–Z</ModeButton>
        <ModeButton active={isNearby} icon={<LocateFixed size={14} />} onClick={() => onSortChange("entfernung")}>In der Nähe</ModeButton>
      </div>

      {/* A-Z text search */}
      {!isNearby && (
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text" value={searchQuery} onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Spielername suchen…" autoComplete="off"
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all min-w-0"
          />
          {searchQuery.length > 0 && (
            <button onClick={onClearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground" aria-label="Zurücksetzen">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Nearby radius + filter */}
      {isNearby && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Umkreis</span>
            <div className="flex gap-1.5 flex-1">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r} type="button"
                  onClick={() => { onNearbyRadiusChange(r); onNearbySearch(r); }}
                  className={cn(
                    "flex-1 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    nearbyRadius === r
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-amber-300 hover:text-amber-700"
                  )}
                >
                  {r} km
                </button>
              ))}
            </div>
            {/* Always rendered so chips never change size; invisible until results are ready */}
            <button
              onClick={() => onNearbySearch(nearbyRadius)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:border-amber-300 hover:text-amber-700 transition-all bg-card shrink-0",
                !nearbyDone && "invisible pointer-events-none"
              )}
            >
              <LocateFixed size={11} />Neu
            </button>
          </div>
          {nearbyDone && rawResults.length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text" value={localFilter} onChange={(e) => setLocalFilter(e.target.value)}
                placeholder="Ergebnisse filtern…"
                className="w-full h-9 pl-8 pr-8 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all min-w-0"
              />
              {localFilter.length > 0 && (
                <button onClick={() => setLocalFilter("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-muted text-muted-foreground" aria-label="Filter löschen">
                  <X size={10} />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2.5 py-2 px-1">
          <span className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            {nearbyStatus === "locating" ? "Standort wird ermittelt…"
              : nearbyStatus === "loading" ? "Spieler in der Nähe werden gesucht…"
              : "Suche…"}
          </p>
        </div>
      )}

      {/* Errors */}
      {nearbyStatus === "denied" && (
        <div className="py-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
          <MapPin size={22} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Standortzugriff verweigert</p>
          <p className="text-xs text-muted-foreground mt-1">Bitte in den Browser-Einstellungen erlauben.</p>
        </div>
      )}
      {nearbyStatus === "error" && <p className="text-sm text-red-600 px-1">Standort konnte nicht ermittelt werden.</p>}

      {/* Empty states */}
      {!isLoading && isNearby && nearbyDone && rawResults.length === 0 && (
        <EmptyState icon={<MapPin size={24} className="text-muted-foreground" />} title="Keine Spieler in der Nähe" subtitle={`Im Umkreis von ${nearbyRadius} km noch niemand gefunden.`} />
      )}
      {!isNearby && !isLoading && searchQuery.length >= 2 && searchResults?.length === 0 && (
        <EmptyState icon={<Search size={22} className="text-muted-foreground" />} title="Kein Spieler gefunden" subtitle="Versuch einen anderen Nutzernamen." />
      )}

      {/* Results */}
      {sorted.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50 px-0.5 mb-1">
            {sorted.length} Spieler{isNearby && ` · ${nearbyRadius} km`}
          </p>
          {sorted.map((player) => (
            <SearchResultCard
              key={player.id} player={player}
              onSendRequest={onSendRequest} onCancelRequest={onCancelRequest}
              showDistance={isNearby}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mode Button ────────────────────────────────────────────────────────────────

function ModeButton({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}{children}
    </button>
  );
}

// ── Search Result Card ─────────────────────────────────────────────────────────

function SearchResultCard({ player, onSendRequest, onCancelRequest, showDistance }: {
  player: SearchPlayer; onSendRequest: (p: SearchPlayer) => Promise<void>;
  onCancelRequest: (fId: string, pId: string) => Promise<void>; showDistance?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const f = player.friendship;
  const displayName = player.display_name ?? player.username;

  async function handleAdd() { setLoading(true); await onSendRequest(player); setLoading(false); }
  async function handleCancel() {
    if (!f) return; setLoading(true); await onCancelRequest(f.id, player.id); setLoading(false);
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border shadow-sm">
      <PlayerAvatar name={player.username} avatarUrl={player.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{displayName}</p>
          {showDistance && player.distance_km !== undefined && (
            <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
              <MapPin size={9} />
              {player.distance_km < 1 ? "< 1 km" : `${Math.round(player.distance_km)} km`}
            </span>
          )}
        </div>
        {player.display_name && player.display_name !== player.username && (
          <p className="text-xs text-muted-foreground truncate">@{player.username}</p>
        )}
        {player.location && (
          <p className="text-xs text-muted-foreground/60 truncate flex items-center gap-1 mt-0.5">
            <MapPin size={9} />{player.location}
          </p>
        )}
      </div>

      {f?.status === "accepted" ? (
        <Link href={`/players/${player.id}`} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-200">
          <UserCheck size={12} />Freund
        </Link>
      ) : f?.status === "pending" && f.is_requester ? (
        <button onClick={handleCancel} disabled={loading} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium border border-border disabled:opacity-50 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors">
          {loading ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Clock size={12} />}
          {loading ? "…" : "Gesendet"}
        </button>
      ) : f?.status === "pending" && !f.is_requester ? (
        <span className="shrink-0 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-full">Anfrage ↓</span>
      ) : (
        <button onClick={handleAdd} disabled={loading} className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm">
          {loading ? <span className="w-3 h-3 border-2 border-white/60 border-t-white rounded-full animate-spin" /> : <UserPlus size={12} />}
          {loading ? "…" : "Hinzufügen"}
        </button>
      )}
    </div>
  );
}

// ── Player Avatar ──────────────────────────────────────────────────────────────

export function PlayerAvatar({
  name, avatarUrl, size = "md", ring = false, className,
}: {
  name: string; avatarUrl: string | null; size?: "sm" | "md" | "lg";
  ring?: boolean; className?: string;
}) {
  const hue = name.charCodeAt(0) % 360;
  const initial = name[0]?.toUpperCase() ?? "?";
  const sizeClasses = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  const px = size === "lg" ? 56 : size === "md" ? 40 : 32;

  return (
    <div className={cn("rounded-full overflow-hidden flex-shrink-0", sizeClasses[size], ring && "ring-2 ring-amber-200 ring-offset-1", className)}>
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} width={px} height={px} className="object-cover w-full h-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-bold text-white" style={{ background: `hsl(${hue} 50% 48%)` }}>
          {initial}
        </div>
      )}
    </div>
  );
}
