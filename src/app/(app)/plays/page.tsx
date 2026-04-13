import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlaysClient } from "./plays-client";

export const metadata: Metadata = { title: "Partien" };

export default async function PlaysPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [playsResult, gamesResult] = await Promise.all([
    supabase
      .from("plays")
      .select("*, game:games(id, name, thumbnail_url, bgg_id), players:play_players(*)")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_games")
      .select("game:games(id, name, thumbnail_url, bgg_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const plays = playsResult.data ?? [];
  type LG = { id: string; name: string; thumbnail_url: string | null; bgg_id: number };
  const libraryGames: LG[] = (gamesResult.data ?? []).flatMap((ug) => {
    const g = ug.game as unknown as LG | LG[] | null;
    if (!g) return [];
    return Array.isArray(g) ? g : [g];
  });

  return <PlaysClient initialPlays={plays} libraryGames={libraryGames} />;
}
