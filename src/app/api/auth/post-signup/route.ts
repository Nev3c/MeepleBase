import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Wird vom Register-Form direkt nach erfolgreichem signUp() aufgerufen
// (und nach OAuth-Login für neue User), um Setup-Aktionen auszuführen,
// die der /auth/callback-Route entgehen, wenn Auto-Confirm aktiv ist.
//
// Aktuell: Wenn REQUIRE_APPROVAL=true → setze profiles.approved=false
// damit der User in der Admin-Ansicht als "ausstehend" erscheint und
// die Middleware ihn auf /waiting schickt.
export async function POST() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  // Nur für brandneue Accounts (< 7 Tage)
  const ageMs = Date.now() - new Date(user.created_at).getTime();
  if (ageMs > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: "user too old" });
  }

  if (process.env.REQUIRE_APPROVAL !== "true") {
    return NextResponse.json({ ok: true, skipped: "approval disabled" });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Nur setzen wenn noch nicht entschieden (approved IS NULL)
  // damit ein bereits genehmigter User nicht zurückgestuft wird
  const { data: profile } = await admin
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && profile.approved === null) {
    const { error } = await admin
      .from("profiles")
      .update({ approved: false })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, requiresApproval: true });
}
