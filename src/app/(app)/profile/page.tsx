import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, libraryResult, playsResult, friendsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_games").select("id", { count: "exact" }).eq("user_id", user.id).eq("status", "owned"),
    supabase.from("plays").select("id", { count: "exact" }).eq("user_id", user.id),
    supabase.from("friendships").select("id", { count: "exact" })
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted"),
  ]);

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
      isAdmin={isAdmin}
    />
  );
}
