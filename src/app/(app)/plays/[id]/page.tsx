import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayDetailClient } from "./play-detail-client";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("plays")
    .select("game:games(name), played_at")
    .eq("id", params.id)
    .single();

  if (!data) return { title: "Partie" };
  const game = data.game as unknown as { name: string } | null;
  const date = new Date(data.played_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
  return { title: game?.name ? `${game.name} · ${date}` : `Partie · ${date}` };
}

export default async function PlayDetailPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: play }, { data: gamesData }] = await Promise.all([
    supabase
      .from("plays")
      .select("*, game:games(id, name, thumbnail_url, image_url, bgg_id), players:play_players(*)")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_games")
      .select("game:games(id, name, thumbnail_url, bgg_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!play) notFound();

  type LG = { id: string; name: string; thumbnail_url: string | null; bgg_id: number };
  const libraryGames: LG[] = (gamesData ?? []).flatMap((ug) => {
    const g = ug.game as unknown as LG | LG[] | null;
    if (!g) return [];
    return Array.isArray(g) ? g : [g];
  });

  return <PlayDetailClient play={play} libraryGames={libraryGames} />;
}
