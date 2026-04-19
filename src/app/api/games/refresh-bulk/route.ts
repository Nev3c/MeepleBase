import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { fetchGeekItem } from "@/lib/bgg-utils";

// GET  /api/games/refresh-bulk  → { pending: number }
//   Count of games in user's library where best_players IS NULL
//
// POST /api/games/refresh-bulk  → { refreshed, errors, names, remaining, done }
//   Refresh next batch of 5 games (500ms delay between BGG calls)

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthUser() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );
  return supabase.auth.getUser();
}

/** Get all game IDs from a user's library */
async function getUserGameIds(admin: ReturnType<typeof serviceClient>, userId: string) {
  const { data } = await admin
    .from("user_games")
    .select("game_id")
    .eq("user_id", userId);
  return (data ?? []).map((r: { game_id: string }) => r.game_id);
}

/** Count games with best_players = NULL (not yet fetched from BGG) */
async function countPending(admin: ReturnType<typeof serviceClient>, gameIds: string[]) {
  if (gameIds.length === 0) return 0;
  const { count } = await admin
    .from("games")
    .select("id", { count: "exact", head: true })
    .in("id", gameIds)
    .is("best_players", null);
  return count ?? 0;
}

export async function GET() {
  const { data: { user } } = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = serviceClient();
  const gameIds = await getUserGameIds(admin, user.id);
  const pending = await countPending(admin, gameIds);

  return NextResponse.json({ pending });
}

export async function POST() {
  const { data: { user } } = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = serviceClient();
  const gameIds = await getUserGameIds(admin, user.id);

  if (gameIds.length === 0) {
    return NextResponse.json({ refreshed: 0, errors: 0, names: [], remaining: 0, done: true });
  }

  // Fetch next 5 games that still need best_players (NULL = not yet processed)
  const { data: games, error } = await admin
    .from("games")
    .select("id, bgg_id, name, best_players")
    .in("id", gameIds)
    .is("best_players", null)
    .order("name")
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!games || games.length === 0) {
    return NextResponse.json({ refreshed: 0, errors: 0, names: [], remaining: 0, done: true });
  }

  let refreshed = 0;
  let errors = 0;
  const names: string[] = [];

  for (const g of games as { id: string; bgg_id: number; name: string; best_players: number[] | null }[]) {
    if (!g?.bgg_id) { errors++; continue; }

    const bggData = await fetchGeekItem(Number(g.bgg_id));

    if (!bggData) {
      errors++;
    } else {
      const updates: Record<string, unknown> = {};
      if (bggData.complexity !== null) updates.complexity = bggData.complexity;
      if (bggData.publishers.length > 0) updates.publishers = bggData.publishers;
      // Store whatever we got — null means "no poll data on BGG", [] is an empty array sentinel
      // We store the actual array (or empty []) to mark it as "processed"
      // Games with null will be re-tried on next bulk refresh
      updates.best_players = bggData.best_players ?? [];

      const { error: upErr } = await admin
        .from("games")
        .update(updates)
        .eq("id", g.id);

      if (upErr) {
        errors++;
      } else {
        refreshed++;
        names.push(g.name);
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  // Count remaining (NULL only — [] means processed/no data)
  const remaining = await countPending(admin, gameIds);

  return NextResponse.json({
    refreshed,
    errors,
    names,
    remaining,
    done: remaining === 0,
  });
}
