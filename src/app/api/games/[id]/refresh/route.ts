import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// POST /api/games/[id]/refresh
// Re-fetches BGG data for a game and updates complexity, publishers, best_players.

function parseBestPlayers(polls: unknown): number[] | null {
  if (!polls) return null;
  const pollArr: unknown[] = Array.isArray(polls)
    ? polls
    : Array.isArray((polls as Record<string, unknown>)?.boardgamepoll)
    ? (polls as Record<string, unknown>).boardgamepoll as unknown[]
    : [];

  const numPlayersPoll = pollArr.find((p) => {
    const poll = p as Record<string, unknown>;
    return poll.name === "suggested_numplayers" || poll.title?.toString().toLowerCase().includes("numplayers");
  }) as Record<string, unknown> | undefined;

  if (!numPlayersPoll) return null;

  const results = numPlayersPoll.results;
  const best: number[] = [];

  if (Array.isArray(results)) {
    for (const entry of results as Record<string, unknown>[]) {
      const num = parseInt(String(entry.numplayers));
      if (isNaN(num)) continue;
      const votes = Array.isArray(entry.result) ? entry.result as Record<string, unknown>[] : [];
      const bestVotes = Number(votes.find((v) => v.value === "Best")?.numvotes ?? 0);
      const recVotes  = Number(votes.find((v) => v.value === "Recommended")?.numvotes ?? 0);
      const notVotes  = Number(votes.find((v) => v.value === "Not Recommended")?.numvotes ?? 0);
      const total = bestVotes + recVotes + notVotes;
      if (total > 5 && bestVotes / total > 0.25) best.push(num);
    }
  }

  return best.length > 0 ? best.sort((a, b) => a - b) : null;
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // Get the game's bgg_id
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, bgg_id")
    .eq("id", params.id)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });
  }

  if (!game.bgg_id) {
    return NextResponse.json({ error: "Kein BGG-ID vorhanden" }, { status: 400 });
  }

  // Fetch from BGG geekitems
  const bggUrl = `https://boardgamegeek.com/api/geekitems?objectid=${game.bgg_id}&objecttype=thing&subtype=boardgame`;
  let bggData: Record<string, unknown>;
  try {
    const res = await fetch(bggUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://boardgamegeek.com/",
      },
    });
    if (!res.ok) throw new Error(`BGG HTTP ${res.status}`);
    bggData = await res.json() as Record<string, unknown>;
  } catch (e) {
    return NextResponse.json({ error: `BGG-Anfrage fehlgeschlagen: ${e}` }, { status: 502 });
  }

  const item = bggData?.item as Record<string, unknown> | undefined;
  if (!item) {
    return NextResponse.json({ error: "BGG hat kein item zurückgegeben" }, { status: 502 });
  }

  // Extract complexity
  const stats = item.stats as Record<string, unknown> | undefined;
  const rawWeight = stats?.avgweight ?? stats?.averageweight ?? stats?.average_weight ?? null;
  const complexity = rawWeight ? parseFloat(String(rawWeight)) : null;

  // Extract publishers
  interface GeekItemLink { name: string }
  const links = item.links as Record<string, unknown> | undefined;
  const publisherLinks = (links?.boardgamepublisher as GeekItemLink[] | undefined) ?? [];
  const publishers = publisherLinks.map((l) => l.name).filter(Boolean);

  // Extract best players poll
  const best_players = parseBestPlayers(item.polls);

  // Update the games table
  const updates: Record<string, unknown> = {};
  if (complexity !== null) updates.complexity = complexity;
  if (publishers.length > 0) updates.publishers = publishers;
  if (best_players !== null) updates.best_players = best_players;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Keine neuen Daten von BGG" });
  }

  const { error: updateError } = await supabase
    .from("games")
    .update(updates)
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: Object.keys(updates), complexity, publishers, best_players });
}
