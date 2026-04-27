import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// ── BGG Catalog bulk-import ────────────────────────────────────────────────────
//
// GET  /api/games/bgg-catalog        → returns { count } (games currently in DB)
// POST /api/games/bgg-catalog        → imports a batch of popular games from BGG
//
// Strategy: search BGG's geekdo autocomplete for a batch of popular game
// search terms. The geekdo endpoint works from Vercel (not blocked like XML API).
// Results are upserted into the `games` table for instant local search.
//
// Each POST call processes one "term batch" (~15 games). Call repeatedly until
// the button text says "Fertig" (all terms processed) or the user stops.

const SEARCH_TERMS = [
  // Popular standalone titles
  "Catan", "Carcassonne", "Dominion", "Ticket to Ride", "Pandemic",
  "Terraforming Mars", "Gloomhaven", "Wingspan", "Azul", "Scythe",
  "Arkham Horror", "Twilight Imperium", "Root", "Viticulture", "Everdell",
  "Spirit Island", "Brass", "Food Chain Magnate", "Agricola", "Puerto Rico",
  "Power Grid", "Splendor", "7 Wonders", "Codenames", "Dixit",
  "Hanabi", "Love Letter", "Sushi Go", "Coup", "Skull",
  "Cascadia", "Lost Ruins of Arnak", "Dune Imperium", "Oath", "Pax Pamir",
  "Nemesis", "Betrayal", "Dead of Winter", "Eldritch Horror", "Robinson Crusoe",
  "The Crew", "Mysterium", "Mansions of Madness", "Imperial Assault", "Star Wars",
  "Clank", "Underwater Cities", "Teotihuacan", "Lorenzo il Magnifico", "Concordia",
  "Mexica", "Tzolkin", "Caverna", "Le Havre", "Ora et Labora",
  "Hansa Teutonica", "Maharaja", "Navegador", "Lisboa", "Vinhos",
  "Great Western Trail", "On Mars", "Maracaibo", "Lacerda", "Kanban",
  "Blood Rage", "Rising Sun", "Kemet", "War of the Ring", "Twilight Struggle",
  "Patchwork", "Sagrada", "Century", "Architects", "Champions of Midgard",
  "Feast for Odin", "Nusfjord", "Hallertau", "Peel", "Boonlake",
  "Earth", "Ark Nova", "Flamecraft", "Paleo", "Lost Expedition",
  "Marvel Champions", "Arkham LCG", "Lord of the Rings", "A Game of Thrones",
  "Elves", "Dwarves", "Orcs", "Dragons", "Wizard",
  "Sheriff of Nottingham", "Werewolf", "The Resistance", "Secret Hitler", "Avalon",
  "Cockroach Poker", "No Thanks", "Coloretto", "For Sale", "Incan Gold",
];

interface GeekdoItem {
  objectid?: unknown;
  id?: unknown;
  name?: unknown;
  thumbnailhref?: unknown;
  yearpublished?: unknown;
}

async function fetchGeekdoBatch(term: string): Promise<{
  bgg_id: number; name: string; thumbnail_url: string | null; year: number | null;
}[]> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekdo?search=${encodeURIComponent(term)}&objecttype=boardgame&nosession=1&showcount=10`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Referer": "https://boardgamegeek.com/",
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as { items?: GeekdoItem[]; results?: GeekdoItem[] };
    const items = (data?.items ?? data?.results ?? []) as GeekdoItem[];
    return items
      .map((item) => ({
        bgg_id: Number(item.objectid ?? item.id ?? 0),
        name: String(item.name ?? ""),
        thumbnail_url: item.thumbnailhref ? `https:${String(item.thumbnailhref)}` : null,
        year: item.yearpublished ? Number(item.yearpublished) : null,
      }))
      .filter((r) => r.bgg_id > 0 && r.name.length > 0);
  } catch {
    return [];
  }
}

// GET: how many games are currently in the catalog
export async function GET() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { count } = await admin.from("games").select("*", { count: "exact", head: true });
  return NextResponse.json({ count: count ?? 0, total_terms: SEARCH_TERMS.length });
}

// POST: import one batch (one term) and return progress
export async function POST(req: NextRequest) {
  // Auth check
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { term_index?: number };
  const termIndex = typeof body.term_index === "number" ? body.term_index : 0;

  if (termIndex >= SEARCH_TERMS.length) {
    return NextResponse.json({ done: true, term_index: termIndex, imported: 0 });
  }

  const term = SEARCH_TERMS[termIndex];
  const games = await fetchGeekdoBatch(term);

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let imported = 0;
  if (games.length > 0) {
    const { error } = await admin
      .from("games")
      .upsert(
        games.map((g) => ({
          bgg_id: g.bgg_id,
          name: g.name,
          thumbnail_url: g.thumbnail_url,
          year: g.year,
        })),
        { onConflict: "bgg_id", ignoreDuplicates: true }
      );
    if (!error) imported = games.length;
  }

  const nextIndex = termIndex + 1;
  return NextResponse.json({
    done: nextIndex >= SEARCH_TERMS.length,
    term_index: nextIndex,
    term,
    imported,
    progress: Math.round((nextIndex / SEARCH_TERMS.length) * 100),
  });
}
