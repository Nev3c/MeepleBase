import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ players: [] });

  // Use service role to bypass RLS on profiles (search must see all users)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url, location")
    .neq("id", user.id)
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles?.length) return NextResponse.json({ players: [] });

  // Get friendship status for found profiles
  const { data: friendships } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const profileIds = new Set(profiles.map((p) => p.id));
  const friendshipMap = new Map<string, { id: string; status: string; is_requester: boolean }>();

  for (const f of friendships ?? []) {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    if (profileIds.has(otherId)) {
      friendshipMap.set(otherId, {
        id: f.id,
        status: f.status,
        is_requester: f.requester_id === user.id,
      });
    }
  }

  const players = profiles.map((p) => ({
    ...p,
    friendship: friendshipMap.get(p.id) ?? null,
  }));

  return NextResponse.json({ players });
}
