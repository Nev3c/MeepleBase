import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LibraryClient } from "./library-client";

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

  // Spiele aus der Bibliothek laden (leer am Anfang)
  const { data: userGames } = user
    ? await supabase
        .from("user_games")
        .select("*, game:games(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <LibraryClient
      initialGames={userGames ?? []}
      user={user}
      profile={profile}
    />
  );
}
