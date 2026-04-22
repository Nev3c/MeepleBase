import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Haversine formula — returns distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  const radius = parseFloat(req.nextUrl.searchParams.get("radius") ?? "50");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat und lng erforderlich" }, { status: 400 });
  }

  // Bounding box pre-filter (rough): ±radius km
  const deltaLat = radius / 111;
  const deltaLng = radius / (111 * Math.cos((lat * Math.PI) / 180));

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url, location, location_lat, location_lng")
    .neq("id", user.id)
    .not("location_lat", "is", null)
    .not("location_lng", "is", null)
    .gte("location_lat", lat - deltaLat)
    .lte("location_lat", lat + deltaLat)
    .gte("location_lng", lng - deltaLng)
    .lte("location_lng", lng + deltaLng);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles?.length) return NextResponse.json({ players: [] });

  // Exact distance filter + sort
  const withDistance = profiles
    .map((p) => ({
      ...p,
      distance_km: haversine(lat, lng, p.location_lat as number, p.location_lng as number),
    }))
    .filter((p) => p.distance_km <= radius)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 30);

  if (!withDistance.length) return NextResponse.json({ players: [] });

  // Friendship status
  const { data: friendships } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const profileIds = new Set(withDistance.map((p) => p.id));
  const friendshipMap = new Map<string, { id: string; status: string; is_requester: boolean }>();
  for (const f of friendships ?? []) {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    if (profileIds.has(otherId)) {
      friendshipMap.set(otherId, { id: f.id, status: f.status, is_requester: f.requester_id === user.id });
    }
  }

  const players = withDistance.map(({ location_lat, location_lng, ...p }) => ({
    ...p,
    friendship: friendshipMap.get(p.id) ?? null,
  }));

  return NextResponse.json({ players });
}
