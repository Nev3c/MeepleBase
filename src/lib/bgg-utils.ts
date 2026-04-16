// ── Shared BGG helper utilities ───────────────────────────────────────────────

const GEEKITEMS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://boardgamegeek.com/",
};

// ── parseBestPlayers ──────────────────────────────────────────────────────────
// Robust parser for BGG "suggested_numplayers" poll.
// Handles all known geekitems response variants:
//   A) polls = [{name:"suggested_numplayers", results:[{numplayers:"3", result:[{value:"Best",numvotes:250},...]}]}]
//   B) polls = {boardgamepoll:[...same array...]}
//   C) polls = {suggested_numplayers: {results:[...]}}
// numvotes may be string or number; value comparison is case-insensitive.
export function parseBestPlayers(polls: unknown): number[] | null {
  if (!polls) return null;

  // ── Locate the suggested_numplayers poll ─────────────────────────────────
  let poll: Record<string, unknown> | undefined;

  if (Array.isArray(polls)) {
    // Format A: polls is directly an array of poll objects
    poll = (polls as Record<string, unknown>[]).find(
      (p) => String(p.name ?? "").toLowerCase().includes("numplayers")
        || String(p.title ?? "").toLowerCase().includes("numplayers")
    );
  } else if (typeof polls === "object" && polls !== null) {
    const p = polls as Record<string, unknown>;
    if (Array.isArray(p.boardgamepoll)) {
      // Format B: {boardgamepoll: [...]}
      poll = (p.boardgamepoll as Record<string, unknown>[]).find(
        (x) => String(x.name ?? "").toLowerCase().includes("numplayers")
          || String(x.title ?? "").toLowerCase().includes("numplayers")
      );
    } else if (p.suggested_numplayers && typeof p.suggested_numplayers === "object") {
      // Format C: {suggested_numplayers: {results:[...]}}
      poll = p.suggested_numplayers as Record<string, unknown>;
    }
  }

  if (!poll) return null;

  const results = poll.results;
  const best: number[] = [];

  if (Array.isArray(results)) {
    for (const entry of results as Record<string, unknown>[]) {
      // numplayers key varies
      const numRaw = entry.numplayers ?? entry.numPlayers ?? entry.num_players ?? entry.players;
      const num = parseInt(String(numRaw ?? ""));
      if (isNaN(num) || num <= 0 || num > 20) continue;

      // result / results sub-array
      const voteArr: Record<string, unknown>[] = Array.isArray(entry.result)
        ? entry.result as Record<string, unknown>[]
        : Array.isArray(entry.results)
        ? entry.results as Record<string, unknown>[]
        : [];

      const find = (label: string) => {
        const row = voteArr.find((v) => String(v.value ?? "").toLowerCase() === label.toLowerCase());
        return Number(row?.numvotes ?? row?.num_votes ?? 0);
      };

      const bestVotes = find("Best");
      const recVotes  = find("Recommended");
      const notVotes  = find("Not Recommended");
      const total = bestVotes + recVotes + notVotes;

      // Threshold: at least 5 total votes, Best > 25% of all votes
      if (total >= 5 && bestVotes / total >= 0.25) best.push(num);
    }
  }

  return best.length > 0 ? best.sort((a, b) => a - b) : null;
}

// ── fetchGeekItem ─────────────────────────────────────────────────────────────
// Fetches a single game from BGG geekitems API.
// Returns null on failure (network, 4xx, no item).
export interface GeekItemData {
  complexity: number | null;
  publishers: string[];
  best_players: number[] | null;
  // raw polls for debugging
  _polls_debug?: unknown;
}

export async function fetchGeekItem(bggId: number): Promise<GeekItemData | null> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`,
      { signal: AbortSignal.timeout(10000), cache: "no-store", headers: GEEKITEMS_HEADERS }
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const item = data?.item as Record<string, unknown> | undefined;
    if (!item) return null;

    // Complexity
    const stats = item.stats as Record<string, unknown> | undefined;
    const rawWeight = stats?.avgweight ?? stats?.averageweight ?? stats?.average_weight ?? null;
    const complexity = rawWeight && parseFloat(String(rawWeight)) > 0
      ? parseFloat(String(rawWeight))
      : null;

    // Publishers
    interface LinkItem { name: string }
    const links = item.links as Record<string, unknown> | undefined;
    const publishers = ((links?.boardgamepublisher as LinkItem[] | undefined) ?? [])
      .map((l) => l.name)
      .filter(Boolean);

    // Best players
    const best_players = parseBestPlayers(item.polls);

    return { complexity, publishers, best_players, _polls_debug: item.polls };
  } catch {
    return null;
  }
}
