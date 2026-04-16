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

export async function GET() {
  const { data: { user } } = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = serviceClient();

  // Count games in user's library where best_players IS NULL
  const { count, error } = await admin
    .from("user_games")
    .select("games!inner(id, best_players)", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("games.best_players", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pending: count ?? 0 });
}

export async function POST() {
  const { data: { user } } = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = serviceClient();

  // Fetch next 5 games in user's library that still need best_players
  const { data: userGames, error } = await admin
    .from("user_games")
    .select("games!inner(id, bgg_id, name, best_players)")
    .eq("user_id", user.id)
    .is("games.best_players", null)
    .order("games(name)")
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!userGames || userGames.length === 0) {
    return NextResponse.json({ refreshed: 0, errors: 0, names: [], remaining: 0, done: true });
  }

  let refreshed = 0;
  let errors = 0;
  const names: string[] = [];

  for (const ug of userGames) {
    const g = ug.games as unknown as { id: string; bgg_id: number; name: string; best_players: number[] | null } | null;
    if (!g?.bgg_id) { errors++; continue; }

    const bggData = await fetchGeekItem(Number(g.bgg_id));

    if (!bggData) {
      errors++;
    } else {
      const updates: Record<string, unknown> = {};
      if (bggData.complexity !== null) updates.complexity = bggData.complexity;
      if (bggData.publishers.length > 0) updates.publishers = bggData.publishers;
      // Always set best_players (even empty array → use sentinel [0] to mark "processed")
      // Use null→[] empty array if BGG had no data, so we don't re-process it every time
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

  // Count remaining
  const { count: remaining } = await admin
    .from("user_games")
    .select("games!inner(id, best_players)", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("games.best_players", null);

  return NextResponse.json({
    refreshed,
    errors,
    names,
    remaining: remaining ?? 0,
    done: (remaining ?? 0) === 0,
  });
}
