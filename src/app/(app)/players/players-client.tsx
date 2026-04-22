"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  UserPlus, UserCheck, UserX, Clock, X, Search,
  Users, MessageSquare, Mail, BookOpen, ChevronRight,
  UserSearch, Star, Dices,
} from "lucide-react";
import { cn, formatPlayerCount, formatPlaytime } from "@/lib/utils";
import type { FriendProfile, GameStatus } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

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

interface SearchPlayer {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
  friendship: { id: string; status: string; is_requester: boolean } | null;
}

type MainTab = "freunde" | "spiele";
type SpielSubTab = "ungespielt" | "heute";

interface Props {
  currentUserId: string;
  friends: FriendProfile[];
  pendingReceived: FriendProfile[];
  pendingSent: FriendProfile[];
  unreadCount: number;
  userGames: LibraryGame[];
  playCountMap: Record<string, number>;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PlayersClient({
  friends: initialFriends,
  pendingReceived: initialPendingReceived,
  pendingSent: initialPendingSent,
  unreadCount,
  userGames,
  playCountMap,
}: Props) {
  const [tab, setTab] = useState<MainTab>("freunde");
  const [spielTab, setSpielTab] = useState<SpielSubTab>("ungespielt");

  // Local state for friends (so UI updates optimistically)
  const [friends, setFriends] = useState(initialFriends);
  const [pendingReceived, setPendingReceived] = useState(initialPendingReceived);
  const [pendingSent, setPendingSent] = useState(initialPendingSent);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlayer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    if (searchRef.current) clearTimeout(searchRef.current);

    if (val.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    searchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json() as { players: SearchPlayer[] };
        setSearchResults(data.players ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  async function sendRequest(player: SearchPlayer) {
    const res = await fetch("/api/friendships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressee_id: player.id }),
    });
    if (res.ok) {
      const data = await res.json() as { id: string };
      // Optimistic: update search result to show pending
      setSearchResults((prev) =>
        prev?.map((p) =>
          p.id === player.id
            ? { ...p, friendship: { id: data.id, status: "pending", is_requester: true } }
            : p
        ) ?? null
      );
      // Add to pendingSent
      setPendingSent((prev) => [
        {
          friendship_id: data.id,
          friendship_status: "pending",
          is_requester: true,
          profile: { id: player.id, username: player.username, display_name: player.display_name, avatar_url: player.avatar_url, location: player.location, library_visibility: "friends" },
        },
        ...prev,
      ]);
    }
  }

  async function cancelRequest(friendshipId: string, playerId: string) {
    const res = await fetch(`/api/friendships/${friendshipId}`, { method: "DELETE" });
    if (res.ok) {
      setPendingSent((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
      setSearchResults((prev) =>
        prev?.map((p) => p.id === playerId ? { ...p, friendship: null } : p) ?? null
      );
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
      if (action === "accept" && entry) {
        setFriends((prev) => [...prev, { ...entry, friendship_status: "accepted" }]);
      }
    }
  }

  async function removeFriend(friendshipId: string) {
    const res = await fetch(`/api/friendships/${friendshipId}`, { method: "DELETE" });
    if (res.ok) {
      setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
    }
  }

  const totalPending = pendingReceived.length;
  const showSearch = searchQuery.trim().length >= 2;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-4 pb-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display text-2xl font-semibold text-foreground">Spieler</h1>
            {/* Messages link */}
            <Link
              href="/players/messages"
              className="relative p-2 rounded-xl hover:bg-muted transition-colors"
              aria-label="Nachrichten"
            >
              <Mail size={20} className="text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-border -mx-4 px-4">
            {([
              { key: "freunde" as MainTab, label: "Spieler", icon: UserSearch },
              { key: "spiele" as MainTab, label: "Spiele", icon: BookOpen },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  tab === key
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {label}
                {key === "freunde" && totalPending > 0 && (
                  <span className="ml-0.5 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full inline-flex items-center justify-center">
                    {totalPending}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full">
        {tab === "freunde" ? (
          <SpielerTab
            friends={friends}
            pendingReceived={pendingReceived}
            pendingSent={pendingSent}
            searchQuery={searchQuery}
            searchResults={searchResults}
            searching={searching}
            showSearch={showSearch}
            onSearchInput={handleSearchInput}
            onSendRequest={sendRequest}
            onCancelRequest={cancelRequest}
            onRespondToRequest={respondToRequest}
            onRemoveFriend={removeFriend}
          />
        ) : (
          <SpielTab
            activeTab={spielTab}
            setActiveTab={setSpielTab}
            userGames={userGames}
            playCountMap={playCountMap}
          />
        )}
      </div>
    </div>
  );
}

// ── Spieler Tab ────────────────────────────────────────────────────────────────

function SpielerTab({
  friends,
  pendingReceived,
  pendingSent,
  searchQuery,
  searchResults,
  searching,
  showSearch,
  onSearchInput,
  onSendRequest,
  onCancelRequest,
  onRespondToRequest,
  onRemoveFriend,
}: {
  friends: FriendProfile[];
  pendingReceived: FriendProfile[];
  pendingSent: FriendProfile[];
  searchQuery: string;
  searchResults: SearchPlayer[] | null;
  searching: boolean;
  showSearch: boolean;
  onSearchInput: (v: string) => void;
  onSendRequest: (p: SearchPlayer) => Promise<void>;
  onCancelRequest: (fId: string, pId: string) => Promise<void>;
  onRespondToRequest: (fId: string, action: "accept" | "decline") => Promise<void>;
  onRemoveFriend: (fId: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-0 px-4 pb-8">
      {/* Search */}
      <div className="pt-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Spieler suchen (Nutzername / Name)…"
            className="w-full h-11 pl-9 pr-4 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all min-w-0"
          />
          {searchQuery.length > 0 && (
            <button
              onClick={() => { onSearchInput(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-0.5"
              aria-label="Suche löschen"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {showSearch ? (
        <div className="flex flex-col gap-2">
          {searching && (
            <p className="text-xs text-muted-foreground px-1 animate-pulse">Suche…</p>
          )}
          {!searching && searchResults !== null && searchResults.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Kein Spieler gefunden.</p>
              <p className="text-xs text-muted-foreground mt-1">Versuche es mit einem anderen Namen.</p>
            </div>
          )}
          {(searchResults ?? []).map((player) => (
            <SearchResultCard
              key={player.id}
              player={player}
              onSendRequest={onSendRequest}
              onCancelRequest={onCancelRequest}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Pending Requests */}
          {pendingReceived.length > 0 && (
            <section className="mb-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Anfragen ({pendingReceived.length})
              </h3>
              <div className="flex flex-col gap-2">
                {pendingReceived.map((fp) => (
                  <PendingRequestCard
                    key={fp.friendship_id}
                    fp={fp}
                    onRespond={onRespondToRequest}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Friends List */}
          <section>
            {friends.length > 0 && (
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Freunde ({friends.length})
              </h3>
            )}

            {friends.length === 0 && pendingReceived.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Users size={28} className="text-muted-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  Noch keine Freunde
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  Suche nach anderen Spielern und schick ihnen eine Freundschaftsanfrage.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {friends.map((fp) => (
                  <FriendCard
                    key={fp.friendship_id}
                    fp={fp}
                    onRemove={onRemoveFriend}
                  />
                ))}
                {/* Pending sent */}
                {pendingSent.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3 mb-1 font-medium">Gesendete Anfragen</p>
                    {pendingSent.map((fp) => (
                      <PendingSentCard
                        key={fp.friendship_id}
                        fp={fp}
                        onCancel={onCancelRequest}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ── Search Result Card ─────────────────────────────────────────────────────────

function SearchResultCard({
  player,
  onSendRequest,
  onCancelRequest,
}: {
  player: SearchPlayer;
  onSendRequest: (p: SearchPlayer) => Promise<void>;
  onCancelRequest: (fId: string, pId: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const f = player.friendship;

  async function handleAdd() {
    setLoading(true);
    await onSendRequest(player);
    setLoading(false);
  }

  async function handleCancel() {
    if (!f) return;
    setLoading(true);
    await onCancelRequest(f.id, player.id);
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card">
      <PlayerAvatar name={player.display_name ?? player.username} avatarUrl={player.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {player.display_name ?? player.username}
        </p>
        <p className="text-xs text-muted-foreground truncate">@{player.username}</p>
        {player.location && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{player.location}</p>
        )}
      </div>

      {f?.status === "accepted" ? (
        <Link
          href={`/players/${player.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium border border-green-200"
        >
          <UserCheck size={13} />
          Befreundet
        </Link>
      ) : f?.status === "pending" && f.is_requester ? (
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium border border-border disabled:opacity-50"
        >
          <Clock size={13} />
          Gesendet
        </button>
      ) : f?.status === "pending" && !f.is_requester ? (
        <span className="text-xs text-amber-600 font-medium px-2">Anfrage erhalten</span>
      ) : (
        <button
          onClick={handleAdd}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold disabled:opacity-50 active:bg-amber-600 transition-colors"
        >
          <UserPlus size={13} />
          {loading ? "…" : "Hinzufügen"}
        </button>
      )}
    </div>
  );
}

// ── Pending Request Card ───────────────────────────────────────────────────────

function PendingRequestCard({
  fp,
  onRespond,
}: {
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
    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
      <PlayerAvatar name={p.display_name ?? p.username} avatarUrl={p.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {p.display_name ?? p.username}
        </p>
        <p className="text-xs text-muted-foreground">@{p.username}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => handle("decline")}
          disabled={!!loading}
          className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center text-muted-foreground active:bg-muted transition-colors disabled:opacity-50"
          aria-label="Ablehnen"
        >
          <UserX size={14} />
        </button>
        <button
          onClick={() => handle("accept")}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold active:bg-amber-600 transition-colors disabled:opacity-50"
          aria-label="Annehmen"
        >
          <UserCheck size={13} />
          {loading === "accept" ? "…" : "Annehmen"}
        </button>
      </div>
    </div>
  );
}

// ── Friend Card ────────────────────────────────────────────────────────────────

function FriendCard({
  fp,
  onRemove,
}: {
  fp: FriendProfile;
  onRemove: (fId: string) => Promise<void>;
}) {
  const [showActions, setShowActions] = useState(false);
  const [removing, setRemoving] = useState(false);
  const p = fp.profile;

  async function handleRemove() {
    setRemoving(true);
    await onRemove(fp.friendship_id);
    setRemoving(false);
    setShowActions(false);
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card">
      <Link href={`/players/${p.id}`} className="flex-shrink-0">
        <PlayerAvatar name={p.display_name ?? p.username} avatarUrl={p.avatar_url} size="md" />
      </Link>

      <Link href={`/players/${p.id}`} className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {p.display_name ?? p.username}
        </p>
        <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
        {p.location && (
          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{p.location}</p>
        )}
      </Link>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Link
          href={`/players/messages/${p.id}`}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:bg-muted/70 transition-colors"
          aria-label="Nachricht senden"
        >
          <MessageSquare size={14} />
        </Link>
        <Link
          href={`/players/${p.id}`}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:bg-muted/70 transition-colors"
          aria-label="Profil ansehen"
        >
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Long press / hold for remove — using a visible button on the right */}
      <button
        onClick={() => setShowActions((v) => !v)}
        className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/40 active:bg-muted transition-colors"
        aria-label="Optionen"
      >
        <span className="text-lg leading-none">⋯</span>
      </button>

      {/* Inline remove action */}
      {showActions && (
        <div className="absolute right-4 z-10">
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium shadow-sm"
          >
            <UserX size={12} /> {removing ? "…" : "Entfernen"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Pending Sent Card ──────────────────────────────────────────────────────────

function PendingSentCard({
  fp,
  onCancel,
}: {
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
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border opacity-70">
      <PlayerAvatar name={p.display_name ?? p.username} avatarUrl={p.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.display_name ?? p.username}</p>
        <p className="text-xs text-muted-foreground">@{p.username}</p>
      </div>
      <button
        onClick={handle}
        disabled={cancelling}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium border border-border disabled:opacity-50 active:bg-muted/70 transition-colors"
      >
        <X size={11} /> {cancelling ? "…" : "Widerrufen"}
      </button>
    </div>
  );
}

// ── Player Avatar ──────────────────────────────────────────────────────────────

export function PlayerAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hue = name.charCodeAt(0) % 360;
  const initial = name[0]?.toUpperCase() ?? "?";
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };

  return (
    <div className={cn("rounded-full overflow-hidden flex-shrink-0", sizeClasses[size], className)}>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={size === "lg" ? 56 : size === "md" ? 40 : 32}
          height={size === "lg" ? 56 : size === "md" ? 40 : 32}
          className="object-cover w-full h-full"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-white"
          style={{ background: `hsl(${hue} 50% 48%)` }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

// ── Spiele Tab (from discover) ─────────────────────────────────────────────────

function SpielTab({
  activeTab,
  setActiveTab,
  userGames,
  playCountMap,
}: {
  activeTab: SpielSubTab;
  setActiveTab: (t: SpielSubTab) => void;
  userGames: LibraryGame[];
  playCountMap: Record<string, number>;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex gap-1 px-4 pt-3 pb-2">
        {([
          { key: "ungespielt" as SpielSubTab, label: "Ungespielt" },
          { key: "heute" as SpielSubTab, label: "Was heute spielen?" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              activeTab === key
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "ungespielt" && <UngespieltTab userGames={userGames} playCountMap={playCountMap} />}
      {activeTab === "heute" && <HeuteTab userGames={userGames} playCountMap={playCountMap} />}
    </div>
  );
}

// ── Ungespielt ─────────────────────────────────────────────────────────────────

function UngespieltTab({
  userGames,
  playCountMap,
}: {
  userGames: LibraryGame[];
  playCountMap: Record<string, number>;
}) {
  const unplayed = userGames
    .filter((ug) => ug.status === "owned" && !playCountMap[ug.game_id] && ug.game)
    .sort((a, b) => (b.personal_rating ?? b.game?.rating_avg ?? 0) - (a.personal_rating ?? a.game?.rating_avg ?? 0));

  if (unplayed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="font-display text-xl font-semibold mb-2">Alles gespielt!</h3>
        <p className="text-muted-foreground text-sm">Du hast alle deine Spiele mindestens einmal gespielt. Respekt!</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8">
      <p className="text-xs text-muted-foreground mb-3 font-medium">
        {unplayed.length} {unplayed.length === 1 ? "Spiel" : "Spiele"} noch nie gespielt · sortiert nach Bewertung
      </p>
      <div className="flex flex-col gap-2">
        {unplayed.map((ug) => {
          const g = ug.game!;
          return (
            <Link
              key={ug.game_id}
              href={`/games/${g.id}`}
              className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover transition-all active:scale-[0.99]"
            >
              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {g.thumbnail_url ? (
                  <Image src={g.thumbnail_url} alt={g.name} fill className="object-cover" sizes="56px" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-amber-100">
                    <span className="text-amber-600 font-bold text-xl">{g.name[0]}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                {g.year_published && <p className="text-xs text-muted-foreground">{g.year_published}</p>}
                <div className="flex items-center gap-3 mt-1">
                  {(g.min_players || g.max_players) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users size={10} /> {formatPlayerCount(g.min_players, g.max_players)}
                    </span>
                  )}
                  {(g.min_playtime || g.max_playtime) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={10} /> {formatPlaytime(g.min_playtime, g.max_playtime)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {ug.personal_rating != null ? (
                  <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                    <Star size={10} fill="currentColor" />{ug.personal_rating}
                  </span>
                ) : g.rating_avg != null ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Star size={9} strokeWidth={1.5} />{g.rating_avg.toFixed(1)}
                  </span>
                ) : null}
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Was heute spielen? ─────────────────────────────────────────────────────────

function HeuteTab({
  userGames,
  playCountMap,
}: {
  userGames: LibraryGame[];
  playCountMap: Record<string, number>;
}) {
  const [players, setPlayers] = useState(3);
  const [time, setTime] = useState(90);
  const [suggestions, setSuggestions] = useState<LibraryGame[] | null>(null);

  const ownedGames = userGames.filter((ug) => ug.status === "owned" && ug.game);

  function findGames() {
    const matches = ownedGames.filter((ug) => {
      const g = ug.game!;
      return (
        (g.min_players == null || players >= g.min_players) &&
        (g.max_players == null || players <= g.max_players) &&
        (g.min_playtime == null || g.min_playtime <= time)
      );
    });

    setSuggestions(
      matches
        .sort((a, b) => {
          const rA = a.personal_rating ?? a.game?.rating_avg ?? 0;
          const rB = b.personal_rating ?? b.game?.rating_avg ?? 0;
          if (rB !== rA) return rB - rA;
          return (playCountMap[b.game_id] ?? 0) - (playCountMap[a.game_id] ?? 0);
        })
        .slice(0, 8)
    );
  }

  return (
    <div className="px-4 pb-8">
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <Users size={14} className="text-amber-500" /> Spieleranzahl
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => { setPlayers(n); setSuggestions(null); }}
                  className={cn(
                    "w-9 h-9 rounded-xl text-sm font-semibold transition-all",
                    players === n ? "bg-amber-500 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700"
                  )}
                  aria-pressed={players === n}
                >
                  {n === 8 ? "8+" : n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Clock size={14} className="text-amber-500" /> Max. Zeit
              </label>
              <span className="text-sm font-bold text-amber-600 w-16 text-right">
                {time < 60 ? `${time} Min` : `${Math.floor(time / 60)}h${time % 60 > 0 ? ` ${time % 60}m` : ""}`}
              </span>
            </div>
            <input
              type="range" min={15} max={240} step={15} value={time}
              onChange={(e) => { setTime(Number(e.target.value)); setSuggestions(null); }}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>15 Min</span><span>4h</span>
            </div>
          </div>
        </div>
        <button
          onClick={findGames}
          className="w-full mt-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Dices size={16} /> Spiele finden
        </button>
      </div>

      {suggestions !== null && (
        suggestions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">Kein passendes Spiel gefunden.</p>
            <p className="text-xs text-muted-foreground mt-1">Versuch mehr Spieler oder mehr Zeit.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              {suggestions.length} passende Spiele für {players} Spieler · max. {time} Min.
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((ug) => {
                const g = ug.game!;
                return (
                  <Link
                    key={ug.game_id}
                    href={`/games/${g.id}`}
                    className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card active:scale-[0.99] transition-all"
                  >
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {g.thumbnail_url ? (
                        <Image src={g.thumbnail_url} alt={g.name} fill className="object-cover" sizes="56px" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-amber-100">
                          <span className="text-amber-600 font-bold text-xl">{g.name[0]}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {(g.min_players || g.max_players) && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users size={10} /> {formatPlayerCount(g.min_players, g.max_players)}
                          </span>
                        )}
                        {(g.min_playtime || g.max_playtime) && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={10} /> {formatPlaytime(g.min_playtime, g.max_playtime)}
                          </span>
                        )}
                      </div>
                      {playCountMap[ug.game_id] > 0 && (
                        <p className="text-[10px] text-amber-600 font-medium mt-0.5">{playCountMap[ug.game_id]}× gespielt</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {ug.personal_rating != null ? (
                        <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                          <Star size={10} fill="currentColor" />{ug.personal_rating}
                        </span>
                      ) : g.rating_avg != null ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Star size={9} strokeWidth={1.5} />{g.rating_avg.toFixed(1)}
                        </span>
                      ) : null}
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )
      )}
    </div>
  );
}
