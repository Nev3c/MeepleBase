import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function makeClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");

  const { data, error, count } = await supabase
    .from("plays")
    .select("*, game:games(id, name, thumbnail_url, bgg_id), players:play_players(*)", { count: "exact" })
    .eq("user_id", user.id)
    .order("played_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plays: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { game_id, played_at, duration_minutes, location, notes, cooperative, players, image_url, incomplete } = body;

  if (!game_id || !played_at) {
    return NextResponse.json({ error: "game_id und played_at sind erforderlich" }, { status: 400 });
  }

  const { data: play, error: playErr } = await supabase
    .from("plays")
    .insert({
      user_id: user.id,
      game_id,
      played_at,
      duration_minutes: duration_minutes ?? null,
      location: location ?? null,
      notes: notes ?? null,
      cooperative: cooperative ?? false,
      incomplete: incomplete === true,
      image_url: image_url ?? null,
    })
    .select("*, game:games(id, name, thumbnail_url, bgg_id)")
    .single();

  if (playErr || !play) return NextResponse.json({ error: playErr?.message }, { status: 500 });

  // Insert players if provided
  if (Array.isArray(players) && players.length > 0) {
    const rows = players.map((p: { display_name: string; score?: number | null; winner?: boolean; color?: string | null }, i: number) => ({
      play_id: play.id,
      user_id: null,
      display_name: p.display_name,
      score: p.score ?? null,
      winner: p.winner ?? false,
      color: p.color ?? null,
      seat_order: i,
      new_player: false,
    }));
    await supabase.from("play_players").insert(rows);
  }

  const { data: fullPlay } = await supabase
    .from("plays")
    .select("*, game:games(id, name, thumbnail_url, bgg_id), players:play_players(*)")
    .eq("id", play.id)
    .single();
  return NextResponse.json(fullPlay ?? play, { status: 201 });
}
