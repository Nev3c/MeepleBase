import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PlayImportClient } from "./play-import-client";

interface Props {
  searchParams: { from?: string };
}

export default async function PlayImportPage({ searchParams }: Props) {
  const playId = searchParams.from;
  if (!playId) redirect("/plays");

  const supabase = createClient();
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the shared play via admin
  const { data: play, error } = await admin
    .from("plays")
    .select(`
      id, user_id, game_id, played_at, location, duration_minutes, cooperative,
      game:games(id, name, thumbnail_url),
      players:play_players(display_name, score, winner)
    `)
    .eq("id", playId)
    .single();

  if (error || !play) redirect("/plays");

  type RawGame = { id: string; name: string; thumbnail_url: string | null } | null;
  type RawPlayer = { display_name: string; score: number | null; winner: boolean };

  const game = (Array.isArray(play.game) ? play.game[0] : play.game) as RawGame;
  const players = (play.players as unknown as RawPlayer[]) ?? [];

  // Duplicate check
  const playedAtDay = play.played_at.slice(0, 10);
  const { count: existingCount } = await supabase
    .from("plays")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)
    .eq("game_id", play.game_id)
    .gte("played_at", `${playedAtDay}T00:00:00`)
    .lte("played_at", `${playedAtDay}T23:59:59`);

  return (
    <PlayImportClient
      playId={playId}
      game={game}
      playedAt={play.played_at}
      location={play.location ?? null}
      durationMinutes={play.duration_minutes ?? null}
      cooperative={play.cooperative ?? false}
      players={players}
      alreadyImported={(existingCount ?? 0) > 0}
      isOwnPlay={play.user_id === user.id}
    />
  );
}
