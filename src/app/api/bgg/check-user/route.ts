import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");

  if (!username || username.trim().length < 2) {
    return NextResponse.json({ exists: false });
  }

  try {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/user?name=${encodeURIComponent(username.trim())}`,
      {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "MeepleBase/1.0" },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ exists: false, error: "BGG nicht erreichbar" });
    }

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const data = parser.parse(xml);

    // BGG gibt id="" zurück wenn der User nicht existiert
    const userId = data?.user?.["@_id"];
    const exists = userId && userId !== "" && userId !== "0";

    return NextResponse.json({ exists: !!exists });
  } catch {
    return NextResponse.json({ exists: false, error: "Timeout oder Netzwerkfehler" });
  }
}
