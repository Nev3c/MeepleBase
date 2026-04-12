import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// BGG's CSV export endpoint – publicly accessible for public collections,
// different from the XML API (which requires bearer tokens since Oct 2025).
// URL pattern: /geekcollection.php?action=exportcsv&subtype=boardgame&username=X&all=1&exporttype=csv

const BGG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/csv,text/plain,*/*",
  "Referer": "https://boardgamegeek.com/",
  "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
};

interface CsvGame {
  bgg_id: number;
  name: string;
  year_published: number | null;
  status: string;
}

interface GeekItemLink { name: string }

function parseBggCsv(text: string): CsvGame[] {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.toLowerCase().includes("objectid"));
  if (headerIdx === -1) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[headerIdx]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const col = (name: string) => headers.indexOf(name);

  const idIdx = col("objectid");
  const nameIdx = col("objectname");
  const yearIdx = col("yearpublished");
  const ownIdx = col("own");
  const tradeIdx = col("fortrade");
  const wtpIdx = col("wanttoplay");
  const wlIdx = col("wishlist");
  const prevIdx = col("prevowned");

  if (idIdx === -1) return [];

  const results: CsvGame[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseLine(line);
    const bggId = Number(cols[idIdx]);
    if (!bggId) continue;

    const own = cols[ownIdx] === "1";
    const trade = cols[tradeIdx] === "1";
    const wtp = cols[wtpIdx] === "1";
    const wl = cols[wlIdx] === "1";
    const prev = cols[prevIdx] === "1";

    if (!own && !trade && !wtp && !wl && !prev) continue;

    let status = "owned";
    if (prev && !own) status = "previously_owned";
    else if (trade) status = "for_trade";
    else if (wtp && !own) status = "want_to_play";
    else if (wl && !own) status = "wishlist";

    const year = yearIdx >= 0 ? Number(cols[yearIdx]) || null : null;
    results.push({ bgg_id: bggId, name: cols[nameIdx] || `BGG #${bggId}`, year_published: year, status });
  }
  return results;
}

async function enrichGame(bggId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(6000), cache: "no-store", headers: { ...BGG_HEADERS, Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.item;
    if (!item) return null;
    const links = item.links ?? {};
    const names = (arr: GeekItemLink[] | undefined) => (arr ?? []).map((l) => l.name).filter(Boolean);
    return {
      name: item.name ?? `BGG #${bggId}`,
      year_published: item.yearpublished ? Number(item.yearpublished) : null,
      min_players: item.minplayers ? Number(item.minplayers) : null,
      max_players: item.maxplayers ? Number(item.maxplayers) : null,
      min_playtime: item.minplaytime ? Number(item.minplaytime) : null,
      max_playtime: item.maxplaytime ? Number(item.maxplaytime) : null,
      thumbnail_url: item.imageurl ?? null,
      image_url: item.topimageurl ?? null,
      description: item.short_description ?? null,
      categories: names(links.boardgamecategory).length ? names(links.boardgamecategory) : null,
      mechanics: names(links.boardgamemechanic).length ? names(links.boardgamemechanic) : null,
      designers: names(links.boardgamedesigner).length ? names(links.boardgamedesigner) : null,
      publishers: names(links.boardgamepublisher).length ? names(links.boardgamepublisher) : null,
    };
  } catch {
    return null;
  }
}

export async function POST() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("bgg_username")
    .eq("id", user.id)
    .single();

  if (!profile?.bgg_username) {
    return NextResponse.json({ error: "Kein BGG-Benutzername hinterlegt" }, { status: 400 });
  }

  // ── Fetch CSV directly from BGG ───────────────────────────────────────────
  const csvUrl = `https://boardgamegeek.com/geekcollection.php?action=exportcsv&subtype=boardgame&username=${encodeURIComponent(profile.bgg_username)}&all=1&exporttype=csv`;

  let collectionGames: CsvGame[] = [];

  try {
    const res = await fetch(csvUrl, {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
      headers: BGG_HEADERS,
    });

    if (!res.ok) {
      console.error("[import] CSV export HTTP", res.status);
      return NextResponse.json({
        error: `BGG CSV-Export nicht verfügbar (HTTP ${res.status}). Bitte lade die Sammlung manuell als CSV herunter und importiere sie über den CSV-Upload.`,
      }, { status: 502 });
    }

    const csvText = await res.text();

    // Check if we got a real CSV or a Cloudflare HTML challenge page
    if (csvText.trim().startsWith("<!") || csvText.includes("cloudflare")) {
      return NextResponse.json({
        error: "BGG blockiert automatische Abfragen. Bitte lade die Sammlung manuell als CSV herunter.",
        needsManual: true,
      }, { status: 502 });
    }

    collectionGames = parseBggCsv(csvText);
  } catch (e) {
    console.error("[import] CSV fetch error:", e instanceof Error ? e.message : e);
    return NextResponse.json({
      error: "BGG konnte nicht erreicht werden. Bitte lade die Sammlung manuell als CSV herunter.",
      needsManual: true,
    }, { status: 502 });
  }

  if (collectionGames.length === 0) {
    return NextResponse.json({ imported: 0, total: 0 });
  }

  // ── Process games ─────────────────────────────────────────────────────────
  let imported = 0;
  let skipped = 0;
  const BATCH = 5;

  for (let i = 0; i < collectionGames.length; i += BATCH) {
    const batch = collectionGames.slice(i, i + BATCH);

    await Promise.all(batch.map(async (csvGame) => {
      let gameData: Record<string, unknown> = {
        bgg_id: csvGame.bgg_id,
        name: csvGame.name,
        year_published: csvGame.year_published,
        last_synced_at: new Date().toISOString(),
      };

      const details = await enrichGame(csvGame.bgg_id);
      if (details) {
        gameData = { ...gameData, ...details, bgg_id: csvGame.bgg_id, last_synced_at: new Date().toISOString() };
      }

      const { data: game, error: gameErr } = await supabase
        .from("games")
        .upsert(gameData, { onConflict: "bgg_id" })
        .select("id")
        .single();

      if (gameErr || !game) return;

      const { error: ugErr } = await supabase
        .from("user_games")
        .insert({ user_id: user.id, game_id: game.id, status: csvGame.status })
        .select("id")
        .single();

      if (!ugErr) imported++;
      else skipped++;
    }));

    if (i + BATCH < collectionGames.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return NextResponse.json({ imported, skipped, total: collectionGames.length });
}
