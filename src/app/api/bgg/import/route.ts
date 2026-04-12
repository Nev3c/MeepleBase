import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const BGG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/xml, text/xml, */*",
  "Referer": "https://boardgamegeek.com/",
};
const GEEKITEMS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://boardgamegeek.com/",
};

interface LinkItem { name: string }

async function fetchGameDetails(bggId: number) {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(8000), cache: "no-store", headers: GEEKITEMS_HEADERS }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.item;
    if (!item) return null;
    const links = item.links ?? {};
    const names = (arr: LinkItem[] | undefined) => (arr ?? []).map((l) => l.name).filter(Boolean);
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

  // ── 1. BGG-Sammlung laden ─────────────────────────────────────────────────
  let collectionItems: Record<string, unknown>[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(profile.bgg_username)}&own=1&stats=1&excludesubtype=boardgameexpansion`,
      { signal: AbortSignal.timeout(12000), cache: "no-store", headers: BGG_HEADERS }
    );

    if (res.status === 202) {
      // BGG queued die Anfrage – kurz warten
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (!res.ok) {
      return NextResponse.json({ error: `BGG nicht erreichbar (HTTP ${res.status})` }, { status: 502 });
    }

    const xml = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: (name) => name === "item",
    });
    const data = parser.parse(xml);

    if (data?.errors?.error) {
      const msg = data.errors.error?.message ?? "BGG-Fehler";
      return NextResponse.json({ error: `BGG: ${msg}` }, { status: 400 });
    }

    const raw = data?.items?.item;
    collectionItems = Array.isArray(raw) ? raw : raw ? [raw] : [];
    break;
  }

  if (collectionItems.length === 0) {
    return NextResponse.json({ imported: 0 });
  }

  // ── 2. Spiele verarbeiten ─────────────────────────────────────────────────
  let imported = 0;

  // In Batches von 5 verarbeiten um BGG nicht zu überlasten
  const BATCH = 5;
  for (let i = 0; i < collectionItems.length; i += BATCH) {
    const batch = collectionItems.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (item) => {
        const bggId = Number(item["@_objectid"]);
        if (!bggId) return;

        // Status aus der Collection bestimmen
        const statusAttr = item.status as Record<string, string> | undefined;
        let status: string = "owned";
        if (statusAttr?.["@_prevowned"] === "1") status = "previously_owned";
        else if (statusAttr?.["@_fortrade"] === "1") status = "for_trade";
        else if (statusAttr?.["@_wanttoplay"] === "1") status = "want_to_play";
        else if (statusAttr?.["@_wishlist"] === "1") status = "wishlist";

        // Basis-Daten aus Collection-XML
        const collName = typeof item.name === "object"
          ? (item.name as Record<string, unknown>)["#text"] ?? (item.name as Record<string, unknown>)["@_sortindex"]
          : item.name;

        let gameData: Record<string, unknown> = {
          bgg_id: bggId,
          name: String(collName ?? `BGG #${bggId}`),
          year_published: item.yearpublished ? Number(item.yearpublished) : null,
          last_synced_at: new Date().toISOString(),
        };

        // Detailliertere Daten via geekitems laden
        const details = await fetchGameDetails(bggId);
        if (details) {
          gameData = { ...gameData, ...details, bgg_id: bggId, last_synced_at: new Date().toISOString() };
        }

        // Spiel upserten
        const { data: game, error: gameErr } = await supabase
          .from("games")
          .upsert(gameData, { onConflict: "bgg_id" })
          .select("id")
          .single();

        if (gameErr || !game) return;

        // user_games – bei Konflikt (bereits vorhanden) ignorieren
        const { error: ugErr } = await supabase
          .from("user_games")
          .insert({ user_id: user.id, game_id: game.id, status })
          .select("id")
          .single();

        if (!ugErr) imported++;
      })
    );

    // Kurze Pause zwischen Batches
    if (i + BATCH < collectionItems.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return NextResponse.json({ imported, total: collectionItems.length });
}
