import { NextRequest, NextResponse } from "next/server";

// MyMemory free translation API – no key required, 5000 chars/day anonymous,
// 30 000 chars/day with free account (set MYMEMORY_EMAIL env var)
export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: "text ist erforderlich" }, { status: 400 });

  const email = process.env.MYMEMORY_EMAIL ?? "";
  const truncated = (text as string).slice(0, 500); // MyMemory limit per request
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", truncated);
  url.searchParams.set("langpair", "en|de");
  if (email) url.searchParams.set("de", email);

  const res = await fetch(url.toString());
  if (!res.ok) return NextResponse.json({ error: "Übersetzung fehlgeschlagen" }, { status: 502 });

  const data = await res.json() as { responseData?: { translatedText?: string }; responseStatus?: number };
  const translated = data.responseData?.translatedText ?? "";
  return NextResponse.json({ translated });
}
