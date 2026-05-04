import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// ── BGStats types ──────────────────────────────────────────────────────────────

interface BGStatsPlayer {
  id: number;
  name: string;
  isMe?: boolean;
}

interface BGStatsLocation {
  id: number;
  name: string;
}

interface BGStatsPlayerScore {
  playerRefId: number;
  score?: number | null;
  winner?: boolean;
  rank?: number;
}

interface BGStatsPlay {
  id: number;
  gameRefId: number;
  date?: string;
  playDate?: string;
  duration?: number;
  durationMin?: number;
  notes?: string;
  locationRefId?: number;
  playerScores?: BGStatsPlayerScore[];
  incomplete?: boolean;
  cooperative?: boolean;
}

// ── POST /api/import/bgstats/plays ────────────────────────────────────────────
//
// Phase 2 of the BGStats import rebuild.
//
// Receives a CHUNK of plays (already sliced by the client) plus the game_map
// produced in Phase 1. No game resolution is done here — the game_map is used
// directly. This keeps each request small and fast.
//
// Body: {
//   game_map:  Record<string, string>,   // bgsGameId → mbGameUUID
//   players:   BGStatsPlayer[],
//   locations: BGStatsLocation[],
//   plays:     BGStatsPlay[],            // ← client sends only this chunk (≤100)
//   total:     number,                   // total plays in export (for progress)
//   offset:    number,                   // start index of this chunk
// }
//
// Returns: { imported, skipped_duplicates, skipped_no_game, errors, game_names,
//            offset, total, done }

const CHUNK_SIZE = 100;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let gameMap: Record<string, string>;
  let players: BGStatsPlayer[];
  let locations: BGStatsLocation[];
  let plays: BGStatsPlay[];
  let total: number;
  let offset: number;

  try {
    const body = await req.json() as {
      game_map?: unknown;
      players?: unknown;
      locations?: unknown;
      plays?: unknown;
      total?: unknown;
      offset?: unknown;
    };
    gameMap   = (body.game_map ?? {}) as Record<string, string>;
    players   = (Array.isArray(body.players)   ? body.players   : []) as BGStatsPlayer[];
    locations = (Array.isArray(body.locations) ? body.locations : []) as BGStatsLocation[];
    plays     = (Array.isArray(body.plays)     ? body.plays     : []) as BGStatsPlay[];
    total     = typeof body.total  === "number" ? body.total  : plays.length;
    offset    = typeof body.offset === "number" ? body.offset : 0;
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (plays.length === 0) {
    return NextResponse.json({
      imported: 0, skipped_duplicates: 0, skipped_no_game: 0, errors: 0, game_names: [],
      offset, total, done: true,
    });
  }

  // Build lookup maps
  const playerMap = new Map<number, BGStatsPlayer>();
  for (const p of players) playerMap.set(p.id, p);

  const locationMap = new Map<number, BGStatsLocation>();
  for (const l of locations) locationMap.set(l.id, l);

  // ── Fetch existing plays for duplicate detection ──────────────────────────────
  // Only for the game IDs referenced in this chunk
  const chunkGameIds = Array.from(
    new Set(
      plays
        .map((p) => gameMap[String(p.gameRefId)])
        .filter((id): id is string => Boolean(id))
    )
  );

  const { data: existingPlays } = chunkGameIds.length > 0
    ? await supabase
        .from("plays")
        .select("game_id, played_at")
        .eq("user_id", user.id)
        .in("game_id", chunkGameIds)
    : { data: [] as { game_id: string; played_at: string }[] };

  const existingSet = new Set<string>();
  for (const ep of existingPlays ?? []) {
    const day = (ep.played_at as string).slice(0, 10);
    existingSet.add(`${ep.game_id}::${day}`);
  }

  // ── Import plays ─────────────────────────────────────────────────────────────
  let imported = 0;
  let skippedDuplicates = 0;
  let skippedNoGame = 0;
  let errors = 0;
  const importedGameNames: string[] = [];

  for (const play of plays) {
    const gameId = gameMap[String(play.gameRefId)];
    if (!gameId) {
      skippedNoGame++;
      continue;
    }

    // Parse date
    const rawDate = play.date ?? play.playDate ?? "";
    const dateStr = rawDate.slice(0, 10);
    if (!dateStr || dateStr.length < 10) {
      errors++;
      continue;
    }
    const timeStr = rawDate.length > 10 ? rawDate.slice(11, 19) : "12:00:00";
    const playedAt = `${dateStr}T${timeStr}`;

    // Duplicate check (same game + same day)
    const dupKey = `${gameId}::${dateStr}`;
    if (existingSet.has(dupKey)) {
      skippedDuplicates++;
      continue;
    }

    const location = play.locationRefId != null
      ? (locationMap.get(play.locationRefId)?.name ?? null)
      : null;

    const duration = play.duration ?? play.durationMin ?? null;

    try {
      const { data: newPlay, error: playErr } = await admin
        .from("plays")
        .insert({
          user_id:          user.id,
          game_id:          gameId,
          played_at:        playedAt,
          duration_minutes: duration ?? null,
          location:         location ?? null,
          notes:            play.notes ?? null,
          cooperative:      play.cooperative ?? false,
          incomplete:       play.incomplete ?? false,
        })
        .select("id")
        .single();

      if (playErr || !newPlay) {
        errors++;
        continue;
      }

      // Insert play_players
      const scores = play.playerScores ?? [];
      if (scores.length > 0) {
        const playerRows = scores.map((ps, idx) => {
          const bgsPlayer = playerMap.get(ps.playerRefId);
          return {
            play_id:      newPlay.id as string,
            user_id:      null as string | null,
            display_name: bgsPlayer?.name ?? `Spieler ${idx + 1}`,
            score:        ps.score ?? null,
            winner:       ps.winner ?? false,
            color:        null as string | null,
            seat_order:   idx,
            new_player:   false,
          };
        });
        await admin.from("play_players").insert(playerRows);
      }

      existingSet.add(dupKey); // prevent intra-chunk duplicates
      imported++;
    } catch {
      errors++;
    }
  }

  const nextOffset = offset + plays.length;
  const done = nextOffset >= total;

  return NextResponse.json({
    imported,
    skipped_duplicates: skippedDuplicates,
    skipped_no_game:    skippedNoGame,
    errors,
    game_names:         importedGameNames.slice(0, 20),
    offset:             nextOffset,
    total,
    done,
  });
}
