"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { LogOut, ExternalLink, ChevronRight, X, Share2, UserPlus, ShieldCheck, MessageSquare, ListChecks, BarChart2, Camera, Images, ArrowLeft } from "lucide-react";
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

  // ── Avatar upload (inline on profile) ─────────────────────────────────────
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          setAvatarPreview(URL.createObjectURL(blob));
          setAvatarUploading(true);
          try {
            const fd = new FormData();
            fd.append("file", blob, "avatar.jpg");
            const res = await fetch("/api/avatar", { method: "POST", body: fd });
            const data = await res.json() as { url?: string };
            if (data.url) setAvatarPreview(data.url);
            router.refresh();
          } finally {
            setAvatarUploading(false);
          }
        }, "image/jpeg", 0.85);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Gallery ────────────────────────────────────────────────────────────────
  type GalleryItem = { id: string; image_url: string; played_at: string; game_name: string };
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<GalleryItem | null>(null);

  async function openGallery() {
    setShowGallery(true);
    if (galleryLoaded) return;
    setGalleryLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("plays")
        .select("id, image_url, played_at, game:games(name)")
        .eq("user_id", user.id)
        .not("image_url", "is", null)
        .order("played_at", { ascending: false });

      type RawRow = { id: string; image_url: string | null; played_at: string; game: { name: string } | { name: string }[] | null };
      const items: GalleryItem[] = ((data ?? []) as RawRow[])
        .filter((r) => !!r.image_url)
        .map((r) => ({
          id: r.id,
          image_url: r.image_url as string,
          played_at: r.played_at,
          game_name: (Array.isArray(r.game) ? r.game[0]?.name : r.game?.name) ?? "Unbekanntes Spiel",
        }));
      setGalleryItems(items);
      setGalleryLoaded(true);
    } finally {
      setGalleryLoading(false);
    }
  }

  useEffect(() => {
    setAppUrl(window.location.origin);
    const done = localStorage.getItem("meeplebase_onboarding_done") === "1";
    const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
    const isNewAccount = accountAgeMs < 30 * 24 * 60 * 60 * 1000; // 30 days
    setTourDone(done || !isNewAccount);
  }, [user.created_at]);

  const displayName = profile?.display_name ?? profile?.username ?? user.email?.split("@")[0] ?? "Spieler";
  const username = profile?.username ?? "–";
  const currentAvatarUrl = avatarPreview ?? (profile?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null);
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

        {/* Avatar — tappable to upload */}
        <div className="relative inline-block mb-3">
          <label className="cursor-pointer group block">
            {currentAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentAvatarUrl}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-card mx-auto block"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center border-2 border-white shadow-card mx-auto">
                <span className="font-display text-3xl font-bold text-white">{initial}</span>
              </div>
            )}
            {/* Camera overlay */}
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 group-active:bg-black/40 transition-all flex items-center justify-center">
              {avatarUploading ? (
                <svg className="animate-spin h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity drop-shadow" />
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
              disabled={avatarUploading}
            />
          </label>
          {/* Camera badge (always visible, small) */}
          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center shadow-sm pointer-events-none">
            <Camera size={11} className="text-white" />
          </div>
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

      {/* QR-Aktionen + Galerie — kompakte Button-Zeile */}
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
          <button
            onClick={openGallery}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-card border border-border shadow-card text-sm font-semibold text-foreground hover:bg-muted active:scale-[0.98] transition-all touch-manipulation"
          >
            <Images size={14} className="text-amber-500 flex-shrink-0" />
            Galerie
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

      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-border bg-background sticky top-0">
            <button
              onClick={() => setShowGallery(false)}
              className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground leading-tight">Meine Fotos</h2>
              <p className="text-xs text-muted-foreground">
                {galleryLoading ? "Lade…" : `${galleryItems.length} ${galleryItems.length === 1 ? "Foto" : "Fotos"}`}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {galleryLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <svg className="animate-spin h-8 w-8 text-amber-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-muted-foreground">Fotos werden geladen…</p>
              </div>
            )}

            {!galleryLoading && galleryItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <Images size={28} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Noch keine Fotos</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Füge Fotos beim Erfassen oder Bearbeiten einer Partie hinzu.
                  </p>
                </div>
              </div>
            )}

            {!galleryLoading && galleryItems.length > 0 && (
              <div className="grid grid-cols-2 gap-0.5 p-0.5">
                {galleryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFullscreenImg(item)}
                    className="relative aspect-square overflow-hidden bg-muted group"
                  >
                    <Image
                      src={item.image_url}
                      alt={item.game_name}
                      fill
                      className="object-cover transition-transform duration-200 group-active:scale-95"
                      sizes="50vw"
                    />
                    {/* Overlay with game name */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                      <p className="text-white text-[11px] font-semibold leading-tight line-clamp-1">{item.game_name}</p>
                      <p className="text-white/70 text-[10px] leading-tight">
                        {new Date(item.played_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen image viewer */}
      {fullscreenImg && (
        <div
          className="fixed inset-0 z-[60] bg-black flex flex-col"
          onClick={() => setFullscreenImg(null)}
        >
          <div className="flex items-center justify-between px-4 pt-12 pb-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-semibold text-white text-sm leading-tight">{fullscreenImg.game_name}</p>
              <p className="text-white/60 text-xs">
                {new Date(fullscreenImg.played_at).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <button
              onClick={() => setFullscreenImg(null)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            >
              <X size={18} className="text-white" />
            </button>
          </div>
          <div className="flex-1 relative">
            <Image
              src={fullscreenImg.image_url}
              alt={fullscreenImg.game_name}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
        </div>
      )}

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
