import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, libraryResult, playsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_games").select("id, price_paid", { count: "exact" }).eq("user_id", user.id).eq("status", "owned"),
    supabase.from("plays").select("game_id, game:games(name, thumbnail_url)").eq("user_id", user.id),
  ]);

  const libraryValue = (libraryResult.data ?? []).reduce((sum, ug) => {
    return sum + (typeof ug.price_paid === "number" ? ug.price_paid : 0);
  }, 0);

  const playMap: Record<string, { count: number; name: string; thumbnail: string | null }> = {};
  for (const p of (playsResult.data ?? [])) {
    const gid = p.game_id;
    const gameRaw = p.game as { name: string; thumbnail_url: string | null } | { name: string; thumbnail_url: string | null }[] | null;
    const g = Array.isArray(gameRaw) ? gameRaw[0] ?? null : gameRaw;
    if (!playMap[gid]) playMap[gid] = { count: 0, name: g?.name ?? "", thumbnail: g?.thumbnail_url ?? null };
    playMap[gid].count++;
  }
  const favoriteGame = Object.values(playMap).sort((a, b) => b.count - a.count)[0] ?? null;

  return (
    <ProfileClient
      user={user}
      profile={profileResult.data}
      gameCount={libraryResult.count ?? 0}
      playCount={playsResult.data?.length ?? 0}
      favoriteGame={favoriteGame ? { name: favoriteGame.name, count: favoriteGame.count, thumbnail: favoriteGame.thumbnail } : null}
      libraryValue={libraryValue > 0 ? libraryValue : null}
    />
  );
}
