/**
 * POST /api/play-images
 * Uploads a play photo to Supabase Storage (bucket: play-images).
 * Returns { url: string }.
 *
 * Required Supabase setup (run once in SQL Editor):
 *   -- Storage bucket (Dashboard → Storage → New bucket):
 *   Name: play-images, Public: true, File size limit: 10MB
 *
 *   -- Add column to plays table if not exists:
 *   ALTER TABLE plays ADD COLUMN IF NOT EXISTS image_url TEXT;
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = cookies();

  // Anon client for auth check (cookie-based session)
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file ist erforderlich" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Foto zu groß (max. 5 MB). Bitte ein kleineres Bild wählen." }, { status: 400 });
  }

  // Use direct supabase-js admin client for storage — avoids SSR cookie issues with service_role
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${user.id}/${Date.now()}.${ext}`;

  try {
    const { error: uploadError } = await admin.storage
      .from("play-images")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from("play-images").getPublicUrl(fileName);
    return NextResponse.json({ url: urlData.publicUrl }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
