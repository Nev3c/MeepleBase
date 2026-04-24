"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Minus, RotateCcw, Dices, ArrowRight,
  X, Trophy, Undo2, Crown, Hash, Volume2, Pencil, StopCircle, Clock,
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

  const resolvedAmount = editingCustom ? (parseInt(customAmount) || 0) : amount;

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
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Punkte-Tracker</h2>
        <div className="flex gap-1.5">
          {history.length > 0 && (
            <button onClick={undoLast} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-medium">
              <Undo2 size={13} /> Rückgängig
            </button>
          )}
          <button onClick={reset} className="w-8 h-8 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center" title="Alle Punkte zurücksetzen">
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
            <button key={p.id} onClick={() => setActivePlayer(p.id)} className={cn("flex-shrink-0 flex items-center gap-1.5 pl-3 pr-2 py-2 rounded-2xl text-sm font-medium transition-all border", isActive ? "bg-[#1E2A3A] text-white border-transparent shadow-sm" : "bg-card border-border text-foreground hover:border-amber-300")}>
              {isWinner && <Trophy size={12} className={isActive ? "text-amber-400" : "text-amber-500"} />}
              <span className="max-w-[72px] truncate">{p.name || `Spieler ${p.id}`}</span>
              <span className={cn("font-display font-bold text-sm ml-0.5 tabular-nums", isActive ? "text-amber-400" : "text-amber-500")}>{p.score}</span>
            </button>
          );
        })}
        <button onClick={addPlayer} className="flex-shrink-0 w-9 h-9 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border">
          <Plus size={14} />
        </button>
      </div>

      {/* Active player card */}
      {active && (
        <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input value={active.name} onChange={(e) => updateName(active.id, e.target.value)} className="flex-1 min-w-0 text-sm font-semibold bg-transparent focus:outline-none text-foreground border-b border-transparent focus:border-amber-400 transition-colors pb-0.5" placeholder={`Spieler ${active.id}`} />
            {players.length > 2 && (
              <button onClick={() => removePlayer(active.id)} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors flex-shrink-0">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-center">
            <span className="font-display text-6xl font-bold text-amber-500 tabular-nums leading-none">{active.score}</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {AMOUNT_CHIPS.map((n) => (
                <button key={n} onClick={() => { setAmount(n); setEditingCustom(false); setCustomAmount(""); }} className={cn("flex-1 min-w-[2.5rem] py-2 rounded-xl text-sm font-bold transition-all border", !editingCustom && amount === n ? "bg-[#1E2A3A] text-white border-transparent" : "bg-muted border-transparent text-foreground hover:border-amber-300")}>
                  {n}
                </button>
              ))}
              <input type="number" inputMode="numeric" value={customAmount} placeholder="?" onFocus={() => setEditingCustom(true)} onBlur={() => { if (!customAmount) setEditingCustom(false); }} onChange={(e) => { setCustomAmount(e.target.value); setEditingCustom(true); }} className={cn("flex-1 min-w-[2.5rem] py-2 rounded-xl text-sm font-bold text-center border transition-all bg-muted focus:outline-none", editingCustom ? "border-amber-400 bg-amber-50 text-amber-700" : "border-transparent text-muted-foreground")} />
            </div>

            <div className="flex gap-2">
              <button onClick={() => addScore(-resolvedAmount)} disabled={resolvedAmount === 0} className="flex-1 h-14 rounded-2xl bg-muted text-foreground font-display text-xl font-bold flex items-center justify-center gap-1.5 hover:bg-red-50 hover:text-red-600 active:scale-[0.97] transition-all disabled:opacity-40">
                <Minus size={18} /><span className="tabular-nums">{resolvedAmount}</span>
              </button>
              <button onClick={() => addScore(resolvedAmount)} disabled={resolvedAmount === 0} className="flex-1 h-14 rounded-2xl bg-amber-500 text-white font-display text-xl font-bold flex items-center justify-center gap-1.5 hover:bg-amber-600 active:scale-[0.97] transition-all shadow-sm disabled:opacity-40">
                <Plus size={18} /><span className="tabular-nums">{resolvedAmount}</span>
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
          {[...players].sort((a, b) => b.score - a.score).map((p, i) => {
            const isWinner = winners.some((w) => w.id === p.id);
            return (
              <button key={p.id} onClick={() => setActivePlayer(p.id)} className={cn("w-full flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 transition-colors text-left", activePlayer === p.id ? "bg-amber-50" : "hover:bg-muted/30")}>
                <span className="text-xs font-bold text-muted-foreground w-4 text-right">{i + 1}</span>
                {isWinner ? <Trophy size={13} className="text-amber-500 flex-shrink-0" /> : <span className="w-[13px] flex-shrink-0" />}
                <span className="flex-1 text-sm font-medium text-foreground truncate">{p.name || `Spieler ${p.id}`}</span>
                <span className="font-display text-base font-bold text-amber-500 tabular-nums">{p.score}</span>
              </button>
            );
          })}
        </div>
      )}

      <button onClick={handleTransferToPlay} className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#1E2A3A] text-white text-sm font-semibold hover:bg-[#253347] active:scale-[0.98] transition-all shadow-sm">
        <Dices size={15} />Als Partie erfassen<ArrowRight size={14} />
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
    <div className={cn("w-16 h-16 rounded-2xl bg-white border-2 border-border shadow-card relative flex-shrink-0 transition-all duration-75", rolling && "opacity-60 scale-95")}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" aria-label={`Würfel: ${value}`}>
        {dots.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={8} fill="#1E2A3A" />)}
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
        <button onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1} className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 disabled:opacity-40 transition-colors"><Minus size={14} /></button>
        <span className="font-display text-xl font-bold text-amber-500 w-7 text-center tabular-nums">{count}</span>
        <button onClick={() => setCount((c) => Math.min(6, c + 1))} disabled={count >= 6} className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 disabled:opacity-40 transition-colors"><Plus size={14} /></button>
      </div>
      <button onClick={roll} disabled={rolling} className="w-full py-4 rounded-2xl bg-amber-500 text-white font-display text-lg font-bold hover:bg-amber-600 active:scale-[0.97] transition-all shadow-sm disabled:opacity-70 flex items-center justify-center gap-3">
        <Dices size={22} className={rolling ? "animate-spin" : ""} />{rolling ? "Würfeln…" : "Würfeln!"}
      </button>
      {shownDice.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col items-center gap-4">
          <div className="flex gap-3 flex-wrap justify-center">
            {shownDice.map((val, i) => <DieFace key={i} value={val} rolling={rolling} />)}
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
    setTimeout(() => { setResult(outcome); setFlipping(false); setShowResult(true); }, 700);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Münzwurf</h2>
      <div className="flex flex-col items-center gap-6 py-4">
        <div onClick={flip} role="button" aria-label="Münze werfen" className="cursor-pointer select-none" style={{ perspective: "600px" }}>
          <div className="relative w-32 h-32" style={{ transformStyle: "preserve-3d", transition: "transform 0.7s cubic-bezier(0.4,0,0.2,1)", transform: `rotateY(${totalRotation}deg)` }}>
            <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-amber-400 bg-amber-400" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
              <Crown size={40} className="text-white drop-shadow" strokeWidth={1.5} />
              <span className="text-white text-xs font-bold mt-1 tracking-widest uppercase">Kopf</span>
            </div>
            <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-slate-500 bg-[#1E2A3A]" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              <Hash size={40} className="text-amber-400 drop-shadow" strokeWidth={1.5} />
              <span className="text-amber-400 text-xs font-bold mt-1 tracking-widest uppercase">Zahl</span>
            </div>
          </div>
        </div>
        {showResult && result && !flipping && (
          <p className="font-display text-2xl font-bold text-foreground text-center">{result === "heads" ? "Kopf!" : "Zahl!"}</p>
        )}
        <button onClick={flip} disabled={flipping} className="px-8 py-3 rounded-2xl bg-[#1E2A3A] text-white font-semibold text-sm hover:bg-[#253347] active:scale-[0.97] transition-all disabled:opacity-60 shadow-sm">
          {flipping ? "Wirft…" : result ? "Nochmal!" : "Werfen!"}
        </button>
      </div>
    </section>
  );
}

// ── Soundboard ────────────────────────────────────────────────────────────────

const EMOJI_PICKER = [
  "🎵","🎶","🎸","🥁","🎻","🎹","🎷","🎺",
  "🌊","🌙","🔥","⛈️","🌲","🌿","🌬️","🌸",
  "🐉","⚔️","🧙","🏰","🎲","🗺️","🔮","💀",
  "😴","⚡","🕯️","🌌","🌅","🌃","🎭","🎬",
  "☕","🍺","🌍","🎯","🔔","🚀","💎","🎃",
  "👑","🦁","🐺","🦅","🌋","❄️","🏔️","🌊",
];

interface SoundButton {
  id: string;
  label: string;
  icon: string;
  youtubeUrl: string;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const STORAGE_KEY = "meeplebase_soundboard_v1";

function loadButtons(): SoundButton[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SoundButton[];
  } catch { /* ignore */ }
  return [];
}

function saveButtons(buttons: SoundButton[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buttons)); } catch { /* ignore */ }
}

type FormMode = { type: "add" } | { type: "edit"; button: SoundButton } | null;

function SoundBoard() {
  const [buttons, setButtons] = useState<SoundButton[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formIcon, setFormIcon] = useState("🎵");
  const [formUrl, setFormUrl] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load from localStorage client-side only
  useEffect(() => { setButtons(loadButtons()); }, []);

  function playSound(btn: SoundButton) {
    const videoId = extractYouTubeId(btn.youtubeUrl);
    if (!videoId) return;

    if (playingId === btn.id) {
      // Stop
      if (iframeRef.current) iframeRef.current.src = "";
      setPlayingId(null);
    } else {
      // Play — set src directly in click handler for autoplay to work
      const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}`;
      if (iframeRef.current) iframeRef.current.src = src;
      setPlayingId(btn.id);
    }
  }

  function stopAll() {
    if (iframeRef.current) iframeRef.current.src = "";
    setPlayingId(null);
  }

  function openAdd() {
    setFormMode({ type: "add" });
    setFormLabel("");
    setFormIcon("🎵");
    setFormUrl("");
    setShowIconPicker(false);
    setEditMode(false);
  }

  function openEdit(btn: SoundButton) {
    setFormMode({ type: "edit", button: btn });
    setFormLabel(btn.label);
    setFormIcon(btn.icon);
    setFormUrl(btn.youtubeUrl);
    setShowIconPicker(false);
  }

  function cancelForm() {
    setFormMode(null);
    setShowIconPicker(false);
  }

  function saveForm() {
    const label = formLabel.trim();
    const url = formUrl.trim();
    if (!label || !extractYouTubeId(url)) return;

    let updated: SoundButton[];
    if (formMode?.type === "edit") {
      updated = buttons.map((b) =>
        b.id === formMode.button.id ? { ...b, label, icon: formIcon, youtubeUrl: url } : b
      );
    } else {
      updated = [...buttons, { id: Date.now().toString(), label, icon: formIcon, youtubeUrl: url }];
    }
    setButtons(updated);
    saveButtons(updated);
    setFormMode(null);
    setShowIconPicker(false);
  }

  function deleteButton(id: string) {
    if (playingId === id) stopAll();
    const updated = buttons.filter((b) => b.id !== id);
    setButtons(updated);
    saveButtons(updated);
  }

  const urlValid = !!extractYouTubeId(formUrl);
  const canSave = formLabel.trim().length > 0 && urlValid;

  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Soundboard</h2>
        {buttons.length > 0 && (
          <button
            onClick={() => { setEditMode((e) => !e); setFormMode(null); }}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors",
              editMode ? "bg-[#1E2A3A] text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {editMode ? "Fertig" : "Bearbeiten"}
          </button>
        )}
      </div>

      {/* Button grid */}
      {buttons.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {buttons.map((btn) => {
            const isPlaying = playingId === btn.id;
            const hasUrl = !!extractYouTubeId(btn.youtubeUrl);
            return (
              <div key={btn.id} className="relative">
                <button
                  onClick={() => !editMode && hasUrl && playSound(btn)}
                  className={cn(
                    "w-full aspect-[4/3] rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.96]",
                    isPlaying
                      ? "bg-amber-500 border-amber-500 shadow-lg"
                      : "bg-card border-border hover:border-amber-300",
                    editMode && "opacity-70 cursor-default",
                    !hasUrl && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="text-3xl leading-none">{btn.icon}</span>
                  <span className={cn(
                    "text-xs font-semibold text-center px-2 leading-tight line-clamp-2",
                    isPlaying ? "text-white" : "text-foreground"
                  )}>
                    {btn.label}
                  </span>
                  {isPlaying && (
                    <span className="flex gap-0.5 items-end h-3">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="w-1 bg-white rounded-full animate-bounce" style={{ height: "100%", animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  )}
                </button>

                {/* Edit overlay */}
                {editMode && (
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button
                      onClick={() => openEdit(btn)}
                      className="w-7 h-7 rounded-lg bg-white/95 shadow text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteButton(btn.id)}
                      className="w-7 h-7 rounded-lg bg-white/95 shadow text-red-500 hover:text-red-600 flex items-center justify-center transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {buttons.length === 0 && !formMode && (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">🎵</span>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Noch keine Sounds</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Füge YouTube-Links als Buttons hinzu — z.B. Hintergrundmusik, Ambience oder Spielgeräusche.
            </p>
          </div>
        </div>
      )}

      {/* Add button (when not in edit mode and no form open) */}
      {!editMode && !formMode && (
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Sound hinzufügen
        </button>
      )}

      {/* Add / Edit form */}
      {formMode && (
        <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">
            {formMode.type === "edit" ? "Sound bearbeiten" : "Sound hinzufügen"}
          </p>

          {/* Icon + Label */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowIconPicker((v) => !v)}
              className={cn(
                "w-12 h-11 rounded-xl border flex items-center justify-center text-2xl flex-shrink-0 transition-colors",
                showIconPicker ? "border-amber-400 bg-amber-50" : "border-border bg-background hover:border-amber-400"
              )}
            >
              {formIcon}
            </button>
            <input
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder='Bezeichnung (z.B. „Taverne")'
              className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          {/* Icon picker grid */}
          {showIconPicker && (
            <div className="grid grid-cols-8 gap-1 p-2.5 bg-muted/40 rounded-xl max-h-44 overflow-y-auto">
              {EMOJI_PICKER.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { setFormIcon(emoji); setShowIconPicker(false); }}
                  className={cn(
                    "w-9 h-9 rounded-lg text-xl flex items-center justify-center hover:bg-white transition-colors",
                    formIcon === emoji && "bg-white ring-2 ring-amber-400"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* YouTube URL */}
          <div>
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="YouTube-URL (z.B. youtube.com/watch?v=…)"
              className={cn(
                "w-full h-11 px-3 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent transition-all",
                formUrl && !urlValid ? "border-red-300 focus:ring-red-400" : "border-border focus:ring-amber-400"
              )}
            />
            {formUrl && !urlValid && (
              <p className="text-xs text-red-600 mt-1">Keine gültige YouTube-URL erkannt</p>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={cancelForm} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Abbrechen
            </button>
            <button
              onClick={saveForm}
              disabled={!canSave}
              className="flex-1 h-10 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-[0.97] transition-all disabled:opacity-40"
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      {/* YouTube player — always in DOM so iframeRef is available on first click */}
      <div className={cn("rounded-2xl border overflow-hidden shadow-sm transition-all", playingId ? "border-amber-300" : "border-border")}>
        {playingId ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200">
            <span className="flex gap-0.5 items-end h-3.5">
              {[0, 120, 240].map((d) => (
                <span key={d} className="w-1 bg-amber-500 rounded-full animate-bounce" style={{ height: "100%", animationDelay: `${d}ms` }} />
              ))}
            </span>
            <span className="text-xs font-semibold text-amber-800 flex-1">
              {buttons.find((b) => b.id === playingId)?.label ?? "Läuft…"}
            </span>
            <button
              onClick={stopAll}
              className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors"
            >
              <StopCircle size={13} /> Stop
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
            <Volume2 size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Wähle einen Sound…</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          className="w-full aspect-video"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title="Soundboard Player"
        />
      </div>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
        Sounds werden lokal gespeichert. YouTube-Links müssen öffentliche Videos sein.
      </p>
    </section>
  );
}

// ── Timer ─────────────────────────────────────────────────────────────────────

const TIMER_PRESETS = [
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
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1); gain1.connect(ctx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.4);
    gain1.gain.setValueAtTime(volume, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc1.start(now); osc1.stop(now + 1.2);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1100, now + 0.5);
    osc2.frequency.exponentialRampToValueAtTime(800, now + 1.0);
    gain2.gain.setValueAtTime(volume * 0.6, now + 0.5);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc2.start(now + 0.5); osc2.stop(now + 1.8);
  } catch { /* AudioContext not available */ }
}

function GameTimer() {
  const [selected, setSelected] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customSeconds, setCustomSeconds] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setRemaining(duration ?? selected);
  }

  function selectPreset(v: number) {
    resetTimer(v);
    setSelected(v);
    setShowCustom(false);
    setCustomMinutes("");
    setCustomSeconds("");
  }

  function applyCustom() {
    const total = (parseInt(customMinutes) || 0) * 60 + (parseInt(customSeconds) || 0);
    if (total <= 0) return;
    setSelected(total);
    resetTimer(total);
    setShowCustom(false);
  }

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - (selected > 0 ? remaining / selected : 0));
  const displayMin = Math.floor(remaining / 60);
  const displaySec = remaining % 60;
  const isPreset = TIMER_PRESETS.some((p) => p.value === selected);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-[#1E2A3A]">Timer</h2>

      {/* Presets */}
      <div className="flex gap-1.5 flex-wrap">
        {TIMER_PRESETS.map((p) => (
          <button key={p.value} onClick={() => selectPreset(p.value)} className={cn("px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border", !showCustom && selected === p.value ? "bg-[#1E2A3A] text-white border-transparent" : "bg-muted border-transparent text-foreground hover:border-amber-300")}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setShowCustom((v) => !v)} className={cn("px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border", showCustom || (!isPreset && remaining !== selected) ? "bg-[#1E2A3A] text-white border-transparent" : "bg-muted border-transparent text-muted-foreground hover:border-amber-300")}>
          Eigene
        </button>
      </div>

      {showCustom && (
        <div className="bg-card rounded-2xl border border-border p-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <input type="number" inputMode="numeric" min={0} max={99} value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)} placeholder="0" className="w-14 h-10 rounded-xl border border-border bg-background text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <span className="text-sm text-muted-foreground font-medium">Min</span>
            <input type="number" inputMode="numeric" min={0} max={59} value={customSeconds} onChange={(e) => setCustomSeconds(e.target.value)} placeholder="0" className="w-14 h-10 rounded-xl border border-border bg-background text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <span className="text-sm text-muted-foreground font-medium">Sek</span>
          </div>
          <button onClick={applyCustom} className="px-4 h-10 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors flex-shrink-0">OK</button>
        </div>
      )}

      {/* Ring */}
      <div className={cn("bg-card rounded-3xl border border-border shadow-card p-6 flex flex-col items-center gap-6 transition-all", finished && "bg-amber-50 border-amber-300")}>
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
            <circle cx="60" cy="60" r={radius} fill="none" stroke={finished ? "#f59e0b" : remaining < 11 ? "#ef4444" : "#1E2A3A"} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: running ? "stroke-dashoffset 1s linear" : "none" }} />
          </svg>
          <div className="flex flex-col items-center">
            {finished ? (
              <span className="font-display text-2xl font-bold text-amber-500">Zeit!</span>
            ) : (
              <span className={cn("font-display text-4xl font-bold tabular-nums leading-none", remaining < 11 && !finished ? "text-red-500" : "text-[#1E2A3A]")}>
                {displayMin > 0 ? `${displayMin}:${String(displaySec).padStart(2, "0")}` : String(displaySec)}
              </span>
            )}
            {!finished && displayMin === 0 && <span className="text-xs text-muted-foreground mt-0.5">Sekunden</span>}
          </div>
        </div>

        <div className="flex gap-3 w-full">
          <button onClick={() => resetTimer()} className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors flex-shrink-0" title="Zurücksetzen">
            <RotateCcw size={16} />
          </button>
          {running ? (
            <button onClick={pauseTimer} className="flex-1 h-12 rounded-2xl bg-[#1E2A3A] text-white font-semibold text-sm hover:bg-[#253347] active:scale-[0.97] transition-all">Pause</button>
          ) : (
            <button onClick={startTimer} disabled={remaining === 0} className="flex-1 h-12 rounded-2xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm">
              {finished ? "Nochmal" : remaining < selected && remaining > 0 ? "Weiter" : "Start"}
            </button>
          )}
          <button onClick={() => playBell(0.4)} className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors flex-shrink-0" title="Ton testen">
            <Volume2 size={16} />
          </button>
        </div>
        {finished && <p className="text-sm text-amber-700 font-medium text-center -mt-2">Zeit abgelaufen! 🔔</p>}
      </div>

      <p className="text-[11px] text-muted-foreground text-center px-4 leading-relaxed">
        Lautsprecher-Button zum Testen. Timer läuft nur solange diese Seite offen ist.
      </p>
    </section>
  );
}

// ── Tools Page ────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const [tab, setTab] = useState<"score" | "dice" | "coin" | "sound" | "timer">("score");

  const TAB_ITEMS = [
    { id: "score" as const, label: "Punkte", icon: <Trophy  size={15} /> },
    { id: "dice"  as const, label: "Würfel", icon: <Dices   size={15} /> },
    { id: "coin"  as const, label: "Münze",  icon: <Crown   size={15} /> },
    { id: "sound" as const, label: "Sound",  icon: <Volume2 size={15} /> },
    { id: "timer" as const, label: "Timer",  icon: <Clock   size={15} /> },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 pt-5 pb-0">
        <h1 className="font-display text-2xl font-semibold text-[#1E2A3A] mb-3">Tools</h1>
        <div className="flex gap-0 -mx-4 px-4 border-b border-border">
          {TAB_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 border-b-2 transition-all gap-0.5",
                tab === id ? "border-amber-500 text-amber-600" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {icon}
              <span className={cn("text-[10px] font-semibold leading-none transition-all", tab === id ? "opacity-100" : "opacity-0 h-0 overflow-hidden")}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        {tab === "score" && <ScoreTracker />}
        {tab === "dice"  && <DiceRoller />}
        {tab === "coin"  && <CoinFlip />}
        {tab === "sound" && <SoundBoard />}
        {tab === "timer" && <GameTimer />}
      </div>
    </div>
  );
}
