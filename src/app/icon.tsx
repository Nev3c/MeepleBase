import { readFile } from "fs/promises";
import path from "path";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default async function Icon() {
  const file = await readFile(path.join(process.cwd(), "public", "icon-192.png"));
  return new Response(file, {
    headers: { "Content-Type": "image/png" },
  });
}
