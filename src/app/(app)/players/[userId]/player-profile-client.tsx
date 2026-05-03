"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MessageSquare, UserPlus, UserCheck, UserX, Clock,
  BookOpen, Lock, Globe, Users, Eye, ListOrdered,
} from "lucide-react";
import { PlayerAvatar } from "../players-client";
import { cn } from "@/lib/utils";
import type { FriendProfile, LibraryVisibility } from "@/types";

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

interface PlaylistEntry {
  rank: number;
  game: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    min_playtime: number | null;
    max_playtime: number | null;
    min_players: number | null;
    max_players: number | null;
  };
}

interface Props {
  currentUserId: string;
  targetProfile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    location: string | null;
    library_visibility: LibraryVisibility;
  };
  friendData: FriendProfile | null;
  library: FriendGame[];
  playCountMap: Record<string, number>;
  canSeeLibrary: boolean;
  playlist: PlaylistEntry[];
  playlistHidden: boolean;
  unreadFromUser: number;
}

const VISIBILITY_LABELS: Record<LibraryVisibility, { label: string; icon: React.ReactNode }> = {
  public: { label: "Öffentlich", icon: <Globe size={11} /> },
  friends: { label: "Nur Freunde", icon: <Users size={11} /> },
  private: { label: "Privat", icon: <Lock size={11} /> },
};

export function PlayerProfileClient({
  targetProfile,
  friendData,
  library,
  playCountMap,
  canSeeLibrary,
  playlist,
  playlistHidden,
  unreadFromUser,
}: Props) {
  const router = useRouter();
  const [localFriendData, setLocalFriendData] = useState(friendData);
  const [actionLoading, setActionLoading] = useState(false);
  const [profileTab, setProfileTab] = useState<"bibliothek" | "playlist">("bibliothek");

  const fp = localFriendData;
  const p = targetProfile;
  const isFriend = fp?.friendship_status === "accepted";
  const isPendingSent = fp?.friendship_status === "pending" && fp.is_requester;
  const isPendingReceived = fp?.friendship_status === "pending" && !fp.is_requester;

  async function sendRequest() {
    setActionLoading(true);
    const res = await fetch("/api/friendships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressee_id: p.id }),
    });
    if (res.ok) {
      const data = await res.json() as { id: string };
      setLocalFriendData({
        friendship_id: data.id,
        friendship_status: "pending",
        is_requester: true,
        profile: { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, location: p.location, library_visibility: p.library_visibility },
      });
    }
    setActionLoading(false);
  }

  async function respondToRequest(action: "accept" | "decline") {
    if (!fp) return;
    setActionLoading(true);
    const res = await fetch(`/api/friendships/${fp.friendship_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      if (action === "accept") {
        setLocalFriendData({ ...fp, friendship_status: "accepted" });
        router.refresh(); // Reload to get library
      } else {
        setLocalFriendData(null);
      }
    }
    setActionLoading(false);
  }

  async function cancelOrRemove() {
    if (!fp) return;
    setActionLoading(true);
    const res = await fetch(`/api/friendships/${fp.friendship_id}`, { method: "DELETE" });
    if (res.ok) {
      setLocalFriendData(null);
      if (isFriend) router.refresh();
    }
    setActionLoading(false);
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-display text-lg font-semibold flex-1 min-w-0 truncate">
          {p.username}
        </span>
        {unreadFromUser > 0 && (
          <Link
            href={`/players/messages/${p.id}`}
            className="relative p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <MessageSquare size={20} className="text-amber-500" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadFromUser}
            </span>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-5 px-4 py-5 max-w-2xl mx-auto w-full">

        {/* Profile Header Card */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4 shadow-card">
          <PlayerAvatar
            name={p.username}
            avatarUrl={p.avatar_url}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-semibold text-foreground leading-tight">
              {p.username}
            </h1>
            {p.location && (
              <p className="text-xs text-muted-foreground mt-1">{p.location}</p>
            )}
            {p.bio && (
              <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{p.bio}</p>
            )}
          </div>
        </div>

        {/* Actions Card */}
        <div className="flex gap-2">
          {/* Message button */}
          <Link
            href={`/players/messages/${p.id}`}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-muted text-foreground text-sm font-medium border border-border hover:bg-muted/70 transition-colors active:scale-[0.98]"
          >
            <MessageSquare size={15} />
            Nachricht
          </Link>

          {/* Friendship action */}
          {!fp && (
            <button
              onClick={sendRequest}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              <UserPlus size={15} />
              {actionLoading ? "…" : "Hinzufügen"}
            </button>
          )}

          {isPendingSent && (
            <button
              onClick={cancelOrRemove}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-muted text-muted-foreground text-sm font-medium border border-border disabled:opacity-50"
            >
              <Clock size={15} />
              {actionLoading ? "…" : "Anfrage gesendet"}
            </button>
          )}

          {isPendingReceived && (
            <div className="flex-1 flex gap-2">
              <button
                onClick={() => respondToRequest("decline")}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center h-11 rounded-xl bg-muted text-muted-foreground text-sm font-medium border border-border disabled:opacity-50"
              >
                <UserX size={15} />
              </button>
              <button
                onClick={() => respondToRequest("accept")}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                <UserCheck size={15} />
                {actionLoading ? "…" : "Annehmen"}
              </button>
            </div>
          )}

          {isFriend && (
            <button
              onClick={cancelOrRemove}
              disabled={actionLoading}
              className="flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-muted text-foreground text-sm font-medium border border-border hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
              aria-label="Freundschaft beenden"
            >
              <UserCheck size={15} className="text-green-600" />
              Befreundet
            </button>
          )}
        </div>

        {/* Tab bar: Bibliothek / Playlist */}
        <div className="flex items-end border-b border-border -mx-4 px-4">
          <ProfileTabButton
            active={profileTab === "bibliothek"}
            onClick={() => setProfileTab("bibliothek")}
            icon={<BookOpen size={14} />}
          >
            Bibliothek
          </ProfileTabButton>
          <ProfileTabButton
            active={profileTab === "playlist"}
            onClick={() => setProfileTab("playlist")}
            icon={<ListOrdered size={14} />}
          >
            Playlist
          </ProfileTabButton>
          {/* Visibility badge */}
          <span className={cn(
            "ml-auto mb-2 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0",
            p.library_visibility === "public"
              ? "bg-green-50 text-green-700"
              : p.library_visibility === "friends"
              ? "bg-blue-50 text-blue-700"
              : "bg-muted text-muted-foreground"
          )}>
            {VISIBILITY_LABELS[p.library_visibility].icon}
            {VISIBILITY_LABELS[p.library_visibility].label}
          </span>
        </div>

        {/* Bibliothek Tab */}
        {profileTab === "bibliothek" && (
          <section>
            {!canSeeLibrary ? (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
                <Lock size={24} className="text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">Bibliothek nicht sichtbar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {p.library_visibility === "private"
                    ? "Diese Bibliothek ist privat."
                    : "Werde Freund, um die Bibliothek zu sehen."}
                </p>
              </div>
            ) : library.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Noch keine Spiele in der Bibliothek.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3 font-medium">
                  {library.filter((g) => g.status === "owned").length} im Besitz
                  {library.filter((g) => g.status === "wishlist").length > 0 && ` · ${library.filter((g) => g.status === "wishlist").length} Wunschliste`}
                  {library.filter((g) => g.status === "for_sale").length > 0 && ` · ${library.filter((g) => g.status === "for_sale").length} zu verkaufen`}
                </p>
                {/* Library transparency note */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5 mb-3">
                  <Eye size={10} className="flex-shrink-0" />
                  <span>Du siehst: Cover, Spielname und Anzahl Partien</span>
                </div>
                <div className="flex flex-col gap-2">
                  {library.map((ug) => {
                    if (!ug.game) return null;
                    const g = ug.game;
                    const plays = playCountMap[ug.game_id] ?? 0;
                    const isWishlist = ug.status === "wishlist";
                    const isForSale = ug.status === "for_sale";
                    return (
                      <div
                        key={ug.id}
                        className={cn(
                          "flex items-center gap-3 p-3 bg-card rounded-xl border shadow-card",
                          isForSale ? "border-green-200" : "border-border"
                        )}
                      >
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {g.thumbnail_url ? (
                            <Image
                              src={g.thumbnail_url}
                              alt={g.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-amber-100">
                              <span className="text-amber-600 font-bold text-base">{g.name[0]}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                          {plays > 0 && (
                            <p className="text-xs text-amber-600 font-medium">{plays}× gespielt</p>
                          )}
                        </div>
                        {/* Status badge */}
                        {isWishlist && (
                          <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            Wunschliste
                          </span>
                        )}
                        {isForSale && (
                          <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            {ug.sale_price != null
                              ? `€ ${ug.sale_price.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                              : "Zu verk."}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {/* Playlist Tab */}
        {profileTab === "playlist" && (
          <section>
            {playlistHidden ? (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
                <Lock size={24} className="text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">Playlist nicht sichtbar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {p.library_visibility === "private"
                    ? "Diese Playlist ist privat."
                    : "Werde Freund, um die Playlist zu sehen."}
                </p>
              </div>
            ) : playlist.length === 0 ? (
              <div className="py-10 text-center">
                <ListOrdered size={28} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Noch keine Spiele auf der Playlist.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3 font-medium">
                  {playlist.length} {playlist.length === 1 ? "Spiel" : "Spiele"} auf der Wunschspielliste
                </p>
                <div className="flex flex-col gap-2">
                  {playlist.map((entry) => {
                    const g = entry.game;
                    const playtimeLabel = g.max_playtime
                      ? `${g.min_playtime ?? g.max_playtime}–${g.max_playtime} Min.`
                      : g.min_playtime
                      ? `${g.min_playtime} Min.`
                      : null;
                    return (
                      <div key={g.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card">
                        {/* Rank badge */}
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-amber-700">#{entry.rank}</span>
                        </div>
                        {/* Cover */}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {g.thumbnail_url ? (
                            <Image
                              src={g.thumbnail_url}
                              alt={g.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-amber-100">
                              <span className="text-amber-600 font-bold text-base">{g.name[0]}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate leading-tight">{g.name}</p>
                          {playtimeLabel && (
                            <p className="text-xs text-muted-foreground mt-0.5">{playtimeLabel}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ── Profile Tab Button ─────────────────────────────────────────────────────────

function ProfileTabButton({
  active, onClick, children, icon,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 py-2.5 pr-5 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
      )}
    >
      {icon}
      {children}
      <span className={cn(
        "absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-200",
        active ? "bg-amber-500 opacity-100" : "opacity-0"
      )} />
    </button>
  );
}
