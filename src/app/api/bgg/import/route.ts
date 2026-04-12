import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// BGG XML API v2 requires bearer tokens since late 2025.
// BGG XML API v1 (/xmlapi/) does NOT require auth tokens yet.
// BGG internal JSON APIs (/api/geekitems) also work without auth.

const BGG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/xml, text/xml, */*",
  "Referer": "https://boardgamegeek.com/",
  "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
};

const GEEK_HEADERS = {
  ...BGG_HEADERS,
  "Accept": "application/json",
};

interface GeekItemLink { name: string }

async function fetchGameDetails(bggId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(8000), cache: "no-store", headers: GEEK_HEADERS }
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

function parseXmlCollection(xml: string, isV2: boolean): Record<string, unknown>[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "item",
  });
  const data = parser.parse(xml);
  if (data?.errors?.error) return [];
  // v1 uses <boardgames><boardgame> or <items><item>
  const raw = isV2 ? data?.items?.item : (data?.items?.item ?? data?.boardgames?.boardgame);
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

async function tryFetchCollection(username: string): Promise<{ items: Record<string, unknown>[]; error?: string }> {
  const encodedUser = encodeURIComponent(username);

  // Attempt 1: BGG XML API v1 – no auth token required
  try {
    const res = await fetch(
      `https://www.boardgamegeek.com/xmlapi/collection/${encodedUser}?own=1`,
      { signal: AbortSignal.timeout(15000), cache: "no-store", headers: BGG_HEADERS }
    );
    if (res.ok) {
      const xml = await res.text();
      const items = parseXmlCollection(xml, false);
      if (items.length > 0) return { items };
    }
    console.log("[import] v1 status:", res.status);
  } catch (e) {
    console.log("[import] v1 error:", e instanceof Error ? e.message : e);
  }

  // Attempt 2: BGG XML API v1 without filters (get all, filter client-side)
  try {
    const res = await fetch(
      `https://www.boardgamegeek.com/xmlapi/collection/${encodedUser}`,
      { signal: AbortSignal.timeout(15000), cache: "no-store", headers: BGG_HEADERS }
    );
    if (res.ok) {
      const xml = await res.text();
      const allItems = parseXmlCollection(xml, false);
      // Filter to only owned games
      const items = allItems.filter((item) => {
        const status = item.status as Record<string, string> | undefined;
        return status?.["@_own"] === "1";
      });
      if (items.length > 0) return { items: allItems }; // return all, status filtering happens later
    }
    console.log("[import] v1 no-filter status:", res.status);
  } catch (e) {
    console.log("[import] v1 no-filter error:", e instanceof Error ? e.message : e);
  }

  // Attempt 3: BGG XML API v2 with 202 retry (might work with different IP)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://boardgamegeek.com/xmlapi2/collection?username=${encodedUser}&own=1&excludesubtype=boardgameexpansion`,
        { signal: AbortSignal.timeout(15000), cache: "no-store", headers: BGG_HEADERS }
      );
      if (res.status === 202) {
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      if (res.ok) {
        const xml = await res.text();
        const items = parseXmlCollection(xml, true);
        if (items.length > 0) return { items };
      }
      console.log("[import] v2 status:", res.status);
      break;
    } catch (e) {
      console.log("[import] v2 error:", e instanceof Error ? e.message : e);
      break;
    }
  }

  return {
    items: [],
    error: `BGG-Sammlung konnte nicht geladen werden. BGG hat die XML API im Oktober 2025 auf Auth-Tokens umgestellt, was Drittanbieter-Apps betrifft. Bitte versuche es in einigen Minuten nochmal – manchmal funktioniert es trotzdem.`,
  };
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
    return NextResponse.json({ error: "Kein BGG-Benutzername hinterlegt. Bitte zuerst in den Einstellungen eintragen." }, { status: 400 });
  }

  // ── 1. BGG-Sammlung laden ─────────────────────────────────────────────────
  const { items: collectionItems, error: fetchError } = await tryFetchCollection(profile.bgg_username);

  if (fetchError) {
    return NextResponse.json({ error: fetchError }, { status: 502 });
  }

  if (collectionItems.length === 0) {
    return NextResponse.json({ imported: 0, total: 0 });
  }

  // ── 2. Spiele verarbeiten ─────────────────────────────────────────────────
  let imported = 0;
  const BATCH = 5;

  for (let i = 0; i < collectionItems.length; i += BATCH) {
    const batch = collectionItems.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (item) => {
        const bggId = Number(item["@_objectid"]);
        if (!bggId) return;

        // Status bestimmen
        const statusAttr = item.status as Record<string, string> | undefined;
        let status = "owned";
        if (statusAttr?.["@_prevowned"] === "1") status = "previously_owned";
        else if (statusAttr?.["@_fortrade"] === "1") status = "for_trade";
        else if (statusAttr?.["@_wanttoplay"] === "1") status = "want_to_play";
        else if (statusAttr?.["@_wishlist"] === "1") status = "wishlist";

        const collName = typeof item.name === "object"
          ? (item.name as Record<string, unknown>)["#text"] ?? (item.name as Record<string, unknown>)["@_sortindex"]
          : item.name;

        let gameData: Record<string, unknown> = {
          bgg_id: bggId,
          name: String(collName ?? `BGG #${bggId}`),
          last_synced_at: new Date().toISOString(),
        };

        const details = await fetchGameDetails(bggId);
        if (details) {
          gameData = { ...gameData, ...details, bgg_id: bggId, last_synced_at: new Date().toISOString() };
        }

        const { data: game, error: gameErr } = await supabase
          .from("games")
          .upsert(gameData, { onConflict: "bgg_id" })
          .select("id")
          .single();

        if (gameErr || !game) return;

        const { error: ugErr } = await supabase
          .from("user_games")
          .insert({ user_id: user.id, game_id: game.id, status })
          .select("id")
          .single();

        if (!ugErr) imported++;
      })
    );

    if (i + BATCH < collectionItems.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return NextResponse.json({ imported, total: collectionItems.length });
}
