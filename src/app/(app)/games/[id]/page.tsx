import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameDetailClient } from "./game-detail-client";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();
  const { data: game } = await supabase
    .from("games")
    .select("name, year_published")
    .eq("id", params.id)
    .single();

  if (!game) return { title: "Spiel nicht gefunden" };
  return {
    title: game.year_published ? `${game.name} (${game.year_published})` : game.name,
  };
}

export default async function GameDetailPage({ params }: Props) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: game }, { data: userGame }, { data: notes }, { data: images }] = await Promise.all([
    supabase.from("games").select("*").eq("id", params.id).single(),
    supabase.from("user_games").select("*").eq("game_id", params.id).eq("user_id", user.id).single(),
    supabase.from("game_notes").select("*").eq("game_id", params.id).eq("user_id", user.id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    // user_game_images table may not exist yet — handle gracefully
    supabase.from("user_game_images").select("*").eq("game_id", params.id).eq("user_id", user.id)
      .order("sort_order").order("created_at"),
  ]);

  if (!game) notFound();

  return (
    <GameDetailClient
      game={game}
      userGame={userGame}
      initialNotes={notes ?? []}
      initialImages={images ?? []}
    />
  );
}
