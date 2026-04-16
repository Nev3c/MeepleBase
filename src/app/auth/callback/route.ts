import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

// Supabase schickt den User nach Login/Registrierung hierher.
// Neue User (Account < 30 Min alt) → /onboarding (oder /waiting wenn REQUIRE_APPROVAL=true)
// Bestehende User → /library

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Explizites next= überschreibt die Auto-Erkennung (z.B. für Deep-Links)
  const explicitNext = searchParams.get("next");

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (explicitNext) {
        return NextResponse.redirect(`${origin}${explicitNext}`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.created_at) {
        const ageMs = Date.now() - new Date(user.created_at).getTime();
        const isNewUser = ageMs < 30 * 60 * 1000;

        if (isNewUser) {
          // Wenn REQUIRE_APPROVAL aktiv: neuen User direkt auf "Wartend" setzen
          if (process.env.REQUIRE_APPROVAL === "true") {
            try {
              const admin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              );
              // Profile wird durch Supabase-Trigger angelegt — hier approved=false setzen
              await admin.from("profiles").upsert({
                id: user.id,
                approved: false,
              }, { onConflict: "id" });
            } catch (e) {
              console.error("[callback] approval upsert failed:", e);
            }
            return NextResponse.redirect(`${origin}/waiting`);
          }

          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}/library`);
    }
  }

  // Fehlerfall → zurück zum Login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
