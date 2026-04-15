import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Batch-translate game descriptions using Google Translate (unofficial gtx endpoint).
// No API key, no account required. ~500 chars per call, 300ms delay between calls.
// POST /api/translate/batch  →  { translated, errors, total }

async function translateText(text: string): Promise<string> {
  const encoded = encodeURIComponent(text.slice(0, 500));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=de&dt=t&q=${encoded}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Translate ${res.status}`);
  // Response: [ [ ["translated","original",...], ... ], ... ]
  const data = await res.json() as unknown[][];
  const parts = (data[0] as unknown[][]) ?? [];
  return parts.map((p) => (p as unknown[])[0] as string).filter(Boolean).join("");
}

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: games, error } = await supabase
    .from("games")
    .select("id, description")
    .not("description", "is", null)
    .is("description_de", null)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!games || games.length === 0) {
    return NextResponse.json({ translated: 0, message: "Alle Beschreibungen bereits übersetzt." });
  }

  let translated = 0;
  let errors = 0;

  for (const game of games) {
    if (!game.description) continue;
    try {
      const description_de = await translateText(game.description as string);
      await supabase.from("games").update({ description_de }).eq("id", game.id);
      translated++;
    } catch {
      errors++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ translated, errors, total: games.length });
}
