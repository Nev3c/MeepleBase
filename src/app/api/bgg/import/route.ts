import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Edge Runtime = Cloudflare IPs (different from standard Vercel/AWS Lambda)
// BGG blocks standard cloud IPs but edge IPs are often not blocked
export const runtime = "edge";

const BGG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/xml, text/xml, */*",
  "Referer": "https://boardgamegeek.com/",
  "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
};

interface LinkItem { name: string }

async function fetchGameDetails(bggId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(8000), cache: "no-store", headers: { ...BGG_HEADERS, Accept: "application/json" } }
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

function parseCollectionXml(xml: string): Record<string, unknown>[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "item",
  });
  const data = parser.parse(xml);
  if (data?.errors?.error) return [];
  const raw = data?.items?.item;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

async function tryFetchCollection(username: string): Promise<{ items: Record<string, unknown>[]; error?: string }> {
  // Attempt list – ordered by likelihood of working from edge/cloud
  const attempts = [
    // 1. BGG XML API v2 – standard endpoint
    async () => {
      const res = await fetch(
        `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&excludesubtype=boardgameexpansion`,
        { signal: AbortSignal.timeout(15000), cache: "no-store", headers: BGG_HEADERS }
      );
      if (res.status === 202) throw new Error("queued");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseCollectionXml(await res.text());
    },
    // 2. BGG XML API v1 – older, sometimes less restricted
    async () => {
      const res = await fetch(
        `https://www.boardgamegeek.com/xmlapi/collection/${encodeURIComponent(username)}?own=1`,
        { signal: AbortSignal.timeout(15000), cache: "no-store", headers: BGG_HEADERS }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseCollectionXml(await res.text());
    },
    // 3. BGG XML API v2 with brief=1 (lighter response, might bypass restrictions)
    async () => {
      const res = await fetch(
        `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&brief=1`,
        { signal: AbortSignal.timeout(15000), cache: "no-store", headers: BGG_HEADERS }
      );
      if (res.status === 202) throw new Error("queued");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseCollectionXml(await res.text());
    },
  ];

  let lastError = "";
  for (const attempt of attempts) {
    // Retry up to 2x for queued (202) responses
    for (let retry = 0; retry < 2; retry++) {
      try {
        const items = await attempt();
        if (items.length > 0 || retry > 0) return { items };
        // empty result on first try might mean still queued – wait and retry
        await new Promise((r) => setTimeout(r, 3000));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "queued") {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        lastError = msg;
        break; // try next attempt
      }
    }
  }

  return {
    items: [],
    error: lastError.includes("401")
      ? `BGG hat den Zugriff verweigert (401). Mögliche Ursachen:\n• Dein BGG-Benutzername "${username}" stimmt nicht überein\n• BGG blockiert automatisierte Abfragen vorübergehend\n\nBitte warte einige Minuten und versuche es nochmal.`
      : `BGG-Sammlung konnte nicht geladen werden (${lastError || "unbekannter Fehler"}). Bitte versuche es später nochmal.`,
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
    return NextResponse.json({ error: "Kein BGG-Benutzername hinterlegt" }, { status: 400 });
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
