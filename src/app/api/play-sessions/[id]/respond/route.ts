import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function makeClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) =>
          c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

function makeAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── POST /api/play-sessions/[id]/respond ─────────────────────────────────────
// Invitee accepts or declines a session invite

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check via user client, write via admin to avoid circular RLS evaluation
  const supabase = makeClient();
  const admin = makeAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { status: "accepted" | "declined" };
  if (!["accepted", "declined"].includes(body.status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  // Ownership enforced explicitly via .eq("invited_user_id", user.id) — same
  // security guarantee as RLS, without triggering the circular policy evaluation
  const { data, error } = await admin
    .from("play_session_invites")
    .update({
      status: body.status,
      responded_at: new Date().toISOString(),
    })
    .eq("session_id", params.id)
    .eq("invited_user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
