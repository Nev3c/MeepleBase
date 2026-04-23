"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Minus, RotateCcw, Dices, ArrowRight,
  X, Trophy, Undo2, Crown, Hash, Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Score Tracker ─────────────────────────────────────────────────────────────

interface Player {
  id: number;
  name: string;
  score: number;
}

const AMOUNT_CHIPS = [1, 2, 3, 5, 10, 50];

function ScoreTracker() {
  const router = useRouter();
  const nextId = useRef(3);
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: "", score: 0 },
    { id: 2, name: "", score: 0 },
  ]);
  const [activePlayer, setActivePlayer] = useState<number>(1);
  const [history, setHistory] = useState<{ playerId: number; delta: number }[]>([]);
  const [amount, setAmount] = useState(1);
  const [customAmount, setCustomAmount] = useState("");
  const [editingCustom, setEditingCustom] = useState(false);

  const resolvedAmount = editingCustom
    ? (parseInt(customAmount) || 0)
    : amount;

  const addScore = useCallback((delta: number) => {
    if (delta === 0) return;
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
    setPlayers((prev) => [...prev, { id, name: "", score: 0 }]);
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
              <span className="max-w-[72px] truncate">{p.name || `Spieler ${p.id}`}</span>
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
        <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-4">
          {/* Name row */}
          <div className="flex items-center gap-2">
            <input
              value={active.name}
              onChange={(e) => updateName(active.id, e.target.value)}
              className="flex-1 min-w-0 text-sm font-semibold bg-transparent focus:outline-none text-foreground border-b border-transparent focus:border-amber-400 transition-colors pb-0.5"
              placeholder={`Spieler ${active.id}`}
            />
            {players.length > 2 && (
              <button
                onClick={() => removePlayer(active.id)}
                className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Score display */}
          <div className="flex items-center justify-center">
            <span className="font-display text-6xl font-bold text-amber-500 tabular-nums leading-none">
              {active.score}
            </span>
          </div>

          {/* Amount chips */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {AMOUNT_CHIPS.map((n) => (
                <button
                  key={n}
                  onClick={() => { setAmount(n); setEditingCustom(false); setCustomAmount(""); }}
                  className={cn(
                    "flex-1 min-w-[2.5rem] py-2 rounded-xl text-sm font-bold transition-all border",
                    !editingCustom && amount === n
                      ? "bg-[#1E2A3A] text-white border-transparent"
                      : "bg-muted border-transparent text-foreground hover:border-amber-300"
                  )}
                >
                  {n}
                </button>
              ))}
              {/* Custom amount input */}
              <input
                type="number"
                inputMode="numeric"
                value={customAmount}
                placeholder="?"
                onFocus={() => setEditingCustom(true)}
                onBlur={() => { if (!customAmount) setEditingCustom(false); }}
                onChange={(e) => { setCustomAmount(e.target.value); setEditingCustom(true); }}
                className={cn(
                  "flex-1 min-w-[2.5rem] py-2 rounded-xl text-sm font-bold text-center border transition-all bg-muted focus:outline-none",
                  editingCustom
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-transparent text-muted-foreground"
                )}
              />
            </div>

            {/* Apply buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => addScore(-resolvedAmount)}
                disabled={resolvedAmount === 0}
                className="flex-1 h-14 rounded-2xl bg-muted text-foreground font-display text-xl font-bold flex items-center justify-center gap-1.5 hover:bg-red-50 hover:text-red-600 active:scale-[0.97] transition-all disabled:opacity-40"
              >
                <Minus size={18} />
                <span className="tabular-nums">{resolvedAmount}</span>
              </button>
              <button
                onClick={() => addScore(resolvedAmount)}
                disabled={resolvedAmount === 0}
                className="flex-1 h-14 rounded-2xl bg-amber-500 text-white font-display text-xl font-bold flex items-center justify-center gap-1.5 hover:bg-amber-600 active:scale-[0.97] transition-all shadow-sm disabled:opacity-40"
              >
                <Plus size={18} />
                <span className="tabular-nums">{resolvedAmount}</span>
              </button>
            </div>
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
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{p.name || `Spieler ${p.id}`}</span>
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

      <button
        onClick={roll}
        disabled={rolling}
        className="w-full py-4 rounded-2xl bg-amber-500 text-white font-display text-lg font-bold hover:bg-amber-600 active:scale-[0.97] transition-all shadow-sm disabled:opacity-70 flex items-center justify-center gap-3"
      >
        <Dices size={22} className={rolling ? "animate-spin" : ""} />
        {rolling ? "Würfeln…" : "Würfeln!"}
      </button>

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
  const [totalRotation, setTotalRotation] = useState(0);
  const rotationRef = useRef(0);

  function flip() {
    if (flipping) return;
    const outcome: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
    const targetMod = outcome === "heads" ? 0 : 180;
    const currentMod = rotationRef.current % 360;
    const forward = ((targetMod - currentMod) + 360) % 360 || 360;
    const newRotation = rotationRef.current + forward + 720;

    rotationRef.current = newRotation;
    setFlipping(true);
    setShowResult(false);
    setTotalRotation(newRotation);

    setTimeout(() => {
      setResult(outcome);
      setFlipping(false);
      setShowResult(true);
    }, 700);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Münzwurf</h2>

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
              transition: "transform 0.7s cubic-bezier(0.4,0,0.2,1)",
              transform: `rotateY(${totalRotation}deg)`,
            }}
          >
            <div
              className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-amber-400 bg-amber-400"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            >
              <Crown size={40} className="text-white drop-shadow" strokeWidth={1.5} />
              <span className="text-white text-xs font-bold mt-1 tracking-widest uppercase">Kopf</span>
            </div>
            <div
              className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-slate-500 bg-[#1E2A3A]"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <Hash size={40} className="text-amber-400 drop-shadow" strokeWidth={1.5} />
              <span className="text-amber-400 text-xs font-bold mt-1 tracking-widest uppercase">Zahl</span>
            </div>
          </div>
        </div>

        {showResult && result && !flipping && (
          <p className="font-display text-2xl font-bold text-foreground text-center">
            {result === "heads" ? "Kopf!" : "Zahl!"}
          </p>
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

// ── Sound / Timer ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "30 Sek", value: 30 },
  { label: "1 Min",  value: 60 },
  { label: "2 Min",  value: 120 },
  { label: "3 Min",  value: 180 },
  { label: "5 Min",  value: 300 },
  { label: "10 Min", value: 600 },
];

function playBell(volume = 0.7) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // First bell
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1); gain1.connect(ctx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.4);
    gain1.gain.setValueAtTime(volume, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc1.start(now); osc1.stop(now + 1.2);

    // Second bell (slight delay)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1100, now + 0.5);
    osc2.frequency.exponentialRampToValueAtTime(800, now + 1.0);
    gain2.gain.setValueAtTime(volume * 0.6, now + 0.5);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc2.start(now + 0.5); osc2.stop(now + 1.8);
  } catch {
    // AudioContext not available (e.g. SSR)
  }
}

function SoundTimer() {
  const [selected, setSelected] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customSeconds, setCustomSeconds] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up interval on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  function startTimer() {
    if (remaining === 0) return;
    setFinished(false);
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setFinished(true);
          playBell();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function pauseTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  }

  function resetTimer(duration?: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setFinished(false);
    const d = duration ?? selected;
    setRemaining(d);
  }

  function selectPreset(v: number) {
    resetTimer(v);
    setSelected(v);
    setShowCustom(false);
    setCustomMinutes("");
    setCustomSeconds("");
  }

  function applyCustom() {
    const mins = parseInt(customMinutes) || 0;
    const secs = parseInt(customSeconds) || 0;
    const total = mins * 60 + secs;
    if (total <= 0) return;
    setSelected(total);
    resetTimer(total);
    setShowCustom(false);
  }

  const progress = selected > 0 ? remaining / selected : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const displayMin = Math.floor(remaining / 60);
  const displaySec = remaining % 60;

  const isPreset = PRESETS.some((p) => p.value === selected);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Timer</h2>

      {/* Preset chips */}
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => selectPreset(p.value)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border",
              !showCustom && selected === p.value
                ? "bg-[#1E2A3A] text-white border-transparent"
                : "bg-muted border-transparent text-foreground hover:border-amber-300"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={cn(
            "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border",
            showCustom || (!isPreset && !showCustom && selected !== 60)
              ? "bg-[#1E2A3A] text-white border-transparent"
              : "bg-muted border-transparent text-muted-foreground hover:border-amber-300"
          )}
        >
          Eigene
        </button>
      </div>

      {/* Custom time input */}
      {showCustom && (
        <div className="bg-card rounded-2xl border border-border p-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              placeholder="0"
              className="w-14 h-10 rounded-xl border border-border bg-background text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <span className="text-sm text-muted-foreground font-medium">Min</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={customSeconds}
              onChange={(e) => setCustomSeconds(e.target.value)}
              placeholder="0"
              className="w-14 h-10 rounded-xl border border-border bg-background text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <span className="text-sm text-muted-foreground font-medium">Sek</span>
          </div>
          <button
            onClick={applyCustom}
            className="px-4 h-10 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors flex-shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* Circular timer */}
      <div className={cn(
        "bg-card rounded-3xl border border-border shadow-card p-6 flex flex-col items-center gap-6 transition-all",
        finished && "bg-amber-50 border-amber-300"
      )}>
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* SVG ring */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
            {/* Track */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
            {/* Progress */}
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke={finished ? "#f59e0b" : remaining < 11 ? "#ef4444" : "#1E2A3A"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: running ? "stroke-dashoffset 1s linear" : "none" }}
            />
          </svg>
          {/* Time display */}
          <div className="flex flex-col items-center">
            {finished ? (
              <span className="font-display text-2xl font-bold text-amber-500">Zeit!</span>
            ) : (
              <span className={cn(
                "font-display text-4xl font-bold tabular-nums leading-none",
                remaining < 11 && !finished ? "text-red-500" : "text-[#1E2A3A]"
              )}>
                {displayMin > 0
                  ? `${displayMin}:${String(displaySec).padStart(2, "0")}`
                  : String(displaySec)
                }
              </span>
            )}
            {!finished && displayMin === 0 && (
              <span className="text-xs text-muted-foreground mt-0.5">Sekunden</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 w-full">
          <button
            onClick={() => resetTimer()}
            className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors flex-shrink-0"
            title="Zurücksetzen"
          >
            <RotateCcw size={16} />
          </button>

          {running ? (
            <button
              onClick={pauseTimer}
              className="flex-1 h-12 rounded-2xl bg-[#1E2A3A] text-white font-semibold text-sm hover:bg-[#253347] active:scale-[0.97] transition-all"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={startTimer}
              disabled={remaining === 0}
              className="flex-1 h-12 rounded-2xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm"
            >
              {finished ? "Nochmal" : remaining < selected && remaining > 0 ? "Weiter" : "Start"}
            </button>
          )}

          {/* Test bell */}
          <button
            onClick={() => playBell(0.4)}
            className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors flex-shrink-0"
            title="Sound testen"
          >
            <Volume2 size={16} />
          </button>
        </div>

        {finished && (
          <p className="text-sm text-amber-700 font-medium text-center -mt-2">
            Zeit abgelaufen! 🔔
          </p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center px-4 leading-relaxed">
        Tipp: Lautsprecher-Button zum Testen des Tons. Der Timer läuft nur solange diese Seite offen ist.
      </p>
    </section>
  );
}

// ── Tools Page ────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const [tab, setTab] = useState<"score" | "dice" | "coin" | "sound">("score");

  const TAB_ITEMS = [
    { id: "score" as const, label: "Punkte", icon: <Trophy size={15} /> },
    { id: "dice"  as const, label: "Würfel", icon: <Dices   size={15} /> },
    { id: "coin"  as const, label: "Münze",  icon: <Crown   size={15} /> },
    { id: "sound" as const, label: "Timer",  icon: <Volume2 size={15} /> },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 pt-5 pb-0">
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
        {tab === "sound" && <SoundTimer />}
      </div>
    </div>
  );
}
