import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ThreadClient } from "./thread-client";
import type { Message } from "@/types";

interface Props {
  params: { userId: string };
}

export const metadata: Metadata = { title: "Nachricht" };

export default async function ThreadPage({ params }: Props) {
  const { userId } = params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: otherProfile }, { data: messages }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", userId)
      .single(),
    supabase
      .from("messages")
      .select("id, from_id, to_id, content, read_at, created_at")
      .or(
        `and(from_id.eq.${user.id},to_id.eq.${userId}),and(from_id.eq.${userId},to_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true }),
  ]);

  if (!otherProfile) redirect("/players/messages");

  // Mark messages from other user as read (fire and forget)
  supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("from_id", userId)
    .eq("to_id", user.id)
    .is("read_at", null)
    .then(() => {});

  return (
    <ThreadClient
      currentUserId={user.id}
      otherUser={{
        id: otherProfile.id,
        username: otherProfile.username,
        display_name: otherProfile.display_name,
        avatar_url: otherProfile.avatar_url,
      }}
      initialMessages={(messages ?? []) as Message[]}
    />
  );
}
