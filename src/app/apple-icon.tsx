import { readFile } from "fs/promises";
import path from "path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const file = await readFile(path.join(process.cwd(), "public", "apple-touch-icon.png"));
  return new Response(file, {
    headers: { "Content-Type": "image/png" },
  });
}
