"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Minus, RotateCcw, Dices, ArrowRight,
  X, Trophy, Undo2, Crown, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Score Tracker ─────────────────────────────────────────────────────────────

interface Player {
  id: number;
  name: string;
  score: number;
}

const QUICK_ADD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 50, 100];

function ScoreTracker() {
  const router = useRouter();
  const nextId = useRef(3);
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: "Spieler 1", score: 0 },
    { id: 2, name: "Spieler 2", score: 0 },
  ]);
  const [activePlayer, setActivePlayer] = useState<number>(1);
  const [history, setHistory] = useState<{ playerId: number; delta: number }[]>([]);

  const addScore = useCallback((delta: number) => {
    setPlayers((prev) => prev.map((p) => p.id === activePlayer ? { ...p, score: p.score + delta } : p));
    setHistory((prev) => [...prev, { playerId: activePlayer, delta }]);
  }, [activePlayer]);

  const undoLast = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setPlayers((prev) => prev.map((p) => p.id === last.playerId ? { ...p, score: p.score - last.delta } : p));
    setHistory((prev) => prev.slice(0, -1));
  }, [history]);

  const addPlayer = useCallback(() => {
    const id = nextId.current++;
    setPlayers((prev) => [...prev, { id, name: `Spieler ${prev.length + 1}`, score: 0 }]);
  }, []);

  const removePlayer = useCallback((id: number) => {
    setPlayers((prev) => {
      const remaining = prev.filter((p) => p.id !== id);
      setActivePlayer(remaining.find((p) => p.id === activePlayer)?.id ?? remaining[0]?.id ?? 1);
      return remaining;
    });
  }, [activePlayer]);

  const reset = useCallback(() => {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
    setHistory([]);
  }, []);

  const updateName = useCallback((id: number, name: string) => {
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
  }, []);

  const maxScore = Math.max(...players.map((p) => p.score));
  const winners = players.filter((p) => p.score === maxScore && maxScore > 0);

  function handleTransferToPlay() {
    const params = new URLSearchParams();
    players.forEach((p, i) => {
      params.set(`player_${i}_name`, p.name);
      params.set(`player_${i}_score`, p.score.toString());
    });
    router.push(`/plays?prefill=${encodeURIComponent(params.toString())}`);
  }

  const active = players.find((p) => p.id === activePlayer);

  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Punkte-Tracker</h2>
        <div className="flex gap-1.5">
          {history.length > 0 && (
            <button
              onClick={undoLast}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
            >
              <Undo2 size={13} /> Rückgängig
            </button>
          )}
          <button
            onClick={reset}
            className="w-8 h-8 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            title="Alle Punkte zurücksetzen"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Player tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {players.map((p) => {
          const isWinner = winners.some((w) => w.id === p.id);
          const isActive = activePlayer === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActivePlayer(p.id)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 pl-3 pr-2 py-2 rounded-2xl text-sm font-medium transition-all border",
                isActive
                  ? "bg-[#1E2A3A] text-white border-transparent shadow-sm"
                  : "bg-card border-border text-foreground hover:border-amber-300"
              )}
            >
              {isWinner && <Trophy size={12} className={isActive ? "text-amber-400" : "text-amber-500"} />}
              <span className="max-w-[72px] truncate">{p.name}</span>
              <span className={cn(
                "font-display font-bold text-sm ml-0.5 tabular-nums",
                isActive ? "text-amber-400" : "text-amber-500"
              )}>
                {p.score}
              </span>
            </button>
          );
        })}
        <button
          onClick={addPlayer}
          className="flex-shrink-0 w-9 h-9 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Active player card */}
      {active && (
        <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              value={active.name}
              onChange={(e) => updateName(active.id, e.target.value)}
              className="flex-1 text-sm font-semibold bg-transparent focus:outline-none text-foreground border-b border-transparent focus:border-amber-400 transition-colors pb-0.5"
              placeholder="Name…"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => addScore(-1)}
                className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Minus size={13} />
              </button>
              <span className="font-display text-3xl font-bold text-amber-500 min-w-[3.5ch] text-center tabular-nums">
                {active.score}
              </span>
              <button
                onClick={() => addScore(1)}
                className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>
            {players.length > 2 && (
              <button
                onClick={() => removePlayer(active.id)}
                className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick-add buttons */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ADD.map((n) => (
              <button
                key={n}
                onClick={() => addScore(n)}
                className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 active:scale-95 transition-all"
              >
                +{n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {players.length > 1 && (
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="px-4 py-2 bg-muted/40 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Rangliste</span>
          </div>
          {[...players]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => {
              const isWinner = winners.some((w) => w.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlayer(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 transition-colors text-left",
                    activePlayer === p.id ? "bg-amber-50" : "hover:bg-muted/30",
                  )}
                >
                  <span className="text-xs font-bold text-muted-foreground w-4 text-right">{i + 1}</span>
                  {isWinner
                    ? <Trophy size={13} className="text-amber-500 flex-shrink-0" />
                    : <span className="w-[13px] flex-shrink-0" />
                  }
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{p.name}</span>
                  <span className="font-display text-base font-bold text-amber-500 tabular-nums">{p.score}</span>
                </button>
              );
            })}
        </div>
      )}

      {/* Transfer button */}
      <button
        onClick={handleTransferToPlay}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#1E2A3A] text-white text-sm font-semibold hover:bg-[#253347] active:scale-[0.98] transition-all shadow-sm"
      >
        <Dices size={15} />
        Als Partie erfassen
        <ArrowRight size={14} />
      </button>
    </section>
  );
}

// ── Dice Roller ───────────────────────────────────────────────────────────────

// SVG dot positions for each face
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DieFace({ value, rolling }: { value: number; rolling: boolean }) {
  const dots = DOT_POSITIONS[value] ?? [];
  return (
    <div className={cn(
      "w-16 h-16 rounded-2xl bg-white border-2 border-border shadow-card relative flex-shrink-0 transition-all duration-75",
      rolling && "opacity-60 scale-95",
    )}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" aria-label={`Würfel: ${value}`}>
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={8} fill="#1E2A3A" />
        ))}
      </svg>
    </div>
  );
}

function DiceRoller() {
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState<number[]>([]);

  function roll() {
    if (rolling) return;
    setRolling(true);
    let ticks = 0;
    const interval = setInterval(() => {
      setDisplayDice(Array.from({ length: count }, () => Math.ceil(Math.random() * 6)));
      ticks++;
      if (ticks >= 8) {
        clearInterval(interval);
        const final = Array.from({ length: count }, () => Math.ceil(Math.random() * 6));
        setResults(final);
        setDisplayDice(final);
        setRolling(false);
      }
    }, 75);
  }

  const shownDice = (rolling || displayDice.length > 0) ? displayDice : results;
  const total = results.reduce((s, n) => s + n, 0);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Würfelwurf</h2>

      {/* Count selector */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex items-center gap-3">
        <span className="text-sm text-foreground font-medium flex-1">Anzahl Würfel</span>
        <button
          onClick={() => setCount((c) => Math.max(1, c - 1))}
          disabled={count <= 1}
          className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 disabled:opacity-40 transition-colors"
        >
          <Minus size={14} />
        </button>
        <span className="font-display text-xl font-bold text-amber-500 w-7 text-center tabular-nums">{count}</span>
        <button
          onClick={() => setCount((c) => Math.min(6, c + 1))}
          disabled={count >= 6}
          className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 disabled:opacity-40 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Roll button */}
      <button
        onClick={roll}
        disabled={rolling}
        className="w-full py-4 rounded-2xl bg-amber-500 text-white font-display text-lg font-bold hover:bg-amber-600 active:scale-[0.97] transition-all shadow-sm disabled:opacity-70 flex items-center justify-center gap-3"
      >
        <Dices size={22} className={rolling ? "animate-spin" : ""} />
        {rolling ? "Würfeln…" : "Würfeln!"}
      </button>

      {/* Dice results */}
      {shownDice.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col items-center gap-4">
          <div className="flex gap-3 flex-wrap justify-center">
            {shownDice.map((val, i) => (
              <DieFace key={i} value={val} rolling={rolling} />
            ))}
          </div>
          {count > 1 && !rolling && total > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-border w-full justify-center">
              <span className="text-sm text-muted-foreground font-medium">Summe</span>
              <span className="font-display text-2xl font-bold text-amber-500 tabular-nums">{total}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Coin Flip ─────────────────────────────────────────────────────────────────

function CoinFlip() {
  const [result, setResult] = useState<"heads" | "tails" | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [showResult, setShowResult] = useState(false);

  function flip() {
    if (flipping) return;
    setFlipping(true);
    setShowResult(false);
    setTimeout(() => {
      setResult(Math.random() < 0.5 ? "heads" : "tails");
      setFlipping(false);
      setShowResult(true);
    }, 650);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Münzwurf</h2>

      {/* Coin */}
      <div className="flex flex-col items-center gap-6 py-4">
        <div
          onClick={flip}
          role="button"
          aria-label="Münze werfen"
          className="cursor-pointer select-none"
          style={{ perspective: "600px" }}
        >
          <div
            className="relative w-32 h-32"
            style={{
              transformStyle: "preserve-3d",
              transition: flipping ? "transform 0.65s cubic-bezier(0.4,0,0.2,1)" : "transform 0.3s",
              transform: flipping ? "rotateY(720deg)" : "rotateY(0deg)",
            }}
          >
            {/* Heads */}
            <div
              className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-amber-400 bg-amber-400"
              style={{ backfaceVisibility: "hidden" }}
            >
              <Crown size={40} className="text-white drop-shadow" strokeWidth={1.5} />
              <span className="text-white text-xs font-bold mt-1 tracking-widest uppercase">Kopf</span>
            </div>
            {/* Tails */}
            <div
              className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-slate-500 bg-[#1E2A3A]"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <Zap size={40} className="text-amber-400 drop-shadow" strokeWidth={1.5} />
              <span className="text-amber-400 text-xs font-bold mt-1 tracking-widest uppercase">Zahl</span>
            </div>
          </div>
        </div>

        {/* Result */}
        {showResult && result && !flipping && (
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-foreground">
              {result === "heads" ? "Kopf!" : "Zahl!"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {result === "heads" ? "Die Krone hat gewonnen" : "Das Blitz-Symbol hat gewonnen"}
            </p>
          </div>
        )}

        <button
          onClick={flip}
          disabled={flipping}
          className="px-8 py-3 rounded-2xl bg-[#1E2A3A] text-white font-semibold text-sm hover:bg-[#253347] active:scale-[0.97] transition-all disabled:opacity-60 shadow-sm"
        >
          {flipping ? "Wirft…" : result ? "Nochmal!" : "Werfen!"}
        </button>
      </div>
    </section>
  );
}

// ── Tools Page ────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const [tab, setTab] = useState<"score" | "dice" | "coin">("score");

  // Handle prefill from score tracker (when returning to this page)
  const TAB_ITEMS = [
    { id: "score" as const, label: "Punkte",  icon: <Trophy size={15} /> },
    { id: "dice"  as const, label: "Würfel",  icon: <Dices  size={15} /> },
    { id: "coin"  as const, label: "Münze",   icon: <Crown  size={15} /> },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-5 pb-0">
        <h1 className="font-display text-2xl font-semibold text-[#1E2A3A] mb-3">Tools</h1>

        {/* Tab bar */}
        <div className="flex gap-0 -mx-4 px-4 border-b border-border">
          {TAB_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 border-b-2 transition-all",
                tab === id
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        {tab === "score" && <ScoreTracker />}
        {tab === "dice"  && <DiceRoller />}
        {tab === "coin"  && <CoinFlip />}
      </div>
    </div>
  );
}
