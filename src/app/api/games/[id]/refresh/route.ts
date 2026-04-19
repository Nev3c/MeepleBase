import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { fetchGeekItem } from "@/lib/bgg-utils";

// POST /api/games/[id]/refresh
// Re-fetches BGG data (complexity, publishers, best_players) and updates the games table.

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: game, error: gameError } = await admin
    .from("games")
    .select("id, bgg_id")
    .eq("id", params.id)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });
  }
  if (!game.bgg_id) {
    return NextResponse.json({ error: "Kein BGG-ID vorhanden" }, { status: 400 });
  }

  const bggData = await fetchGeekItem(Number(game.bgg_id));
  if (!bggData) {
    return NextResponse.json({ error: "BGG nicht erreichbar oder keine Daten" }, { status: 502 });
  }

  const { complexity, publishers, best_players, alternate_names } = bggData;

  const updates: Record<string, unknown> = {};
  if (complexity !== null) updates.complexity = complexity;
  if (publishers.length > 0) updates.publishers = publishers;
  if (best_players !== null) updates.best_players = best_players;
  if (alternate_names.length > 0) updates.alternate_names = alternate_names;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      success: true,
      updated: [],
      message: "BGG hat keine Daten für dieses Spiel geliefert",
      complexity: null,
      publishers: [],
      best_players: null,
      alternate_names: [],
    });
  }

  const { error: updateError } = await admin
    .from("games")
    .update(updates)
    .eq("id", params.id);

  if (updateError) {
    console.error("[BGG refresh] DB update failed:", updateError);
    return NextResponse.json({ error: `DB-Fehler: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    updated: Object.keys(updates),
    complexity: complexity ?? null,
    publishers,
    best_players: best_players ?? null,
    alternate_names,
  });
}
