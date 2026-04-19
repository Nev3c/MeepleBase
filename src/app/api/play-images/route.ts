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
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = cookies();

  // Service role client for storage upload
  const storageClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // Anon client for auth check
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

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${user.id}/${Date.now()}.${ext}`;

  // Ensure bucket exists (auto-create on first use)
  const { data: buckets } = await storageClient.storage.listBuckets();
  const bucketExists = (buckets ?? []).some((b) => b.name === "play-images");
  if (!bucketExists) {
    const { error: createErr } = await storageClient.storage.createBucket("play-images", {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    if (createErr) {
      return NextResponse.json({ error: `Bucket konnte nicht erstellt werden: ${createErr.message}` }, { status: 500 });
    }
  }

  const { error: uploadError } = await storageClient.storage
    .from("play-images")
    .upload(fileName, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = storageClient.storage.from("play-images").getPublicUrl(fileName);
  return NextResponse.json({ url: urlData.publicUrl }, { status: 201 });
}
