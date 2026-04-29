"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Plus, X, Check, Trash2, Users, Clock, MapPin,
  Edit2, SlidersHorizontal, Camera, Calendar, Gamepad2,
  UserPlus, CheckCircle2, XCircle, ChevronDown, Share2, Copy, CheckCheck,
  Dices,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import type { PlannedSession } from "@/types";

// ── Local types ───────────────────────────────────────────────────────────────

interface LibraryGame {
  id: string;
  name: string;
  thumbnail_url: string | null;
  bgg_id: number;
}

interface FriendProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
}

interface PlayPlayer {
  id: string;
  display_name: string;
  score: number | null;
  winner: boolean;
  color: string | null;
}

interface Play {
  id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
  location: string | null;
  notes: string | null;
  cooperative: boolean;
  image_url?: string | null;
  game?: LibraryGame | null;
  players?: PlayPlayer[];
}

interface DraftPlayer {
  display_name: string;
  score: string;
  winner: boolean;
}

type PlaysTab = "geplant" | "vergangen";
type PlaySortKey = "date_desc" | "date_asc" | "game_asc";

// ── Main Component ─────────────────────────────────────────────────────────────

export function PlaysClient({
  initialPlays,
  libraryGames,
  plannedSessions: initialSessions,
  friends,
}: {
  initialPlays: Play[];
  libraryGames: LibraryGame[];
  plannedSessions: PlannedSession[];
  friends: FriendProfile[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<PlaysTab>("geplant");
  const [plays, setPlays] = useState<Play[]>(initialPlays);
  const [sessions, setSessions] = useState<PlannedSession[]>(initialSessions);

  // Past-play sheet
  const [pastSheetOpen, setPastSheetOpen] = useState(false);
  const [editPlay, setEditPlay] = useState<Play | null>(null);
  const [prefillPlayers, setPrefillPlayers] = useState<DraftPlayer[] | undefined>(undefined);

  // Session complete via play sheet — holds the session being completed
  const [completingSession, setCompletingSession] = useState<PlannedSession | null>(null);

  // Planned-session sheet
  const [plannedSheetOpen, setPlannedSheetOpen] = useState(false);

  // Sorting (past tab)
  const [sortKey, setSortKey] = useState<PlaySortKey>("date_desc");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Pre-fill players from score-tracker URL param OR from ?player=NAME (friend quick-record)
  useEffect(() => {
    // ?player=NAME — from "Partie aufzeichnen" in the friend sheet
    const playerName = searchParams.get("player");
    if (playerName) {
      setPrefillPlayers([{ display_name: playerName, score: "", winner: false }]);
      setPastSheetOpen(true);
      setActiveTab("vergangen");
      router.replace("/plays", { scroll: false });
      return;
    }

    // ?prefill=... — from score-tracker
    const prefill = searchParams.get("prefill");
    if (!prefill) return;
    try {
      const params = new URLSearchParams(decodeURIComponent(prefill));
      const players: DraftPlayer[] = [];
      let i = 0;
      while (params.has(`player_${i}_name`)) {
        players.push({
          display_name: params.get(`player_${i}_name`) ?? "",
          score: params.get(`player_${i}_score`) ?? "",
          winner: false,
        });
        i++;
      }
      if (players.length > 0) {
        setPrefillPlayers(players);
        setPastSheetOpen(true);
        router.replace("/plays", { scroll: false });
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    if (sortOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [sortOpen]);

  const sortedPlays = [...plays].sort((a, b) => {
    switch (sortKey) {
      case "date_desc": return new Date(b.played_at).getTime() - new Date(a.played_at).getTime();
      case "date_asc":  return new Date(a.played_at).getTime() - new Date(b.played_at).getTime();
      case "game_asc":  return (a.game?.name ?? "").localeCompare(b.game?.name ?? "", "de");
      default: return 0;
    }
  });

  async function handleDelete(id: string) {
    await fetch(`/api/plays/${id}`, { method: "DELETE" });
    setPlays((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
  }

  function handlePlayCreated(newPlays: Play[]) {
    setPlays((prev) => [...newPlays, ...prev]);
    setPastSheetOpen(false);
    router.refresh();
  }

  function handlePlayUpdated(play: Play) {
    setPlays((prev) => prev.map((p) => (p.id === play.id ? play : p)));
    setEditPlay(null);
    router.refresh();
  }

  function handleSessionCreated(session: PlannedSession) {
    setSessions((prev) => [session, ...prev].sort(
      (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
    ));
    setPlannedSheetOpen(false);
  }

  function handleSessionCompleted(sessionId: string) {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    router.refresh(); // reload plays list to show the newly created plays
  }

  // Called when the user saves plays via "Scores & Fotos erfassen" on a planned session.
  // After saving scores, we ALSO complete the session server-side so it leaves the Geplant
  // list immediately — no separate "Spielabend abschließen" click needed.
  // The complete route deduplicates: plays already created here are skipped (date-range
  // check), plays for other participants who don't have an entry yet are created automatically.
  async function handleSessionPlayCreated(newPlays: Play[]) {
    // Capture session ID before any state changes (async closure safety)
    const sessionId = completingSession?.id;

    // Close the sheet and optimistically show the new plays right away
    setCompletingSession(null);
    setPastSheetOpen(false);
    setPlays((prev) => [...newPlays, ...prev]);

    if (sessionId) {
      // Complete the session server-side (idempotent via dedup in complete route)
      await fetch(`/api/play-sessions/${sessionId}/complete`, { method: "POST" });
      // Remove the session from the local Geplant list
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }

    // Reload server state to show plays created for other participants
    router.refresh();
  }

  const pendingInviteCount = sessions.filter(
    (s) => !s.is_organizer && s.my_invite_status === "invited"
  ).length;

  return (
    <>
      <div className="flex flex-col min-h-[calc(100dvh-72px)]">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-4 pb-3">
          <div className="flex items-center justify-between max-w-2xl mx-auto mb-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Partien</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sessions.length} geplant · {plays.length} gespielt
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "vergangen" && (
                <div className="relative" ref={sortRef}>
                  <button
                    onClick={() => setSortOpen((o) => !o)}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Sortieren"
                  >
                    <SlidersHorizontal size={14} />
                  </button>
                  {sortOpen && (
                    <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-zinc-900 border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                      {([
                        { key: "date_desc", label: "Neueste zuerst" },
                        { key: "date_asc",  label: "Älteste zuerst" },
                        { key: "game_asc",  label: "Spiel A → Z" },
                      ] as { key: PlaySortKey; label: string }[]).map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => { setSortKey(opt.key); setSortOpen(false); }}
                          className={cn(
                            "w-full px-3 py-2.5 text-sm text-left transition-colors",
                            sortKey === opt.key
                              ? "bg-amber-50 text-amber-700 font-medium"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => activeTab === "geplant" ? setPlannedSheetOpen(true) : setPastSheetOpen(true)}
                className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-sm transition-colors"
                aria-label={activeTab === "geplant" ? "Spieleabend anlegen" : "Partie erfassen"}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* ── Tab toggle ─────────────────────────────────────────────────── */}
          <div className="max-w-2xl mx-auto">
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab("geplant")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative",
                  activeTab === "geplant"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar size={14} />
                Geplant
                {pendingInviteCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {pendingInviteCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("vergangen")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  activeTab === "vergangen"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Clock size={14} />
                Vergangen
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab content ────────────────────────────────────────────────────── */}
        <div className="px-4 py-4 max-w-2xl mx-auto w-full">
          {activeTab === "geplant" ? (
            sessions.length === 0 ? (
              <EmptyStateGeplant onAdd={() => setPlannedSheetOpen(true)} />
            ) : (
              <div className="flex flex-col gap-3">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onCompleted={handleSessionCompleted}
                    onRecordScores={(s) => setCompletingSession(s)}
                  />
                ))}
              </div>
            )
          ) : (
            sortedPlays.length === 0 ? (
              <EmptyStatePast onAdd={() => setPastSheetOpen(true)} />
            ) : (
              <div className="flex flex-col gap-2">
                {sortedPlays.map((play) => (
                  <PlayCard
                    key={play.id}
                    play={play}
                    onEdit={() => setEditPlay(play)}
                    onDelete={() => setDeleteId(play.id)}
                    showDeleteConfirm={deleteId === play.id}
                    onConfirmDelete={() => handleDelete(play.id)}
                    onCancelDelete={() => setDeleteId(null)}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Past play sheet ─────────────────────────────────────────────────── */}
      {pastSheetOpen && (
        <PastPlaySheet
          libraryGames={libraryGames}
          prefillPlayers={prefillPlayers}
          onClose={() => { setPastSheetOpen(false); setPrefillPlayers(undefined); }}
          onSaved={handlePlayCreated}
        />
      )}
      {editPlay && (
        <PastPlaySheet
          libraryGames={libraryGames}
          editPlay={editPlay}
          onClose={() => setEditPlay(null)}
          onSavedSingle={handlePlayUpdated}
        />
      )}
      {/* ── Complete session with scores ─────────────────────────────────────── */}
      {completingSession && (
        <PastPlaySheet
          libraryGames={libraryGames}
          sessionPrefill={completingSession}
          onClose={() => setCompletingSession(null)}
          onSaved={handleSessionPlayCreated}
        />
      )}

      {/* ── Planned session sheet ───────────────────────────────────────────── */}
      {plannedSheetOpen && (
        <PlannedSessionSheet
          libraryGames={libraryGames}
          friends={friends}
          onClose={() => setPlannedSheetOpen(false)}
          onSaved={handleSessionCreated}
        />
      )}
    </>
  );
}

// ── Play Card ─────────────────────────────────────────────────────────────────

function PlayCard({
  play, onEdit, onDelete, showDeleteConfirm, onConfirmDelete, onCancelDelete,
}: {
  play: Play;
  onEdit: () => void;
  onDelete: () => void;
  showDeleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/plays/import?from=${play.id}`
    : `/plays/import?from=${play.id}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // BGStats deep link — opens the BGStats app with this play pre-filled
  const bgStatsData = encodeURIComponent(JSON.stringify({
    game: {
      name: play.game?.name ?? "Unbekannt",
      ...(play.game?.bgg_id ? { bggId: play.game.bgg_id } : {}),
    },
    playDate: play.played_at.replace("T", " ").slice(0, 19),
    players: (play.players ?? []).map((p) => ({
      name: p.display_name,
      ...(p.score !== null ? { score: p.score } : {}),
      winner: p.winner,
    })),
    ...(play.duration_minutes ? { durationMin: play.duration_minutes } : {}),
    ...(play.location ? { location: play.location } : {}),
    sourceName: "MeepleBase",
  }));
  const bgStatsUrl = `bgstats://app.bgstatsapp.com/createPlay.html?data=${bgStatsData}`;

  const date = new Date(play.played_at);
  const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
  const winner = play.players?.find((p) => p.winner);
  const withScores = play.players?.some((p) => p.score != null) && !winner;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
      <Link href={`/plays/${play.id}`} className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors active:bg-muted/50">
        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {play.game?.thumbnail_url ? (
            <Image src={play.game.thumbnail_url} alt={play.game?.name ?? ""} fill className="object-cover" sizes="56px" />
          ) : (
            <div className="w-full h-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-600 font-bold text-lg">{play.game?.name?.[0] ?? "?"}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground leading-tight truncate">
            {play.game?.name ?? "Unbekanntes Spiel"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {play.players && play.players.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users size={11} />
                {play.players.map((p) => p.display_name).join(", ")}
              </span>
            )}
            {play.duration_minutes && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={11} />{play.duration_minutes} Min
              </span>
            )}
            {play.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={11} />{play.location}
              </span>
            )}
          </div>

          {winner && (
            <div className="mt-1.5">
              <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">
                🏆 {winner.display_name}{winner.score != null && ` (${winner.score})`}
              </span>
            </div>
          )}
          {withScores && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {play.players?.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((p) => (
                <span key={p.id} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {p.display_name}: {p.score}
                </span>
              ))}
            </div>
          )}
          {play.cooperative && (
            <span className="mt-1.5 inline-block text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">Kooperativ</span>
          )}
          {play.notes && (
            <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2">{play.notes}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0 mt-0.5">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Bearbeiten"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareOpen(true); }}
            className="text-muted-foreground hover:text-amber-500 transition-colors"
            aria-label="Teilen"
          >
            <Share2 size={14} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            className="text-muted-foreground hover:text-red-400 transition-colors"
            aria-label="Löschen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </Link>

      {/* Share modal */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="bg-card rounded-3xl p-5 w-full max-w-xs shadow-xl flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="font-display text-base font-semibold text-foreground">Partie teilen</p>
                <p className="text-xs text-muted-foreground mt-0.5">Mitspieler können sie übernehmen</p>
              </div>
              <button
                onClick={() => setShareOpen(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <div className="bg-white rounded-2xl p-3 shadow-inner">
              <QRCodeSVG value={shareUrl} size={180} fgColor="#1E2A3A" bgColor="#FFFFFF" level="M" />
            </div>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {copied ? <CheckCheck size={14} className="text-green-500" /> : <Copy size={14} />}
              {copied ? "Kopiert!" : "Link kopieren"}
            </button>

            <div className="w-full flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground font-medium">oder</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <a
              href={bgStatsUrl}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#1E2A3A] hover:bg-[#253347] text-white text-sm font-semibold transition-colors"
            >
              <Dices size={14} />
              In BGStats eintragen
            </a>
            <p className="text-[10px] text-muted-foreground text-center -mt-2 leading-snug">
              Öffnet die BGStats-App auf deinem Gerät
            </p>
          </div>
        </div>
      )}

      {play.image_url && (
        <Link href={`/plays/${play.id}`} className="block">
          <div className="relative w-full h-32 overflow-hidden">
            <Image src={play.image_url} alt="" fill className="object-cover" sizes="(max-width: 672px) 100vw, 640px" loading="lazy" />
          </div>
        </Link>
      )}

      {showDeleteConfirm && (
        <div className="border-t border-border px-3 py-2.5 bg-red-50 flex items-center justify-between gap-3">
          <p className="text-xs text-red-700 font-medium">Partie wirklich löschen?</p>
          <div className="flex gap-2">
            <button onClick={onConfirmDelete} className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold">Löschen</button>
            <button onClick={onCancelDelete} className="px-3 py-1 rounded-lg bg-muted text-xs font-medium">Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session Card (planned) ────────────────────────────────────────────────────

function SessionCard({ session, onCompleted, onRecordScores }: {
  session: PlannedSession;
  onCompleted: (id: string) => void;
  onRecordScores: (session: PlannedSession) => void;
}) {
  const date = new Date(session.session_date);
  const dateStr = date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  const accepted = session.invitees.filter((i) => i.status === "accepted").length;
  const pending  = session.invitees.filter((i) => i.status === "invited").length;

  const isPending = !session.is_organizer && session.my_invite_status === "invited";
  const [responding, setResponding] = useState(false);
  const [myStatus, setMyStatus] = useState(session.my_invite_status);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function respond(status: "accepted" | "declined") {
    setResponding(true);
    try {
      await fetch(`/api/play-sessions/${session.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setMyStatus(status);
    } finally {
      setResponding(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/play-sessions/${session.id}/complete`, { method: "POST" });
      if (res.ok) {
        onCompleted(session.id);
      }
    } finally {
      setCompleting(false);
      setConfirmComplete(false);
    }
  }

  return (
    <div className={cn(
      "bg-card border rounded-2xl overflow-hidden",
      isPending && myStatus === "invited" ? "border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.15)]" : "border-border shadow-card"
    )}>
      {/* Game thumbnails row */}
      {session.games.length > 0 && (
        <div className="flex gap-0 h-16 overflow-hidden relative">
          {session.games.slice(0, 4).map((game, i) => (
            <div
              key={game.id}
              className="relative flex-1 min-w-0 overflow-hidden"
              style={{ zIndex: session.games.length - i }}
            >
              {game.thumbnail_url ? (
                <Image src={game.thumbnail_url} alt={game.name} fill className="object-cover" sizes="120px" />
              ) : (
                <div className="w-full h-full bg-amber-100 flex items-center justify-center">
                  <Gamepad2 size={20} className="text-amber-400" />
                </div>
              )}
            </div>
          ))}
          {session.games.length > 4 && (
            <div className="absolute right-0 top-0 bottom-0 w-10 bg-black/60 flex items-center justify-center">
              <span className="text-white text-xs font-bold">+{session.games.length - 4}</span>
            </div>
          )}
          {/* Gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground leading-tight">
              {session.title ?? `Spieleabend`}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dateStr} · {timeStr} Uhr
            </p>
          </div>

          {/* Status badge */}
          {session.is_organizer ? (
            <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Organisator
            </span>
          ) : myStatus === "accepted" ? (
            <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              <CheckCircle2 size={10} /> Zugesagt
            </span>
          ) : myStatus === "declined" ? (
            <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
              <XCircle size={10} /> Abgelehnt
            </span>
          ) : null}
        </div>

        {/* Games list (text) */}
        {session.games.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
            <Gamepad2 size={10} className="inline mr-1 -mt-0.5" />
            {session.games.map((g) => g.name).join(", ")}
          </p>
        )}

        {/* Location + invitee count */}
        <div className="flex flex-wrap items-center gap-x-3 mt-1.5">
          {session.location && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={10} />{session.location}
            </span>
          )}
          {session.invitees.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={10} />
              {accepted > 0 && `${accepted} Zusage${accepted !== 1 ? "n" : ""}`}
              {accepted > 0 && pending > 0 && " · "}
              {pending > 0 && `${pending} offen`}
            </span>
          )}
        </div>

        {/* Invitee avatars */}
        {session.invitees.length > 0 && (
          <div className="flex -space-x-2 mt-2">
            {session.invitees.slice(0, 6).map((inv) => (
              <div
                key={inv.user_id}
                title={inv.display_name ?? inv.username}
                className={cn(
                  "w-7 h-7 rounded-full border-2 border-background overflow-hidden flex-shrink-0",
                  inv.status === "accepted" ? "ring-1 ring-green-400" : inv.status === "declined" ? "opacity-40" : ""
                )}
              >
                {inv.avatar_url ? (
                  <Image src={inv.avatar_url} alt={inv.username} width={28} height={28} className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-amber-200 flex items-center justify-center">
                    <span className="text-amber-700 font-bold text-[10px]">{inv.username[0].toUpperCase()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Respond buttons (for invitees with pending status) */}
        {isPending && myStatus === "invited" && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => respond("declined")}
              disabled={responding}
              className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Ablehnen
            </button>
            <button
              onClick={() => respond("accepted")}
              disabled={responding}
              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> Zusagen
            </button>
          </div>
        )}

        {/* Aktionen — organizer only */}
        {session.is_organizer && (
          <div className="mt-3 flex flex-col gap-2">
            {/* Primary action: record scores/photos AND complete the session in one step */}
            <button
              onClick={() => onRecordScores(session)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Edit2 size={14} /> Scores &amp; Fotos erfassen
            </button>
            {/* Quick-complete without scores */}
            {!confirmComplete && (
              <button
                onClick={() => setConfirmComplete(true)}
                className="w-full py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={13} /> Ohne Scores abschließen
              </button>
            )}
            {confirmComplete && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col gap-2">
                <p className="text-xs text-green-800 font-medium leading-snug">
                  Abschließen ohne Scores? Für alle {accepted + 1} Teilnehmer werden Partien ohne Scores eingetragen. Mit „Scores &amp; Fotos erfassen" kannst du stattdessen Scores eingeben und abschließen.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmComplete(false)}
                    disabled={completing}
                    className="flex-1 py-1.5 rounded-lg border border-border bg-white text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {completing ? "Wird abgeschlossen…" : <><CheckCircle2 size={12} /> Abschließen</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Multi-Game Picker ─────────────────────────────────────────────────────────

interface SelectedGame {
  id?: string;       // set if from library
  bgg_id?: number;   // set if from BGG global search
  name: string;
  thumbnail_url: string | null;
}

function MultiGamePicker({
  libraryGames,
  selectedGames,
  onAdd,
  onRemove,
}: {
  libraryGames: LibraryGame[];
  selectedGames: SelectedGame[];
  onAdd: (game: SelectedGame) => void;
  onRemove: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [globalResults, setGlobalResults] = useState<{ bgg_id: number; name: string; thumbnail_url: string | null }[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const selectedNames = new Set(selectedGames.map((g) => g.name));
  const filteredLibrary = libraryGames.filter(
    (g) => !selectedNames.has(g.name) &&
    (!search || g.name.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) { setGlobalResults([]); setGlobalSearching(false); return; }
    if (filteredLibrary.length > 0) { setGlobalResults([]); return; }

    setGlobalSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json() as { results: { bgg_id: number; name: string; thumbnail_url: string | null }[] };
          setGlobalResults((data.results ?? []).filter((g) => !selectedNames.has(g.name)));
        }
      } finally { setGlobalSearching(false); }
    }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function selectLibraryGame(g: LibraryGame) {
    onAdd({ id: g.id, name: g.name, thumbnail_url: g.thumbnail_url });
    setSearch("");
    setOpen(false);
  }

  function selectGlobalGame(g: { bgg_id: number; name: string; thumbnail_url: string | null }) {
    onAdd({ bgg_id: g.bgg_id, name: g.name, thumbnail_url: g.thumbnail_url });
    setSearch("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected game chips */}
      {selectedGames.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedGames.map((g) => (
            <div key={g.name} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
              {g.thumbnail_url && (
                <Image src={g.thumbnail_url} alt={g.name} width={20} height={20} className="rounded-full object-cover flex-shrink-0" />
              )}
              <span className="max-w-[120px] truncate">{g.name}</span>
              <button
                onClick={() => onRemove(g.name)}
                className="text-amber-600 hover:text-amber-900 flex-shrink-0 ml-0.5"
                aria-label={`${g.name} entfernen`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-background text-left text-sm text-muted-foreground hover:border-amber-400 transition-colors"
      >
        <Plus size={14} className="text-amber-500 flex-shrink-0" />
        Spiel hinzufügen…
        <ChevronDown size={14} className={cn("ml-auto transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-border rounded-2xl shadow-xl z-20 overflow-hidden max-h-72">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name suchen…"
              className="w-full text-sm px-3 py-1.5 rounded-lg bg-muted focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto max-h-56">
            {filteredLibrary.map((g) => (
              <button
                key={g.id}
                onClick={() => selectLibraryGame(g)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
              >
                {g.thumbnail_url && <Image src={g.thumbnail_url} alt="" width={28} height={28} className="rounded object-cover flex-shrink-0" />}
                <span className="truncate">{g.name}</span>
              </button>
            ))}

            {filteredLibrary.length > 0 && globalResults.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40 border-t border-border">
                Alle Spiele (BGG)
              </div>
            )}

            {globalSearching && (
              <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">Suche…</div>
            )}

            {!globalSearching && globalResults.map((g) => (
              <button
                key={g.bgg_id}
                onClick={() => selectGlobalGame(g)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
              >
                {g.thumbnail_url && <Image src={g.thumbnail_url} alt="" width={28} height={28} className="rounded object-cover flex-shrink-0" />}
                <span className="truncate">{g.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0 bg-muted px-1.5 py-0.5 rounded">BGG</span>
              </button>
            ))}

            {!globalSearching && search.length >= 2 && filteredLibrary.length === 0 && globalResults.length === 0 && (
              <div className="flex flex-col items-center py-4 text-xs text-muted-foreground gap-1">
                <span>Nichts gefunden</span>
                <span className="text-[10px] opacity-70">Tipp: BGG-ID oder Link einfügen</span>
              </div>
            )}

            {!search && filteredLibrary.length === 0 && (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                Tippe um zu suchen
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Past Play Sheet ───────────────────────────────────────────────────────────
// Creates one play per selected game (with same date/players/duration/etc.)

function PastPlaySheet({
  libraryGames,
  editPlay,
  prefillPlayers,
  sessionPrefill,
  onClose,
  onSaved,
  onSavedSingle,
}: {
  libraryGames: LibraryGame[];
  editPlay?: Play | null;
  prefillPlayers?: DraftPlayer[];
  sessionPrefill?: PlannedSession | null;
  onClose: () => void;
  onSaved?: (plays: Play[]) => void;
  onSavedSingle?: (play: Play) => void;
}) {
  const isEdit = !!editPlay;
  const today = new Date().toISOString().slice(0, 10);

  // For edit mode: single game
  const [editGameId, setEditGameId] = useState(editPlay?.game_id ?? "");
  const [editGameSearch, setEditGameSearch] = useState("");
  const [editGameOpen, setEditGameOpen] = useState(false);
  const [editGlobalResults, setEditGlobalResults] = useState<{ bgg_id: number; name: string; thumbnail_url: string | null }[]>([]);
  const [editGlobalSearching, setEditGlobalSearching] = useState(false);
  const [editGlobalSelected, setEditGlobalSelected] = useState<{ bgg_id: number; name: string; thumbnail_url: string | null } | null>(null);

  // For create mode: multi-game (pre-fill from session if provided)
  const [selectedGames, setSelectedGames] = useState<SelectedGame[]>(
    sessionPrefill
      ? sessionPrefill.games.map((g) => ({ id: g.id, name: g.name, thumbnail_url: g.thumbnail_url }))
      : []
  );

  const [playedAt, setPlayedAt] = useState(
    editPlay?.played_at?.slice(0, 10) ?? sessionPrefill?.session_date?.slice(0, 10) ?? today
  );
  const [duration, setDuration] = useState(editPlay?.duration_minutes?.toString() ?? "");
  const [location, setLocation] = useState(editPlay?.location ?? sessionPrefill?.location ?? "");
  const [notes, setNotes] = useState(editPlay?.notes ?? "");
  const [cooperative, setCooperative] = useState(editPlay?.cooperative ?? false);

  // Players: edit > session invitees (accepted) > prefillPlayers > empty
  const sessionAccepted = sessionPrefill?.invitees.filter((i) => i.status === "accepted") ?? [];
  const [players, setPlayers] = useState<DraftPlayer[]>(
    editPlay?.players && editPlay.players.length > 0
      ? editPlay.players.map((p) => ({ display_name: p.display_name, score: p.score?.toString() ?? "", winner: p.winner }))
      : sessionAccepted.length > 0
      ? sessionAccepted.map((i) => ({ display_name: i.display_name ?? i.username, score: "", winner: false }))
      : prefillPlayers && prefillPlayers.length > 0
      ? prefillPlayers
      : [{ display_name: "", score: "", winner: false }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editPlay?.image_url ?? null);

  // Edit-mode: game search effect
  useEffect(() => {
    if (!isEdit) return;
    const trimmed = editGameSearch.trim();
    if (trimmed.length < 2) { setEditGlobalResults([]); setEditGlobalSearching(false); return; }
    const libMatches = libraryGames.filter((g) => g.name.toLowerCase().includes(trimmed.toLowerCase()));
    if (libMatches.length > 0) { setEditGlobalResults([]); return; }
    setEditGlobalSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json() as { results: { bgg_id: number; name: string; thumbnail_url: string | null }[] };
          setEditGlobalResults(data.results ?? []);
        }
      } finally { setEditGlobalSearching(false); }
    }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editGameSearch]);

  function addPlayer() { setPlayers((prev) => [...prev, { display_name: "", score: "", winner: false }]); }
  function removePlayer(i: number) { setPlayers((prev) => prev.filter((_, idx) => idx !== i)); }
  function updatePlayer(i: number, field: keyof DraftPlayer, value: string | boolean) {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }
  function toggleWinner(i: number) {
    setPlayers((prev) => prev.map((p, idx) => ({ ...p, winner: idx === i ? !p.winner : false })));
  }

  function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.onload = () => {
        URL.revokeObjectURL(url);
        const { naturalWidth: w, naturalHeight: h } = img;
        const scale = Math.min(1, 1200 / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file),
          "image/jpeg", 0.82
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setImageFile(compressed);
    setImagePreview(URL.createObjectURL(compressed));
  }

  async function ensureGame(game: SelectedGame): Promise<string | null> {
    if (game.id) return game.id;
    if (!game.bgg_id) return null;
    const res = await fetch("/api/games/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bgg_id: game.bgg_id, name: game.name, thumbnail_url: game.thumbnail_url }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { game_id: string };
    return data.game_id;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const validPlayers = players
      .filter((p) => p.display_name.trim())
      .map((p) => ({
        display_name: p.display_name.trim(),
        score: p.score !== "" ? Number(p.score) : null,
        winner: p.winner,
      }));

    // ── Edit mode ────────────────────────────────────────────────────────────
    if (isEdit) {
      let resolvedGameId = editGameId;
      if (!resolvedGameId && editGlobalSelected) {
        const res = await fetch("/api/games/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bgg_id: editGlobalSelected.bgg_id,
            name: editGlobalSelected.name,
            thumbnail_url: editGlobalSelected.thumbnail_url,
          }),
        });
        if (!res.ok) { setError("Spiel konnte nicht geladen werden."); setSaving(false); return; }
        const d = await res.json() as { game_id: string };
        resolvedGameId = d.game_id;
      }
      if (!resolvedGameId) { setError("Bitte ein Spiel auswählen"); setSaving(false); return; }

      let image_url: string | null = editPlay?.image_url ?? null;
      if (imageFile) {
        const form = new FormData();
        form.append("file", imageFile, `${Date.now()}.jpg`);
        const uploadRes = await fetch("/api/play-images", { method: "POST", body: form });
        if (uploadRes.ok) {
          const ud = await uploadRes.json() as { url: string };
          image_url = ud.url;
        } else {
          setError("Foto-Upload fehlgeschlagen.");
          setSaving(false);
          return;
        }
      }

      const res = await fetch(`/api/plays/${editPlay!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: resolvedGameId, played_at: playedAt, duration_minutes: duration ? Number(duration) : null, location: location.trim() || null, notes: notes.trim() || null, cooperative, players: validPlayers, image_url }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); setSaving(false); return; }
      onSavedSingle?.(data as Play);
      return;
    }

    // ── Create mode: one play per game ────────────────────────────────────────
    if (selectedGames.length === 0) { setError("Bitte mindestens ein Spiel auswählen"); setSaving(false); return; }

    let image_url: string | null = null;
    if (imageFile) {
      const form = new FormData();
      form.append("file", imageFile, `${Date.now()}.jpg`);
      const uploadRes = await fetch("/api/play-images", { method: "POST", body: form });
      if (uploadRes.ok) {
        const ud = await uploadRes.json() as { url: string };
        image_url = ud.url;
      }
    }

    const createdPlays: Play[] = [];
    for (const game of selectedGames) {
      const game_id = await ensureGame(game);
      if (!game_id) { setError(`Spiel "${game.name}" konnte nicht gespeichert werden.`); setSaving(false); return; }

      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id, played_at: playedAt, duration_minutes: duration ? Number(duration) : null, location: location.trim() || null, notes: notes.trim() || null, cooperative, players: validPlayers, image_url }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); setSaving(false); return; }
      createdPlays.push(data as Play);
    }

    onSaved?.(createdPlays);
  }

  // Edit mode: selected game from library
  const editSelectedGame = libraryGames.find((g) => g.id === editGameId);
  const editFilteredGames = editGameSearch
    ? libraryGames.filter((g) => g.name.toLowerCase().includes(editGameSearch.toLowerCase()))
    : libraryGames;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "92dvh" }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="font-display text-lg font-semibold">
            {isEdit ? "Partie bearbeiten" : sessionPrefill ? "Scores & Fotos erfassen" : "Partie(n) erfassen"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* Game(s) selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              {isEdit ? "Spiel *" : "Spiele *"}
            </label>

            {isEdit ? (
              /* Single game picker (edit mode) */
              <div className="relative">
                <button
                  onClick={() => setEditGameOpen((o) => !o)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                    (editGameId || editGlobalSelected) ? "border-amber-400 bg-amber-50" : "border-border bg-background"
                  )}
                >
                  {(editSelectedGame?.thumbnail_url ?? editGlobalSelected?.thumbnail_url) && (
                    <Image src={(editSelectedGame?.thumbnail_url ?? editGlobalSelected?.thumbnail_url)!} alt="" width={32} height={32} className="rounded-md object-cover flex-shrink-0" />
                  )}
                  <span className={cn("flex-1 text-sm truncate", !(editGameId || editGlobalSelected) && "text-muted-foreground")}>
                    {editSelectedGame?.name ?? editGlobalSelected?.name ?? "Spiel auswählen…"}
                  </span>
                  <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", editGameOpen && "rotate-180")} />
                </button>

                {editGameOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-border rounded-2xl shadow-xl z-10 overflow-hidden max-h-64">
                    <div className="p-2 border-b border-border">
                      <input value={editGameSearch} onChange={(e) => setEditGameSearch(e.target.value)} placeholder="Name suchen…" className="w-full text-sm px-3 py-1.5 rounded-lg bg-muted focus:outline-none" />
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      {editFilteredGames.map((g) => (
                        <button key={g.id} onClick={() => { setEditGameId(g.id); setEditGlobalSelected(null); setEditGameOpen(false); setEditGameSearch(""); }}
                          className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors", editGameId === g.id && "bg-amber-50 text-amber-700 font-medium")}>
                          {g.thumbnail_url && <Image src={g.thumbnail_url} alt="" width={28} height={28} className="rounded object-cover flex-shrink-0" />}
                          <span className="truncate">{g.name}</span>
                        </button>
                      ))}
                      {editGlobalSearching && <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">Suche…</div>}
                      {!editGlobalSearching && editGlobalResults.map((g) => (
                        <button key={g.bgg_id} onClick={() => { setEditGlobalSelected(g); setEditGameId(""); setEditGameOpen(false); setEditGameSearch(""); }}
                          className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors", editGlobalSelected?.bgg_id === g.bgg_id && "bg-amber-50 text-amber-700 font-medium")}>
                          {g.thumbnail_url && <Image src={g.thumbnail_url} alt="" width={28} height={28} className="rounded object-cover flex-shrink-0" />}
                          <span className="truncate">{g.name}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">BGG</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Multi-game picker (create mode) */
              <MultiGamePicker
                libraryGames={libraryGames}
                selectedGames={selectedGames}
                onAdd={(g) => setSelectedGames((prev) => [...prev, g])}
                onRemove={(name) => setSelectedGames((prev) => prev.filter((g) => g.name !== name))}
              />
            )}
          </div>

          {/* Date + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Datum</label>
              <input type="date" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Dauer (Min)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="z.B. 90"
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              <MapPin size={11} className="inline mr-1" />Ort (optional)
            </label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z.B. Zuhause, Spieleabend bei Marc…"
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          {/* Cooperative toggle */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-muted/40 rounded-xl">
            <span className="text-sm font-medium">Kooperativ gespielt</span>
            <button type="button"
              onClick={() => { setCooperative((c) => { const next = !c; if (next) setPlayers((prev) => prev.map((p) => ({ ...p, winner: false }))); return next; }); }}
              className={cn("rounded-full transition-colors relative flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400", cooperative ? "bg-amber-500" : "bg-border")}
              style={{ width: 44, height: 26 }} aria-checked={cooperative} role="switch">
              <span className="absolute rounded-full bg-white shadow pointer-events-none"
                style={{ width: 20, height: 20, top: 3, left: cooperative ? 21 : 3, transition: "left 0.15s ease" }} />
            </button>
          </div>

          {/* Players */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Users size={11} className="inline mr-1" />Spieler
              </label>
              <button onClick={addPlayer} className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Plus size={12} /> Hinzufügen
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={p.display_name} onChange={(e) => updatePlayer(i, "display_name", e.target.value)}
                    placeholder={`Spieler ${i + 1}`}
                    className="flex-1 min-w-0 text-sm px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input value={p.score} onChange={(e) => updatePlayer(i, "score", e.target.value)}
                    placeholder="Pkt" type="number"
                    className="w-16 text-sm px-2 py-2 rounded-xl border border-border bg-background text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  {!cooperative && (
                    <button onClick={() => toggleWinner(i)}
                      className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                        p.winner ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-amber-100")}
                      title="Gewinner">🏆</button>
                  )}
                  {players.length > 1 && (
                    <button onClick={() => removePlayer(i)} className="text-muted-foreground hover:text-red-400 flex-shrink-0">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Photo */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Foto (optional)</label>
            {imagePreview ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Vorschau" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border hover:border-amber-400 hover:bg-amber-50 transition-all text-sm text-muted-foreground hover:text-amber-700">
                  <Camera size={14} /> Foto hinzufügen
                </button>
              </>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notizen (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Highlights, besondere Momente…"
              rows={3} className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="px-4 py-4 border-t border-border flex-shrink-0 flex flex-col gap-2">
          {sessionPrefill && (
            <p className="text-[11px] text-muted-foreground text-center leading-snug">
              Speichern erstellt nur die Partien — der Spielabend bleibt offen.
              Zum Beenden nutze &bdquo;Spielabend abschließen&ldquo; auf der Karte.
            </p>
          )}
          <button onClick={handleSave} disabled={saving || (!isEdit && selectedGames.length === 0) || (isEdit && !editGameId && !editGlobalSelected)}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {saving ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : <Check size={16} />}
            {isEdit ? "Änderungen speichern" : selectedGames.length > 1 ? `${selectedGames.length} Partien speichern` : "Partie speichern"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Planned Session Sheet ─────────────────────────────────────────────────────

function PlannedSessionSheet({
  libraryGames,
  friends,
  onClose,
  onSaved,
}: {
  libraryGames: LibraryGame[];
  friends: FriendProfile[];
  onClose: () => void;
  onSaved: (session: PlannedSession) => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState(defaultDate);
  const [sessionTime, setSessionTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedGames, setSelectedGames] = useState<SelectedGame[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInvite(userId: string) {
    setInvitedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function ensureGame(game: SelectedGame): Promise<string | null> {
    if (game.id) return game.id;
    if (!game.bgg_id) return null;
    const res = await fetch("/api/games/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bgg_id: game.bgg_id, name: game.name, thumbnail_url: game.thumbnail_url }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { game_id: string };
    return data.game_id;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    // Ensure all selected games exist in DB
    const game_ids: string[] = [];
    for (const game of selectedGames) {
      const id = await ensureGame(game);
      if (!id) { setError(`Spiel "${game.name}" konnte nicht gespeichert werden.`); setSaving(false); return; }
      game_ids.push(id);
    }

    const session_date = `${sessionDate}T${sessionTime}:00`;

    const res = await fetch("/api/play-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || null,
        session_date,
        location: location.trim() || null,
        notes: notes.trim() || null,
        game_ids,
        invited_user_ids: Array.from(invitedIds),
      }),
    });

    const data = await res.json() as { session_id?: string; error?: string };
    if (!res.ok) { setError(data.error ?? "Fehler beim Speichern"); setSaving(false); return; }

    // Build optimistic session object for immediate UI update
    const newSession: PlannedSession = {
      id: data.session_id!,
      title: title.trim() || null,
      session_date,
      location: location.trim() || null,
      notes: notes.trim() || null,
      status: "planned",
      created_by: "", // will be set by server
      is_organizer: true,
      my_invite_status: null,
      games: selectedGames.map((g) => ({ id: g.id ?? "", name: g.name, thumbnail_url: g.thumbnail_url })),
      invitees: friends
        .filter((f) => invitedIds.has(f.id))
        .map((f) => ({
          user_id: f.id,
          username: f.username,
          display_name: f.display_name,
          avatar_url: f.avatar_url,
          status: "invited" as const,
        })),
    };

    onSaved(newSession);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "92dvh" }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-display text-lg font-semibold">Spieleabend planen</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Lade Freunde ein und schlage Spiele vor</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Name (optional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Spieleabend bei Dennis"
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Datum *</label>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Uhrzeit</label>
              <input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              <MapPin size={11} className="inline mr-1" />Ort (optional)
            </label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z.B. Bei mir zuhause, Spielcafé…"
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          {/* Games */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              <Gamepad2 size={11} className="inline mr-1" />Spielvorschläge
            </label>
            <MultiGamePicker
              libraryGames={libraryGames}
              selectedGames={selectedGames}
              onAdd={(g) => setSelectedGames((prev) => [...prev, g])}
              onRemove={(name) => setSelectedGames((prev) => prev.filter((g) => g.name !== name))}
            />
          </div>

          {/* Friends to invite */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              <UserPlus size={11} className="inline mr-1" />Freunde einladen
              {invitedIds.size > 0 && (
                <span className="ml-2 text-amber-600 normal-case font-medium">{invitedIds.size} ausgewählt</span>
              )}
            </label>

            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted/40 rounded-xl">
                Noch keine Freunde in MeepleBase — füge sie im Spieler-Menü hinzu.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {friends.map((friend) => {
                  const selected = invitedIds.has(friend.id);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => toggleInvite(friend.id)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                        selected ? "border-amber-400 bg-amber-50" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-amber-100">
                        {friend.avatar_url ? (
                          <Image src={friend.avatar_url} alt={friend.username} fill className="object-cover" sizes="36px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-amber-600 font-bold text-sm">{friend.username[0].toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {friend.display_name ?? friend.username}
                        </p>
                        <p className="text-xs text-muted-foreground">@{friend.username}</p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                        selected ? "border-amber-500 bg-amber-500" : "border-border"
                      )}>
                        {selected && <Check size={11} className="text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notizen (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hinweise für Gäste, Snacks mitbringen…"
              rows={2} className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="px-4 py-4 border-t border-border flex-shrink-0">
          <button onClick={handleSave} disabled={saving || !sessionDate}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {saving ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : <Calendar size={15} />}
            {invitedIds.size > 0 ? `Einladungen senden (${invitedIds.size})` : "Spieleabend speichern"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Empty States ──────────────────────────────────────────────────────────────

function EmptyStatePast({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-4">
        <Clock size={36} className="text-amber-400" />
      </div>
      <h3 className="font-display text-xl font-semibold text-foreground mb-2">Noch keine Partien</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs">
        Erfasse deine erste Partie und behalte den Überblick über deine Spielsessions.
      </p>
      <button onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 text-white font-semibold text-sm">
        <Plus size={16} /> Erste Partie erfassen
      </button>
    </div>
  );
}

function EmptyStateGeplant({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-4">
        <Calendar size={36} className="text-amber-400" />
      </div>
      <h3 className="font-display text-xl font-semibold text-foreground mb-2">Kein Spieleabend geplant</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs">
        Plane deinen nächsten Spieleabend, schlage Spiele vor und lade Freunde ein.
      </p>
      <button onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 text-white font-semibold text-sm">
        <Plus size={16} /> Spieleabend planen
      </button>
    </div>
  );
}
