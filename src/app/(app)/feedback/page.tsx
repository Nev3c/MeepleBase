import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FeedbackClient } from "./feedback-client";
import type { Metadata } from "next";
import type { Feedback } from "@/types";

export const metadata: Metadata = { title: "Feedback" };

export default async function FeedbackPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdmin = !!adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase();

  return (
    <FeedbackClient
      userId={user.id}
      initialFeedback={(feedback ?? []) as Feedback[]}
      isAdmin={isAdmin}
    />
  );
}
