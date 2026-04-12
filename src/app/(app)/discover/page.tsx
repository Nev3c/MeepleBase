import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entdecken" };

export default function DiscoverPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-200px)] px-6 text-center">
      <h1 className="font-display text-3xl font-semibold text-foreground mb-2">Entdecken</h1>
      <p className="text-muted-foreground">Kommt in Phase 2 – Spieler & Gruppen finden.</p>
    </div>
  );
}
