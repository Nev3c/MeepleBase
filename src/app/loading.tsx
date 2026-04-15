// Root-level loading — shown during initial app startup / SSR hydration
export default function RootLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#FDFAF6] gap-4">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="MeepleBase" className="w-16 h-16 rounded-2xl animate-pulse" />
        <p className="font-display text-2xl font-semibold text-[#1E2A3A] tracking-tight">
          Meeple<span className="text-[#E8821A]">Base</span>
        </p>
      </div>
      <div className="flex gap-1.5 mt-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
