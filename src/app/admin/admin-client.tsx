"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, RefreshCw, Shield, Trash2 } from "lucide-react";

interface UserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string;
  created_at: string;
  approved: boolean | null;
}

export function AdminClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [requireApproval, setRequireApproval] = useState<boolean | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // userId pending delete

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json() as { users: UserRow[] };
      setUsers(data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchUsers();
    // Read require_approval from server env via a simple meta endpoint
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((d: { requireApproval: boolean }) => setRequireApproval(d.requireApproval))
      .catch(() => {});
  }, [fetchUsers]);

  async function setApproved(userId: string, approved: boolean) {
    setActing(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, approved }),
    });
    await fetchUsers();
    setActing(null);
  }

  async function deleteUser(userId: string) {
    setActing(userId);
    setDeleteConfirm(null);
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await fetchUsers();
    setActing(null);
  }

  // Pending = approved is explicitly false OR null (never decided).
  // approved===true → user is approved.
  // This handles legacy users who slipped through the /auth/callback init when
  // REQUIRE_APPROVAL was off, plus users who auto-confirmed (skip callback).
  const pending  = users.filter((u) => u.approved !== true);
  const approved = users.filter((u) => u.approved === true);

  return (
    <div className="flex flex-col min-h-dvh bg-[#FDFAF6] px-4 py-8 max-w-xl mx-auto gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Shield size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-[#1E2A3A]">Admin</h1>
          <p className="text-xs text-muted-foreground">MeepleBase Nutzerverwaltung</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="ml-auto w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Status-Banner */}
      {requireApproval !== null && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${requireApproval ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-emerald-50 border border-emerald-200 text-emerald-800"}`}>
          {requireApproval
            ? "🔒 Freigabe-Pflicht aktiv — neue User müssen manuell genehmigt werden."
            : "🔓 Offene Registrierung — neue User haben automatisch Zugang."}
          <p className="text-xs font-normal mt-1 opacity-70">
            {requireApproval ? "Zum Deaktivieren: REQUIRE_APPROVAL=false in .env setzen." : "Zum Aktivieren: REQUIRE_APPROVAL=true in .env setzen."}
          </p>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ausstehend ({pending.length})
          </h2>
          {pending.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              acting={acting === u.id}
              onApprove={() => setApproved(u.id, true)}
              onReject={() => setApproved(u.id, false)}
              onDelete={() => setDeleteConfirm(u.id)}
              isPending
            />
          ))}
        </section>
      )}

      {pending.length === 0 && !loading && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-700 text-center">
          Keine ausstehenden Freigaben ✓
        </div>
      )}

      {/* All users */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Alle User ({approved.length})
        </h2>
        {approved.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            acting={acting === u.id}
            onApprove={() => setApproved(u.id, true)}
            onReject={() => setApproved(u.id, false)}
            onDelete={() => setDeleteConfirm(u.id)}
            isPending={false}
          />
        ))}
      </section>

      {/* Delete confirm modal */}
      {deleteConfirm && (() => {
        const u = users.find((x) => x.id === deleteConfirm);
        const name = u?.display_name ?? u?.username ?? u?.email.split("@")[0] ?? "?";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-xl flex flex-col gap-4">
              <div>
                <p className="font-display text-lg font-semibold text-foreground">User löschen?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">{name}</span> wird dauerhaft gelöscht.
                  Bibliothek, Partien und alle Daten werden entfernt. Das kann nicht rückgängig gemacht werden.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 h-10 rounded-xl border border-border bg-muted text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => deleteUser(deleteConfirm)}
                  disabled={acting === deleteConfirm}
                  className="flex-1 h-10 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {acting === deleteConfirm ? "Löschen…" : "Ja, löschen"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function UserCard({
  user, acting, onApprove, onReject, onDelete, isPending,
}: {
  user: UserRow;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const name = user.display_name ?? user.username ?? user.email.split("@")[0];
  const date = new Date(user.created_at).toLocaleDateString("de-DE", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div className={`bg-white rounded-2xl border shadow-sm px-4 py-3 flex items-center gap-3 ${isPending ? "border-amber-200" : "border-border"}`}>
      {/* Avatar placeholder */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isPending ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
        {name[0]?.toUpperCase() ?? "?"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{date}</p>
      </div>

      {/* Actions */}
      {isPending ? (
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onApprove}
            disabled={acting}
            className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            title="Freigeben"
          >
            <Check size={16} />
          </button>
          <button
            onClick={onReject}
            disabled={acting}
            className="w-9 h-9 rounded-xl bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 disabled:opacity-50 transition-colors"
            title="Ablehnen"
          >
            <X size={16} />
          </button>
          <button
            onClick={onDelete}
            disabled={acting}
            className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 disabled:opacity-50 transition-colors"
            title="User löschen"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onReject}
            disabled={acting}
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
            title="Zugang entziehen"
          >
            Sperren
          </button>
          <button
            onClick={onDelete}
            disabled={acting}
            className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 hover:text-red-600 disabled:opacity-50 transition-colors"
            title="User löschen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
