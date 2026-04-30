"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { X, Users, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlannedSession } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnimState = "idle" | "drawing" | "revealing" | "done" | "no_result";

interface LotteryGame {
  id: string;
  name: string;
  thumbnail_url: string | null;
  min_players?: number | null;
  max_players?: number | null;
}

interface LotteryResult {
  game: LotteryGame;
  total_tickets: number;
  participant_count: number;
}

// ── Ball config ───────────────────────────────────────────────────────────────

const BALLS = [
  { id: 1, color: "#E8821A", size: 54, x: 8,  y: 14, dur: 2.2, delay: 0 },
  { id: 2, color: "#3DB87A", size: 46, x: 30, y: 6,  dur: 2.8, delay: -0.7 },
  { id: 3, color: "#4A9EDB", size: 38, x: 58, y: 18, dur: 1.9, delay: -1.2 },
  { id: 4, color: "#9B59B6", size: 42, x: 76, y: 8,  dur: 2.5, delay: -0.3 },
  { id: 5, color: "#E74C3C", size: 50, x: 18, y: 52, dur: 2.1, delay: -0.9 },
  { id: 6, color: "#F39C12", size: 38, x: 48, y: 56, dur: 2.6, delay: -1.5 },
  { id: 7, color: "#16A085", size: 44, x: 72, y: 50, dur: 2.3, delay: -0.5 },
  { id: 8, color: "#C0392B", size: 34, x: 35, y: 76, dur: 2.7, delay: -1.0 },
];

// ── Confetti generator ────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#E8821A", "#3DB87A", "#4A9EDB", "#F39C12",
  "#E74C3C", "#9B59B6", "#FFFFFF", "#FDE68A",
];

interface ConfettiItem {
  id: number; color: string; left: number; delay: number;
  duration: number; size: number; isCircle: boolean;
}

function generateConfetti(count: number): ConfettiItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: 3 + (i * 2.4) % 94,
    delay: (i * 0.038) % 0.9,
    duration: 1.3 + (i * 0.13) % 1.1,
    size: 5 + (i * 0.8) % 9,
    isCircle: i % 3 !== 0,
  }));
}

// ── LotterySheet ──────────────────────────────────────────────────────────────

export function LotterySheet({
  session,
  onClose,
  onGameAdded,
}: {
  session: PlannedSession;
  onClose: () => void;
  onGameAdded: (game: { id: string; name: string; thumbnail_url: string | null }) => void;
}) {
  const [animState, setAnimState] = useState<AnimState>("idle");
  const [result, setResult] = useState<LotteryResult | null>(null);
  const [noResultReason, setNoResultReason] = useState<string | null>(null);
  const [addingToSession, setAddingToSession] = useState(false);

  const confettiItems = useMemo(() => generateConfetti(50), []);

  const participantCount =
    1 + session.invitees.filter((i) => i.status !== "declined").length;

  const handleDraw = useCallback(async () => {
    setAnimState("drawing");
    setResult(null);
    setNoResultReason(null);

    // Run API call + enforce minimum animation time in parallel
    const [res] = await Promise.all([
      fetch(`/api/play-sessions/${session.id}/lottery`, { method: "POST" }),
      new Promise<void>((r) => setTimeout(r, 2800)),
    ]);

    const data = await res.json() as {
      game?: LotteryGame | null;
      reason?: string;
      total_tickets?: number;
      participant_count?: number;
    };

    if (!res.ok || !data.game) {
      const reason = data.reason === "no_playlists"
        ? "Noch keine Spiellisten vorhanden — füge Spiele unter »Playlist« hinzu."
        : `Kein passendes Spiel für ${data.participant_count ?? participantCount} Spieler gefunden.`;
      setNoResultReason(reason);
      setAnimState("no_result");
      return;
    }

    setResult({
      game: data.game,
      total_tickets: data.total_tickets ?? 0,
      participant_count: data.participant_count ?? participantCount,
    });
    setAnimState("revealing");
    setTimeout(() => setAnimState("done"), 900);
  }, [session.id, participantCount]);

  const handleAddToSession = useCallback(async () => {
    if (!result?.game) return;
    setAddingToSession(true);
    const res = await fetch(`/api/play-sessions/${session.id}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: result.game.id }),
    });
    setAddingToSession(false);
    if (res.ok || res.status === 409) {
      onGameAdded({ id: result.game.id, name: result.game.name, thumbnail_url: result.game.thumbnail_url });
      onClose();
    }
  }, [result, session.id, onGameAdded, onClose]);

  const isDone = animState === "done";
  const isDrawing = animState === "drawing";
  const isRevealing = animState === "revealing";

  return (
    <>
      {/* Confetti (rendered fixed over everything) */}
      {isDone && confettiItems.map((item) => (
        <div
          key={item.id}
          className="fixed top-0 pointer-events-none z-[70]"
          style={{
            left: `${item.left}%`,
            width: item.size,
            height: item.isCircle ? item.size : Math.round(item.size * 1.5),
            backgroundColor: item.color,
            borderRadius: item.isCircle ? "50%" : 2,
            animation: `lottery-confetti-fall ${item.duration}s ${item.delay}s ease-in forwards`,
            opacity: 0,
          }}
        />
      ))}

      {/* Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes lottery-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes lottery-float-fast {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-14px) translateX(6px); }
          50% { transform: translateY(-4px) translateX(-8px); }
          75% { transform: translateY(-18px) translateX(4px); }
        }
        @keyframes lottery-ball-exit {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0) rotate(180deg); opacity: 0; }
        }
        @keyframes lottery-ball-reveal {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          80% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes lottery-game-pop {
          0% { transform: scale(0) rotate(-8deg); opacity: 0; }
          55% { transform: scale(1.08) rotate(2deg); opacity: 1; }
          75% { transform: scale(0.97) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes lottery-confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          20% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(540deg); opacity: 0; }
        }
        @keyframes lottery-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes lottery-pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(232,130,26,0.2); }
          50% { box-shadow: 0 0 40px rgba(232,130,26,0.5); }
        }
        @keyframes lottery-chamber-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px) rotate(-0.5deg); }
          40% { transform: translateX(4px) rotate(0.5deg); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes lottery-name-slide {
          0% { transform: translateY(16px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}} />

      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0F1923 0%, #1a2636 100%)",
          maxHeight: "92dvh",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 flex-shrink-0">
          <div>
            <h2 className="font-display text-xl font-semibold text-white tracking-tight">
              Spiellotterie
            </h2>
            <p className="text-xs text-white/50 mt-0.5 flex items-center gap-1">
              <Users size={10} />
              {participantCount} Teilnehmer · gewichtete Ziehung
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col px-5 pb-6 gap-5">

          {/* ── Chamber ─────────────────────────────────────────────────── */}
          <div
            className="relative w-full rounded-3xl overflow-hidden flex-shrink-0"
            style={{
              height: 200,
              background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              animation: isDrawing ? "lottery-chamber-shake 0.25s ease-in-out infinite" : "none",
              animationPlayState: isDrawing ? "running" : "paused",
            }}
          >
            {/* Ambient glow ring */}
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at 50% 110%, rgba(232,130,26,0.12) 0%, transparent 65%)",
              }}
            />

            {/* Ball cluster (idle + drawing) */}
            {(animState === "idle" || isDrawing) && BALLS.map((ball) => (
              <div
                key={ball.id}
                className="absolute rounded-full"
                style={{
                  width: ball.size,
                  height: ball.size,
                  left: `${ball.x}%`,
                  top: `${ball.y}%`,
                  backgroundColor: ball.color,
                  boxShadow: `0 4px 16px ${ball.color}55, inset 0 2px 4px rgba(255,255,255,0.3)`,
                  animation: isDrawing
                    ? `lottery-float-fast ${ball.dur * 0.35}s ${ball.delay}s ease-in-out infinite`
                    : `lottery-float ${ball.dur}s ${ball.delay}s ease-in-out infinite`,
                  willChange: "transform",
                }}
              />
            ))}

            {/* Revealing: selected ball grows in center */}
            {(isRevealing) && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ animation: "lottery-ball-reveal 0.6s ease-out forwards" }}
              >
                <div
                  className="w-24 h-24 rounded-full"
                  style={{
                    backgroundColor: "#E8821A",
                    boxShadow: "0 0 60px rgba(232,130,26,0.7), inset 0 4px 8px rgba(255,255,255,0.4)",
                  }}
                />
              </div>
            )}

            {/* Done: game cover */}
            {isDone && result && (
              <div
                className="absolute inset-0 flex items-center justify-center gap-4"
                style={{ animation: "lottery-game-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
              >
                <div
                  className="relative rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl"
                  style={{ width: 100, height: 100, boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 3px rgba(232,130,26,0.6)" }}
                >
                  {result.game.thumbnail_url ? (
                    <Image
                      src={result.game.thumbnail_url}
                      alt={result.game.name}
                      fill
                      className="object-cover"
                      sizes="100px"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full bg-amber-500 flex items-center justify-center">
                      <span className="text-white font-bold text-3xl">{result.game.name[0]}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No result state */}
            {animState === "no_result" && (
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <p className="text-white/60 text-sm text-center leading-relaxed">{noResultReason}</p>
              </div>
            )}

            {/* Drawing: loading overlay */}
            {isDrawing && (
              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-amber-400"
                      style={{
                        animation: `lottery-float ${0.6}s ${i * 0.2}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Result reveal ──────────────────────────────────────────── */}
          {isDone && result && (
            <div
              className="text-center flex-shrink-0"
              style={{ animation: "lottery-name-slide 0.5s 0.3s ease-out both" }}
            >
              <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-1.5">
                Das Schicksal spricht
              </p>
              <h3 className="font-display text-2xl font-bold text-white leading-tight mb-2">
                {result.game.name}
              </h3>
              {(result.game.min_players || result.game.max_players) && (
                <p className="text-white/40 text-xs flex items-center justify-center gap-1.5">
                  <Users size={11} />
                  {result.game.min_players}
                  {result.game.max_players && result.game.max_players !== result.game.min_players
                    ? `–${result.game.max_players}`
                    : ""} Spieler
                  <span className="text-white/20">·</span>
                  {result.total_tickets} Lose gesamt
                </p>
              )}
            </div>
          )}

          {/* ── Idle description ───────────────────────────────────────── */}
          {animState === "idle" && (
            <div className="text-center flex-shrink-0 py-1">
              <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
                Die Listen aller {participantCount} Teilnehmer fließen ein.
                Höher gerankte Spiele bekommen mehr Lose.
              </p>
            </div>
          )}
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <div className="px-5 pb-7 pt-2 flex-shrink-0 flex flex-col gap-2.5">

          {/* Main button */}
          {(animState === "idle" || animState === "no_result") && (
            <button
              onClick={handleDraw}
              className="relative w-full py-4 rounded-2xl text-white font-bold text-lg overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #E8821A 0%, #f59c2a 50%, #E8821A 100%)",
                backgroundSize: "200% auto",
                boxShadow: "0 4px 24px rgba(232,130,26,0.45)",
                animation: "lottery-shimmer 3s linear infinite, lottery-pulse-glow 2s ease-in-out infinite",
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                🎰 {animState === "no_result" ? "Nochmal ziehen" : "Ziehen!"}
              </span>
            </button>
          )}

          {isDrawing && (
            <div
              className="w-full py-4 rounded-2xl text-white/60 font-bold text-lg text-center"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              Ziehe Lose…
            </div>
          )}

          {(isRevealing) && (
            <div
              className="w-full py-4 rounded-2xl text-amber-400 font-bold text-lg text-center"
              style={{ background: "rgba(232,130,26,0.1)" }}
            >
              ✨ Enthüllung…
            </div>
          )}

          {isDone && (
            <>
              <button
                onClick={handleAddToSession}
                disabled={addingToSession}
                className="w-full py-4 rounded-2xl font-bold text-base transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: "#3DB87A",
                  color: "white",
                  boxShadow: "0 4px 20px rgba(61,184,122,0.35)",
                }}
              >
                {addingToSession ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : "✓"} Zum Spieleabend hinzufügen
              </button>
              <button
                onClick={() => { setResult(null); setAnimState("idle"); }}
                className="w-full py-2.5 rounded-xl text-white/50 text-sm font-medium flex items-center justify-center gap-1.5 hover:text-white/70 transition-colors"
              >
                <RefreshCw size={13} /> Nochmal ziehen
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
