import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PlaysClient } from "./plays-client";
import type { PlannedSession, InviteStatus, PlaySessionStatus, PlaylistEntry } from "@/types";

export const metadata: Metadata = { title: "Partien" };

export default async function PlaysPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Parallel: plays + library games + accepted friendships + planned sessions + playlist ─
  const [playsResult, gamesResult, friendshipsResult, sessionsResult, playlistResult] = await Promise.all([
    supabase
      .from("plays")
      .select("*, game:games(id, name, thumbnail_url, bgg_id), players:play_players(*)")
      .eq("user_id", user.id)
      .eq("incomplete", false)
      .order("played_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_games")
      .select("game:games(id, name, thumbnail_url, bgg_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted"),
    supabase
      .from("play_sessions")
      .select(`
        id, title, session_date, location, notes, status, created_by,
        session_games:play_session_games(game:games(id, name, thumbnail_url)),
        invites:play_session_invites(invited_user_id, status)
      `)
      .in("status", ["planned", "confirmed"])
      .order("session_date", { ascending: true }),
    supabase
      .from("game_playlist")
      .select("*, game:games(id, name, thumbnail_url, min_players, max_players, min_playtime, max_playtime)")
      .eq("user_id", user.id)
      .order("rank", { ascending: true }),
  ]);

  // ── Library games ─────────────────────────────────────────────────────────────
  type LG = { id: string; name: string; thumbnail_url: string | null; bgg_id: number };
  const libraryGames: LG[] = (gamesResult.data ?? []).flatMap((ug) => {
    const g = ug.game as unknown as LG | LG[] | null;
    if (!g) return [];
    return Array.isArray(g) ? g : [g];
  });

  // ── Friend profiles ───────────────────────────────────────────────────────────
  const friendIds = (friendshipsResult.data ?? []).map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );
  const friendProfiles = friendIds.length > 0
    ? (await admin
        .from("profiles")
        .select("id, username, display_name, avatar_url, location")
        .in("id", friendIds)).data ?? []
    : [];

  // ── Planned sessions ─────────────────────────────────────────────────────────
  const rawSessions = sessionsResult.data ?? [];

  // Collect all involved user IDs for profile lookups
  const involvedIds = new Set<string>();
  for (const s of rawSessions) {
    if (s.created_by !== user.id) involvedIds.add(s.created_by);
    for (const inv of (s.invites as { invited_user_id: string }[]) ?? []) {
      involvedIds.add(inv.invited_user_id);
    }
  }
  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
  if (involvedIds.size > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", Array.from(involvedIds));
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
    }
  }

  const plannedSessions: PlannedSession[] = rawSessions.map((s) => {
    const invites = (s.invites as { invited_user_id: string; status: string }[]) ?? [];
    const myInvite = invites.find((i) => i.invited_user_id === user.id);
    type RawSG = { game: { id: string; name: string; thumbnail_url: string | null } };
    const rawGames = (s.session_games as unknown as RawSG[]) ?? [];

    return {
      id: s.id,
      title: s.title ?? null,
      session_date: s.session_date,
      location: s.location ?? null,
      notes: s.notes ?? null,
      status: s.status as PlaySessionStatus,
      created_by: s.created_by,
      is_organizer: s.created_by === user.id,
      my_invite_status: myInvite ? (myInvite.status as InviteStatus) : null,
      games: rawGames.map((sg) => sg.game),
      invitees: invites.map((inv) => {
        const p = profileMap.get(inv.invited_user_id);
        return {
          user_id: inv.invited_user_id,
          username: p?.username ?? "?",
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          status: inv.status as InviteStatus,
        };
      }),
    };
  });

  const initialPlaylist: PlaylistEntry[] = (playlistResult.data ?? []) as unknown as PlaylistEntry[];

  return (
    <Suspense>
      <PlaysClient
        initialPlays={playsResult.data ?? []}
        libraryGames={libraryGames}
        plannedSessions={plannedSessions}
        initialPlaylist={initialPlaylist}
        friends={friendProfiles.map((p) => ({
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          location: p.location,
        }))}
      />
    </Suspense>
  );
}
