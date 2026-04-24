"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Bell, BellOff, X } from "lucide-react";
import { PlayerAvatar } from "../players-client";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useState } from "react";

interface Props {
  currentUserId: string;
  conversations: ConversationSummary[];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Gestern";
  } else if (diffDays < 7) {
    return date.toLocaleDateString("de-DE", { weekday: "short" });
  } else {
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }
}

export function MessagesClient({ conversations }: Props) {
  const router = useRouter();
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const { state: pushState, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Show banner only when user hasn't decided yet
  const showBanner = !bannerDismissed && pushState === "unsubscribed";

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-12 pb-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
          aria-label="Zurück"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold flex-1">Nachrichten</h1>
        {totalUnread > 0 && (
          <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            {totalUnread} neu
          </span>
        )}
      </div>

      {/* Push notification banner */}
      {showBanner && (
        <div className="mx-4 mt-3 flex items-center gap-3 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Bell size={15} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Benachrichtigungen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Lass dich bei neuen Nachrichten benachrichtigen.</p>
          </div>
          <button
            onClick={subscribe}
            disabled={pushLoading}
            className="flex-shrink-0 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {pushLoading ? "…" : "Aktivieren"}
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Schließen"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Subtle status when subscribed / denied */}
      {pushState === "subscribed" && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-2 px-3.5 py-2 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Bell size={13} className="text-green-600" />
            <p className="text-xs text-green-700 font-medium">Benachrichtigungen aktiv</p>
          </div>
          <button
            onClick={unsubscribe}
            disabled={pushLoading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
          >
            <BellOff size={12} />
            Deaktivieren
          </button>
        </div>
      )}

      {/* Empty state */}
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageSquare size={26} className="text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            Noch keine Nachrichten
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Öffne das Profil eines Freundes und schick ihm eine Nachricht.
          </p>
          <Link
            href="/players"
            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold active:bg-amber-600 transition-colors"
          >
            Spieler finden
          </Link>
        </div>
      ) : (
        /* Conversation list */
        <div className="flex flex-col max-w-2xl mx-auto w-full">
          {conversations.map((conv, i) => (
            <Link
              key={conv.other_user_id}
              href={`/players/messages/${conv.other_user_id}`}
              className={cn(
                "flex items-center gap-3.5 px-4 py-3.5 active:bg-muted/40 transition-colors",
                // Separator: border between items, not on last
                i < conversations.length - 1 && "border-b border-border/40",
                // Unread highlight
                conv.unread_count > 0 && "bg-amber-50/50"
              )}
            >
              {/* Avatar with unread dot */}
              <div className="relative flex-shrink-0">
                <PlayerAvatar
                  name={conv.other_username}
                  avatarUrl={conv.other_avatar_url}
                  size="md"
                />
                {conv.unread_count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {conv.unread_count > 9 ? "9+" : conv.unread_count}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn(
                    "text-sm truncate",
                    conv.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground"
                  )}>
                    {conv.other_username}
                  </p>
                  <p className={cn(
                    "text-[11px] flex-shrink-0 tabular-nums",
                    conv.unread_count > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"
                  )}>
                    {formatTime(conv.last_message_at)}
                  </p>
                </div>
                <p className={cn(
                  "text-xs truncate mt-0.5",
                  conv.unread_count > 0
                    ? "text-foreground/75 font-medium"
                    : "text-muted-foreground"
                )}>
                  {conv.is_last_from_me && (
                    <span className="text-muted-foreground/70 font-normal">Du: </span>
                  )}
                  {conv.last_message}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
