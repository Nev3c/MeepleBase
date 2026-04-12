import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// BGG XML API v2 now requires bearer tokens (since late 2025).
// We use BGG's internal JSON APIs instead (/api/...) which work without auth.

const BGG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://boardgamegeek.com/",
  "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
};

interface GeekItemLink { name: string }

interface CollectionItem {
  collid: number;
  objectid: number;
  objecttype: string;
  objectsubtype: string;
  objectname: string;
  status: {
    own: number;
    prevowned: number;
    fortrade: number;
    want: number;
    wanttoplay: number;
    wanttobuy: number;
    wishlist: number;
    preordered: number;
  };
}

async function fetchGameDetails(bggId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(8000), cache: "no-store", headers: BGG_HEADERS }
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

async function fetchBggCollection(username: string): Promise<{ items: CollectionItem[]; error?: string }> {
  // BGG internal JSON collection API – same domain as geekitems, no bearer token needed
  // Pagination: BGG returns up to 100 items per page
  const allItems: CollectionItem[] = [];
  let page = 1;
  const maxPages = 20; // safety cap (2000 games max)

  while (page <= maxPages) {
    try {
      const url = `https://boardgamegeek.com/api/collections?objecttype=thing&objectsubtype=boardgame&own=1&username=${encodeURIComponent(username)}&page=${page}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
        headers: BGG_HEADERS,
      });

      if (!res.ok) {
        if (page === 1) {
          return {
            items: [],
            error: `BGG hat die Anfrage abgelehnt (HTTP ${res.status}). Bitte stelle sicher, dass dein BGG-Benutzername korrekt ist.`,
          };
        }
        break; // partial result ok
      }

      const data = await res.json();

      // BGG returns { items: [...], total: N } or similar
      const items: CollectionItem[] = data?.items ?? data?.collection ?? [];

      if (!Array.isArray(items) || items.length === 0) break;

      allItems.push(...items);

      // Check if there are more pages
      const total: number = data?.total ?? data?.totalitems ?? 0;
      if (allItems.length >= total || items.length < 100) break;

      page++;
    } catch (e) {
      if (page === 1) {
        return {
          items: [],
          error: `BGG konnte nicht erreicht werden: ${e instanceof Error ? e.message : "Netzwerkfehler"}`,
        };
      }
      break;
    }
  }

  return { items: allItems };
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
  const { items: collectionItems, error: fetchError } = await fetchBggCollection(profile.bgg_username);

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
        const bggId = item.objectid;
        if (!bggId) return;

        // Status bestimmen
        let status = "owned";
        if (item.status.prevowned) status = "previously_owned";
        else if (item.status.fortrade) status = "for_trade";
        else if (item.status.wanttoplay) status = "want_to_play";
        else if (item.status.wishlist) status = "wishlist";

        let gameData: Record<string, unknown> = {
          bgg_id: bggId,
          name: item.objectname ?? `BGG #${bggId}`,
          last_synced_at: new Date().toISOString(),
        };

        // Detaillierte Spieldaten laden
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
