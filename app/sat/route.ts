import { readFile } from "node:fs/promises";
import path from "node:path";
import { adminSession } from "@/lib/admin";

// SAT practice (Rudimentary Intelligence), admins only. It's a standalone page, so it's served as-is
// rather than through a layout; its question data lives in public/sat/data (College Board's free bank).
export async function GET(req: Request) {
    if (!(await adminSession())) return Response.redirect(new URL("/profile", req.url));
    const html = await readFile(path.join(process.cwd(), "app/sat/index.html"), "utf8");
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
}
