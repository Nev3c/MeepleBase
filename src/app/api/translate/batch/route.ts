import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Batch-translate game descriptions using MyMemory (free, no key needed).
// MyMemory limit: 500 chars per request. We chunk long descriptions.
// Set MYMEMORY_EMAIL env var (free account) to raise limit to 30 000 chars/day.
// POST /api/translate/batch  →  { translated, errors, total }

async function translateChunk(text: string, email: string): Promise<string> {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text.slice(0, 500));
  url.searchParams.set("langpair", "en|de");
  if (email) url.searchParams.set("de", email);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`MyMemory ${res.status}`);
  const data = await res.json() as { responseData?: { translatedText?: string } };
  return data.responseData?.translatedText ?? text;
}

export async function POST() {
  const email = process.env.MYMEMORY_EMAIL ?? "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: games, error } = await supabase
    .from("games")
    .select("id, description")
    .not("description", "is", null)
    .is("description_de", null)
    .limit(20); // Stay well within daily limits

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!games || games.length === 0) {
    return NextResponse.json({ translated: 0, message: "Alle Beschreibungen bereits übersetzt." });
  }

  let translated = 0;
  let errors = 0;

  for (const game of games) {
    if (!game.description) continue;
    try {
      // Take first 500 chars (enough for a useful summary)
      const description_de = await translateChunk(game.description as string, email);
      await supabase.from("games").update({ description_de }).eq("id", game.id);
      translated++;
    } catch {
      errors++;
    }
    // Respect rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ translated, errors, total: games.length });
}
