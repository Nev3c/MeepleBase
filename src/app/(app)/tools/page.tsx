"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, RotateCcw, Dices, Coins, Users, ArrowRight, X, Trophy } from "lucide-react";
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
    setPlayers((prev) =>
      prev.map((p) => p.id === activePlayer ? { ...p, score: p.score + delta } : p)
    );
    setHistory((prev) => [...prev, { playerId: activePlayer, delta }]);
  }, [activePlayer]);

  const undoLast = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setPlayers((prev) =>
      prev.map((p) => p.id === last.playerId ? { ...p, score: p.score - last.delta } : p)
    );
    setHistory((prev) => prev.slice(0, -1));
  }, [history]);

  const addPlayer = useCallback(() => {
    const id = nextId.current++;
    setPlayers((prev) => [...prev, { id, name: `Spieler ${prev.length + 1}`, score: 0 }]);
  }, []);

  const removePlayer = useCallback((id: number) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setActivePlayer((prev) => {
      const remaining = players.filter((p) => p.id !== id);
      return remaining.find((p) => p.id === prev)?.id ?? remaining[0]?.id ?? 1;
    });
  }, [players]);

  const reset = useCallback(() => {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
    setHistory([]);
  }, []);

  const updateName = useCallback((id: number, name: string) => {
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
  }, []);

  const maxScore = Math.max(...players.map((p) => p.score));
  const winner = players.length > 0 && players.filter((p) => p.score === maxScore && maxScore > 0);

  // Transfer to play recording: build URL params
  function handleTransferToPlay() {
    const params = new URLSearchParams();
    players.forEach((p, i) => {
      params.set(`player_${i}_name`, p.name);
      params.set(`player_${i}_score`, p.score.toString());
    });
    // Navigate to plays with pre-fill params
    router.push(`/plays?prefill=${encodeURIComponent(params.toString())}`);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">🏆 Punkte-Tracker</h2>
        <div className="flex gap-2">
          {history.length > 0 && (
            <button
              onClick={undoLast}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              ↩ Rückgängig
            </button>
          )}
          <button
            onClick={reset}
            className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Alle Punkte zurücksetzen"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Player tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {players.map((p) => {
          const isWinner = Array.isArray(winner) && winner.some((w) => w.id === p.id);
          return (
            <button
              key={p.id}
              onClick={() => setActivePlayer(p.id)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border",
                activePlayer === p.id
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-card border-border text-foreground hover:border-amber-300"
              )}
            >
              {isWinner && <Trophy size={13} className={activePlayer === p.id ? "text-white" : "text-amber-500"} />}
              <span className="max-w-[80px] truncate">{p.name}</span>
              <span className={cn("font-bold ml-0.5", activePlayer === p.id ? "text-white" : "text-amber-500")}>
                {p.score}
              </span>
            </button>
          );
        })}
        <button
          onClick={addPlayer}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border"
          title="Spieler hinzufügen"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Active player detail */}
      {players.find((p) => p.id === activePlayer) && (() => {
        const p = players.find((p) => p.id === activePlayer)!;
        return (
          <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <input
                value={p.name}
                onChange={(e) => updateName(p.id, e.target.value)}
                className="flex-1 text-base font-semibold bg-transparent focus:outline-none text-foreground border-b border-border focus:border-amber-400 transition-colors pb-0.5"
                placeholder="Name…"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addScore(-1)}
                  className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="font-display text-3xl font-bold text-amber-500 min-w-[3ch] text-center tabular-nums">
                  {p.score}
                </span>
                <button
                  onClick={() => addScore(1)}
                  className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              {players.length > 2 && (
                <button
                  onClick={() => removePlayer(p.id)}
                  className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick-add buttons */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ADD.map((n) => (
                <button
                  key={n}
                  onClick={() => addScore(n)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 active:scale-95 transition-all"
                >
                  +{n}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Leaderboard */}
      {players.length > 1 && (
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rangliste</span>
          </div>
          {[...players]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => {
              const isWinner = Array.isArray(winner) && winner.some((w) => w.id === p.id);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 transition-colors cursor-pointer",
                    activePlayer === p.id ? "bg-amber-50" : "hover:bg-muted/30",
                  )}
                  onClick={() => setActivePlayer(p.id)}
                >
                  <span className="text-sm font-bold text-muted-foreground w-5 text-center">{i + 1}.</span>
                  {isWinner && <Trophy size={14} className="text-amber-500 flex-shrink-0" />}
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{p.name}</span>
                  <span className="font-display text-lg font-bold text-amber-500 tabular-nums">{p.score}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Transfer to play */}
      <button
        onClick={handleTransferToPlay}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#1E2A3A] text-white text-sm font-semibold hover:bg-[#253347] active:scale-[0.98] transition-all"
      >
        <Dices size={16} />
        Als Partie erfassen
        <ArrowRight size={15} />
      </button>
    </section>
  );
}

// ── Dice Roller ───────────────────────────────────────────────────────────────

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function DiceRoller() {
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState<number[]>([]);

  function roll() {
    if (rolling) return;
    setRolling(true);

    // Animate for 600ms with random face changes
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

  const shownDice = rolling ? displayDice : results;
  const total = results.reduce((s, n) => s + n, 0);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-foreground">🎲 Würfelwurf</h2>

      {/* Count selector */}
      <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-3 shadow-card">
        <span className="text-sm text-muted-foreground font-medium flex-1">Anzahl Würfel</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            disabled={count <= 1}
            className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 disabled:opacity-40 transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="font-display text-xl font-bold text-amber-500 w-6 text-center">{count}</span>
          <button
            onClick={() => setCount((c) => Math.min(6, c + 1))}
            disabled={count >= 6}
            className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 disabled:opacity-40 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Roll button */}
      <button
        onClick={roll}
        disabled={rolling}
        className="w-full py-4 rounded-2xl bg-amber-500 text-white font-display text-xl font-bold hover:bg-amber-600 active:scale-[0.97] transition-all shadow-sm disabled:opacity-70 flex items-center justify-center gap-3"
      >
        <Dices size={24} className={rolling ? "animate-spin" : ""} />
        {rolling ? "Würfeln…" : "Würfeln!"}
      </button>

      {/* Results */}
      {shownDice.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col items-center gap-3">
          <div className="flex gap-3 flex-wrap justify-center">
            {shownDice.map((val, i) => (
              <span
                key={i}
                className={cn(
                  "text-6xl transition-all duration-75 select-none",
                  rolling ? "animate-pulse opacity-70" : "drop-shadow-sm"
                )}
                aria-label={`Würfel ${i + 1}: ${val}`}
              >
                {DICE_FACES[val - 1]}
              </span>
            ))}
          </div>
          {count > 1 && !rolling && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-muted-foreground">Summe</span>
              <span className="font-display text-2xl font-bold text-amber-500">{total}</span>
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
  const [flipped, setFlipped] = useState(false);

  function flip() {
    if (flipping) return;
    setFlipping(true);
    setFlipped(false);

    setTimeout(() => {
      const outcome = Math.random() < 0.5 ? "heads" : "tails";
      setResult(outcome);
      setFlipped(true);
      setFlipping(false);
    }, 700);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-foreground">🪙 Münzwurf</h2>

      {/* Coin */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            "w-32 h-32 rounded-full flex items-center justify-center text-6xl select-none cursor-pointer transition-all duration-700 shadow-lg border-4",
            flipping
              ? "animate-bounce border-muted bg-muted scale-90"
              : result === "heads"
              ? "bg-amber-400 border-amber-500 scale-100"
              : result === "tails"
              ? "bg-slate-300 border-slate-400 scale-100"
              : "bg-muted border-border scale-100 hover:scale-105"
          )}
          onClick={flip}
          role="button"
          aria-label="Münze werfen"
        >
          {flipping ? (
            <Coins size={48} className="text-muted-foreground animate-spin" />
          ) : result === "heads" ? (
            "👑"
          ) : result === "tails" ? (
            "⚡"
          ) : (
            <Coins size={48} className="text-muted-foreground" />
          )}
        </div>

        {!flipping && result && flipped && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="font-display text-2xl font-bold text-foreground">
              {result === "heads" ? "Kopf! 👑" : "Zahl! ⚡"}
            </p>
          </div>
        )}

        <button
          onClick={flip}
          disabled={flipping}
          className="px-8 py-3 rounded-2xl bg-[#1E2A3A] text-white font-semibold text-base hover:bg-[#253347] active:scale-[0.97] transition-all disabled:opacity-70"
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

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-5 pb-0">
        <h1 className="font-display text-2xl font-semibold text-foreground mb-3">Tools</h1>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-border -mx-4 px-4">
          {([
            { id: "score", label: "🏆 Punkte", },
            { id: "dice",  label: "🎲 Würfel", },
            { id: "coin",  label: "🪙 Münze",  },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 text-sm font-semibold py-2.5 border-b-2 transition-all",
                tab === id
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
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
