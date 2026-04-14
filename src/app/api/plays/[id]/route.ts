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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  const { error } = await supabase.from("plays").delete().eq("id", params.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { game_id, played_at, duration_minutes, location, notes, cooperative, players, image_url } = body;

  const updateData: Record<string, unknown> = {};
  if (game_id !== undefined) updateData.game_id = game_id;
  if (played_at !== undefined) updateData.played_at = played_at;
  if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
  if (location !== undefined) updateData.location = location;
  if (notes !== undefined) updateData.notes = notes;
  if (cooperative !== undefined) updateData.cooperative = cooperative;
  if (image_url !== undefined) updateData.image_url = image_url;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase.from("plays").update(updateData).eq("id", params.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(players)) {
    await supabase.from("play_players").delete().eq("play_id", params.id);
    if (players.length > 0) {
      const rows = players.map((p: { display_name: string; score?: number | null; winner?: boolean; color?: string | null }, i: number) => ({
        play_id: params.id,
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
  }

  const { data: fullPlay } = await supabase
    .from("plays")
    .select("*, game:games(id, name, thumbnail_url, bgg_id), players:play_players(*)")
    .eq("id", params.id)
    .single();
  return NextResponse.json(fullPlay);
}
