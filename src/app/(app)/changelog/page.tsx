import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Sparkles, Wrench, TrendingUp } from "lucide-react";
import { CHANGELOG, CURRENT_VERSION } from "@/data/changelog";
import type { ChangeType } from "@/data/changelog";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Changelog" };

function ChangeIcon({ type }: { type: ChangeType }) {
  if (type === "feat")    return <Sparkles size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />;
  if (type === "fix")     return <Wrench size={12} className="text-red-400 flex-shrink-0 mt-0.5" />;
  return <TrendingUp size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />;
}

function changeLabel(type: ChangeType) {
  if (type === "feat")    return "Neu";
  if (type === "fix")     return "Fix";
  return "Verbessert";
}

export default async function ChangelogPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Link
          href="/profile"
          className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-lg font-semibold text-foreground leading-tight">Changelog</h1>
          <p className="text-[11px] text-muted-foreground">Aktuelle Version: {CURRENT_VERSION}</p>
        </div>
      </div>

      <div className="px-4 py-6 flex flex-col gap-6 max-w-2xl mx-auto">
        {CHANGELOG.map((entry, i) => (
          <div key={entry.version} className="relative">
            {/* Timeline line */}
            {i < CHANGELOG.length - 1 && (
              <div className="absolute left-[15px] top-10 bottom-[-24px] w-px bg-border" aria-hidden="true" />
            )}

            <div className="flex gap-4">
              {/* Version dot */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold z-10
                ${i === 0 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground border border-border"}`}>
                {i === 0 ? "✓" : i + 1 === CHANGELOG.length ? "🚀" : "·"}
              </div>

              <div className="flex-1 pb-2">
                {/* Version header */}
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-display text-base font-bold text-foreground">{entry.version}</span>
                  {i === 0 && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Aktuell</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-medium text-foreground">{entry.title}</p>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                </div>

                {/* Changes */}
                <div className="flex flex-col gap-2">
                  {entry.changes.map((change, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <ChangeIcon type={change.type} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-[10px] font-semibold mr-1.5 uppercase tracking-wide
                          ${change.type === "feat" ? "text-amber-600" : change.type === "fix" ? "text-red-500" : "text-blue-500"}`}>
                          {changeLabel(change.type)}
                        </span>
                        <span className="text-xs text-foreground/80">{change.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        <p className="text-center text-[11px] text-muted-foreground pb-4 pt-2">
          MeepleBase wird laufend weiterentwickelt.{" "}
          <Link href="/feedback" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Feedback geben →
          </Link>
        </p>
      </div>
    </div>
  );
}
