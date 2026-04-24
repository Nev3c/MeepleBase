import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, libraryResult, playsResult, tagsResult, friendsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_games").select("id, price_paid", { count: "exact" }).eq("user_id", user.id).eq("status", "owned"),
    supabase.from("plays").select("id", { count: "exact" }).eq("user_id", user.id),
    supabase.from("user_games").select("game:games(categories, mechanics)").eq("user_id", user.id),
    supabase.from("friendships").select("id", { count: "exact" })
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted"),
  ]);

  // Compute unique category/mechanic counts across the whole library
  const uniqueCats = new Set<string>();
  const uniqueMechs = new Set<string>();
  type GameTags = { categories: string[] | null; mechanics: string[] | null } | null;
  for (const row of (tagsResult.data ?? [])) {
    const raw = row.game as unknown;
    const g: GameTags = Array.isArray(raw) ? (raw[0] ?? null) : (raw as GameTags);
    for (const c of g?.categories ?? []) uniqueCats.add(c);
    for (const m of g?.mechanics ?? []) uniqueMechs.add(m);
  }

  const libraryValue = (libraryResult.data ?? []).reduce((sum, ug) => {
    return sum + (typeof ug.price_paid === "number" ? ug.price_paid : 0);
  }, 0);

  const isAdmin =
    !!process.env.ADMIN_EMAIL &&
    user.email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

  return (
    <ProfileClient
      user={user}
      profile={profileResult.data}
      gameCount={libraryResult.count ?? 0}
      playCount={playsResult.count ?? 0}
      friendCount={friendsResult.count ?? 0}
      libraryValue={libraryValue > 0 ? libraryValue : null}
      uniqueCategoryCount={uniqueCats.size}
      uniqueMechanicCount={uniqueMechs.size}
      isAdmin={isAdmin}
    />
  );
}
