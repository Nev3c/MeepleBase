import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/playlist/[id] — move entry up or down (swap ranks)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { direction: "up" | "down" };
  const { direction } = body;

  // Get the current entry
  const { data: entry } = await supabase
    .from("game_playlist")
    .select("id, rank")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!entry) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const targetRank = direction === "up" ? entry.rank - 1 : entry.rank + 1;
  if (targetRank < 1 || targetRank > 10) {
    return NextResponse.json({ error: "Bereits am Rand" }, { status: 400 });
  }

  // Find the neighbor at targetRank
  const { data: neighbor } = await supabase
    .from("game_playlist")
    .select("id, rank")
    .eq("user_id", user.id)
    .eq("rank", targetRank)
    .maybeSingle();

  if (!neighbor) return NextResponse.json({ error: "Kein Nachbar vorhanden" }, { status: 400 });

  // Swap: no unique constraint on rank, so we can update both freely
  await supabase.from("game_playlist").update({ rank: targetRank }).eq("id", entry.id);
  await supabase.from("game_playlist").update({ rank: entry.rank }).eq("id", neighbor.id);

  return NextResponse.json({ ok: true });
}

// DELETE /api/playlist/[id] — remove entry and renumber remaining
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // Get the rank of the entry being deleted
  const { data: entry } = await supabase
    .from("game_playlist")
    .select("id, rank")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!entry) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Delete the entry
  await supabase.from("game_playlist").delete().eq("id", params.id);

  // Renumber all entries with higher rank (close the gap)
  const { data: higher } = await supabase
    .from("game_playlist")
    .select("id, rank")
    .eq("user_id", user.id)
    .gt("rank", entry.rank)
    .order("rank", { ascending: true });

  for (const item of higher ?? []) {
    await supabase.from("game_playlist").update({ rank: item.rank - 1 }).eq("id", item.id);
  }

  return NextResponse.json({ ok: true });
}
