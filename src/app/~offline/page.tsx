"use client";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt="MeepleBase"
          className="w-16 h-16 rounded-2xl opacity-60"
        />
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground mb-2">
            Kein Internet
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            Du bist gerade offline. Bereits geladene Seiten stehen weiterhin zur Verfügung.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="h-11 px-6 rounded-btn bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 active:scale-[0.98] transition-all"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
