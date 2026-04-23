import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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

// PATCH /api/friendships/[id] — accept or decline
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { action } = await req.json() as { action: "accept" | "decline" };
  if (!["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";

  const { error } = await supabase
    .from("friendships")
    .update({ status: newStatus })
    .eq("id", params.id)
    .eq("addressee_id", user.id); // Only the addressee can accept/decline

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: newStatus });
}

// DELETE /api/friendships/[id] — remove friendship (either party)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // Use admin client to bypass RLS — we verify ownership manually via the .or() filter
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error, count } = await admin
    .from("friendships")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: "Nicht gefunden oder keine Berechtigung" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
