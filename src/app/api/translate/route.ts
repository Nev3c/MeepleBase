import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "DEEPL_API_KEY nicht konfiguriert" }, { status: 503 });

  const { text, target_lang = "DE" } = await req.json();
  if (!text) return NextResponse.json({ error: "text ist erforderlich" }, { status: 400 });

  const res = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text], target_lang, source_lang: "EN" }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const translated = (data.translations as Array<{ text: string }> | undefined)?.[0]?.text ?? "";
  return NextResponse.json({ translated });
}
