import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET  /api/admin/users        → alle User mit approved=false (pending)
// PATCH /api/admin/users       → { userId, approved: true|false }

function isAdmin(email: string | undefined) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}

export async function GET() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin
    .from("profiles")
    .select("id, username, display_name, created_at, approved")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hole E-Mails aus auth.users via service role
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  if (authUsers) {
    for (const u of authUsers.users) {
      emailMap[u.id] = u.email ?? "";
    }
  }

  const users = (data ?? []).map((p) => ({
    ...p,
    email: emailMap[p.id] ?? "",
  }));

  // Sortierung: pending zuerst
  users.sort((a, b) => {
    if (a.approved === false && b.approved !== false) return -1;
    if (a.approved !== false && b.approved === false) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json({ users });
}

export async function DELETE(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = await request.json() as { userId: string };
  if (!body.userId) {
    return NextResponse.json({ error: "userId erforderlich" }, { status: 400 });
  }

  // Prevent self-deletion
  if (body.userId === user.id) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst löschen." }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Delete from auth (cascades to profiles via FK if set, otherwise profile stays — clean up manually)
  const { error } = await admin.auth.admin.deleteUser(body.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also delete profile row (in case ON DELETE CASCADE is not set)
  await admin.from("profiles").delete().eq("id", body.userId);

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = await request.json() as { userId: string; approved: boolean };
  if (!body.userId || typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "userId + approved erforderlich" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin
    .from("profiles")
    .update({ approved: body.approved })
    .eq("id", body.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
