import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/feedback — alle Einträge (neueste zuerst)
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/feedback — neues Feedback einreichen
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as { type?: string; title?: string; message?: string };
  const { type, title, message } = body;

  if (!type || !["bug", "feature", "other"].includes(type)) {
    return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
  }
  if (!title || title.trim().length < 3) {
    return NextResponse.json({ error: "Titel zu kurz (mind. 3 Zeichen)" }, { status: 400 });
  }
  if (title.trim().length > 120) {
    return NextResponse.json({ error: "Titel zu lang (max. 120 Zeichen)" }, { status: 400 });
  }

  // Username aus Profile laden
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      user_id: user.id,
      username: profile?.username ?? user.email?.split("@")[0] ?? "Anonym",
      type,
      title: title.trim(),
      message: message?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
