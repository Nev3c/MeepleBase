import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function WaitingPage() {
  // Wenn User bereits genehmigt ist → direkt weiterleiten
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
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .single();

  if (profile?.approved !== false) {
    redirect("/library");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#FDFAF6] px-6 text-center gap-6">
      {/* Icon */}
      <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-xl" />
      </div>

      {/* Text */}
      <div className="flex flex-col gap-2 max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-[#1E2A3A]">
          Warte auf Freigabe
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Dein Account wurde angelegt — du wirst freigeschaltet sobald ein Admin deinen Zugang bestätigt.
          Du bekommst in Kürze Bescheid.
        </p>
      </div>

      {/* Email hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 max-w-sm w-full text-left">
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-semibold">Registriert als:</span> {user.email}
        </p>
      </div>

      {/* Logout */}
      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Anderer Account? Abmelden
        </button>
      </form>
    </div>
  );
}
