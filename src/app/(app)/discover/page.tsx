import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiscoverClient } from "./discover-client";

export const metadata: Metadata = { title: "Entdecken" };

export default async function DiscoverPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: userGames }, { data: plays }] = await Promise.all([
    supabase
      .from("user_games")
      .select("game_id, status, personal_rating, game:games(id, name, thumbnail_url, min_players, max_players, min_playtime, max_playtime, rating_avg, year_published)")
      .eq("user_id", user.id),
    supabase
      .from("plays")
      .select("game_id")
      .eq("user_id", user.id),
  ]);

  // play counts per game
  const playCountMap: Record<string, number> = {};
  for (const p of (plays ?? [])) {
    playCountMap[p.game_id] = (playCountMap[p.game_id] ?? 0) + 1;
  }

  return (
    <DiscoverClient
      userGames={userGames ?? []}
      playCountMap={playCountMap}
    />
  );
}
