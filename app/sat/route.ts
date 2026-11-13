import { readFile } from "node:fs/promises";
import path from "node:path";
import { adminSession } from "@/lib/admin";
import { satToken } from "@/lib/satToken";

// SAT practice (Rudimentary Intelligence), admins only. It's a standalone page, so it's served as-is
// rather than through a layout; its question data lives in public/sat-bank/data (College Board's free bank),
// which on AWS needs the "sat" cookie set here (see lib/satToken.ts).
export async function GET(req: Request) {
    if (!(await adminSession())) return Response.redirect(new URL("/profile", req.url));
    const html = await readFile(path.join(process.cwd(), "app/sat/index.html"), "utf8");
    const cookie = `sat=${satToken(process.env.BETTER_AUTH_SECRET ?? "")}; Path=/sat-bank; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "set-cookie": cookie } });
}
