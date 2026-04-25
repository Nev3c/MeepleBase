import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  const isAdmin =
    !!process.env.ADMIN_EMAIL &&
    user.email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

  return (
    <ProfileClient
      user={user}
      profile={profileResult.data}
      isAdmin={isAdmin}
    />
  );
}
