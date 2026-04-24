"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Plus, Bug, Lightbulb, MessageSquare,
  CheckCircle2, Clock, Circle, ChevronDown, X, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Feedback, FeedbackStatus, FeedbackType } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const TYPE_META: Record<FeedbackType, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  bug:     { label: "Bug",           icon: <Bug size={13} />,          bg: "bg-red-50",    text: "text-red-600",    border: "border-red-200" },
  feature: { label: "Feature-Wunsch", icon: <Lightbulb size={13} />,  bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  other:   { label: "Sonstiges",     icon: <MessageSquare size={13} />, bg: "bg-slate-50",  text: "text-slate-600",  border: "border-slate-200" },
};

const STATUS_META: Record<FeedbackStatus, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  open:        { label: "Offen",      icon: <Circle size={10} />,        bg: "bg-slate-100",  text: "text-slate-500" },
  in_progress: { label: "In Arbeit",  icon: <Clock size={10} />,         bg: "bg-amber-100",  text: "text-amber-700" },
  done:        { label: "Erledigt",   icon: <CheckCircle2 size={10} />,  bg: "bg-green-100",  text: "text-green-700" },
};

type Filter = "all" | FeedbackType | "mine";

// ── Main Component ─────────────────────────────────────────────────────────────

interface FeedbackClientProps {
  userId: string;
  initialFeedback: Feedback[];
  isAdmin: boolean;
}

export function FeedbackClient({ userId, initialFeedback, isAdmin }: FeedbackClientProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback[]>(initialFeedback);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [justSubmittedId, setJustSubmittedId] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState<FeedbackType>("bug");
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Admin state — per-item: which is being edited + the note draft
  const [adminEditId, setAdminEditId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);

  // Sorted: own first, then by status priority (open > in_progress > done), then date
  const statusOrder: Record<FeedbackStatus, number> = { open: 0, in_progress: 1, done: 2 };
  const sorted = [...feedback].sort((a, b) => {
    // Just submitted item always first
    if (a.id === justSubmittedId) return -1;
    if (b.id === justSubmittedId) return 1;
    // Then by status
    const sd = statusOrder[a.status] - statusOrder[b.status];
    if (sd !== 0) return sd;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const visible = sorted.filter((f) => {
    if (filter === "all") return true;
    if (filter === "mine") return f.user_id === userId;
    return f.type === filter;
  });

  const counts = {
    all: feedback.length,
    bug: feedback.filter((f) => f.type === "bug").length,
    feature: feedback.filter((f) => f.type === "feature").length,
    other: feedback.filter((f) => f.type === "other").length,
    mine: feedback.filter((f) => f.user_id === userId).length,
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!formTitle.trim() || submitting) return;
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
      setJustSubmittedId(created.id);
      setFormTitle("");
      setFormMessage("");
      setFormType("bug");
      setShowForm(false);
      setExpandedId(created.id);
      setTimeout(() => setJustSubmittedId(null), 4000);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Admin: set status ────────────────────────────────────────────────────────

  async function handleStatusChange(id: string, status: FeedbackStatus) {
    setAdminSaving(true);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_note: adminNote }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Feedback;
      setFeedback((prev) => prev.map((f) => f.id === id ? updated : f));
      setAdminEditId(null);
      setAdminNote("");
    } catch {
      /* keep panel open on error */
    } finally {
      setAdminSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-background">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            aria-label="Zurück"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold text-foreground leading-tight">Feedback</h1>
            <p className="text-[11px] text-muted-foreground leading-none">
              {counts.all === 0 ? "Noch keine Einträge" : `${counts.all} ${counts.all === 1 ? "Eintrag" : "Einträge"}`}
            </p>
          </div>
          <button
            onClick={() => { setShowForm((v) => !v); setSubmitError(null); }}
            className={cn(
              "flex items-center gap-1.5 px-4 h-9 rounded-xl text-sm font-semibold transition-colors touch-manipulation",
              showForm
                ? "bg-muted text-muted-foreground"
                : "bg-amber-500 text-white hover:bg-amber-600 active:scale-95"
            )}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Schließen" : "Neu"}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3 max-w-2xl mx-auto">

        {/* ── Submit form ─────────────────────────────────────────────────── */}
        {showForm && (
          <div className="bg-card border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 pt-4 pb-3 border-b border-border/50">
              <p className="text-sm font-semibold text-foreground mb-3">Was möchtest du melden?</p>
              {/* Type selector */}
              <div className="grid grid-cols-3 gap-2">
                {(["bug", "feature", "other"] as FeedbackType[]).map((t) => {
                  const m = TYPE_META[t];
                  const active = formType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all touch-manipulation",
                        active
                          ? `${m.bg} ${m.text} ${m.border} ring-2 ring-offset-1 ring-current`
                          : "border-border text-muted-foreground hover:border-border/80 bg-background"
                      )}
                    >
                      <span className={active ? m.text : "text-muted-foreground"}>{m.icon}</span>
                      <span className="text-[11px] font-semibold leading-tight">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2.5">
              {/* Title */}
              <div>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value.slice(0, 120))}
                  placeholder="Kurze Beschreibung *"
                  className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent touch-manipulation"
                />
                <p className={cn("text-[10px] mt-1 text-right transition-colors", formTitle.length > 100 ? "text-amber-600" : "text-muted-foreground")}>
                  {formTitle.length}/120
                </p>
              </div>
              {/* Message */}
              <textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Details, Schritte, Screenshot-Beschreibung… (optional)"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none touch-manipulation"
              />
              {submitError && (
                <p role="alert" className="text-xs text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {submitError}
                </p>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || formTitle.trim().length < 3}
                className="h-11 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-50 touch-manipulation"
              >
                {submitting ? "Wird gesendet…" : "Absenden"}
              </button>
            </div>
          </div>
        )}

        {/* ── Filter chips ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none -mx-4 px-4">
          {([
            ["all",     "Alle",            counts.all],
            ["bug",     "Bugs",            counts.bug],
            ["feature", "Features",        counts.feature],
            ["other",   "Sonstiges",       counts.other],
            ["mine",    "Meine",           counts.mine],
          ] as [Filter, string, number][]).map(([f, label, count]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold transition-colors touch-manipulation",
                filter === f
                  ? "bg-[#1E2A3A] text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              <span className={cn("text-[10px] font-bold tabular-nums", filter === f ? "opacity-70" : "opacity-50")}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* ── List ─────────────────────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-1">
              <MessageSquare size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {filter === "mine" ? "Du hast noch kein Feedback eingereicht" : "Keine Einträge"}
            </p>
            <p className="text-xs text-muted-foreground">
              {filter === "mine"
                ? "Tippe auf \u201eNeu\u201c um einen Bug oder Wunsch zu melden."
                : "Ändere den Filter oder erstelle den ersten Eintrag."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((item) => {
              const tm = TYPE_META[item.type];
              const sm = STATUS_META[item.status];
              const isExpanded = expandedId === item.id;
              const isOwn = item.user_id === userId;
              const isNew = item.id === justSubmittedId;
              const isAdminEdit = adminEditId === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "bg-card rounded-2xl border overflow-hidden transition-all",
                    isNew ? "border-amber-300 ring-2 ring-amber-200" : isOwn ? "border-border/80" : "border-border"
                  )}
                >
                  {/* Main tap row */}
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : item.id);
                      if (isAdminEdit) { setAdminEditId(null); setAdminNote(""); }
                    }}
                    className="w-full px-4 py-3.5 text-left flex items-center gap-3 touch-manipulation active:bg-muted/50 transition-colors"
                  >
                    {/* Type icon pill */}
                    <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border", tm.bg, tm.text, tm.border)}>
                      {tm.icon}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        @{item.username} · {formatDate(item.created_at)}
                        {isOwn && <span className="ml-1.5 text-amber-600 font-semibold">· Du</span>}
                      </p>
                    </div>

                    {/* Status badge + chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", sm.bg, sm.text)}>
                        {sm.icon} {sm.label}
                      </span>
                      <ChevronDown
                        size={15}
                        className={cn("text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")}
                      />
                    </div>
                  </button>

                  {/* Expanded content — CSS grid animation */}
                  <div className={cn("grid transition-all duration-250 ease-out", isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="overflow-hidden">
                      <div className="border-t border-border/50 px-4 py-3 flex flex-col gap-3">

                        {/* Message */}
                        {item.message ? (
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.message}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Keine weiteren Details angegeben.</p>
                        )}

                        {/* Admin note — visible to all when status != open */}
                        {item.admin_note && item.status !== "open" && (
                          <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                            <ShieldCheck size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Status-Update</p>
                              <p className="text-xs text-amber-900 leading-relaxed">{item.admin_note}</p>
                            </div>
                          </div>
                        )}

                        {/* Admin controls — only for admin, only when expanded */}
                        {isAdmin && (
                          <div className="border-t border-border/50 pt-3">
                            {!isAdminEdit ? (
                              <button
                                onClick={() => { setAdminEditId(item.id); setAdminNote(item.admin_note ?? ""); }}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                              >
                                <ShieldCheck size={12} />
                                Status bearbeiten
                              </button>
                            ) : (
                              <div className="flex flex-col gap-2.5">
                                {/* Quick status buttons — tap to immediately save */}
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status setzen:</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {(["open", "in_progress", "done"] as FeedbackStatus[]).map((s) => {
                                    const sm2 = STATUS_META[s];
                                    const isCurrent = item.status === s;
                                    return (
                                      <button
                                        key={s}
                                        disabled={adminSaving}
                                        onClick={() => handleStatusChange(item.id, s)}
                                        className={cn(
                                          "flex items-center justify-center gap-1 h-9 rounded-xl text-[11px] font-semibold border transition-all touch-manipulation",
                                          isCurrent
                                            ? `${sm2.bg} ${sm2.text} border-current ring-2 ring-offset-1 ring-current`
                                            : `${sm2.bg} ${sm2.text} border-transparent opacity-60 hover:opacity-100`
                                        )}
                                      >
                                        {sm2.icon} {sm2.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* Optional note */}
                                <textarea
                                  value={adminNote}
                                  onChange={(e) => setAdminNote(e.target.value)}
                                  placeholder="Notiz für den Nutzer (optional) — wird beim nächsten Status-Klick gespeichert"
                                  rows={2}
                                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none touch-manipulation"
                                />
                                <button
                                  onClick={() => { setAdminEditId(null); setAdminNote(""); }}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
                                >
                                  Abbrechen
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {feedback.length > 0 && (
          <p className="text-center text-[11px] text-muted-foreground py-3">
            Nur du als Admin kannst den Status setzen · Alle Nutzer sehen alle Einträge
          </p>
        )}
      </div>
    </div>
  );
}
