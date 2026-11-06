import { readFile } from "node:fs/promises";
import path from "node:path";

// Keep the review document readable without authentication, cookies, or JavaScript.
// Drafts must not be served from a stale shared cache after review updates.
export const dynamic = "force-dynamic";
export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public/legal/privacy-review.html"), "utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
