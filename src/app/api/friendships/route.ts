import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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

// GET /api/friendships — returns { friends, pending_received, pending_sent }
export async function GET() {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data: friendships, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!friendships?.length) return NextResponse.json({ friends: [], pending_received: [], pending_sent: [] });

  // Get profiles for all other parties
  const otherIds = Array.from(new Set(friendships.map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  )));

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url, location, library_visibility")
    .in("id", otherIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const friends: object[] = [];
  const pending_received: object[] = [];
  const pending_sent: object[] = [];

  for (const f of friendships) {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    const profile = profileMap.get(otherId);
    if (!profile) continue;

    const entry = {
      friendship_id: f.id,
      friendship_status: f.status,
      is_requester: f.requester_id === user.id,
      profile,
    };

    if (f.status === "accepted") friends.push(entry);
    else if (f.status === "pending" && f.addressee_id === user.id) pending_received.push(entry);
    else if (f.status === "pending" && f.requester_id === user.id) pending_sent.push(entry);
  }

  return NextResponse.json({ friends, pending_received, pending_sent });
}

// POST /api/friendships — send friend request { addressee_id }
export async function POST(req: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { addressee_id } = body;

  if (!addressee_id) return NextResponse.json({ error: "addressee_id fehlt" }, { status: 400 });
  if (addressee_id === user.id) return NextResponse.json({ error: "Kannst dich nicht selbst hinzufügen" }, { status: 400 });

  // Check for existing friendship in either direction
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${addressee_id}),and(requester_id.eq.${addressee_id},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  // Active or pending friendship — block re-add
  if (existing && existing.status !== "declined") {
    return NextResponse.json({ error: "Anfrage bereits vorhanden", existing }, { status: 409 });
  }

  // Stale "declined" record — remove it so the fresh INSERT below can succeed
  if (existing?.status === "declined") {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await admin.from("friendships").delete().eq("id", existing.id);
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert({ requester_id: user.id, addressee_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
