"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, AlertCircle, Gamepad2,
  MapPin, Clock, Trophy, Users,
} from "lucide-react";

interface Player {
  display_name: string;
  score: number | null;
  winner: boolean;
}

interface Game {
  id: string;
  name: string;
  thumbnail_url: string | null;
}

interface Props {
  playId: string;
  game: Game | null;
  playedAt: string;
  location: string | null;
  durationMinutes: number | null;
  cooperative: boolean;
  players: Player[];
  alreadyImported: boolean;
  isOwnPlay: boolean;
}

export function PlayImportClient({
  playId,
  game,
  playedAt,
  location,
  durationMinutes,
  cooperative,
  players,
  alreadyImported,
  isOwnPlay,
}: Props) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = new Date(playedAt);
  const dateStr = date.toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  const winners = players.filter((p) => p.winner);

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/plays/${playId}/shared`, { method: "POST" });
      if (res.status === 409) {
        setError("Diese Partie ist bereits in deinen Partien eingetragen.");
        return;
      }
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error ?? "Fehler beim Übernehmen");
        return;
      }
      setDone(true);
    } finally {
      setImporting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-72px)] px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Partie übernommen!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {game?.name ?? "Die Partie"} wurde zu deinen Partien hinzugefügt.
          </p>
        </div>
        <Link
          href="/plays"
          className="mt-2 px-6 py-3 rounded-2xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
        >
          Zu meinen Partien
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <Link href="/plays" className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground leading-tight">Partie übernehmen</h1>
          <p className="text-xs text-muted-foreground">Füge diese Partie zu deinen Partien hinzu</p>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-3">
        {/* Game card */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          {game?.thumbnail_url && (
            <div className="relative h-32 w-full">
              <Image
                src={game.thumbnail_url}
                alt={game.name}
                fill
                className="object-cover"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {!game?.thumbnail_url && <Gamepad2 size={16} className="text-amber-500" />}
              <h2 className="font-display text-lg font-bold text-foreground">
                {game?.name ?? "Unbekanntes Spiel"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">{dateStr} · {timeStr} Uhr</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {location && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin size={11} />{location}
                </span>
              )}
              {durationMinutes && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={11} />{durationMinutes} Min.
                </span>
              )}
              {cooperative && (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                  <Users size={11} />Kooperativ
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Players */}
        {players.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Spieler · {players.length}
            </p>
            <div className="flex flex-col gap-2">
              {players.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.winner && <Trophy size={13} className="text-amber-500 flex-shrink-0" />}
                    <span className={`text-sm ${p.winner ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                      {p.display_name}
                    </span>
                  </div>
                  {p.score !== null && (
                    <span className="text-sm font-bold text-foreground tabular-nums">{p.score}</span>
                  )}
                </div>
              ))}
            </div>
            {winners.length > 0 && (
              <p className="text-xs text-amber-600 font-medium mt-2">
                🏆 {winners.map((w) => w.display_name).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Already imported / own play notice */}
        {(alreadyImported || isOwnPlay) && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              {isOwnPlay
                ? "Das ist deine eigene Partie — du hast sie bereits eingetragen."
                : "Du hast diese Partie bereits in deiner Liste."}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-3.5">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* CTA */}
        {!isOwnPlay && (
          <button
            onClick={handleImport}
            disabled={importing || alreadyImported}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {importing ? (
              <span>Wird übernommen…</span>
            ) : alreadyImported ? (
              <>
                <CheckCircle2 size={16} />
                Bereits eingetragen
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                In meine Partien übernehmen
              </>
            )}
          </button>
        )}

        <p className="text-center text-xs text-muted-foreground pb-2">
          Scores und Gewinner können danach noch bearbeitet werden.
        </p>
      </div>
    </div>
  );
}
