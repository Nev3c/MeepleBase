// ── Shared BGG helper utilities ───────────────────────────────────────────────
//
// Strategy:
//   1. geekitems API  → publishers, categories, mechanics, designers, basic info
//      (works from Vercel, no polls/stats)
//   2. XML API v2     → weight (averageweight) + best-players poll
//      (might be blocked from Vercel — if 401/403, silently skip)
//
// Both calls run in parallel. Whatever succeeds is merged into the result.

const GEEKITEMS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://boardgamegeek.com/",
};

const XML_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/xml, text/xml, */*",
  "Referer": "https://boardgamegeek.com/",
};

// ── XML helpers ───────────────────────────────────────────────────────────────

function parseXmlAlternateNames(xml: string): string[] {
  const names: string[] = [];
  // Match all <name .../> tags (self-closing)
  const tagRe = /<name\s([^>]*?)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(xml)) !== null) {
    const attrs = m[1];
    if (!/type="alternate"/.test(attrs)) continue;
    const valM = attrs.match(/value="([^"]+)"/);
    if (valM?.[1]) names.push(valM[1]);
  }
  return names;
}

function parseXmlWeight(xml: string): number | null {
  // <averageweight value="2.0560" />  or  <averageweight value="2.056"/>
  const m = xml.match(/averageweight\s+value="([0-9.]+)"/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return isNaN(v) || v === 0 ? null : v;
}

function parseXmlBestPlayers(xml: string): number[] | null {
  // <poll name="suggested_numplayers" ...>
  const pollM = xml.match(/<poll[^>]+name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll>/);
  if (!pollM) return null;

  const pollXml = pollM[1];
  const best: number[] = [];

  // <results numplayers="3"> ... </results>
  const resultsRe = /<results\s+numplayers="(\d+)[+]?">([\s\S]*?)<\/results>/g;
  let m: RegExpExecArray | null;

  while ((m = resultsRe.exec(pollXml)) !== null) {
    const num = parseInt(m[1]);
    if (isNaN(num) || num < 1 || num > 20) continue;
    const block = m[2];

    const get = (label: string) => {
      const rx = new RegExp(`value="${label}"\\s+numvotes="(\\d+)"`, "i");
      return parseInt(block.match(rx)?.[1] ?? "0");
    };

    const bestV = get("Best");
    const recV  = get("Recommended");
    const notV  = get("Not Recommended");
    const total = bestV + recV + notV;

    if (total >= 5 && bestV / total >= 0.25) best.push(num);
  }

  return best.length > 0 ? best.sort((a, b) => a - b) : null;
}

// ── parseBestPlayers (for geekitems polls, kept as fallback) ──────────────────
export function parseBestPlayers(polls: unknown): number[] | null {
  if (!polls) return null;

  let poll: Record<string, unknown> | undefined;

  if (Array.isArray(polls)) {
    poll = (polls as Record<string, unknown>[]).find(
      (p) => String(p.name ?? "").toLowerCase().includes("numplayers")
        || String(p.title ?? "").toLowerCase().includes("numplayers")
    );
  } else if (typeof polls === "object" && polls !== null) {
    const p = polls as Record<string, unknown>;
    if (Array.isArray(p.boardgamepoll)) {
      poll = (p.boardgamepoll as Record<string, unknown>[]).find(
        (x) => String(x.name ?? "").toLowerCase().includes("numplayers")
      );
    } else if (p.suggested_numplayers && typeof p.suggested_numplayers === "object") {
      poll = p.suggested_numplayers as Record<string, unknown>;
    }
  }

  if (!poll) return null;

  const results = poll.results;
  const best: number[] = [];

  if (Array.isArray(results)) {
    for (const entry of results as Record<string, unknown>[]) {
      const num = parseInt(String(entry.numplayers ?? entry.numPlayers ?? ""));
      if (isNaN(num) || num < 1 || num > 20) continue;

      const voteArr: Record<string, unknown>[] = Array.isArray(entry.result)
        ? entry.result as Record<string, unknown>[]
        : Array.isArray(entry.results) ? entry.results as Record<string, unknown>[] : [];

      const find = (label: string) =>
        Number(voteArr.find((v) => String(v.value ?? "").toLowerCase() === label.toLowerCase())?.numvotes ?? 0);

      const bestV = find("Best");
      const recV  = find("Recommended");
      const notV  = find("Not Recommended");
      const total = bestV + recV + notV;

      if (total >= 5 && bestV / total >= 0.25) best.push(num);
    }
  }

  return best.length > 0 ? best.sort((a, b) => a - b) : null;
}

// ── fetchGeekItem ─────────────────────────────────────────────────────────────

export interface GeekItemData {
  complexity: number | null;
  publishers: string[];
  best_players: number[] | null;
  alternate_names: string[];
  source: string; // which API provided weight/best_players
}

export async function fetchGeekItem(bggId: number): Promise<GeekItemData | null> {
  // Run both API calls in parallel
  const [geekResult, xmlResult] = await Promise.allSettled([
    fetchGeekItems(bggId),
    fetchXmlApi(bggId),
  ]);

  const geek = geekResult.status === "fulfilled" ? geekResult.value : null;
  const xml  = xmlResult.status  === "fulfilled" ? xmlResult.value  : null;

  if (!geek && !xml) return null;

  // Prefer XML for weight + best_players (more complete data)
  const complexity   = xml?.complexity   ?? geek?.complexity   ?? null;
  const best_players = xml?.best_players ?? geek?.best_players ?? null;
  const publishers   = geek?.publishers  ?? [];

  // Merge alternate names from both sources, deduplicate
  const xmlNames  = xml?.alternate_names  ?? [];
  const geekNames = geek?.alternate_names ?? [];
  const seen = new Set<string>();
  const alternate_names: string[] = [];
  for (const n of [...xmlNames, ...geekNames]) {
    const key = n.toLowerCase().trim();
    if (key && !seen.has(key)) { seen.add(key); alternate_names.push(n); }
  }

  const source = [
    xml?.complexity   != null ? "xml-weight"      : null,
    xml?.best_players != null ? "xml-best_players": null,
    geek              != null ? "geekitems"        : null,
  ].filter(Boolean).join("+") || "none";

  return { complexity, publishers, best_players, alternate_names, source };
}

// ── geekitems call ────────────────────────────────────────────────────────────

async function fetchGeekItems(bggId: number) {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(10000), cache: "no-store", headers: GEEKITEMS_HEADERS }
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const item = data?.item as Record<string, unknown> | undefined;
    if (!item) return null;

    interface LinkItem { name: string }
    const links = item.links as Record<string, unknown> | undefined;
    const publishers = ((links?.boardgamepublisher as LinkItem[] | undefined) ?? [])
      .map((l) => l.name).filter(Boolean);

    // geekitems rarely has stats — keep as fallback
    const stats = item.stats as Record<string, unknown> | undefined;
    const rawW = stats?.avgweight ?? stats?.averageweight ?? null;
    const complexity = rawW && parseFloat(String(rawW)) > 0 ? parseFloat(String(rawW)) : null;

    const best_players = parseBestPlayers(item.polls);

    // Parse alternate names: item.alternatenames.alternatename can be array or single object
    const altNamesRaw = (item.alternatenames as Record<string, unknown> | undefined)?.alternatename;
    const alternate_names: string[] = [];
    if (Array.isArray(altNamesRaw)) {
      for (const entry of altNamesRaw as Record<string, unknown>[]) {
        const n = String(entry.name ?? "").trim();
        if (n) alternate_names.push(n);
      }
    } else if (altNamesRaw && typeof altNamesRaw === "object") {
      const n = String((altNamesRaw as Record<string, unknown>).name ?? "").trim();
      if (n) alternate_names.push(n);
    }

    return { publishers, complexity, best_players, alternate_names };
  } catch {
    return null;
  }
}

// ── BGG XML API v2 call ───────────────────────────────────────────────────────

async function fetchXmlApi(bggId: number) {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`,
      { signal: AbortSignal.timeout(10000), cache: "no-store", headers: XML_HEADERS }
    );
    // 202 = queued (BGG caching), treat as unavailable
    if (res.status === 401 || res.status === 403 || res.status === 202) return null;
    if (!res.ok) return null;

    const xml = await res.text();
    if (!xml.includes("<items")) return null; // sanity check

    const complexity      = parseXmlWeight(xml);
    const best_players    = parseXmlBestPlayers(xml);
    const alternate_names = parseXmlAlternateNames(xml);

    return { complexity, best_players, alternate_names };
  } catch {
    return null;
  }
}
