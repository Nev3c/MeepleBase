"use client";

import { Button } from "@/components/ui/button";

// Meeple SVG illustration – warm, friendly, on-brand
function MeepleIllustration() {
  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-40 h-auto drop-shadow-md"
      aria-hidden="true"
    >
      {/* Shadow */}
      <ellipse cx="100" cy="228" rx="52" ry="10" fill="#E8821A" opacity="0.15" />

      {/* Body */}
      <path
        d="M60 140 C55 155 48 175 52 200 C56 220 80 228 100 228 C120 228 144 220 148 200 C152 175 145 155 140 140 Z"
        fill="#E8821A"
      />

      {/* Head */}
      <circle cx="100" cy="95" r="38" fill="#E8821A" />

      {/* Inner head highlight */}
      <circle cx="92" cy="85" r="28" fill="#EF9A3D" opacity="0.4" />

      {/* Eyes */}
      <circle cx="88" cy="90" r="6" fill="#1E2A3A" />
      <circle cx="112" cy="90" r="6" fill="#1E2A3A" />
      <circle cx="90" cy="88" r="2" fill="white" />
      <circle cx="114" cy="88" r="2" fill="white" />

      {/* Smile */}
      <path
        d="M88 106 Q100 116 112 106"
        stroke="#1E2A3A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Neck connector */}
      <rect x="84" y="128" width="32" height="18" rx="4" fill="#E8821A" />

      {/* Left arm */}
      <path
        d="M60 150 Q38 140 30 158 Q26 168 38 172 Q50 176 60 165"
        fill="#E8821A"
      />
      {/* Right arm */}
      <path
        d="M140 150 Q162 140 170 158 Q174 168 162 172 Q150 176 140 165"
        fill="#E8821A"
      />

      {/* Small dice in right hand */}
      <rect x="162" y="162" width="20" height="20" rx="4" fill="#3DB87A" />
      <circle cx="168" cy="168" r="2" fill="white" />
      <circle cx="176" cy="168" r="2" fill="white" />
      <circle cx="168" cy="176" r="2" fill="white" />
      <circle cx="176" cy="176" r="2" fill="white" />

      {/* Decorative stars */}
      <path d="M20 60 L22 66 L28 66 L23 70 L25 76 L20 72 L15 76 L17 70 L12 66 L18 66 Z"
        fill="#E8821A" opacity="0.3" />
      <path d="M172 40 L174 46 L180 46 L175 50 L177 56 L172 52 L167 56 L169 50 L164 46 L170 46 Z"
        fill="#3DB87A" opacity="0.4" />
    </svg>
  );
}

// Decorative floating cards in background
function DecorativeCard({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-card bg-white/60 border border-border shadow-card ${className}`}
      aria-hidden="true"
    />
  );
}

interface LibraryEmptyStateProps {
  onAddGame: () => void;
}

export function LibraryEmptyState({ onAddGame }: LibraryEmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100dvh-200px)] px-6 overflow-hidden">
      {/* Decorative background cards */}
      <DecorativeCard className="w-28 h-36 -top-4 -left-8 rotate-[-12deg] opacity-60" />
      <DecorativeCard className="w-24 h-32 top-12 -right-6 rotate-[8deg] opacity-40" />
      <DecorativeCard className="w-20 h-28 bottom-20 -left-4 rotate-[6deg] opacity-30" />
      <DecorativeCard className="w-26 h-34 bottom-12 -right-8 rotate-[-9deg] opacity-50" />

      {/* Warm radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(232,130,26,0.08) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm animate-slide-up">
        {/* Meeple */}
        <div className="mb-6 animate-bounce-gentle">
          <MeepleIllustration />
        </div>

        {/* Headline */}
        <h2 className="font-display text-3xl font-semibold text-foreground mb-3 leading-tight">
          Deine Bibliothek{" "}
          <span className="text-gradient-amber italic">wartet</span>
        </h2>

        {/* Subtext */}
        <p className="text-muted-foreground text-base leading-relaxed mb-8">
          Hier landen all deine Spiele – von Klassikern bis zu den neuesten
          Entdeckungen. Fang einfach an.
        </p>

        {/* CTA */}
        <div className="w-full max-w-xs">
          <Button
            className="w-full h-12 text-base font-semibold shadow-amber"
            onClick={onAddGame}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Spiel hinzufügen
          </Button>
        </div>
      </div>
    </div>
  );
}
