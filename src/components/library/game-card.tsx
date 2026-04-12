"use client";

import Image from "next/image";
import Link from "next/link";
import { Users, Clock, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatPlaytime, formatPlayerCount } from "@/lib/utils";
import type { UserGame, GameStatus } from "@/types";

const STATUS_LABELS: Record<GameStatus, string> = {
  owned: "Besitz",
  wishlist: "Wunschliste",
  previously_owned: "Ehemalig",
  for_trade: "Zum Tausch",
  want_to_play: "Möchte spielen",
};

interface GameCardProps {
  userGame: UserGame;
  view: "grid" | "list";
}

export function GameCard({ userGame, view }: GameCardProps) {
  const { game } = userGame;
  if (!game) return null;

  if (view === "list") {
    return (
      <Link
        href={`/games/${game.id}`}
        className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover transition-all duration-200 active:scale-[0.99]"
      >
        {/* Cover */}
        <div className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
          {game.thumbnail_url ? (
            <Image
              src={game.thumbnail_url}
              alt={game.name}
              fill
              className="object-cover"
              sizes="64px"
              loading="lazy"
            />
          ) : (
            <PlaceholderCover name={game.name} size="sm" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground text-sm leading-tight truncate">
            {game.name}
          </h3>
          {game.year_published && (
            <span className="text-muted-foreground text-xs">{game.year_published}</span>
          )}
          <div className="flex items-center gap-3 mt-1">
            {(game.min_players || game.max_players) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users size={11} strokeWidth={2} />
                {formatPlayerCount(game.min_players, game.max_players)}
              </span>
            )}
            {(game.min_playtime || game.max_playtime) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={11} strokeWidth={2} />
                {formatPlaytime(game.min_playtime, game.max_playtime)}
              </span>
            )}
          </div>
        </div>

        {/* Rating / Status */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {userGame.personal_rating && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600">
              <Star size={11} fill="currentColor" />
              {userGame.personal_rating}
            </span>
          )}
          <Badge variant={userGame.status as keyof typeof STATUS_LABELS}>
            {STATUS_LABELS[userGame.status]}
          </Badge>
        </div>
      </Link>
    );
  }

  // Grid view
  return (
    <Link
      href={`/games/${game.id}`}
      className="group flex flex-col bg-card rounded-card border border-border shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden active:scale-[0.98]"
    >
      {/* Cover image */}
      <div className="relative aspect-cover bg-muted overflow-hidden">
        {game.thumbnail_url ? (
          <Image
            src={game.thumbnail_url}
            alt={game.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 45vw, 200px"
            loading="lazy"
          />
        ) : (
          <PlaceholderCover name={game.name} size="lg" />
        )}

        {/* Status badge overlay */}
        {userGame.status !== "owned" && (
          <div className="absolute top-2 left-2">
            <Badge variant={userGame.status as keyof typeof STATUS_LABELS} className="text-[10px] px-2 py-0.5 shadow-sm">
              {STATUS_LABELS[userGame.status]}
            </Badge>
          </div>
        )}

        {/* Rating overlay */}
        {userGame.personal_rating && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-slate-900/80 backdrop-blur-sm text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md">
            <Star size={9} fill="currentColor" className="text-amber-400" />
            {userGame.personal_rating}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-2.5 flex flex-col gap-1">
        <h3 className="font-medium text-foreground text-xs leading-tight line-clamp-2">
          {game.name}
        </h3>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {(game.min_players || game.max_players) && (
            <span className="flex items-center gap-0.5">
              <Users size={10} strokeWidth={2} />
              {formatPlayerCount(game.min_players, game.max_players)}
            </span>
          )}
          {(game.min_playtime || game.max_playtime) && (
            <span className="flex items-center gap-0.5">
              <Clock size={10} strokeWidth={2} />
              {formatPlaytime(game.min_playtime, game.max_playtime)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Placeholder when no cover image is available
function PlaceholderCover({ name, size }: { name: string; size: "sm" | "lg" }) {
  // Generate a consistent color from the game name
  const hue = name.charCodeAt(0) % 360;
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center font-display font-bold text-white",
        size === "lg" ? "text-3xl" : "text-lg"
      )}
      style={{
        background: `hsl(${hue} 45% 45%)`,
      }}
    >
      {initial}
    </div>
  );
}
