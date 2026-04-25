import { NextResponse } from "next/server";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { default: { url: string } };
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });
  }

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", `${q} board game soundtrack music`);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "5");
  searchUrl.searchParams.set("relevanceLanguage", "de");
  searchUrl.searchParams.set("key", apiKey);

  const res = await fetch(searchUrl.toString());
  const data = await res.json() as { items?: YouTubeSearchItem[]; error?: { message: string } };

  if (!res.ok) {
    console.error("YouTube API error:", data.error?.message);
    return NextResponse.json({ error: "YouTube API error" }, { status: 502 });
  }

  const results = (data.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.default.url,
  }));

  return NextResponse.json({ results });
}
