import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Batch-translate game descriptions using Google Translate (unofficial gtx endpoint).
// No API key, no account required. ~500 chars per call, 300ms delay between calls.
// GET  /api/translate/batch  →  { pending: number }
// POST /api/translate/batch  →  { translated, errors, names, remaining, done }

async function translateText(text: string): Promise<string> {
  const encoded = encodeURIComponent(text.slice(0, 500));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=de&dt=t&q=${encoded}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
  const data = await res.json() as unknown[][];
  const parts = (data[0] as unknown[][]) ?? [];
  return parts.map((p) => (p as unknown[])[0] as string).filter(Boolean).join("");
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET – how many games still need translation
export async function GET() {
  const supabase = serviceClient();
  const { count, error } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .not("description", "is", null)
    .is("description_de", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pending: count ?? 0 });
}

// POST – translate next batch of 20
export async function POST() {
  const supabase = serviceClient();

  const { data: games, error } = await supabase
    .from("games")
    .select("id, name, description")
    .not("description", "is", null)
    .is("description_de", null)
    .order("name")
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!games || games.length === 0) {
    return NextResponse.json({ translated: 0, errors: 0, names: [], remaining: 0, done: true });
  }

  let translated = 0;
  let errors = 0;
  const names: string[] = [];

  for (const game of games) {
    if (!game.description) continue;
    try {
      const description_de = await translateText(game.description as string);
      await supabase.from("games").update({ description_de }).eq("id", game.id);
      translated++;
      names.push(game.name as string);
    } catch {
      errors++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Count how many are still pending after this batch
  const { count: remaining } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .not("description", "is", null)
    .is("description_de", null);

  return NextResponse.json({
    translated,
    errors,
    names,
    remaining: remaining ?? 0,
    done: (remaining ?? 0) === 0,
  });
}
