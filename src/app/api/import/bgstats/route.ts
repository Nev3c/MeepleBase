import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// ── BGStats JSON export types ──────────────────────────────────────────────────

interface BGStatsGame {
  id: number;
  name: string;
  bggId?: number;
}

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
  startPlayer?: boolean;
}

interface BGStatsPlay {
  id: number;
  gameRefId: number;
  // "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"
  date?: string;
  playDate?: string; // alternate field name used by some BGStats versions
  duration?: number;
  durationMin?: number; // alternate
  notes?: string;
  locationRefId?: number;
  playerScores?: BGStatsPlayerScore[];
  incomplete?: boolean;
  cooperative?: boolean;
}

interface BGStatsExport {
  games?: BGStatsGame[];
  players?: BGStatsPlayer[];
  locations?: BGStatsLocation[];
  plays?: BGStatsPlay[];
  // Pagination (added by client-side chunking)
  offset?: number;
}

// ── POST /api/import/bgstats ───────────────────────────────────────────────────
// Body: parsed BGStats JSON export { games, players, locations, plays, offset? }
//
// Chunked import: the client sends the full BGStats export body on every request,
// plus an optional `offset` (default 0). The route processes CHUNK_SIZE plays
// starting at `offset` and returns `{ ..., total, next_offset, done }` so the
// client can loop until done.
//
// Why chunking?  A BGStats export with 700+ plays previously exceeded Vercel's
// function timeout (10 s free / 60 s pro) when processed all at once, because
// the sequential play loop does 2 DB round-trips per play.  Chunking keeps each
// request well under the timeout.

const CHUNK_SIZE = 100;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: BGStatsExport;
  try {
    body = await req.json() as BGStatsExport;
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const bgsGames = body.games ?? [];
  const bgsPlayers = body.players ?? [];
  const bgsLocations = body.locations ?? [];
  const bgsPlays = body.plays ?? [];
  const offset = typeof body.offset === "number" && body.offset >= 0 ? body.offset : 0;

  if (bgsPlays.length === 0) {
    return NextResponse.json({ error: "Keine Partien in der Datei gefunden." }, { status: 400 });
  }

  // ── Slice plays to the current chunk ────────────────────────────────────────
  const chunk = bgsPlays.slice(offset, offset + CHUNK_SIZE);
  const nextOffset = offset + CHUNK_SIZE;
  const done = nextOffset >= bgsPlays.length;

  // ── Build lookup maps from BGStats IDs ──────────────────────────────────────
  const bgsGameMap = new Map<number, BGStatsGame>();
  for (const g of bgsGames) bgsGameMap.set(g.id, g);

  const bgsPlayerMap = new Map<number, BGStatsPlayer>();
  for (const p of bgsPlayers) bgsPlayerMap.set(p.id, p);

  const bgsLocationMap = new Map<number, BGStatsLocation>();
  for (const l of bgsLocations) bgsLocationMap.set(l.id, l);

  // ── Resolve BGStats games → MeepleBase game UUIDs (only for this chunk) ─────
  // Cache: bgs game id → meeplebase game uuid
  const gameIdCache = new Map<number, string>();
  const gameNameCache = new Map<number, string>();

  // Only resolve unique game IDs referenced in this chunk — avoids redundant DB
  // lookups for games not used in this batch.
  const uniqueBgsGameIds = Array.from(new Set(chunk.map((p) => p.gameRefId)));

  // Run all game-resolution lookups in parallel (each is an independent DB query).
  await Promise.all(
    uniqueBgsGameIds.map(async (bgsId) => {
      const bgsGame = bgsGameMap.get(bgsId);
      if (!bgsGame) return;

      // 1) Match by BGG ID
      if (bgsGame.bggId) {
        const { data: existing } = await admin
          .from("games")
          .select("id, name")
          .eq("bgg_id", bgsGame.bggId)
          .maybeSingle();

        if (existing) {
          gameIdCache.set(bgsId, existing.id as string);
          gameNameCache.set(bgsId, existing.name as string);
          return;
        }
      }

      // 2) Match by name (case-insensitive)
      const { data: byName } = await admin
        .from("games")
        .select("id, name")
        .ilike("name", bgsGame.name.trim())
        .maybeSingle();

      if (byName) {
        gameIdCache.set(bgsId, byName.id as string);
        gameNameCache.set(bgsId, byName.name as string);
        return;
      }

      // 3) Create minimal game entry
      const insertPayload: Record<string, unknown> = {
        name: bgsGame.name.trim(),
      };
      if (bgsGame.bggId) insertPayload.bgg_id = bgsGame.bggId;

      const { data: created } = await admin
        .from("games")
        .insert(insertPayload)
        .select("id, name")
        .single();

      if (created) {
        gameIdCache.set(bgsId, created.id as string);
        gameNameCache.set(bgsId, created.name as string);
      }
    })
  );

  // ── Fetch existing play dates for this user (for duplicate detection) ────────
  // We compare: same user_id + same game_id + same calendar day.
  // Only fetching the IDs of games used in this chunk avoids a full-table scan
  // for large play histories.
  const chunkGameIds = Array.from(gameIdCache.values());
  const { data: existingPlays } = await supabase
    .from("plays")
    .select("game_id, played_at")
    .in("game_id", chunkGameIds.length > 0 ? chunkGameIds : ["00000000-0000-0000-0000-000000000000"]);

  const existingSet = new Set<string>();
  for (const ep of existingPlays ?? []) {
    const day = (ep.played_at as string).slice(0, 10);
    existingSet.add(`${ep.game_id}::${day}`);
  }

  // ── Import plays in this chunk ───────────────────────────────────────────────
  let imported = 0;
  let skippedDuplicates = 0;
  let skippedNoGame = 0;
  let errors = 0;
  const importedGameNames: string[] = [];

  for (const play of chunk) {
    const gameId = gameIdCache.get(play.gameRefId);
    if (!gameId) {
      skippedNoGame++;
      continue;
    }

    // Parse date
    const rawDate = play.date ?? play.playDate ?? "";
    const dateStr = rawDate.slice(0, 10); // "YYYY-MM-DD"
    if (!dateStr || dateStr.length < 10) {
      errors++;
      continue;
    }
    // Build ISO timestamp
    const timeStr = rawDate.length > 10 ? rawDate.slice(11, 19) : "12:00:00";
    const playedAt = `${dateStr}T${timeStr}`;

    // Duplicate check
    const dupKey = `${gameId}::${dateStr}`;
    if (existingSet.has(dupKey)) {
      skippedDuplicates++;
      continue;
    }

    // Location
    const location = play.locationRefId != null
      ? (bgsLocationMap.get(play.locationRefId)?.name ?? null)
      : null;

    // Duration
    const duration = play.duration ?? play.durationMin ?? null;

    try {
      // Insert play
      const { data: newPlay, error: playErr } = await admin
        .from("plays")
        .insert({
          user_id: user.id,
          game_id: gameId,
          played_at: playedAt,
          duration_minutes: duration ?? null,
          location: location ?? null,
          notes: play.notes ?? null,
          cooperative: play.cooperative ?? false,
        })
        .select("id")
        .single();

      if (playErr || !newPlay) {
        errors++;
        continue;
      }

      // Insert play_players
      const playerScores = play.playerScores ?? [];
      if (playerScores.length > 0) {
        const playerRows = playerScores.map((ps, idx) => {
          const bgsPlayer = bgsPlayerMap.get(ps.playerRefId);
          const displayName = bgsPlayer?.name ?? `Spieler ${idx + 1}`;
          return {
            play_id: newPlay.id,
            user_id: null as string | null,
            display_name: displayName,
            score: ps.score ?? null,
            winner: ps.winner ?? false,
            seat_order: idx + 1,
          };
        });

        await admin.from("play_players").insert(playerRows);
      }

      existingSet.add(dupKey); // prevent duplicate within same chunk
      imported++;
      const gameName = gameNameCache.get(play.gameRefId);
      if (gameName && !importedGameNames.includes(gameName)) {
        importedGameNames.push(gameName);
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    imported,
    skipped_duplicates: skippedDuplicates,
    skipped_no_game: skippedNoGame,
    errors,
    game_names: importedGameNames.slice(0, 20),
    // Pagination info for the client loop
    total: bgsPlays.length,
    next_offset: nextOffset,
    done,
  });
}
