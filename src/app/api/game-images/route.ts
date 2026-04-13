/**
 * POST /api/game-images
 * Uploads a user's own game image to Supabase Storage.
 *
 * Required Supabase setup (run once in SQL Editor):
 *   CREATE TABLE user_game_images (
 *     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
 *     game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
 *     storage_path TEXT NOT NULL,
 *     url TEXT NOT NULL,
 *     label TEXT,
 *     sort_order INTEGER DEFAULT 0,
 *     created_at TIMESTAMPTZ DEFAULT now()
 *   );
 *   ALTER TABLE user_game_images ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Users manage own images" ON user_game_images
 *     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 *
 *   -- Storage bucket (Dashboard → Storage → New bucket):
 *   Name: game-images, Public: true, File size limit: 5MB
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role for storage
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
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
  const gameId = formData.get("game_id") as string | null;
  const label = (formData.get("label") as string | null) ?? null;

  if (!file || !gameId) {
    return NextResponse.json({ error: "file und game_id sind erforderlich" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei zu groß (max. 5 MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${user.id}/${gameId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("game-images")
    .upload(fileName, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(fileName);
  const url = urlData.publicUrl;

  const { data, error: dbError } = await anonClient
    .from("user_game_images")
    .insert({ user_id: user.id, game_id: gameId, storage_path: fileName, url, label })
    .select("*")
    .single();

  if (dbError) {
    await supabase.storage.from("game-images").remove([fileName]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ images: [] });

  const gameId = req.nextUrl.searchParams.get("game_id");
  if (!gameId) return NextResponse.json({ images: [] });

  const { data } = await supabase
    .from("user_game_images")
    .select("*")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .order("sort_order")
    .order("created_at");

  return NextResponse.json({ images: data ?? [] });
}
