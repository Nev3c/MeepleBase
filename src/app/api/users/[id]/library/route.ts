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

// ── GET /api/users/[id]/library ───────────────────────────────────────────────
// Returns the game library of any authenticated user (for vote_free proposals).
// Requires the caller to be logged in; uses admin client to bypass RLS on
// user_games (which is scoped to own rows only).

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch the target user's library (all statuses — admin bypasses user_games RLS)
  const { data, error } = await admin
    .from("user_games")
    .select("game:games(id, name, thumbnail_url, min_playtime, max_playtime)")
    .eq("user_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type RawGame = { id: string; name: string; thumbnail_url: string | null; min_playtime: number | null; max_playtime: number | null };
  const games: RawGame[] = (data ?? []).flatMap((ug) => {
    const g = ug.game as unknown as RawGame | RawGame[] | null;
    if (!g) return [];
    return Array.isArray(g) ? g : [g];
  });

  return NextResponse.json({ games });
}
