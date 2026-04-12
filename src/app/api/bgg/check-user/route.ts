import { NextRequest, NextResponse } from "next/server";

const BGG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*",
  "Referer": "https://boardgamegeek.com/",
};

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");

  if (!username || username.trim().length < 2) {
    return NextResponse.json({ exists: false });
  }

  const trimmed = username.trim();

  // Use BGG profile page – simple HTTP check, no auth needed
  // A 200 means the profile exists, a 404 means it doesn't
  try {
    const res = await fetch(
      `https://boardgamegeek.com/user/${encodeURIComponent(trimmed)}`,
      { signal: AbortSignal.timeout(8000), cache: "no-store", headers: BGG_HEADERS }
    );

    if (res.status === 404) {
      return NextResponse.json({ exists: false });
    }

    if (res.ok) {
      return NextResponse.json({ exists: true });
    }

    // Any other status (401, 503, etc.) = BGG unreachable, not "user doesn't exist"
    return NextResponse.json({ exists: null, unreachable: true });
  } catch {
    return NextResponse.json({ exists: null, unreachable: true });
  }
}
