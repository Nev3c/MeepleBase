import { NextResponse } from "next/server";

// ── Melodice Lookup ────────────────────────────────────────────────────────────
// Melodice.org ist eine Apache/Django-App (kein Next.js).
// Die Spielseite enthält ein JavaScript-Array `songs` mit:
//   { 'iid': '123', 'eid': 'YouTube-Video-ID', 'title': 'Track-Titel' }
//
// Wichtig: Melodice nutzt KEINE YouTube-Playlist-IDs (PL...).
// Stattdessen: Liste einzelner Video-IDs → wir spielen sie sequenziell per
// YouTube-Embed: /embed/{firstId}?playlist={alle IDs kommagetrennt}&autoplay=1
//
// URL-Muster: https://melodice.org/playlist/{slug}/
// Melodice hängt oft Jahreszahlen an: the-hunger → the-hunger-2021
// Daher müssen wir Redirects folgen (redirect: "follow").

export interface MelodiceTrack {
  videoId: string;
  title: string;
  position: number;
}

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

function slugVariants(q: string): string[] {
  const base = toSlug(q);
  const variants = new Set<string>();
  variants.add(base);
  // Ohne führenden Artikel
  variants.add(base.replace(/^(the|a|an|der|die|das|ein|eine)-/, ""));
  // Mit "the-" Prefix
  if (!base.startsWith("the-")) variants.add(`the-${base}`);
  return Array.from(variants).filter(Boolean);
}

// Parst das `songs = [...]` JavaScript-Array aus dem Melodice-HTML
function parseSongs(html: string): MelodiceTrack[] {
  // Melodice schreibt: songs = [\n    {\n        'iid': '123',\n        'eid': 'xxxx',\n        'title': 'Titel',\n    },...]
  const arrayMatch = html.match(/songs\s*=\s*\[([\s\S]*?)\];/);
  if (!arrayMatch) return [];

  const block = arrayMatch[1];
  const tracks: MelodiceTrack[] = [];

  // Jedes Objekt { ... } einzeln parsen
  const objectRegex = /\{([^}]+)\}/g;
  let objMatch: RegExpExecArray | null;

  while ((objMatch = objectRegex.exec(block)) !== null) {
    const obj = objMatch[1];
    const eidMatch = obj.match(/'eid'\s*:\s*'([A-Za-z0-9_-]{6,20})'/);
    const titleMatch = obj.match(/'title'\s*:\s*'([^']+)'/);
    if (eidMatch && titleMatch) {
      tracks.push({
        videoId: eidMatch[1],
        title: titleMatch[1],
        position: tracks.length,
      });
    }
  }

  return tracks;
}

function extractMeta(html: string, fallback: string): string {
  // OpenGraph title
  const og = html.match(/property="og:title"\s+content="([^"]+)"/i)
    ?? html.match(/content="([^"]+)"\s+property="og:title"/i);
  if (og) return og[1].replace(/\s*[-|–|·|—].*$/, "").trim();
  // <h1>
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return h1[1].trim();
  return fallback;
}

async function fetchPlaylistPage(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`https://melodice.org/playlist/${slug}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow", // Folgt Weiterleitungen wie /the-hunger/ → /the-hunger-2021/
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  const slugs = slugVariants(q);

  for (const slug of slugs) {
    const html = await fetchPlaylistPage(slug);
    if (!html) continue;

    const tracks = parseSongs(html);
    if (tracks.length === 0) continue;

    const gameTitle = extractMeta(html, q);
    const videoIds = tracks.map((t) => t.videoId);
    // YouTube-Embed: erstes Video + Playlist aller IDs für sequenzielles Abspielen
    const embedSrc = `https://www.youtube.com/embed/${videoIds[0]}?playlist=${videoIds.join(",")}&autoplay=1`;

    return NextResponse.json({
      found: true,
      tracks,
      videoIds,
      embedSrc,
      gameTitle,
      sourceUrl: `https://melodice.org/playlist/${slug}/`,
    });
  }

  return NextResponse.json({ found: false });
}
