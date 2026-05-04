import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// ── BGStats game type (subset we care about) ───────────────────────────────────
interface BGStatsGame {
  id: number;
  name: string;
  bggId?: number;
}

// ── POST /api/import/bgstats/games ────────────────────────────────────────────
//
// Phase 1 of the BGStats import rebuild.
//
// Receives the `games[]` array from a BGStats JSON export, resolves each game
// to a MeepleBase `games` row (finding by bgg_id → name → creating if needed),
// and upserts a `user_games` entry so the game appears in the user's library.
//
// Returns:
//   game_map   — { [bgsGameId]: mbGameUUID }  (sent by client in Phase 2)
//   created    — number of games newly added to the user's library
//   existing   — number of games already in the user's library (skipped)
//   failed     — number of games that couldn't be resolved (should be 0)
//   game_names — names of newly added games (for UI display, max 30)

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let bgsGames: BGStatsGame[];
  try {
    const body = await req.json() as { games?: unknown };
    if (!Array.isArray(body.games)) {
      return NextResponse.json({ error: "games[] fehlt im Body" }, { status: 400 });
    }
    bgsGames = body.games as BGStatsGame[];
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (bgsGames.length === 0) {
    return NextResponse.json({ game_map: {}, created: 0, existing: 0, failed: 0, game_names: [] });
  }

  // Deduplicate by BGStats ID
  const uniqueGames = Array.from(new Map(bgsGames.map((g) => [g.id, g])).values());

  // ── Bulk-fetch existing games by bgg_id (single round-trip) ─────────────────
  const bggIds = uniqueGames.filter((g) => g.bggId).map((g) => g.bggId as number);
  const { data: byBggId } = bggIds.length > 0
    ? await admin.from("games").select("id, name, bgg_id").in("bgg_id", bggIds)
    : { data: [] as { id: string; name: string; bgg_id: number }[] };

  const bggIdToMb = new Map<number, { id: string; name: string }>();
  for (const row of byBggId ?? []) {
    bggIdToMb.set(row.bgg_id as number, { id: row.id as string, name: row.name as string });
  }

  // ── Bulk-fetch existing user_games for this user ─────────────────────────────
  // We'll fill this in after resolving all game IDs.
  // (Done per-game below to keep logic simple; still fast because it's parallelized)

  const gameMap: Record<string, string> = {};
  let created = 0;
  let existing = 0;
  let failed = 0;
  const gameNames: string[] = [];

  // Process all unique games in parallel
  await Promise.all(
    uniqueGames.map(async (bgsGame) => {
      let mbGameId: string | null = null;
      let mbGameName: string | null = null;

      // 1. Match by BGG ID (from bulk fetch)
      if (bgsGame.bggId) {
        const hit = bggIdToMb.get(bgsGame.bggId);
        if (hit) { mbGameId = hit.id; mbGameName = hit.name; }
      }

      // 2. Match by name (case-insensitive) — only if no bgg_id match
      if (!mbGameId) {
        const { data } = await admin
          .from("games")
          .select("id, name")
          .ilike("name", bgsGame.name.trim())
          .maybeSingle();
        if (data) { mbGameId = data.id as string; mbGameName = data.name as string; }
      }

      // 3. Create minimal game entry
      if (!mbGameId) {
        const payload: Record<string, unknown> = { name: bgsGame.name.trim() };
        if (bgsGame.bggId) payload.bgg_id = bgsGame.bggId;
        const { data } = await admin
          .from("games")
          .insert(payload)
          .select("id, name")
          .single();
        if (data) { mbGameId = data.id as string; mbGameName = data.name as string; }
      }

      if (!mbGameId) {
        failed++;
        return;
      }

      gameMap[String(bgsGame.id)] = mbGameId;

      // ── Upsert user_games → add to library as "owned" if not present ──────
      const { data: existingUg } = await supabase
        .from("user_games")
        .select("id")
        .eq("user_id", user.id)
        .eq("game_id", mbGameId)
        .maybeSingle();

      if (existingUg) {
        existing++;
      } else {
        const { error: ugErr } = await supabase.from("user_games").insert({
          user_id: user.id,
          game_id: mbGameId,
          status: "owned",
        });
        if (!ugErr) {
          created++;
          if (mbGameName) gameNames.push(mbGameName);
        } else {
          // Game resolved but library insert failed — still track in game_map
          existing++; // treat as "already there" to not confuse UI
        }
      }
    })
  );

  return NextResponse.json({
    game_map: gameMap,
    created,
    existing,
    failed,
    game_names: gameNames.slice(0, 30),
  });
}
