export default function AppLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background gap-4">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="MeepleBase" className="w-16 h-16 animate-pulse" />
        <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">
          Meeple<span className="text-amber-500">Base</span>
        </h1>
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
