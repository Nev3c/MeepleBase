import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Alle Nutzerdaten parallel abrufen
  const [profileRes, userGamesRes, playsRes, notesRes] = await Promise.all([
    admin.from("profiles").select("id, username, display_name, avatar_url, bgg_username, location, library_visibility, created_at").eq("id", user.id).single(),
    admin.from("user_games").select("status, acquired_date, notes, personal_rating, custom_fields, created_at, game:games(bgg_id, name, year, min_players, max_players, min_playtime, max_playtime, complexity, categories, mechanics)").eq("user_id", user.id),
    admin.from("plays").select("played_at, duration_minutes, location, notes, cooperative, incomplete, play_players(display_name, score, winner, seat_order), game:games(name, bgg_id)").eq("user_id", user.id).order("played_at", { ascending: false }),
    admin.from("game_notes").select("title, content_markdown, note_type, is_pinned, created_at, game:games(name, bgg_id)").eq("user_id", user.id),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    app: "MeepleBase",
    version: "1.0",
    profile: profileRes.data,
    library: userGamesRes.data ?? [],
    plays: playsRes.data ?? [],
    notes: notesRes.data ?? [],
  };

  const filename = `meeplebase-export-${new Date().toISOString().split("T")[0]}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
