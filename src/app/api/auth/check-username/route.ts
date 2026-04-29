import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── GET /api/auth/check-username?u=meeple_max ────────────────────────────────
// Public endpoint (no auth required) — checks if a username is already taken.
// Used during registration to give inline feedback before calling signUp().

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("u")?.toLowerCase().trim();

  if (!username || username.length < 2) {
    return NextResponse.json({ available: false, reason: "too_short" });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    // On DB error, fail open — let signUp() handle it
    console.error("[check-username] DB error:", error.message);
    return NextResponse.json({ available: true });
  }

  return NextResponse.json({ available: data === null });
}
