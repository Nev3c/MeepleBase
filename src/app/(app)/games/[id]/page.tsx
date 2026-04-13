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

  const [{ data: game }, { data: userGame }] = await Promise.all([
    supabase.from("games").select("*").eq("id", params.id).single(),
    supabase
      .from("user_games")
      .select("*")
      .eq("game_id", params.id)
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!game) notFound();

  return <GameDetailClient game={game} userGame={userGame} />;
}
