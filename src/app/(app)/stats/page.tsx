import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { StatsClient } from "./stats-client";
import type { RankingEntry, RankingSet, PlayByMonth, SpendingByMonth } from "./stats-client";

export const metadata: Metadata = { title: "Statistiken" };

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthLabel(date: Date): string {
  return date.toLocaleString("de-DE", { month: "short" });
}

function buildPlaysByMonth(plays: { played_at: string }[], count: number): PlayByMonth[] {
  const now = new Date();
  const result: PlayByMonth[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const n = plays.filter(p => {
      const pd = new Date(p.played_at);
      return pd >= d && pd < next;
    }).length;
    result.push({ label: getMonthLabel(d), month: d.toISOString().slice(0, 7), count: n });
  }
  return result;
}

function buildSpendingByMonth(
  games: { price_paid: number | null; acquired_date: string | null; created_at: string }[],
  count: number
): SpendingByMonth[] {
  const now = new Date();
  const result: SpendingByMonth[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const amount = games
      .filter(g => {
        if (!g.price_paid) return false;
        const dateStr = g.acquired_date ?? g.created_at;
        const gd = new Date(dateStr);
        return gd >= d && gd < next;
      })
      .reduce((sum, g) => sum + (g.price_paid ?? 0), 0);
    result.push({ label: getMonthLabel(d), month: d.toISOString().slice(0, 7), amount });
  }
  return result;
}

interface RawPlay { user_id: string; played_at: string }
interface RawPP { user_id: string; winner: boolean; play: { played_at: string } | { played_at: string }[] | null }
interface RawGame { user_id: string; acquired_date: string | null }

function buildRankingSet(
  allPlays: RawPlay[],
  allPP: RawPP[],
  allGames: RawGame[],
  participants: { id: string; username: string; display_name: string | null; avatar_url: string | null; is_me: boolean }[],
  since: Date
): RankingSet {
  const filteredPlays = allPlays.filter(p => new Date(p.played_at) >= since);
  const filteredPP = allPP.filter(pp => {
    const raw = pp.play;
    const played_at = raw && !Array.isArray(raw) ? raw.played_at : Array.isArray(raw) ? raw[0]?.played_at : null;
    return played_at && new Date(played_at) >= since;
  });
  const filteredGames = allGames.filter(g => g.acquired_date && new Date(g.acquired_date) >= since);

  const entries: RankingEntry[] = participants.map(p => {
    const myPlays = filteredPlays.filter(x => x.user_id === p.id).length;
    const myPP = filteredPP.filter(x => x.user_id === p.id);
    const myWins = myPP.filter(x => x.winner).length;
    const myPurchases = filteredGames.filter(x => x.user_id === p.id).length;
    return {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      is_me: p.is_me,
      plays: myPlays,
      wins: myWins,
      total_with_players: myPP.length,
      purchases: myPurchases,
    };
  });

  const byPlays = [...entries].sort((a, b) => b.plays - a.plays);

  const byWinrate = [...entries]
    .filter(e => e.total_with_players > 0)
    .sort((a, b) => {
      const rateA = a.wins / a.total_with_players;
      const rateB = b.wins / b.total_with_players;
      return rateB - rateA;
    });

  const byPurchases = [...entries].sort((a, b) => b.purchases - a.purchases);

  return { by_plays: byPlays, by_winrate: byWinrate, by_purchases: byPurchases };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function StatsPage() {
  const supabase = createClient();
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const twelveMoAgo = new Date();
  twelveMoAgo.setMonth(twelveMoAgo.getMonth() - 12);

  // ── Parallel personal data + friendships ────────────────────────────────
  const [playsRes, ppRes, gamesRes, friendshipsRes, allPlaysCountRes, tagsRes] = await Promise.all([
    supabase
      .from("plays")
      .select("id, played_at, game_id, game:games(name, thumbnail_url)")
      .eq("user_id", user.id)
      .gte("played_at", twelveMoAgo.toISOString())
      .order("played_at", { ascending: true }),
    supabase
      .from("play_players")
      .select("winner, play:plays(played_at)")
      .eq("user_id", user.id),
    supabase
      .from("user_games")
      .select("price_paid, acquired_date, status, created_at")
      .eq("user_id", user.id),
    supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted"),
    supabase.from("plays").select("id", { count: "exact" }).eq("user_id", user.id),
    supabase.from("user_games").select("game:games(categories, mechanics)").eq("user_id", user.id),
  ]);

  const myPlays = playsRes.data ?? [];
  const myPP = ppRes.data ?? [];
  const myGames = gamesRes.data ?? [];
  const totalPlaysAllTime = allPlaysCountRes.count ?? 0;

  // Unique categories + mechanics across owned library
  const uniqueCats = new Set<string>();
  const uniqueMechs = new Set<string>();
  type GameTags = { categories: string[] | null; mechanics: string[] | null } | null;
  for (const row of (tagsRes.data ?? [])) {
    const raw = row.game as unknown;
    const g: GameTags = Array.isArray(raw) ? (raw[0] ?? null) : (raw as GameTags);
    for (const c of g?.categories ?? []) uniqueCats.add(c);
    for (const m of g?.mechanics ?? []) uniqueMechs.add(m);
  }

  // ── Personal stats ───────────────────────────────────────────────────────
  const playsByMonth = buildPlaysByMonth(myPlays.map(p => ({ played_at: p.played_at })), 6);

  const ppTyped = myPP as unknown as { winner: boolean; play: { played_at: string } | null }[];
  const totalWins = ppTyped.filter(p => p.winner).length;
  const totalWithPlayers = ppTyped.length;

  // Favourite game (last 12 months)
  type GameEntry = { name: string; thumbnail_url: string | null; count: number };
  const gameCounts = new Map<string, GameEntry>();
  for (const play of myPlays) {
    const raw = play.game as unknown as { name: string; thumbnail_url: string | null } | null;
    const gId = play.game_id;
    const existing = gameCounts.get(gId) ?? { name: raw?.name ?? "?", thumbnail_url: raw?.thumbnail_url ?? null, count: 0 };
    gameCounts.set(gId, { ...existing, count: existing.count + 1 });
  }
  const favGame = Array.from(gameCounts.values()).sort((a, b) => b.count - a.count)[0] ?? null;

  // Collection value
  const collectionValue = myGames
    .filter(g => g.status === "owned")
    .reduce((sum, g) => sum + (typeof g.price_paid === "number" ? g.price_paid : 0), 0);

  const hasFinancialData = myGames.some(g => typeof g.price_paid === "number" && g.price_paid > 0);

  const spendingByMonth = buildSpendingByMonth(
    myGames
      .filter(g => g.status === "owned")
      .map(g => ({ price_paid: g.price_paid as number | null, acquired_date: g.acquired_date as string | null, created_at: g.created_at as string })),
    6
  );

  const totalGames = myGames.filter(g => g.status === "owned").length;

  // ── Friend rankings ──────────────────────────────────────────────────────
  const friendIds = (friendshipsRes.data ?? []).map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  const participantIds = [user.id, ...friendIds];
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  type ProfileRow = { id: string; username: string; display_name: string | null; avatar_url: string | null };

  const [profilesRes, allPlaysRes, allPPRes, allGamesRes, myProfileRes] = await Promise.all([
    friendIds.length > 0
      ? admin.from("profiles").select("id, username, display_name, avatar_url").in("id", friendIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    admin
      .from("plays")
      .select("user_id, played_at")
      .in("user_id", participantIds)
      .gte("played_at", twoYearsAgo.toISOString()),
    admin
      .from("play_players")
      .select("user_id, winner, play:plays(played_at)")
      .in("user_id", participantIds),
    admin
      .from("user_games")
      .select("user_id, acquired_date")
      .in("user_id", participantIds)
      .not("acquired_date", "is", null),
    admin.from("profiles").select("id, username, display_name, avatar_url").eq("id", user.id).single(),
  ]);

  const myProfile = (myProfileRes.data as ProfileRow | null) ?? { id: user.id, username: user.email?.split("@")[0] ?? "Ich", display_name: null, avatar_url: null };
  const friendProfiles = (profilesRes.data ?? []) as ProfileRow[];

  const participants = [
    { ...myProfile, is_me: true },
    ...friendProfiles.map(p => ({ ...p, is_me: false })),
  ];

  const allPlays = (allPlaysRes.data ?? []) as RawPlay[];
  const allPP = (allPPRes.data ?? []) as unknown as RawPP[];
  const allGames = (allGamesRes.data ?? []) as RawGame[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const rankingsMonth = buildRankingSet(allPlays, allPP, allGames, participants, monthStart);
  const rankingsYear = buildRankingSet(allPlays, allPP, allGames, participants, yearStart);
  const rankingsAllTime = buildRankingSet(allPlays, allPP, allGames, participants, new Date(0));

  return (
    <StatsClient
      totalGames={totalGames}
      totalPlays={totalPlaysAllTime}
      uniqueCategoryCount={uniqueCats.size}
      uniqueMechanicCount={uniqueMechs.size}
      playsByMonth={playsByMonth}
      totalWins={totalWins}
      totalWithPlayers={totalWithPlayers}
      favGame={favGame}
      collectionValue={collectionValue}
      hasFinancialData={hasFinancialData}
      spendingByMonth={spendingByMonth}
      hasRankings={friendIds.length > 0}
      rankingsMonth={rankingsMonth}
      rankingsYear={rankingsYear}
      rankingsAllTime={rankingsAllTime}
    />
  );
}
