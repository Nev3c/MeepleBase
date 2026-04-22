"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, MessageSquare } from "lucide-react";
import { PlayerAvatar } from "../players-client";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types";

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

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold flex-1">Nachrichten</h1>
        {totalUnread > 0 && (
          <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            {totalUnread} ungelesen
          </span>
        )}
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageSquare size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">Noch keine Nachrichten</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Öffne das Profil eines Freundes und schick ihm eine Nachricht.
          </p>
          <Link
            href="/players"
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold"
          >
            <Mail size={14} />
            Spieler finden
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-0 max-w-2xl mx-auto w-full">
          {conversations.map((conv) => (
            <Link
              key={conv.other_user_id}
              href={`/players/messages/${conv.other_user_id}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 border-b border-border/50 active:bg-muted/50 transition-colors",
                conv.unread_count > 0 && "bg-amber-50/40"
              )}
            >
              <div className="relative flex-shrink-0">
                <PlayerAvatar
                  name={conv.other_username}
                  avatarUrl={conv.other_avatar_url}
                  size="md"
                />
                {conv.unread_count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {conv.unread_count > 9 ? "9+" : conv.unread_count}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("text-sm truncate", conv.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                    {conv.other_username}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex-shrink-0">
                    {formatTime(conv.last_message_at)}
                  </p>
                </div>
                <p className={cn("text-xs truncate mt-0.5", conv.unread_count > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground")}>
                  {conv.is_last_from_me && <span className="text-muted-foreground">Du: </span>}
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
