"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  UserPlus, UserCheck, UserX, Clock, X, Search,
  Users, MessageSquare, Mail, MoreHorizontal,
  MapPin, LocateFixed,
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
    <div className="flex flex-col px-4 pb-8">
      {/* Search input */}
      <div className="pt-4 pb-2">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchInput(e.target.value);
              if (showNearby) onClearNearby();
            }}
            placeholder="Spieler suchen…"
            className="w-full h-11 pl-9 pr-9 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 transition-all min-w-0"
          />
          {searchQuery.length > 0 && (
            <button
              onClick={() => onSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70 transition-colors"
              aria-label="Suche löschen"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Nearby search controls */}
      {!showSearch && (
        <div className="flex items-center gap-2 pb-4">
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
                  nearbyStatus !== "idle" && nearbyRadius === r
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-amber-300 hover:text-foreground"
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
              <X size={11} />
              Schließen
            </button>
          ) : (
            <button
              onClick={() => onNearbySearch()}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-foreground hover:border-amber-400 hover:text-amber-600 transition-colors"
            >
              <LocateFixed size={12} />
              In meiner Nähe
            </button>
          )}
        </div>
      )}

      {/* Nearby results */}
      {showNearby && !showSearch && (
        <div className="flex flex-col gap-2 mb-5">
          {(nearbyStatus === "locating" || nearbyStatus === "loading") && (
            <div className="flex items-center gap-2 py-2 px-1">
              <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                {nearbyStatus === "locating" ? "Standort wird ermittelt…" : "Spieler werden gesucht…"}
              </p>
            </div>
          )}
          {nearbyStatus === "denied" && (
            <div className="py-6 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
              <MapPin size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Standortzugriff verweigert</p>
              <p className="text-xs text-muted-foreground mt-1">Bitte in den Browser-Einstellungen erlauben.</p>
            </div>
          )}
          {nearbyStatus === "error" && (
            <div className="py-4 px-1">
              <p className="text-sm text-red-600">Fehler beim Abrufen des Standorts. Bitte erneut versuchen.</p>
            </div>
          )}
          {nearbyStatus === "done" && nearbyResults !== null && nearbyResults.length === 0 && (
            <div className="py-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
              <MapPin size={22} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Keine Spieler in der Nähe</p>
              <p className="text-xs text-muted-foreground mt-1 px-4">
                Im Umkreis von {nearbyRadius} km noch niemand gefunden. Versuch einen größeren Radius.
              </p>
            </div>
          )}
          {nearbyStatus === "done" && nearbyResults !== null && nearbyResults.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground font-medium px-0.5 mb-1">
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

      {/* Text search results */}
      {showSearch ? (
        <div className="flex flex-col gap-2">
          {searching && (
            <div className="flex items-center gap-2 py-2 px-1">
              <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
              <p className="text-xs text-muted-foreground">Suche…</p>
            </div>
          )}
          {!searching && searchResults !== null && searchResults.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-foreground mb-1">Kein Spieler gefunden</p>
              <p className="text-xs text-muted-foreground">Versuche einen anderen Nutzernamen.</p>
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
          {/* Pending incoming requests */}
          {pendingReceived.length > 0 && (
            <section className="mb-5">
              <SectionLabel>Anfragen ({pendingReceived.length})</SectionLabel>
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

          {/* Friends list */}
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
                    <div className="mt-3 mb-1">
                      <SectionLabel>Gesendete Anfragen</SectionLabel>
                    </div>
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
          aria-label="Annehmen"
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

  // Close dropdown on outside click
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
      {/* Avatar → profile */}
      <Link href={`/players/${p.id}`} className="flex-shrink-0">
        <PlayerAvatar name={p.username} avatarUrl={p.avatar_url} size="md" />
      </Link>

      {/* Name + location → profile */}
      <Link href={`/players/${p.id}`} className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.username}</p>
        {p.location && (
          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{p.location}</p>
        )}
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Message */}
        <Link
          href={`/players/messages/${p.id}`}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/70 active:bg-muted/70 transition-colors"
          aria-label="Nachricht senden"
        >
          <MessageSquare size={15} />
        </Link>

        {/* Three-dot overflow menu */}
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
