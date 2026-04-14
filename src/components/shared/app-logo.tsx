import Image from "next/image";

export function AppLogo({ size = 56 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-2xl overflow-hidden shadow-amber flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          src="/icon-192.png"
          alt="MeepleBase"
          width={size}
          height={size}
          className="object-cover"
          priority
        />
      </div>
      <span className="font-display text-xl font-semibold text-foreground tracking-tight">
        Meeple<span className="text-amber-500">Base</span>
      </span>
    </div>
  );
}
