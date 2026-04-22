"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { PlayerAvatar } from "../../players-client";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface OtherUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  currentUserId: string;
  otherUser: OtherUser;
  initialMessages: Message[];
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return `Gestern ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays < 7) {
    return `${date.toLocaleDateString("de-DE", { weekday: "short" })} ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  } else {
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }
}

export function ThreadClient({ currentUserId, otherUser, initialMessages }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setDraft("");

    // Optimistic message
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      from_id: currentUserId,
      to_id: otherUser.id,
      content: text,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_id: otherUser.id, content: text }),
      });
      if (res.ok) {
        const real = await res.json() as Message;
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? real : m));
      } else {
        // Revert optimistic on error
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(text);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Send on Enter (without shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const d = new Date(msg.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const last = grouped[grouped.length - 1];
    if (last?.date === d) {
      last.messages.push(msg);
    } else {
      grouped.push({ date: d, messages: [msg] });
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft size={20} />
        </button>
        <PlayerAvatar
          name={otherUser.display_name ?? otherUser.username}
          avatarUrl={otherUser.avatar_url}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">
            {otherUser.display_name ?? otherUser.username}
          </p>
          <p className="text-xs text-muted-foreground">@{otherUser.username}</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-2">
        <div className="flex flex-col gap-1 max-w-2xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                Starte das Gespräch mit {otherUser.display_name ?? otherUser.username}!
              </p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground font-medium">{group.date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {group.messages.map((msg, i) => {
                const isMe = msg.from_id === currentUserId;
                const isOptimistic = msg.id.startsWith("opt-");
                const showTime = i === group.messages.length - 1 ||
                  group.messages[i + 1]?.from_id !== msg.from_id;

                return (
                  <div
                    key={msg.id}
                    className={cn("flex mb-0.5", isMe ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                        isMe
                          ? "bg-amber-500 text-white rounded-br-md"
                          : "bg-card border border-border text-foreground rounded-bl-md",
                        isOptimistic && "opacity-70"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      {showTime && (
                        <p className={cn(
                          "text-[10px] mt-0.5",
                          isMe ? "text-white/60 text-right" : "text-muted-foreground"
                        )}>
                          {formatMessageTime(msg.created_at)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Compose input — fixed to bottom above bottom nav */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht schreiben…"
            rows={1}
            className="flex-1 min-w-0 resize-none py-2.5 px-3.5 rounded-2xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.4" }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:bg-amber-600 transition-colors"
            aria-label="Senden"
          >
            <Send size={15} className="translate-x-0.5 -translate-y-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
