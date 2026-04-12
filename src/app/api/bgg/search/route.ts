import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

const BGG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/xml, text/xml, */*",
  "Referer": "https://boardgamegeek.com/",
  "Origin": "https://boardgamegeek.com",
};

interface ParsedItem {
  "@_id"?: string | number;
  "@_type"?: string;
  name?: { "@_value"?: string; "@_type"?: string } | Array<{ "@_value"?: string; "@_type"?: string }>;
  yearpublished?: { "@_value"?: string | number };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const query = q.trim();

  // ── Attempt 1: BGG XML API v2 ───────────────────────────────────────────────
  try {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`,
      { signal: AbortSignal.timeout(12000), cache: "no-store", headers: BGG_HEADERS }
    );

    if (res.ok) {
      const xml = await res.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (name) => name === "item",
      });
      const data = parser.parse(xml);
      const rawItems: ParsedItem[] = data?.items?.item ?? [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      const results = items
        .filter((item) => item["@_type"] === "boardgame")
        .slice(0, 30)
        .map((item) => {
          // name can be a single object or an array (when multiple names)
          const nameField = item.name;
          let name = "";
          if (Array.isArray(nameField)) {
            const primary = nameField.find((n) => n["@_type"] === "primary");
            name = (primary ?? nameField[0])?.["@_value"] ?? "";
          } else {
            name = nameField?.["@_value"] ?? "";
          }
          const year = item.yearpublished?.["@_value"];
          return {
            bgg_id: Number(item["@_id"]),
            name: String(name),
            year_published: year ? Number(year) : null,
            thumbnail_url: null, // search API doesn't return thumbnails; geekitems fetched on select
          };
        })
        .filter((r) => r.bgg_id > 0 && r.name.length > 0);

      return NextResponse.json({ results });
    }

    console.error("[BGG search] xmlapi2 HTTP", res.status);
  } catch (e) {
    console.error("[BGG search] xmlapi2 error:", e instanceof Error ? e.message : e);
  }

  // ── Attempt 2: BGG internal suggest API ────────────────────────────────────
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekdo?search=${encodeURIComponent(query)}&objecttype=boardgame&nosession=1`,
      { signal: AbortSignal.timeout(8000), cache: "no-store", headers: { ...BGG_HEADERS, Accept: "application/json" } }
    );

    if (res.ok) {
      const data = await res.json();
      const items = data?.items ?? data?.results ?? [];
      if (Array.isArray(items) && items.length > 0) {
        const results = items.slice(0, 30).map((item: Record<string, unknown>) => ({
          bgg_id: Number(item.objectid ?? item.id ?? 0),
          name: String(item.name ?? ""),
          year_published: item.yearpublished ? Number(item.yearpublished) : null,
          thumbnail_url: item.thumbnailhref ? `https:${item.thumbnailhref}` : null,
        })).filter((r) => r.bgg_id > 0 && r.name.length > 0);
        return NextResponse.json({ results });
      }
    }

    console.error("[BGG search] geekdo HTTP", res.status);
  } catch (e) {
    console.error("[BGG search] geekdo error:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    results: [],
    error: "BGG-Suche nicht verfügbar",
  });
}
