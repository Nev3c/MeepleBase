"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, Users, Clock, Star, ExternalLink, Trash2,
  Edit2, Check, X, Plus, Camera, FileText, BookOpen,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { translateCategories, translateMechanics } from "@/lib/bgg-translations";
import type { Game, UserGame, GameStatus, GameNote, NoteType } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserGameImage {
  id: string;
  url: string;
  label: string | null;
  storage_path: string;
}

const STATUS_OPTIONS: { value: GameStatus; label: string }[] = [
  { value: "owned",            label: "Im Besitz" },
  { value: "wishlist",         label: "Wunschliste" },
  { value: "want_to_play",     label: "Möchte spielen" },
  { value: "for_trade",        label: "Zum Tausch" },
  { value: "previously_owned", label: "Ehemals besessen" },
];

const STATUS_COLORS: Record<GameStatus, string> = {
  owned:            "bg-emerald-100 text-emerald-800",
  wishlist:         "bg-violet-100 text-violet-800",
  want_to_play:     "bg-sky-100 text-sky-800",
  for_trade:        "bg-orange-100 text-orange-800",
  previously_owned: "bg-slate-100 text-slate-600",
};

interface GameDetailClientProps {
  game: Game;
  userGame: UserGame | null;
  initialNotes?: GameNote[];
  initialImages?: UserGameImage[];
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GameDetailClient({ game, userGame, initialNotes = [], initialImages = [] }: GameDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<GameStatus>(userGame?.status ?? "owned");
  const [editingStatus, setEditingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notes, setNotes] = useState<GameNote[]>(initialNotes);
  const [images, setImages] = useState<UserGameImage[]>(initialImages);

  const categories = translateCategories(game.categories);
  const mechanics = translateMechanics(game.mechanics);

  async function handleStatusSave(newStatus: GameStatus) {
    if (!userGame) return;
    setSaving(true);
    try {
      await fetch(`/api/user-games/${userGame.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
    } finally {
      setSaving(false);
      setEditingStatus(false);
    }
  }

  async function handleDelete() {
    if (!userGame) return;
    setDeleting(true);
    const res = await fetch(`/api/user-games/${userGame.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/library");
      router.refresh();
    } else {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  const hasMeta = game.min_players || game.max_players || game.min_playtime || game.max_playtime;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Hero */}
      <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
        {game.image_url || game.thumbnail_url ? (
          <Image
            src={(game.image_url ?? game.thumbnail_url)!}
            alt={game.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <PlaceholderHero name={game.name} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md"
          aria-label="Zurück"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-12 pt-4 relative z-10">
        {/* Title */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground leading-tight">{game.name}</h1>
          {game.year_published && <p className="text-muted-foreground text-sm mt-0.5">{game.year_published}</p>}
        </div>

        {/* Status */}
        {userGame && (
          <div className="flex items-center gap-2">
            {editingStatus ? (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusSave(opt.value)}
                      disabled={saving}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        status === opt.value ? "bg-amber-500 text-white" : "bg-muted text-foreground hover:bg-muted/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setEditingStatus(false)} className="self-start text-xs text-muted-foreground flex items-center gap-1">
                  <X size={12} /> Abbrechen
                </button>
              </div>
            ) : (
              <>
                <span className={cn("px-3 py-1 rounded-full text-sm font-medium", STATUS_COLORS[status])}>
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label}
                </span>
                <button
                  onClick={() => setEditingStatus(true)}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Status ändern"
                >
                  <Edit2 size={13} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Meta */}
        {hasMeta && (
          <div className="flex flex-wrap gap-2">
            {(game.min_players || game.max_players) && (
              <Stat icon={<Users size={14} />} label={formatPlayers(game.min_players, game.max_players)} />
            )}
            {(game.min_playtime || game.max_playtime) && (
              <Stat icon={<Clock size={14} />} label={formatTime(game.min_playtime, game.max_playtime)} />
            )}
            {game.complexity != null && (
              <Stat icon={<Star size={14} />} label={`${game.complexity.toFixed(1)} / 5`} sublabel="Komplexität" />
            )}
            {game.rating_avg != null && (
              <Stat icon={<Star size={14} className="text-amber-500" />} label={game.rating_avg.toFixed(1)} sublabel="BGG-Wertung" />
            )}
          </div>
        )}

        {/* Description */}
        {game.description && <ExpandableDescription text={game.description} />}

        {/* Categories + Mechanics */}
        {(categories.length > 0 || mechanics.length > 0) && (
          <section className="flex flex-col gap-3">
            {categories.length > 0 && (
              <TagRow label="Kategorien" tags={categories} color="amber" />
            )}
            {mechanics.length > 0 && (
              <TagRow label="Mechanismen" tags={mechanics.slice(0, 10)} color="slate" />
            )}
          </section>
        )}

        {/* Designers */}
        {game.designers && game.designers.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Designer</p>
            <p className="text-sm text-foreground">{game.designers.join(", ")}</p>
          </section>
        )}

        {/* ── Eigene Bilder ─────────────────────────────────────────────────── */}
        <OwnImagesSection gameId={game.id} images={images} setImages={setImages} />

        {/* ── Hausregeln ────────────────────────────────────────────────────── */}
        <NoteSection
          gameId={game.id}
          noteType="house_rules"
          title="Hausregeln"
          icon={<BookOpen size={15} />}
          placeholder="Eigene Regeländerungen, Varianten oder Hausregeln notieren…"
          notes={notes.filter((n) => n.note_type === "house_rules")}
          setNotes={setNotes}
        />

        {/* ── Notizen ───────────────────────────────────────────────────────── */}
        <NoteSection
          gameId={game.id}
          noteType="general"
          title="Notizen"
          icon={<FileText size={15} />}
          placeholder="Strategie-Hinweise, Links, Erinnerungen…"
          notes={notes.filter((n) => n.note_type === "general")}
          setNotes={setNotes}
        />

        {/* ── Mit wem gespielt ──────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<Users size={15} />} title="Mit wem gespielt" />
          <div className="mt-2 bg-muted/40 rounded-xl px-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Wird automatisch aus deinen erfassten Partien befüllt.
            </p>
            <Link href="/plays" className="text-xs text-amber-600 font-medium mt-1 inline-block">
              Partie erfassen →
            </Link>
          </div>
        </section>

        {/* BGG Link */}
        <a
          href={`https://boardgamegeek.com/boardgame/${game.bgg_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-amber-600 font-medium"
        >
          <ExternalLink size={14} />
          Auf BoardGameGeek ansehen
        </a>

        {/* Delete */}
        {userGame && (
          <div className="mt-2 pt-4 border-t border-border">
            {deleteConfirm ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground font-medium">
                  &quot;{game.name}&quot; wirklich entfernen?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {deleting ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <Check size={14} />}
                    Ja, entfernen
                  </button>
                  <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-medium">
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
                Aus Bibliothek entfernen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Own Images Section ────────────────────────────────────────────────────────

interface UserGameImage2 {
  id: string;
  url: string;
  label: string | null;
  storage_path: string;
}

function OwnImagesSection({
  gameId, images, setImages,
}: {
  gameId: string;
  images: UserGameImage2[];
  setImages: React.Dispatch<React.SetStateAction<UserGameImage2[]>>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85);
      };
      img.src = url;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed, `${Date.now()}.jpg`);
      form.append("game_id", gameId);
      const res = await fetch("/api/game-images", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload fehlgeschlagen"); return; }
      setImages((prev) => [...prev, data]);
    } catch {
      setError("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/game-images/${id}`, { method: "DELETE" });
    setImages((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <section>
      <SectionHeader icon={<Camera size={15} />} title="Eigene Bilder" />
      <div className="mt-2 flex flex-col gap-2">
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
                <Image src={img.url} alt={img.label ?? "Spielbild"} fill className="object-cover" sizes="33vw" />
                <button
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Bild löschen"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border hover:border-amber-400 hover:bg-amber-50 transition-all text-sm text-muted-foreground hover:text-amber-700 disabled:opacity-50 self-start"
        >
          {uploading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <Plus size={14} />
          )}
          {uploading ? "Wird hochgeladen…" : "Bild hinzufügen"}
        </button>
        <p className="text-[11px] text-muted-foreground/70">Bilder werden vor dem Upload auf max. 1200 px komprimiert (JPEG 85%).</p>
      </div>
    </section>
  );
}

// ── Note Section ──────────────────────────────────────────────────────────────

function NoteSection({
  gameId, noteType, title, icon, placeholder, notes, setNotes,
}: {
  gameId: string;
  noteType: NoteType;
  title: string;
  icon: React.ReactNode;
  placeholder: string;
  notes: GameNote[];
  setNotes: React.Dispatch<React.SetStateAction<GameNote[]>>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!draftContent.trim()) { setAdding(false); return; }
    setSaving(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: gameId, note_type: noteType, title: "", content: draftContent.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setNotes((prev) => [data, ...prev]);
      setDraftContent("");
      setAdding(false);
    }
    setSaving(false);
  }

  async function handleUpdate(id: string, content: string) {
    setSaving(true);
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (res.ok) {
      setNotes((prev) => prev.map((n) => (n.id === id ? data : n)));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeader icon={icon} title={title} />
        {!adding && (
          <button
            onClick={() => { setAdding(true); setDraftContent(""); }}
            className="text-xs text-amber-600 font-medium flex items-center gap-1"
          >
            <Plus size={12} /> Hinzufügen
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {adding && (
          <NoteEditor
            value={draftContent}
            onChange={setDraftContent}
            placeholder={placeholder}
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
            saving={saving}
          />
        )}
        {notes.map((note) => (
          editingId === note.id ? (
            <NoteEditor
              key={note.id}
              value={draftContent}
              onChange={setDraftContent}
              placeholder={placeholder}
              onSave={() => handleUpdate(note.id, draftContent)}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          ) : (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => { setEditingId(note.id); setDraftContent(note.content ?? ""); }}
              onDelete={() => handleDelete(note.id)}
            />
          )
        ))}
        {notes.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-3">
            Noch keine {title}. Tippe auf &quot;Hinzufügen&quot;.
          </p>
        )}
      </div>
    </section>
  );
}

function NoteEditor({ value, onChange, placeholder, onSave, onCancel, saving }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex flex-col gap-2 bg-muted/30 rounded-xl p-3">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full text-sm bg-transparent resize-none focus:outline-none text-foreground placeholder:text-muted-foreground"
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold disabled:opacity-50"
        >
          <Check size={12} /> Speichern
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete }: { note: GameNote; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-muted/30 rounded-xl px-4 py-3 group">
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{note.content}</p>
      <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <Edit2 size={11} /> Bearbeiten
        </button>
        <button onClick={onDelete} className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1">
          <Trash2 size={11} /> Löschen
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function TagRow({ label, tags, color }: { label: string; tags: string[]; color: "amber" | "slate" }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full font-medium",
              color === "amber" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 300;
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-2">Beschreibung</h2>
      <p className={cn("text-sm text-muted-foreground leading-relaxed", !expanded && isLong && "line-clamp-4")}>
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-amber-600 font-medium mt-1"
        >
          {expanded ? <><ChevronUp size={12} /> Weniger</> : <><ChevronDown size={12} /> Mehr lesen</>}
        </button>
      )}
    </section>
  );
}

function Stat({ icon, label, sublabel }: { icon: React.ReactNode; label: string; sublabel?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-xl">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-foreground leading-none">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

function PlaceholderHero({ name }: { name: string }) {
  const hue = name.charCodeAt(0) % 360;
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: `hsl(${hue} 35% 35%)` }}>
      <span className="font-display font-bold text-white/20 text-8xl select-none">{name[0]?.toUpperCase()}</span>
    </div>
  );
}

function formatPlayers(min: number | null, max: number | null): string {
  if (min && max && min !== max) return `${min}–${max} Spieler`;
  if (min || max) return `${min ?? max} Spieler`;
  return "";
}

function formatTime(min: number | null, max: number | null): string {
  if (min && max && min !== max) return `${min}–${max} Min`;
  if (min || max) return `${min ?? max} Min`;
  return "";
}

