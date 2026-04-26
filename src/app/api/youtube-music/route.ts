import { NextResponse } from "next/server";

interface YouTubeVideoItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { default: { url: string } };
  };
}

interface YouTubePlaylistItem {
  id: { playlistId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { default: { url: string } };
  };
}

interface YouTubePlaylistTrackItem {
  snippet: {
    title: string;
    resourceId: { videoId: string };
    thumbnails: { default?: { url: string }; medium?: { url: string } };
    position: number;
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });
  }

  // ── Playlist items mode ────────────────────────────────────────────────────
  const playlistId = searchParams.get("playlistId")?.trim();
  if (playlistId) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "30");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json() as {
      items?: YouTubePlaylistTrackItem[];
      error?: { message: string };
    };

    if (!res.ok) {
      console.error("YouTube API error (playlistItems):", data.error?.message);
      return NextResponse.json({ error: "YouTube API error" }, { status: 502 });
    }

    const tracks = (data.items ?? []).map((item) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      position: item.snippet.position,
      thumbnail:
        item.snippet.thumbnails.default?.url ??
        item.snippet.thumbnails.medium?.url ??
        "",
    }));

    return NextResponse.json({ tracks });
  }

  // ── Search mode ────────────────────────────────────────────────────────────
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") === "playlist" ? "playlist" : "video";

  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  // Für Videos: Musik-Kategorie erzwingen (verhindert Tutorials, Let's Plays etc.)
  // Für Playlisten: kein category-Filter verfügbar, aber bessere Keywords
  const searchQuery = type === "playlist"
    ? `${q} ambient music tabletop`
    : `${q} ambient music`;

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", searchQuery);
  searchUrl.searchParams.set("type", type);
  searchUrl.searchParams.set("maxResults", "5");
  searchUrl.searchParams.set("key", apiKey);
  // Nur Videos aus der Musik-Kategorie (ID 10) — eliminiert Tutorials & Gameplays
  if (type === "video") {
    searchUrl.searchParams.set("videoCategoryId", "10");
  }

  const res = await fetch(searchUrl.toString());
  const data = await res.json() as {
    items?: (YouTubeVideoItem | YouTubePlaylistItem)[];
    error?: { message: string };
  };

  if (!res.ok) {
    console.error("YouTube API error:", data.error?.message);
    return NextResponse.json({ error: "YouTube API error" }, { status: 502 });
  }

  const results = (data.items ?? []).map((item) => {
    if (type === "playlist") {
      const pl = item as YouTubePlaylistItem;
      return {
        id: pl.id.playlistId,
        title: pl.snippet.title,
        channelTitle: pl.snippet.channelTitle,
        thumbnail: pl.snippet.thumbnails.default.url,
        type: "playlist" as const,
      };
    } else {
      const vid = item as YouTubeVideoItem;
      return {
        id: vid.id.videoId,
        title: vid.snippet.title,
        channelTitle: vid.snippet.channelTitle,
        thumbnail: vid.snippet.thumbnails.default.url,
        type: "video" as const,
      };
    }
  });

  return NextResponse.json({ results });
}
