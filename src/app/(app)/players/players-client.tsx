"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  UserPlus, UserCheck, UserX, Clock, X, Search,
  Users, MessageSquare, Mail, ChevronRight, MoreHorizontal,
  MapPin, Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FriendProfile } from "@/types";

type NearbyStatus = "idle" | "locating" | "loading" | "done" | "denied" | "error";

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
  const [friends, setFriends] = useState(initialFriends);
  const [pendingReceived, setPendingReceived] = useState(initialPendingReceived);
  const [pendingSent, setPendingSent] = useState(initialPendingSent);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlayer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>("idle");
  const [nearbyResults, setNearbyResults] = useState<SearchPlayer[] | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState(50);

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

  function handleNearbySearch(radius = nearbyRadius) {
    if (!navigator.geolocation) {
      setNearbyStatus("error");
      return;
    }
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
        } catch {
          setNearbyStatus("error");
        }
      },
      () => setNearbyStatus("denied"),
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  function clearNearby() {
    setNearbyStatus("idle");
    setNearbyResults(null);
  }

  async function sendRequest(player: SearchPlayer) {
    const res = await fetch("/api/friendships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressee_id: player.id }),
    });
    if (res.ok) {
      const data = await res.json() as { id: string };
      setSearchResults((prev) =>
        prev?.map((p) =>
          p.id === player.id
            ? { ...p, friendship: { id: data.id, status: "pending", is_requester: true } }
            : p
        ) ?? null
      );
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
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-4 pb-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground leading-tight">Spieler</h1>
            {totalPending > 0 && (
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                {totalPending} offene {totalPending === 1 ? "Anfrage" : "Anfragen"}
              </p>
            )}
          </div>
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
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full">
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
          nearbyStatus={nearbyStatus}
          nearbyResults={nearbyResults}
          nearbyRadius={nearbyRadius}
          onNearbySearch={handleNearbySearch}
          onNearbyRadiusChange={setNearbyRadius}
          onClearNearby={clearNearby}
        />
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
  nearbyStatus,
  nearbyResults,
  nearbyRadius,
  onNearbySearch,
  onNearbyRadiusChange,
  onClearNearby,
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
  nearbyStatus: NearbyStatus;
  nearbyResults: SearchPlayer[] | null;
  nearbyRadius: number;
  onNearbySearch: (radius?: number) => void;
  onNearbyRadiusChange: (r: number) => void;
  onClearNearby: () => void;
}) {
  const showNearby = nearbyStatus !== "idle";

  return (
    <div className="flex flex-col gap-0 px-4 pb-8">
      {/* Search */}
      <div className="pt-4 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchInput(e.target.value);
              if (showNearby) onClearNearby();
            }}
            placeholder="Spieler suchen…"
            className="w-full h-11 pl-9 pr-4 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all min-w-0"
          />
          {searchQuery.length > 0 && (
            <button
              onClick={() => onSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-0.5"
              aria-label="Suche löschen"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Nearby search button row */}
      {!showSearch && (
        <div className="flex items-center gap-2 pb-3">
          <div className="flex gap-1">
            {[25, 50, 100].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onNearbyRadiusChange(r);
                  onNearbySearch(r);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border",
                  nearbyStatus !== "idle" && nearbyRadius === r
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                )}
              >
                {r} km
              </button>
            ))}
          </div>
          {showNearby ? (
            <button
              onClick={onClearNearby}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} /> Schließen
            </button>
          ) : (
            <button
              onClick={() => onNearbySearch()}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-xs font-medium text-foreground hover:border-amber-400 transition-colors"
            >
              <Navigation size={12} />
              In meiner Nähe
            </button>
          )}
        </div>
      )}

      {/* Nearby results */}
      {showNearby && !showSearch && (
        <div className="flex flex-col gap-2 mb-4">
          {(nearbyStatus === "locating" || nearbyStatus === "loading") && (
            <p className="text-xs text-muted-foreground px-1 animate-pulse">
              {nearbyStatus === "locating" ? "Standort wird ermittelt…" : "Spieler werden gesucht…"}
            </p>
          )}
          {nearbyStatus === "denied" && (
            <div className="py-4 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
              <MapPin size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Standortzugriff verweigert</p>
              <p className="text-xs text-muted-foreground mt-1">Bitte in den Browser-Einstellungen erlauben.</p>
            </div>
          )}
          {nearbyStatus === "error" && (
            <p className="text-sm text-red-600 px-1">Fehler beim Abrufen der Spieler. Bitte erneut versuchen.</p>
          )}
          {nearbyStatus === "done" && nearbyResults !== null && nearbyResults.length === 0 && (
            <div className="py-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
              <MapPin size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Keine Spieler in der Nähe</p>
              <p className="text-xs text-muted-foreground mt-1">
                Im Umkreis von {nearbyRadius} km gibt es noch keine Spieler. Versuche einen größeren Radius.
              </p>
            </div>
          )}
          {nearbyStatus === "done" && nearbyResults !== null && nearbyResults.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground font-medium px-0.5">
                {nearbyResults.length} {nearbyResults.length === 1 ? "Spieler" : "Spieler"} im Umkreis von {nearbyRadius} km
              </p>
              {nearbyResults.map((player) => (
                <SearchResultCard
                  key={player.id}
                  player={player}
                  onSendRequest={onSendRequest}
                  onCancelRequest={onCancelRequest}
                  showDistance
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Text Search Results */}
      {showSearch ? (
        <div className="flex flex-col gap-2">
          {searching && (
            <p className="text-xs text-muted-foreground px-1 animate-pulse">Suche…</p>
          )}
          {!searching && searchResults !== null && searchResults.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Kein Spieler gefunden.</p>
              <p className="text-xs text-muted-foreground mt-1">Versuche einen anderen Nutzernamen.</p>
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
              {player.distance_km < 1
                ? `< 1 km`
                : `${Math.round(player.distance_km)} km`}
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
        <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" />
      </Link>

      <Link href={`/players/${p.id}`} className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.username}</p>
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

        {/* ⋯ menu — dropdown anchored to button so it can't overlap it */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowActions((v) => !v)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground active:bg-muted transition-colors"
            aria-label="Optionen"
            aria-expanded={showActions}
          >
            <MoreHorizontal size={16} />
          </button>

          {showActions && (
            <div className="absolute right-0 top-full mt-1.5 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[152px]">
              <button
                onClick={handleRemove}
                disabled={removing}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <UserX size={14} />
                {removing ? "…" : "Freund entfernen"}
              </button>
              <div className="border-t border-border" />
              <button
                onClick={() => setShowActions(false)}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-muted-foreground text-sm hover:bg-muted transition-colors"
              >
                <X size={14} />
                Abbrechen
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
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border opacity-70">
      <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.username}</p>
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
