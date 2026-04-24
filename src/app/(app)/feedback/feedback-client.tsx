"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Bug, Lightbulb, MessageSquare, CheckCircle2, Clock, Circle, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Feedback, FeedbackStatus, FeedbackType } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const TYPE_META: Record<FeedbackType, { label: string; icon: React.ReactNode; color: string }> = {
  bug:     { label: "Bug",          icon: <Bug size={12} />,         color: "text-red-600 bg-red-50 border-red-200" },
  feature: { label: "Feature-Wunsch", icon: <Lightbulb size={12} />, color: "text-amber-700 bg-amber-50 border-amber-200" },
  other:   { label: "Sonstiges",    icon: <MessageSquare size={12} />, color: "text-slate-600 bg-slate-50 border-slate-200" },
};

const STATUS_META: Record<FeedbackStatus, { label: string; icon: React.ReactNode; color: string }> = {
  open:        { label: "Offen",       icon: <Circle size={11} />,        color: "text-slate-500 bg-slate-100" },
  in_progress: { label: "In Arbeit",   icon: <Clock size={11} />,         color: "text-amber-700 bg-amber-100" },
  done:        { label: "Erledigt",    icon: <CheckCircle2 size={11} />,  color: "text-green-700 bg-green-100" },
};

type Filter = "all" | FeedbackType | "mine";

// ── Component ─────────────────────────────────────────────────────────────────

interface FeedbackClientProps {
  userId: string;
  username: string;
  initialFeedback: Feedback[];
  isAdmin: boolean;
}

export function FeedbackClient({ userId, username, initialFeedback, isAdmin }: FeedbackClientProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback[]>(initialFeedback);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [formType, setFormType] = useState<FeedbackType>("bug");
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Admin state
  const [adminItem, setAdminItem] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);

  // Filter
  const visible = feedback.filter((f) => {
    if (filter === "all") return true;
    if (filter === "mine") return f.user_id === userId;
    return f.type === filter;
  });

  // Submit form
  async function handleSubmit() {
    if (!formTitle.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: formType, title: formTitle.trim(), message: formMessage.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Fehler beim Senden");
      }
      const created = await res.json() as Feedback;
      setFeedback((prev) => [created, ...prev]);
      setFormTitle("");
      setFormMessage("");
      setFormType("bug");
      setShowForm(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  // Admin: update status
  async function handleAdminSave(id: string, status: FeedbackStatus) {
    setAdminSaving(true);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_note: adminNote }),
      });
      if (!res.ok) throw new Error("Fehler");
      const updated = await res.json() as Feedback;
      setFeedback((prev) => prev.map((f) => f.id === id ? updated : f));
      setAdminItem(null);
      setAdminNote("");
      startTransition(() => router.refresh());
    } catch {
      // silent — keep panel open
    } finally {
      setAdminSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="font-display text-lg font-semibold text-foreground flex-1">Feedback</h1>
        <button
          onClick={() => { setShowForm((v) => !v); setAdminItem(null); }}
          className={cn(
            "flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-colors",
            showForm ? "bg-muted text-muted-foreground" : "bg-amber-500 text-white hover:bg-amber-600"
          )}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Abbrechen" : "Einreichen"}
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 max-w-2xl mx-auto">

        {/* Submit form */}
        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Neues Feedback</p>

            {/* Type selector */}
            <div className="flex gap-2">
              {(["bug", "feature", "other"] as FeedbackType[]).map((t) => {
                const m = TYPE_META[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormType(t)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold border transition-colors",
                      formType === t ? m.color : "border-border text-muted-foreground hover:border-amber-300"
                    )}
                  >
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>

            {/* Title */}
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Kurze Beschreibung (Pflichtfeld)"
              maxLength={120}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />

            {/* Message */}
            <textarea
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              placeholder="Details, Schritte zum Reproduzieren, Screenshot-Beschreibung… (optional)"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
            />

            {submitError && <p className="text-xs text-destructive">{submitError}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || !formTitle.trim()}
              className="h-11 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? "Wird gesendet…" : "Absenden"}
            </button>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {([
            ["all", "Alle"],
            ["bug", "Bugs"],
            ["feature", "Feature-Wünsche"],
            ["other", "Sonstiges"],
            ["mine", "Meine"],
          ] as [Filter, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-shrink-0 px-3 h-8 rounded-full text-xs font-semibold transition-colors",
                filter === f ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {f !== "all" && (
                <span className="ml-1.5 opacity-70">
                  {f === "mine"
                    ? feedback.filter((x) => x.user_id === userId).length
                    : feedback.filter((x) => x.type === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {visible.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {filter === "mine" ? "Du hast noch kein Feedback eingereicht." : "Keine Einträge."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((item) => {
              const tm = TYPE_META[item.type];
              const sm = STATUS_META[item.status];
              const isExpanded = expandedId === item.id;
              const isOwn = item.user_id === userId;
              const isAdminOpen = adminItem === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "bg-card border rounded-2xl overflow-hidden transition-shadow",
                    isOwn ? "border-amber-200" : "border-border",
                  )}
                >
                  {/* Main row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full px-4 py-3.5 text-left flex items-start gap-3"
                  >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", tm.color)}>
                          {tm.icon} {tm.label}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", sm.color)}>
                          {sm.icon} {sm.label}
                        </span>
                        {isOwn && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                            Mein Feedback
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.username} · {formatDate(item.created_at)}
                      </p>
                    </div>
                    <span className="text-muted-foreground flex-shrink-0 mt-1">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border/50 pt-3">
                      {item.message && (
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.message}</p>
                      )}
                      {item.admin_note && item.status !== "open" && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Status-Update</p>
                          <p className="text-xs text-amber-900">{item.admin_note}</p>
                        </div>
                      )}

                      {/* Admin controls */}
                      {isAdmin && (
                        <div className="border-t border-border/50 pt-3">
                          {!isAdminOpen ? (
                            <button
                              onClick={() => { setAdminItem(item.id); setAdminNote(item.admin_note ?? ""); }}
                              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                            >
                              Status bearbeiten
                            </button>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-semibold text-foreground">Status setzen:</p>
                              <div className="flex gap-2">
                                {(["open", "in_progress", "done"] as FeedbackStatus[]).map((s) => {
                                  const sm2 = STATUS_META[s];
                                  return (
                                    <button
                                      key={s}
                                      disabled={adminSaving}
                                      onClick={() => handleAdminSave(item.id, s)}
                                      className={cn(
                                        "flex-1 flex items-center justify-center gap-1 h-8 rounded-xl text-[11px] font-semibold transition-colors",
                                        item.status === s
                                          ? sm2.color + " ring-2 ring-offset-1 ring-current"
                                          : sm2.color + " opacity-60 hover:opacity-100"
                                      )}
                                    >
                                      {sm2.icon} {sm2.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <textarea
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                placeholder="Notiz für den Nutzer (optional)"
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setAdminItem(null); setAdminNote(""); }}
                                  className="flex-1 h-8 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Abbrechen
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer hint */}
        <p className="text-center text-[11px] text-muted-foreground pb-4">
          {feedback.length} {feedback.length === 1 ? "Eintrag" : "Einträge"} · Alle Nutzer können Feedback sehen
        </p>
      </div>
    </div>
  );
}
