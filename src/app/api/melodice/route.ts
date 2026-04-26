import { NextResponse } from "next/server";

// ── Melodice Lookup ────────────────────────────────────────────────────────────
// Melodice.org hat eine community-kuratierte DB von Brettspielen → YouTube-
// Playlisten. Wir versuchen mehrere Ansätze um die Playlist-ID zu bekommen:
//
// 1. Ihre interne JSON-API (/api/boardgames/?search=...)
// 2. HTML-Scraping der Spielseite (/playlist/{slug}/)
// 3. __NEXT_DATA__ JSON Parsing

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json,text/html,*/*;q=0.9",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

// ── YouTube Playlist-ID aus HTML/JSON extrahieren ─────────────────────────────
// YouTube PL-IDs: PL + 32 Zeichen alphanumerisch (manchmal kürzer, min 16)
function findPlaylistId(text: string): string | null {
  // Spezifisch: PL-Prefix (echte Nutzer-Playlisten)
  const patterns = [
    // In URLs als list= Parameter
    /[?&]list=(PL[A-Za-z0-9_-]{16,})/g,
    // Als JSON-Property
    /"(?:playlistId|playlist_id|youtubePlaylistId|youtube_playlist_id)"\s*:\s*"(PL[A-Za-z0-9_-]{16,})"/g,
    // Embed-URLs
    /embed\/videoseries\?list=(PL[A-Za-z0-9_-]{16,})/g,
    // YouTube-Playlist-Link generisch
    /youtube\.com\/playlist\?list=(PL[A-Za-z0-9_-]{16,})/g,
  ];

  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m) return m[1];
  }
  return null;
}

// ── Ansatz 1: Melodice JSON-API ───────────────────────────────────────────────
// Melodice scheint eine interne Django/DRF oder Next.js API zu haben.
// Typische Muster: /api/boardgames/?search=... oder /api/playlist/{slug}/
interface MelodiceApiGame {
  slug?: string;
  name?: string;
  youtube_playlist_id?: string;
  playlistId?: string;
  playlist_id?: string;
}

async function tryApi(q: string): Promise<string | null> {
  const endpoints = [
    `https://melodice.org/api/boardgames/?search=${encodeURIComponent(q)}&format=json`,
    `https://melodice.org/api/boardgames/?q=${encodeURIComponent(q)}&format=json`,
    `https://melodice.org/api/playlists/?search=${encodeURIComponent(q)}&format=json`,
    `https://melodice.org/api/games/?search=${encodeURIComponent(q)}&format=json`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) continue;
      const text = await res.text();
      const id = findPlaylistId(text);
      if (id) return id;
    } catch { /* ignore */ }
  }
  return null;
}

// ── Ansatz 2: HTML-Seite scrapen ──────────────────────────────────────────────
async function tryHtml(slug: string): Promise<{ playlistId: string | null; html: string | null; status: number }> {
  const url = `https://melodice.org/playlist/${slug}/`;
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) return { playlistId: null, html: null, status: res.status };

    const html = await res.text();
    const id = findPlaylistId(html);
    return { playlistId: id, html: html.slice(0, 5000), status: res.status };
  } catch {
    return { playlistId: null, html: null, status: 0 };
  }
}

// ── Ansatz 3: __NEXT_DATA__ tiefer parsen ─────────────────────────────────────
function parseNextData(html: string): string | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const json = JSON.parse(match[1]) as unknown;
    const str = JSON.stringify(json);
    return findPlaylistId(str);
  } catch { return null; }
}

// ── Slug-Varianten ────────────────────────────────────────────────────────────
function slugVariants(q: string): string[] {
  const base = toSlug(q);
  const variants = new Set<string>([base]);

  // Artikel entfernen
  variants.add(base.replace(/^(the|a|an|der|die|das|ein|eine)-/, ""));

  // Mit "the-" Prefix wenn nicht schon da
  if (!base.startsWith("the-")) variants.add(`the-${base}`);

  // Doppel-Bindestrich → einfach
  variants.add(base.replace(/--+/g, "-"));

  return Array.from(variants).filter(Boolean);
}

// ── Metadaten aus HTML lesen ──────────────────────────────────────────────────
function extractMeta(html: string, fallback: string) {
  const og = html.match(/property="og:title"\s+content="([^"]+)"/i)
    ?? html.match(/content="([^"]+)"\s+property="og:title"/i);
  if (og) return og[1].replace(/\s*[-|–|·].*$/, "").trim();
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (t) return t[1].replace(/\s*[-|–|·].*$/, "").trim();
  return fallback;
}

function extractTrackCount(html: string): number | null {
  const m = html.match(/(\d+)\s+(?:songs?|tracks?|Titel)/i);
  return m ? parseInt(m[1]) : null;
}

// ── Haupt-Handler ─────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const debug = searchParams.get("debug") === "1";

  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  // ── Ansatz 1: JSON-API ──────────────────────────────────────────────────────
  const apiId = await tryApi(q);
  if (apiId) {
    return NextResponse.json({
      found: true,
      playlistId: apiId,
      gameTitle: q,
      source: "api",
    });
  }

  // ── Ansatz 2 & 3: HTML-Scraping mit Slug-Varianten ─────────────────────────
  const slugs = slugVariants(q);
  const debugInfo: Record<string, { status: number; hasHtml: boolean; foundId: string | null }> = {};

  for (const slug of slugs) {
    const { playlistId, html, status } = await tryHtml(slug);

    if (debug) {
      debugInfo[slug] = { status, hasHtml: !!html, foundId: playlistId };
    }

    if (playlistId) {
      const meta = html ? extractMeta(html, q) : q;
      const count = html ? extractTrackCount(html) : null;
      return NextResponse.json({
        found: true,
        playlistId,
        gameTitle: meta,
        trackCount: count,
        sourceUrl: `https://melodice.org/playlist/${slug}/`,
        source: "html",
        ...(debug ? { debugInfo } : {}),
      });
    }

    // __NEXT_DATA__ separat versuchen falls findPlaylistId nichts fand
    if (html) {
      const ndId = parseNextData(html);
      if (ndId) {
        return NextResponse.json({
          found: true,
          playlistId: ndId,
          gameTitle: extractMeta(html, q),
          trackCount: extractTrackCount(html),
          sourceUrl: `https://melodice.org/playlist/${slug}/`,
          source: "nextdata",
          ...(debug ? { debugInfo } : {}),
        });
      }
    }
  }

  return NextResponse.json({
    found: false,
    ...(debug ? { triedSlugs: slugs, debugInfo } : {}),
  });
}
