import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies();
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
  const storageClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data: img } = await anonClient
    .from("user_game_images")
    .select("storage_path")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!img) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await storageClient.storage.from("game-images").remove([img.storage_path]);
  await anonClient.from("user_game_images").delete().eq("id", params.id);

  return NextResponse.json({ success: true });
}
