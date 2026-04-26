import { NextResponse } from "next/server";

// ── Melodice Lookup ────────────────────────────────────────────────────────────
// Melodice.org hat eine kuratierte, community-gewählte Datenbank von
// Brettspielen → YouTube-Playlisten. Wir holen die Seite server-seitig
// (kein CORS), parsen die Playlist-ID und spielen sie direkt ab.
// Kein API-Key nötig; wir scrapen nur die öffentliche Seite.
//
// URL-Schema: https://melodice.org/playlist/{slug}/
// Slug = lowercase, Leerzeichen → Bindestrich, Sonderzeichen entfernt.

function toSlug(name: string): string {
  return name
    .toLowerCase()
    // Deutsche Umlaute
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    // Apostrophe / Satzzeichen vor der Bereinigung entfernen
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractPlaylistId(html: string): string | null {
  // 1. Next.js __NEXT_DATA__ JSON (am zuverlässigsten)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
      const text = JSON.stringify(json);
      const m = text.match(/list=([A-Za-z0-9_-]{10,})/);
      if (m) return m[1];
      // Alternativ: playlistId direkt im JSON
      const pm = text.match(/"playlistId"\s*:\s*"([A-Za-z0-9_-]{10,})"/);
      if (pm) return pm[1];
    } catch { /* ignore */ }
  }

  // 2. YouTube playlist link im HTML-Body
  const patterns = [
    /youtube\.com\/playlist\?list=([A-Za-z0-9_-]{10,})/,
    /youtube\.com\/watch\?[^"']*list=([A-Za-z0-9_-]{10,})/,
    /youtu\.be\/[^?]+\?[^"']*list=([A-Za-z0-9_-]{10,})/,
    // Embed-Variante
    /youtube\.com\/embed\/videoseries\?list=([A-Za-z0-9_-]{10,})/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }

  return null;
}

function extractTrackCount(html: string): number | null {
  const m = html.match(/(\d+)\s+(?:songs?|tracks?|Titel)/i);
  return m ? parseInt(m[1]) : null;
}

function extractGameTitle(html: string, fallback: string): string {
  // OpenGraph title
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  if (og) return og[1].replace(/\s*[-|–].*$/, "").trim();
  // <title> tag
  const t = html.match(/<title>([^<]+)<\/title>/i);
  if (t) return t[1].replace(/\s*[-|–].*$/, "").trim();
  return fallback;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  const slug = toSlug(q);
  if (!slug) return NextResponse.json({ found: false });

  const url = `https://melodice.org/playlist/${slug}/`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      // Next.js Data Cache: 1 Stunde
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ found: false });
    }

    const html = await res.text();
    const playlistId = extractPlaylistId(html);

    if (!playlistId) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      playlistId,
      gameTitle: extractGameTitle(html, q),
      trackCount: extractTrackCount(html),
      sourceUrl: url,
    });
  } catch (err) {
    console.error("[melodice] fetch error:", err);
    return NextResponse.json({ found: false });
  }
}
