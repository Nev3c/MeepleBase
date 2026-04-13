import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "DEEPL_API_KEY nicht konfiguriert" }, { status: 503 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: games, error } = await supabase
    .from("games")
    .select("id, description")
    .not("description", "is", null)
    .is("description_de", null)
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!games || games.length === 0) return NextResponse.json({ translated: 0, message: "Alle Beschreibungen bereits übersetzt." });

  let translated = 0;
  let errors = 0;

  for (const game of games) {
    if (!game.description) continue;
    const text = (game.description as string).slice(0, 4500);
    try {
      const res = await fetch("https://api-free.deepl.com/v2/translate", {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [text], target_lang: "DE", source_lang: "EN" }),
      });
      if (res.ok) {
        const deeplData = await res.json() as { translations: Array<{ text: string }> };
        const description_de = deeplData.translations?.[0]?.text ?? null;
        if (description_de) {
          await supabase.from("games").update({ description_de }).eq("id", game.id);
          translated++;
        }
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({ translated, errors, total: games.length });
}
