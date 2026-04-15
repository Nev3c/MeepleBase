import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

// Supabase schickt den User nach Login/Registrierung hierher.
// Neue User (Account < 30 Min alt) → /onboarding, sonst → /library
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

      // Auto-Erkennung: neuer Account (< 30 Min) → Onboarding
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.created_at) {
        const ageMs = Date.now() - new Date(user.created_at).getTime();
        if (ageMs < 30 * 60 * 1000) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}/library`);
    }
  }

  // Fehlerfall → zurück zum Login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
