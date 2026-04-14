"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Edit2, Users, Clock, MapPin, Handshake, FileText, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/shared/image-lightbox";

interface PlayPlayer {
  id: string;
  display_name: string;
  score: number | null;
  winner: boolean;
  color: string | null;
}

interface GameInfo {
  id: string;
  name: string;
  thumbnail_url: string | null;
  image_url?: string | null;
  bgg_id?: number;
}

interface Play {
  id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
  location: string | null;
  notes: string | null;
  cooperative: boolean;
  image_url?: string | null;
  game?: GameInfo | null;
  players?: PlayPlayer[];
}

export function PlayDetailClient({ play }: { play: Play; libraryGames?: unknown[] }) {
  const router = useRouter();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { game, players = [] } = play;

  const date = new Date(play.played_at);
  const dateStr = date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const winner = players.find((p) => p.winner);
  const hasScores = players.some((p) => p.score != null);
  const sortedPlayers = hasScores
    ? [...players].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
    : players;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Hero — game cover */}
      <div className="relative w-full" style={{ height: "260px" }}>
        {game?.thumbnail_url ? (
          <Image
            src={game.thumbnail_url}
            alt={game.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `hsl(${(game?.name.charCodeAt(0) ?? 0) % 360} 40% 40%)` }}
          >
            <span className="text-white font-display text-6xl font-bold opacity-40">
              {game?.name?.[0] ?? "?"}
            </span>
          </div>
        )}
        {/* Gradient overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label="Zurück"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Edit button — navigates back to plays list where the edit sheet opens */}
        <Link
          href="/plays"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label="Bearbeiten"
        >
          <Edit2 size={16} />
        </Link>

        {/* Game name + date overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          {game && (
            <Link href={`/games/${game.id}`} className="block">
              <h1 className="font-display text-2xl font-semibold text-white leading-tight drop-shadow-sm line-clamp-2">
                {game.name}
              </h1>
            </Link>
          )}
          <p className="text-white/80 text-sm mt-0.5 capitalize">{dateStr}</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 flex flex-col gap-4 max-w-2xl mx-auto w-full">

        {/* Quick stats row */}
        <div className="flex items-center gap-4 flex-wrap">
          {play.duration_minutes && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock size={14} className="text-amber-500" />
              {play.duration_minutes} Min.
            </span>
          )}
          {play.location && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={14} className="text-amber-500" />
              {play.location}
            </span>
          )}
          {play.cooperative && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
              <Handshake size={13} />
              Kooperativ
            </span>
          )}
        </div>

        {/* Players */}
        {players.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users size={11} />
              Spieler
            </h2>
            <div className="flex flex-col gap-2">
              {sortedPlayers.map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border",
                    p.winner
                      ? "bg-amber-50 border-amber-200"
                      : "bg-card border-border"
                  )}
                >
                  {/* Rank / crown */}
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    {p.winner ? (
                      <span className="text-lg leading-none">🏆</span>
                    ) : hasScores ? (
                      <span className="text-muted-foreground text-xs font-medium">{i + 1}.</span>
                    ) : null}
                  </div>

                  <span className={cn("flex-1 text-sm font-medium", p.winner ? "text-amber-900" : "text-foreground")}>
                    {p.display_name}
                  </span>

                  {p.score != null && (
                    <span className={cn("text-sm font-bold tabular-nums", p.winner ? "text-amber-700" : "text-foreground")}>
                      {p.score} Pkt
                    </span>
                  )}
                </div>
              ))}
            </div>

            {play.cooperative && winner === undefined && (
              <p className="text-xs text-muted-foreground mt-2 text-center italic">Kein individueller Gewinner — Kooperativspiel</p>
            )}
          </section>
        )}

        {/* Session photo */}
        {play.image_url && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Camera size={11} />
              Foto
            </h2>
            <button
              className="w-full rounded-2xl overflow-hidden border border-border block"
              onClick={() => setLightboxOpen(true)}
              aria-label="Foto vergrößern"
            >
              <div className="relative w-full" style={{ maxHeight: 320 }}>
                <Image
                  src={play.image_url}
                  alt="Partien-Foto"
                  width={640}
                  height={320}
                  className="w-full object-cover"
                  sizes="(max-width: 672px) 100vw, 640px"
                />
              </div>
            </button>
            {lightboxOpen && (
              <ImageLightbox
                images={[play.image_url]}
                currentIndex={0}
                onClose={() => setLightboxOpen(false)}
                onNavigate={() => {}}
              />
            )}
          </section>
        )}

        {/* Notes */}
        {play.notes && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <FileText size={11} />
              Notizen
            </h2>
            <div className="bg-muted/40 rounded-xl px-4 py-3 border border-border">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{play.notes}</p>
            </div>
          </section>
        )}

        {/* Link to game detail */}
        {game && (
          <Link
            href={`/games/${game.id}`}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors mt-1"
          >
            {game.thumbnail_url && (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                <Image src={game.thumbnail_url} alt="" fill className="object-cover" sizes="40px" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-700 font-medium">Zum Spiel</p>
              <p className="text-sm font-semibold text-amber-900 truncate">{game.name}</p>
            </div>
            <ArrowLeft size={14} className="text-amber-500 rotate-180 flex-shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
