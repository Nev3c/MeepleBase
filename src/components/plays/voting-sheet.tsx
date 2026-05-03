"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Trophy, CheckCircle2, RotateCcw, Vote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlannedSession, SessionProposal, BordaResult } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VotingSheetProps {
  session: PlannedSession;
  userId: string;
  onClose: () => void;
  onVotingClosed: (winner: { id: string; name: string; thumbnail_url: string | null }) => void;
  onVoteSubmitted?: () => void;
}

type SheetView = "vote" | "results";

// ── VotingSheet ───────────────────────────────────────────────────────────────

export function VotingSheet({ session, onClose, onVotingClosed, onVoteSubmitted }: VotingSheetProps) {
  const isOrganizer = session.is_organizer;
  const isClosed = session.voting_closed;

  const [view, setView] = useState<SheetView>(isClosed ? "results" : "vote");
  const [proposals, setProposals] = useState<SessionProposal[]>(session.proposals ?? []);
  const [bordaResults, setBordaResults] = useState<BordaResult[]>(session.borda_results ?? []);

  // Ordered list of game_ids: index 0 = rank 1
  const [ranking, setRanking] = useState<string[]>(
    () => (session.my_votes ?? [])
      .sort((a, b) => a.rank - b.rank)
      .map((v) => v.game_id)
  );

  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [submitted, setSubmitted] = useState((session.my_votes ?? []).length > 0);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [propRes, voteRes] = await Promise.all([
      fetch(`/api/play-sessions/${session.id}/proposals`),
      fetch(`/api/play-sessions/${session.id}/votes`),
    ]);
    if (propRes.ok) {
      const d = await propRes.json() as { proposals: SessionProposal[] };
      setProposals(d.proposals);
    }
    if (voteRes.ok) {
      const d = await voteRes.json() as { borda_results: BordaResult[] };
      setBordaResults(d.borda_results);
    }
  }, [session.id]);

  useEffect(() => { reload(); }, [reload]);

  function tapGame(gameId: string) {
    if (isClosed) return;
    setRanking((prev) => {
      const idx = prev.indexOf(gameId);
      if (idx !== -1) return prev.filter((id) => id !== gameId);
      return [...prev, gameId];
    });
  }

  async function handleSubmitVote() {
    if (ranking.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/play-sessions/${session.id}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rankings: ranking.map((game_id, i) => ({ game_id, rank: i + 1 })),
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Fehler beim Speichern");
        return;
      }
      setSubmitted(true);
      onVoteSubmitted?.();
      await reload();
      setView("results");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseVoting() {
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/play-sessions/${session.id}/votes/close`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Fehler beim Schließen");
        return;
      }
      const d = await res.json() as { winner: { id: string; name: string; thumbnail_url: string | null } };
      await reload();
      setView("results");
      if (d.winner) onVotingClosed(d.winner);
    } finally {
      setClosing(false);
    }
  }

  const maxPoints = bordaResults[0]?.points ?? 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl flex flex-col"
        style={{ height: "min(92svh, 100dvh)", overflow: "hidden" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Vote size={18} className="text-amber-500" />
              Spielabstimmung
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isClosed
                ? "Abstimmung abgeschlossen"
                : proposals.length === 0
                  ? "Noch keine Vorschläge"
                  : `${proposals.length} Spiel${proposals.length !== 1 ? "e" : ""} zur Auswahl`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        {/* View toggle — only show when results are available */}
        {!isClosed && (submitted || isOrganizer) && proposals.length > 0 && (
          <div className="flex gap-1 px-4 pt-3 flex-shrink-0">
            <button
              onClick={() => setView("vote")}
              className={cn(
                "flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
                view === "vote" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              Meine Wahl
            </button>
            <button
              onClick={() => setView("results")}
              className={cn(
                "flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
                view === "results" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              Zwischenstand
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* ── VOTE VIEW ── */}
          {view === "vote" && !isClosed && (
            <>
              {proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                    <Vote size={28} className="text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Noch keine Vorschläge</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {session.game_selection_mode === "vote_organizer"
                      ? "Der Gastgeber fügt noch Spiele hinzu."
                      : "Nutze unten den Button um ein Spiel vorzuschlagen."}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    Tippe Spiele in Wunschreihenfolge an — erste Auswahl = Rang&nbsp;1.
                  </p>
                  <div className="flex flex-col gap-2">
                    {proposals.map((proposal) => {
                      const rankIdx = ranking.indexOf(proposal.game_id);
                      const isRanked = rankIdx !== -1;
                      const rankNum = rankIdx + 1;
                      return (
                        <button
                          key={proposal.game_id}
                          onClick={() => tapGame(proposal.game_id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-[0.98]",
                            isRanked
                              ? "border-amber-400 bg-amber-50"
                              : "border-border bg-card hover:border-amber-200"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all",
                            isRanked ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                          )}>
                            {isRanked ? rankNum : "–"}
                          </div>
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-amber-100">
                            {proposal.game.thumbnail_url ? (
                              <Image src={proposal.game.thumbnail_url} alt={proposal.game.name} width={40} height={40} className="object-cover w-full h-full" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">🎲</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{proposal.game.name}</p>
                            {(proposal.game.min_playtime || proposal.game.max_playtime) && (
                              <p className="text-xs text-muted-foreground">
                                {proposal.game.min_playtime}
                                {proposal.game.max_playtime && proposal.game.max_playtime !== proposal.game.min_playtime ? `–${proposal.game.max_playtime}` : ""} Min.
                              </p>
                            )}
                          </div>
                          {isRanked && <CheckCircle2 size={16} className="text-amber-500 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {ranking.length > 0 && (
                    <button
                      onClick={() => setRanking([])}
                      className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RotateCcw size={11} /> Auswahl zurücksetzen
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* ── RESULTS VIEW ── */}
          {(view === "results" || isClosed) && (
            <>
              {bordaResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">Noch keine Stimmen abgegeben.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {bordaResults.map((result, i) => {
                    const pct = maxPoints > 0 ? (result.points / maxPoints) * 100 : 0;
                    const isWinner = i === 0 && isClosed;
                    return (
                      <div
                        key={result.game.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border",
                          isWinner ? "border-amber-400 bg-amber-50" : "border-border bg-card"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                          isWinner ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {isWinner ? <Trophy size={13} /> : i + 1}
                        </div>
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-amber-100">
                          {result.game.thumbnail_url ? (
                            <Image src={result.game.thumbnail_url} alt={result.game.name} width={40} height={40} className="object-cover w-full h-full" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">🎲</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{result.game.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isWinner ? "bg-amber-500" : "bg-slate-300")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{result.points} Pt.</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isClosed && bordaResults[0] && (
                <div className="mt-4 p-4 rounded-2xl bg-green-50 border border-green-200">
                  <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                    <Trophy size={14} /> Gewinner: {bordaResults[0].game.name}
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">Spiel wurde zur Session hinzugefügt.</p>
                </div>
              )}
            </>
          )}

          {error && <p className="mt-3 text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border flex-shrink-0 flex flex-col gap-2">
          {!isClosed && view === "vote" && proposals.length > 0 && (
            <button
              onClick={handleSubmitVote}
              disabled={submitting || ranking.length === 0}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : <Vote size={15} />}
              {submitted ? "Abstimmung aktualisieren" : `Abstimmen (${ranking.length} von ${proposals.length})`}
            </button>
          )}
          {!isClosed && isOrganizer && (
            <button
              onClick={handleCloseVoting}
              disabled={closing || proposals.length === 0}
              className="w-full py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {closing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : <Trophy size={14} />}
              Abstimmung schließen &amp; Gewinner ermitteln
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── ProposalAdderSheet ────────────────────────────────────────────────────────
// Used in vote_free mode so guests can suggest games from organizer's library

interface OrganizerGame {
  id: string;
  name: string;
  thumbnail_url: string | null;
  min_playtime?: number | null;
  max_playtime?: number | null;
}

interface ProposalAdderSheetProps {
  sessionId: string;
  organizerLibrary: OrganizerGame[];
  existingProposalGameIds: Set<string>;
  plannedDurationMinutes: number | null;
  onClose: () => void;
  onProposed: (proposal: SessionProposal) => void;
}

export function ProposalAdderSheet({
  sessionId,
  organizerLibrary,
  existingProposalGameIds,
  plannedDurationMinutes,
  onClose,
  onProposed,
}: ProposalAdderSheetProps) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = organizerLibrary.filter((g) => {
    if (existingProposalGameIds.has(g.id)) return false;
    if (plannedDurationMinutes && (g.min_playtime ?? 0) > plannedDurationMinutes) return false;
    if (!search) return true;
    return g.name.toLowerCase().includes(search.toLowerCase());
  });

  async function propose(game: OrganizerGame) {
    setAdding(game.id);
    setError(null);
    try {
      const res = await fetch(`/api/play-sessions/${sessionId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.id }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Fehler");
        return;
      }
      const d = await res.json() as { proposal: SessionProposal };
      onProposed(d.proposal);
    } finally {
      setAdding(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] bg-background rounded-t-3xl shadow-2xl flex flex-col"
        style={{ height: "min(82svh, 100dvh)", overflow: "hidden" }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="font-display text-lg font-semibold">Spiel vorschlagen</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-3 flex-shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Spiel suchen…"
            className="w-full min-w-0 text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {organizerLibrary.length === 0 ? "Gastgeber-Bibliothek nicht verfügbar." : "Kein passendes Spiel gefunden."}
            </p>
          )}
          {filtered.map((game) => (
            <button
              key={game.id}
              onClick={() => propose(game)}
              disabled={adding === game.id}
              className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:border-amber-300 text-left transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-amber-100">
                {game.thumbnail_url ? (
                  <Image src={game.thumbnail_url} alt={game.name} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🎲</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{game.name}</p>
                {(game.min_playtime || game.max_playtime) && (
                  <p className="text-xs text-muted-foreground">
                    {game.min_playtime}{game.max_playtime && game.max_playtime !== game.min_playtime ? `–${game.max_playtime}` : ""} Min.
                  </p>
                )}
              </div>
              {adding === game.id ? (
                <svg className="animate-spin h-4 w-4 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <span className="text-xs text-amber-600 font-semibold flex-shrink-0">Vorschlagen</span>
              )}
            </button>
          ))}
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>
      </div>
    </>
  );
}
