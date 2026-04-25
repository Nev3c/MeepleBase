import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LibraryClient } from "./library-client";
import { OnboardingBanner } from "./onboarding-banner";

export const metadata: Metadata = {
  title: "Bibliothek",
  description: "Deine Brettspielsammlung auf einen Blick.",
};

export default async function LibraryPage() {
  const supabase = createClient();

  // User + Profil parallel laden
  const [{ data: { user } }, ] = await Promise.all([
    supabase.auth.getUser(),
  ]);

  const profile = user
    ? (await supabase.from("profiles").select("*").eq("id", user.id).single()).data
    : null;

  // Spiele aus der Bibliothek laden
  const { data: userGames } = user
    ? await supabase
        .from("user_games")
        .select("*, game:games(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Partien-Zählungen pro Spiel
  const { data: playRows } = user
    ? await supabase.from("plays").select("game_id").eq("user_id", user.id)
    : { data: [] };

  const playCountMap: Record<string, number> = {};
  for (const p of (playRows ?? [])) {
    playCountMap[p.game_id] = (playCountMap[p.game_id] ?? 0) + 1;
  }

  return (
    <>
      {user && <OnboardingBanner userCreatedAt={user.created_at} />}
      <LibraryClient
        initialGames={userGames ?? []}
        user={user}
        profile={profile}
        playCounts={playCountMap}
      />
    </>
  );
}
