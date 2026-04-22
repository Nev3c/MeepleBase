import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { MessagesClient } from "./messages-client";
import type { ConversationSummary } from "@/types";

export const metadata: Metadata = { title: "Nachrichten" };

export default async function MessagesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: messages } = await supabase
    .from("messages")
    .select("id, from_id, to_id, content, read_at, created_at")
    .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (!messages?.length) {
    return <MessagesClient currentUserId={user.id} conversations={[]} />;
  }

  // Group by conversation partner
  const convMap = new Map<string, {
    other_user_id: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    is_last_from_me: boolean;
  }>();

  for (const msg of messages) {
    const otherId = msg.from_id === user.id ? msg.to_id : msg.from_id;
    if (!convMap.has(otherId)) {
      convMap.set(otherId, {
        other_user_id: otherId,
        last_message: msg.content,
        last_message_at: msg.created_at,
        unread_count: 0,
        is_last_from_me: msg.from_id === user.id,
      });
    }
    if (msg.to_id === user.id && !msg.read_at) {
      convMap.get(otherId)!.unread_count++;
    }
  }

  const otherIds = Array.from(convMap.keys());
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", otherIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const conversations: ConversationSummary[] = Array.from(convMap.values()).map((conv) => {
    const p = profileMap.get(conv.other_user_id);
    return {
      ...conv,
      other_username: p?.username ?? "?",
      other_display_name: p?.display_name ?? null,
      other_avatar_url: p?.avatar_url ?? null,
    };
  });

  return <MessagesClient currentUserId={user.id} conversations={conversations} />;
}
