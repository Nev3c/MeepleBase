import type { Metadata } from "next";

export const metadata: Metadata = { title: "Partien" };

export default function PlaysPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-200px)] px-6 text-center">
      <h1 className="font-display text-3xl font-semibold text-foreground mb-2">Partien</h1>
      <p className="text-muted-foreground">Kommt in Phase 1 – Partien-Tracking.</p>
    </div>
  );
}
