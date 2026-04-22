"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp } from "lucide-react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  function handleDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setDraft("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

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
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(text);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const d = new Date(msg.created_at).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
    const last = grouped[grouped.length - 1];
    if (last?.date === d) {
      last.messages.push(msg);
    } else {
      grouped.push({ date: d, messages: [msg] });
    }
  }

  return (
    // Fixed positioning: completely removes the element from page flow,
    // preventing the layout pb-[72px] from causing an outer page scroll.
    <div className="fixed inset-x-0 top-0 bottom-[72px] flex flex-col bg-background">

      {/* Header */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-12 pb-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
          aria-label="Zurück"
        >
          <ArrowLeft size={20} />
        </button>
        <PlayerAvatar
          name={otherUser.username}
          avatarUrl={otherUser.avatar_url}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-semibold text-foreground leading-tight truncate">
            {otherUser.username}
          </p>
        </div>
      </div>

      {/* Messages area — flex-1 + overflow-y-auto = only this section scrolls */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-0.5 max-w-2xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <PlayerAvatar
                  name={otherUser.username}
                  avatarUrl={otherUser.avatar_url}
                  size="sm"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Starte das Gespräch mit <span className="font-medium text-foreground">{otherUser.username}</span>
              </p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {group.messages.map((msg, i) => {
                const isMe = msg.from_id === currentUserId;
                const isOptimistic = msg.id.startsWith("opt-");
                const nextMsg = group.messages[i + 1];
                const isLastInRun = !nextMsg || nextMsg.from_id !== msg.from_id;
                const showTime = isLastInRun;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      isMe ? "justify-end" : "justify-start",
                      isLastInRun ? "mb-2" : "mb-0.5"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[78%] px-3.5 py-2 text-sm leading-relaxed",
                        isMe
                          ? "bg-amber-500 text-white"
                          : "bg-card border border-border text-foreground",
                        // Bubble shape: full radius except one corner
                        isMe
                          ? isLastInRun
                            ? "rounded-2xl rounded-br-md"
                            : "rounded-2xl"
                          : isLastInRun
                            ? "rounded-2xl rounded-bl-md"
                            : "rounded-2xl",
                        isOptimistic && "opacity-60"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      {showTime && (
                        <p className={cn(
                          "text-[10px] mt-1",
                          isMe ? "text-white/50 text-right" : "text-muted-foreground/60"
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

      {/* Compose bar */}
      <div className="flex-shrink-0 bg-background border-t border-border/60 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht…"
            rows={1}
            className="flex-1 min-w-0 resize-none py-2.5 px-3.5 rounded-2xl border border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 transition-all overflow-hidden"
            style={{ lineHeight: "1.45" }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-35 hover:bg-amber-600 active:scale-95 active:bg-amber-600 transition-all"
            aria-label="Senden"
          >
            <ArrowUp size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
