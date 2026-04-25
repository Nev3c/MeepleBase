"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { LogOut, ExternalLink, ChevronRight, X, Share2, UserPlus, ShieldCheck, MessageSquare, ListChecks, BarChart2 } from "lucide-react";
import { CURRENT_VERSION } from "@/data/changelog";
import { QRCodeSVG } from "qrcode.react";

interface ProfileClientProps {
  user: User;
  profile: Profile | null;
  isAdmin?: boolean;
}

export function ProfileClient({ user, profile, isAdmin }: ProfileClientProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<"app" | "friend" | null>(null);
  const [appUrl, setAppUrl] = useState("https://meeplebase.app");
  // Tour badge: show for new accounts (< 30 days) that haven't completed the tour
  const [tourDone, setTourDone] = useState(true); // default true → no flash on hydration

  useEffect(() => {
    setAppUrl(window.location.origin);
    const done = localStorage.getItem("meeplebase_onboarding_done") === "1";
    const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
    const isNewAccount = accountAgeMs < 30 * 24 * 60 * 60 * 1000; // 30 days
    setTourDone(done || !isNewAccount);
  }, [user.created_at]);

  const displayName = profile?.display_name ?? profile?.username ?? user.email?.split("@")[0] ?? "Spieler";
  const username = profile?.username ?? "–";
  const avatarUrl = profile?.avatar_url ?? user.user_metadata?.avatar_url;
  const initial = displayName[0]?.toUpperCase() ?? "?";

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);

    const res = await fetch("/api/account/delete", { method: "DELETE" });

    if (!res.ok) {
      setDeleteError("Löschen fehlgeschlagen. Bitte nochmal versuchen.");
      setDeleting(false);
      return;
    }

    // Ausloggen + zur Registrierung
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/register");
    router.refresh();
  }

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const friendUrl = `${appUrl}/players/${user.id}`;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* App-Name Header */}
      <div className="flex items-center justify-center gap-2 pt-6 pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="w-6 h-6 rounded-lg" aria-hidden="true" />
        <span className="font-display text-base font-semibold text-foreground/60 tracking-tight">
          Meeple<span className="text-amber-500">Base</span>
        </span>
      </div>

      {/* Header mit Avatar */}
      <div className="relative px-4 pt-4 pb-6 text-center">
        {/* Hintergrund-Gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(232,130,26,0.08) 0%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        {/* Avatar */}
        <div className="relative inline-block mb-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-card mx-auto block"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center border-2 border-white shadow-card mx-auto">
              <span className="font-display text-3xl font-bold text-white">{initial}</span>
            </div>
          )}
        </div>

        <h1 className="font-display text-2xl font-semibold text-foreground">{displayName}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">@{username}</p>

        {profile?.bgg_username && (
          <a
            href={`https://boardgamegeek.com/user/${profile.bgg_username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-xs text-amber-600 font-medium hover:text-amber-700"
          >
            <ExternalLink size={11} />
            BGG: {profile.bgg_username}
          </a>
        )}
      </div>

      {/* Statistiken & Rankings — CTA → /stats */}
      <div className="px-4 mb-3">
        <Link href="/stats" className="block group">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-card px-4 py-3.5 flex items-center justify-between group-active:bg-amber-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <BarChart2 size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900 leading-tight">Statistiken & Rankings</p>
                <p className="text-[11px] text-amber-700/80 leading-tight">Partien, Siege, Sammlung & mehr</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-amber-500 flex-shrink-0" />
          </div>
        </Link>
      </div>

      {/* QR-Aktionen — kompakte Button-Zeile */}
      <div className="px-4 mb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setQrModal("app")}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-card border border-border shadow-card text-sm font-semibold text-foreground hover:bg-muted active:scale-[0.98] transition-all touch-manipulation"
          >
            <Share2 size={14} className="text-amber-500 flex-shrink-0" />
            App teilen
          </button>
          <button
            onClick={() => setQrModal("friend")}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-card border border-border shadow-card text-sm font-semibold text-foreground hover:bg-muted active:scale-[0.98] transition-all touch-manipulation"
          >
            <UserPlus size={14} className="text-amber-500 flex-shrink-0" />
            Kontakt-QR
          </button>
        </div>
      </div>

      {/* Menü-Sektionen */}
      <div className="px-4 flex flex-col gap-3">
        {/* Account-Sektion */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <SectionHeader>Account</SectionHeader>

          <MenuRow label="E-Mail" value={user.email ?? "–"} />
          <MenuRow
            label="BGG-Username"
            value={profile?.bgg_username ?? "Nicht eingetragen"}
            href="/settings"
            muted={!profile?.bgg_username}
          />
          <MenuRow label="Mitglied seit" value={formatDate(user.created_at)} />
        </div>

        {/* Einstellungen */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <SectionHeader>Einstellungen</SectionHeader>
          <MenuRow label="Einstellungen & BGG-Sync" href="/settings" showChevron />
          {isAdmin && (
            <MenuRow label="Admin" href="/admin" showChevron icon={<ShieldCheck size={14} className="text-muted-foreground" />} />
          )}
          {/* App Tour — highlighted if not yet completed */}
          {tourDone ? (
            <MenuRow label="App Tour" href="/onboarding" showChevron />
          ) : (
            <a
              href="/onboarding"
              className="block hover:bg-amber-50 active:bg-amber-100 transition-colors"
            >
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-amber-700">App Tour</span>
                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">
                    Neu
                  </span>
                </div>
                <ChevronRight size={16} className="text-amber-500" />
              </div>
              <p className="px-4 pb-3 text-xs text-amber-600/80 -mt-1">
                Lerne alle Funktionen in 2 Minuten kennen →
              </p>
            </a>
          )}
        </div>

        {/* Community */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <SectionHeader>Community</SectionHeader>
          <MenuRow
            label="Feedback & Bugs"
            href="/feedback"
            showChevron
            icon={<MessageSquare size={14} className="text-muted-foreground" />}
          />
          <MenuRow
            label="Changelog"
            href="/changelog"
            showChevron
            icon={<ListChecks size={14} className="text-muted-foreground" />}
          />
        </div>

        {/* Abmelden */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <button
            onClick={handleLogout}
            disabled={loggingOut || deleting}
            className="flex items-center gap-3 w-full px-4 py-3.5 text-left text-destructive hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">
              {loggingOut ? "Abmelden…" : "Abmelden"}
            </span>
          </button>
        </div>

        {/* Account löschen */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loggingOut || deleting}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2 mx-auto pb-2"
          >
            Account löschen
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
            <div>
              <p className="font-semibold text-sm text-red-800">Wirklich löschen?</p>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                Dein Account, deine Bibliothek und alle Partien werden
                unwiderruflich gelöscht.
              </p>
            </div>
            {deleteError && (
              <p className="text-xs text-destructive font-medium">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                disabled={deleting}
                className="flex-1 h-9 rounded-btn border border-border bg-white text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 h-9 rounded-btn bg-destructive text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? "Löschen…" : "Ja, löschen"}
              </button>
            </div>
          </div>
        )}

        {/* Legal links + Version */}
        <div className="flex flex-col items-center gap-1 pb-4 pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <a href="/impressum" className="hover:text-foreground transition-colors underline underline-offset-2">Impressum</a>
            <span aria-hidden="true">·</span>
            <a href="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">Datenschutz</a>
            <span aria-hidden="true">·</span>
            <a href="/terms" className="hover:text-foreground transition-colors underline underline-offset-2">AGB</a>
          </div>
          <p className="text-center text-xs text-muted-foreground">MeepleBase · {CURRENT_VERSION}</p>
        </div>
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
          onClick={() => setQrModal(null)}
        >
          <div
            className="bg-card rounded-3xl p-6 w-full max-w-xs shadow-xl flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="font-display text-lg font-semibold text-foreground">
                  {qrModal === "app" ? "App teilen" : "Kontakt-QR"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {qrModal === "app"
                    ? "Lass Freunde MeepleBase scannen"
                    : `Profil von @${username}`}
                </p>
              </div>
              <button
                onClick={() => setQrModal(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-inner">
              <QRCodeSVG
                value={qrModal === "app" ? appUrl : friendUrl}
                size={200}
                fgColor="#1E2A3A"
                bgColor="#FFFFFF"
                level="M"
              />
            </div>

            <p className="text-[10px] text-muted-foreground text-center break-all px-2">
              {qrModal === "app" ? appUrl : friendUrl}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Abschnitts-Überschrift
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 bg-muted/50 border-b border-border">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {children}
      </span>
    </div>
  );
}

// Menü-Zeile
function MenuRow({
  label,
  value,
  href,
  showChevron,
  muted,
  icon,
}: {
  label: string;
  value?: string;
  href?: string;
  showChevron?: boolean;
  muted?: boolean;
  icon?: React.ReactNode;
}) {
  const content = (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {value && (
          <span className={`text-sm ${muted ? "text-muted-foreground" : "text-muted-foreground"} max-w-[160px] truncate text-right`}>
            {value}
          </span>
        )}
        {showChevron && <ChevronRight size={16} className="text-muted-foreground" />}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block hover:bg-muted/50 active:bg-muted transition-colors">
        {content}
      </a>
    );
  }

  return <div>{content}</div>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
