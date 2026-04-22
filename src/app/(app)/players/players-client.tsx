"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  UserPlus, UserCheck, UserX, Clock, X, Search,
  Users, MessageSquare, Mail, MoreHorizontal,
  MapPin, LocateFixed, ArrowDownAZ, Ruler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FriendProfile } from "@/types";

type NearbyStatus = "idle" | "locating" | "loading" | "done" | "denied" | "error";
type SortMode = "az" | "entfernung";
type PlayersTab = "freunde" | "suche";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  friends: FriendProfile[];
  pendingReceived: FriendProfile[];
  pendingSent: FriendProfile[];
  unreadCount: number;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PlayersClient({
  friends: initialFriends,
  pendingReceived: initialPendingReceived,
  pendingSent: initialPendingSent,
  unreadCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<PlayersTab>("freunde");
  const [friends, setFriends] = useState(initialFriends);
  const [pendingReceived, setPendingReceived] = useState(initialPendingReceived);
  const [pendingSent, setPendingSent] = useState(initialPendingSent);

  // Search state — kept here so it persists across tab switches
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlayer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>("idle");
  const [nearbyResults, setNearbyResults] = useState<SearchPlayer[] | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState(50);

  const [sortMode, setSortMode] = useState<SortMode>("az");

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    if (searchRef.current) clearTimeout(searchRef.current);

    // If typing, clear nearby results
    if (val.trim().length >= 2) {
      setNearbyStatus("idle");
      setNearbyResults(null);
    }

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

  function handleNearbySearch(radius = nearbyRadius) {
    if (!navigator.geolocation) {
      setNearbyStatus("error");
      return;
    }
    // Clear text search when doing nearby
    setSearchQuery("");
    setSearchResults(null);
    setNearbyStatus("locating");
    setNearbyResults(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setNearbyStatus("loading");
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `/api/players/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}`
          );
          const data = await res.json() as { players: SearchPlayer[] };
          setNearbyResults(data.players ?? []);
          setNearbyStatus("done");
          setSortMode("entfernung"); // default to distance sort for nearby
        } catch {
          setNearbyStatus("error");
        }
      },
      () => setNearbyStatus("denied"),
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults(null);
    setNearbyStatus("idle");
    setNearbyResults(null);
    setSortMode("az");
  }

  async function sendRequest(player: SearchPlayer) {
    const res = await fetch("/api/friendships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressee_id: player.id }),
    });
    if (res.ok) {
      const data = await res.json() as { id: string };
      const updateFriendship = (p: SearchPlayer) =>
        p.id === player.id
          ? { ...p, friendship: { id: data.id, status: "pending", is_requester: true } }
          : p;
      setSearchResults((prev) => prev?.map(updateFriendship) ?? null);
      setNearbyResults((prev) => prev?.map(updateFriendship) ?? null);
      setPendingSent((prev) => [
        {
          friendship_id: data.id,
          friendship_status: "pending",
          is_requester: true,
          profile: {
            id: player.id, username: player.username,
            display_name: player.display_name, avatar_url: player.avatar_url,
            location: player.location, library_visibility: "friends",
          },
        },
        ...prev,
      ]);
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
      if (action === "accept" && entry) {
        setFriends((prev) => [...prev, { ...entry, friendship_status: "accepted" }]);
      }
    }
  }

  async function removeFriend(friendshipId: string) {
    const removed = friends.find((f) => f.friendship_id === friendshipId);
    const res = await fetch(`/api/friendships/${friendshipId}`, { method: "DELETE" });
    if (res.ok) {
      setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
      // Critical: also clear friendship from search/nearby results so user can re-add
      if (removed) {
        const userId = removed.profile.id;
        const clearFn = (p: SearchPlayer) => p.id === userId ? { ...p, friendship: null } : p;
        setSearchResults((prev) => prev?.map(clearFn) ?? null);
        setNearbyResults((prev) => prev?.map(clearFn) ?? null);
      }
    }
  }

  const totalPending = pendingReceived.length;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)]">
      {/* Sticky header with tab bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-4 pb-0">
        <div className="max-w-2xl mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground leading-tight">
                Spieler
              </h1>
              {totalPending > 0 && activeTab === "freunde" && (
                <p className="text-xs text-amber-600 font-medium mt-0.5">
                  {totalPending} offene {totalPending === 1 ? "Anfrage" : "Anfragen"}
                </p>
              )}
            </div>
            <Link
              href="/players/messages"
              className="relative p-2.5 rounded-xl hover:bg-muted transition-colors"
              aria-label="Nachrichten"
            >
              <Mail size={20} className="text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-muted/70 rounded-xl mb-0">
            <TabButton
              active={activeTab === "freunde"}
              onClick={() => setActiveTab("freunde")}
              badge={totalPending > 0 ? totalPending : undefined}
            >
              Freunde
            </TabButton>
            <TabButton
              active={activeTab === "suche"}
              onClick={() => setActiveTab("suche")}
            >
              Suche
            </TabButton>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full">
        {activeTab === "freunde" ? (
          <FreundeTab
            friends={friends}
            pendingReceived={pendingReceived}
            pendingSent={pendingSent}
            onRespondToRequest={respondToRequest}
            onRemoveFriend={removeFriend}
            onCancelRequest={cancelRequest}
          />
        ) : (
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
            onClearSearch={clearSearch}
            onSortChange={setSortMode}
            onSendRequest={sendRequest}
            onCancelRequest={cancelRequest}
          />
        )}
      </div>
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {badge !== undefined && (
        <span className={cn(
          "text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center",
          active ? "bg-amber-500 text-white" : "bg-amber-500/20 text-amber-600"
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Freunde Tab ───────────────────────────────────────────────────────────────

function FreundeTab({
  friends,
  pendingReceived,
  pendingSent,
  onRespondToRequest,
  onRemoveFriend,
  onCancelRequest,
}: {
  friends: FriendProfile[];
  pendingReceived: FriendProfile[];
  pendingSent: FriendProfile[];
  onRespondToRequest: (fId: string, action: "accept" | "decline") => Promise<void>;
  onRemoveFriend: (fId: string) => Promise<void>;
  onCancelRequest: (fId: string, pId: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col px-4 pt-4 pb-8 gap-4">
      {/* Incoming requests */}
      {pendingReceived.length > 0 && (
        <section>
          <SectionLabel>Anfragen ({pendingReceived.length})</SectionLabel>
          <div className="flex flex-col gap-2">
            {pendingReceived.map((fp) => (
              <PendingRequestCard key={fp.friendship_id} fp={fp} onRespond={onRespondToRequest} />
            ))}
          </div>
        </section>
      )}

      {/* Friends */}
      <section>
        {friends.length > 0 && (
          <SectionLabel>Freunde ({friends.length})</SectionLabel>
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
              Wechsle zum Tab &quot;Suche&quot; um andere Spieler zu finden.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((fp) => (
              <FriendCard key={fp.friendship_id} fp={fp} onRemove={onRemoveFriend} />
            ))}
          </div>
        )}
      </section>

      {/* Sent requests */}
      {pendingSent.length > 0 && (
        <section>
          <SectionLabel>Gesendete Anfragen</SectionLabel>
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

// ── Suche Tab ─────────────────────────────────────────────────────────────────

function SucheTab({
  searchQuery,
  searchResults,
  searching,
  nearbyStatus,
  nearbyResults,
  nearbyRadius,
  sortMode,
  onSearchInput,
  onNearbySearch,
  onNearbyRadiusChange,
  onClearSearch,
  onSortChange,
  onSendRequest,
  onCancelRequest,
}: {
  searchQuery: string;
  searchResults: SearchPlayer[] | null;
  searching: boolean;
  nearbyStatus: NearbyStatus;
  nearbyResults: SearchPlayer[] | null;
  nearbyRadius: number;
  sortMode: SortMode;
  onSearchInput: (v: string) => void;
  onNearbySearch: (radius?: number) => void;
  onNearbyRadiusChange: (r: number) => void;
  onClearSearch: () => void;
  onSortChange: (mode: SortMode) => void;
  onSendRequest: (p: SearchPlayer) => Promise<void>;
  onCancelRequest: (fId: string, pId: string) => Promise<void>;
}) {
  // Determine which results are active and merge
  const isNearby = nearbyStatus === "done" && nearbyResults !== null;
  const activeResults: SearchPlayer[] = searchResults ?? (isNearby ? nearbyResults! : []);
  const hasDistances = activeResults.some((p) => p.distance_km !== undefined);
  const hasAnyResults = activeResults.length > 0;

  // Sort results
  const sortedResults = [...activeResults].sort((a, b) => {
    if (sortMode === "entfernung" && hasDistances) {
      return (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity);
    }
    return a.username.localeCompare(b.username, "de", { sensitivity: "base" });
  });

  const isLoading = searching || nearbyStatus === "locating" || nearbyStatus === "loading";
  const showEmpty =
    !isLoading &&
    ((searchResults !== null && searchResults.length === 0) ||
      (nearbyStatus === "done" && nearbyResults !== null && nearbyResults.length === 0));

  return (
    <div className="flex flex-col px-4 pt-4 pb-8 gap-3">
      {/* Text search input */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchInput(e.target.value)}
          placeholder="Spielername eingeben…"
          className="w-full h-11 pl-9 pr-9 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 transition-all min-w-0"
        />
        {(searchQuery.length > 0 || isNearby) && (
          <button
            onClick={onClearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70 transition-colors"
            aria-label="Suche zurücksetzen"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Nearby section */}
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground font-medium mr-1">Umkreis:</p>
        <div className="flex gap-1.5">
          {[25, 50, 100].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                onNearbyRadiusChange(r);
                onNearbySearch(r);
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                isNearby && nearbyRadius === r
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-amber-300 hover:text-foreground"
              )}
            >
              {r} km
            </button>
          ))}
        </div>
        <button
          onClick={() => onNearbySearch()}
          disabled={nearbyStatus === "locating" || nearbyStatus === "loading"}
          className={cn(
            "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
            isNearby
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "bg-card border-border text-foreground hover:border-amber-400 hover:text-amber-600"
          )}
        >
          <LocateFixed size={12} />
          {isNearby ? "Aktualisieren" : "In meiner Nähe"}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 py-1 px-0.5">
          <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            {nearbyStatus === "locating"
              ? "Standort wird ermittelt…"
              : nearbyStatus === "loading"
              ? "Spieler werden gesucht…"
              : "Suche…"}
          </p>
        </div>
      )}

      {/* Error / denied states */}
      {nearbyStatus === "denied" && (
        <div className="py-6 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
          <MapPin size={20} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Standortzugriff verweigert</p>
          <p className="text-xs text-muted-foreground mt-1">Bitte in den Browser-Einstellungen erlauben.</p>
        </div>
      )}
      {nearbyStatus === "error" && (
        <p className="text-sm text-red-600 px-0.5">Standort konnte nicht ermittelt werden.</p>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div className="py-10 text-center">
          {isNearby ? (
            <>
              <MapPin size={22} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">Keine Spieler in der Nähe</p>
              <p className="text-xs text-muted-foreground">
                Im Umkreis von {nearbyRadius} km noch niemand gefunden.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground mb-1">Kein Spieler gefunden</p>
              <p className="text-xs text-muted-foreground">Versuche einen anderen Nutzernamen.</p>
            </>
          )}
        </div>
      )}

      {/* Results with sort bar */}
      {hasAnyResults && (
        <>
          {/* Sort bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              {sortedResults.length} {sortedResults.length === 1 ? "Spieler" : "Spieler"}
              {isNearby && ` im Umkreis von ${nearbyRadius} km`}
            </p>
            <div className="flex gap-1 p-0.5 bg-muted/60 rounded-lg">
              <SortButton
                active={sortMode === "az"}
                onClick={() => onSortChange("az")}
                icon={<ArrowDownAZ size={12} />}
                label="A–Z"
              />
              <SortButton
                active={sortMode === "entfernung"}
                disabled={!hasDistances}
                onClick={() => hasDistances && onSortChange("entfernung")}
                icon={<Ruler size={12} />}
                label="Entfernung"
              />
            </div>
          </div>

          {/* Result cards */}
          <div className="flex flex-col gap-2">
            {sortedResults.map((player) => (
              <SearchResultCard
                key={player.id}
                player={player}
                onSendRequest={onSendRequest}
                onCancelRequest={onCancelRequest}
                showDistance={isNearby}
              />
            ))}
          </div>
        </>
      )}

      {/* Idle hint — no query entered yet */}
      {!isLoading && searchResults === null && !isNearby && nearbyStatus !== "denied" && nearbyStatus !== "error" && (
        <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Search size={24} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Spieler finden</p>
            <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">
              Suche nach Nutzernamen oder finde Spieler in deiner Nähe.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sort Button ───────────────────────────────────────────────────────────────

function SortButton({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Section Label ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground mb-2 px-0.5">
      {children}
    </p>
  );
}

// ── Search Result Card ─────────────────────────────────────────────────────────

function SearchResultCard({
  player,
  onSendRequest,
  onCancelRequest,
  showDistance,
}: {
  player: SearchPlayer;
  onSendRequest: (p: SearchPlayer) => Promise<void>;
  onCancelRequest: (fId: string, pId: string) => Promise<void>;
  showDistance?: boolean;
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
      <PlayerAvatar name={player.username} avatarUrl={player.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{player.username}</p>
          {showDistance && player.distance_km !== undefined && (
            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
              <MapPin size={9} />
              {player.distance_km < 1 ? `< 1 km` : `${Math.round(player.distance_km)} km`}
            </span>
          )}
        </div>
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
          {loading ? "…" : "Gesendet"}
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
      <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.username}</p>
        {p.location && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{p.location}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => handle("decline")}
          disabled={!!loading}
          className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center text-muted-foreground active:bg-muted transition-colors disabled:opacity-50"
          aria-label="Ablehnen"
        >
          <UserX size={15} />
        </button>
        <button
          onClick={() => handle("accept")}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-amber-500 text-white text-xs font-semibold active:bg-amber-600 transition-colors disabled:opacity-50"
        >
          <UserCheck size={14} />
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showActions) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActions]);

  async function handleRemove() {
    setRemoving(true);
    await onRemove(fp.friendship_id);
    setRemoving(false);
    setShowActions(false);
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card">
      <Link href={`/players/${p.id}`} className="flex-shrink-0">
        <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" />
      </Link>

      <Link href={`/players/${p.id}`} className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.username}</p>
        {p.location && (
          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{p.location}</p>
        )}
      </Link>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Link
          href={`/players/messages/${p.id}`}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/70 active:bg-muted/70 transition-colors"
          aria-label="Nachricht senden"
        >
          <MessageSquare size={15} />
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowActions((v) => !v)}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
              showActions
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label="Optionen"
            aria-expanded={showActions}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={16} />
          </button>

          {showActions && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 z-30 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[168px]"
            >
              <button
                role="menuitem"
                onClick={handleRemove}
                disabled={removing}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-red-600 text-sm font-medium hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
              >
                <UserX size={14} />
                {removing ? "Wird entfernt…" : "Freund entfernen"}
              </button>
            </div>
          )}
        </div>
      </div>
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
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border opacity-60">
      <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.username}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Anfrage ausstehend</p>
      </div>
      <button
        onClick={handle}
        disabled={cancelling}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium border border-border disabled:opacity-50 active:bg-muted/70 transition-colors"
      >
        <X size={11} />
        {cancelling ? "…" : "Widerrufen"}
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
          className="w-full h-full flex items-center justify-center font-semibold text-white"
          style={{ background: `hsl(${hue} 45% 50%)` }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
