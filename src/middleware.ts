import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Seiten die ohne Login erreichbar sind
const PUBLIC_ROUTES = [
  "/login", "/register", "/onboarding", "/auth",
  "/waiting", "/terms", "/privacy", "/impressum",
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Session prüfen (refresht den Token automatisch)
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((r) => path.startsWith(r));

  // Nicht eingeloggt + will auf geschützte Seite → zum Login schicken
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Eingeloggt + will auf Login/Register → zur Bibliothek schicken
  if (user && (path === "/login" || path === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/library";
    return NextResponse.redirect(url);
  }

  // Freigabe-Check: wenn REQUIRE_APPROVAL aktiv, unapproved User → /waiting
  if (user && !isPublicRoute && path !== "/waiting") {
    const requireApproval = process.env.REQUIRE_APPROVAL === "true";
    if (requireApproval) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("approved")
        .eq("id", user.id)
        .single();

      if (profile && profile.approved === false) {
        const url = request.nextUrl.clone();
        url.pathname = "/waiting";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Alle Seiten außer statische Dateien, Next.js-Interna und API-Routen
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
