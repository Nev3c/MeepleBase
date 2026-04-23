import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";

function makeSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

// GET /api/messages — returns conversation list (inbox)
export async function GET() {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, from_id, to_id, content, read_at, created_at")
    .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!messages?.length) return NextResponse.json({ conversations: [] });

  // Group by conversation partner — keep only the latest message per partner
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

    // Count unread (messages TO me that haven't been read)
    if (msg.to_id === user.id && !msg.read_at) {
      convMap.get(otherId)!.unread_count++;
    }
  }

  // Fetch other users' profiles
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

  const conversations = Array.from(convMap.values()).map((conv) => {
    const p = profileMap.get(conv.other_user_id);
    return {
      ...conv,
      other_username: p?.username ?? "?",
      other_display_name: p?.display_name ?? null,
      other_avatar_url: p?.avatar_url ?? null,
    };
  });

  // Sorted newest first (already sorted from DB)
  return NextResponse.json({ conversations });
}

// POST /api/messages — send a new message { to_id, content }
export async function POST(req: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { to_id, content } = await req.json() as { to_id: string; content: string };
  if (!to_id || !content?.trim()) {
    return NextResponse.json({ error: "to_id und content erforderlich" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ from_id: user.id, to_id, content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send push to recipient (fire-and-forget, don't block the response)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: sender } = await admin
    .from("profiles")
    .select("username, notify_messages")
    .eq("id", user.id)
    .single();
  const { data: recipient } = await admin
    .from("profiles")
    .select("notify_messages")
    .eq("id", to_id)
    .single();

  // Only send if recipient hasn't disabled message notifications
  if (recipient?.notify_messages !== false) {
    sendPushToUser(to_id, {
      title: `Neue Nachricht von ${sender?.username ?? "jemandem"}`,
      body: content.trim().length > 80 ? content.trim().slice(0, 80) + "…" : content.trim(),
      url: `/players/messages/${user.id}`,
    }).catch(() => { /* ignore push errors */ });
  }

  return NextResponse.json(data, { status: 201 });
}
