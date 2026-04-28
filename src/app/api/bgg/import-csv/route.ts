import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CsvGame {
  bgg_id: number;
  name: string;
  year_published: number | null;
  status: string;
}

// NOTE: enrichGame() was intentionally removed from the CSV import path.
//
// Previously every game triggered a BGG geekitems fetch (up to 6 s each).
// For collections of 200+ games this reliably exceeded Vercel's function
// timeout, causing the import to abort after ~50 games.
//
// The import now only stores the data that is already present in the CSV
// (bgg_id, name, year, status).  Thumbnails, player counts, complexity and
// other BGG metadata can be fetched afterwards via
//   Settings → "BGG-Daten aktualisieren"
// which uses the same geekitems endpoint but in small, resumable batches.

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  let games: CsvGame[];
  try {
    const body = await request.json();
    games = body.games;
    if (!Array.isArray(games) || games.length === 0) {
      return NextResponse.json({ error: "Keine Spiele in der CSV gefunden." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  // Process in parallel batches of 20 — fast because there is no BGG fetch.
  // 600 games ÷ 20 per batch × ~50 ms per batch ≈ 1.5 s total.
  const BATCH = 20;

  for (let i = 0; i < games.length; i += BATCH) {
    const batch = games.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (csvGame) => {
        if (!csvGame.bgg_id) return;

        // Upsert basic game record (name, year from CSV).
        // Existing records are updated only if the CSV has newer data —
        // onConflict: "bgg_id" handles the merge.
        const { data: game, error: gameErr } = await supabase
          .from("games")
          .upsert(
            {
              bgg_id: csvGame.bgg_id,
              name: csvGame.name,
              year_published: csvGame.year_published,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "bgg_id" }
          )
          .select("id")
          .single();

        if (gameErr || !game) return;

        // Add to the user's library (skipped silently if already present).
        const { error: ugErr } = await supabase
          .from("user_games")
          .insert({ user_id: user.id, game_id: game.id, status: csvGame.status })
          .select("id")
          .single();

        if (!ugErr) imported++;
        else skipped++; // unique-constraint violation = already in library
      })
    );
  }

  return NextResponse.json({ imported, skipped, total: games.length });
}
