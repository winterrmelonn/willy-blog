import dbConnect from "@/lib/mongoose";
import { adminSession } from "@/lib/admin";

// One doc per admin: { _id: userId, att: { [questionId]: { c, n, t } } }
async function progress() {
    return (await dbConnect()).connection.db!.collection<{ _id: string; att: object }>("satprogress");
}

export async function GET() {
    const session = await adminSession();
    if (!session) return new Response(null, { status: 401 });
    const doc = await (await progress()).findOne({ _id: session.user.id });
    return Response.json({ att: doc?.att ?? {} });
}

export async function PUT(req: Request) {
    const session = await adminSession();
    if (!session) return new Response(null, { status: 401 });
    const body = await req.text();
    if (body.length > 1_000_000) return new Response(null, { status: 413 });
    let att: unknown;
    try { att = (JSON.parse(body) as { att?: unknown }).att; } catch { return new Response(null, { status: 400 }); }
    if (!att || typeof att !== "object" || Array.isArray(att)) return new Response(null, { status: 400 });
    await (await progress()).updateOne({ _id: session.user.id }, { $set: { att } }, { upsert: true });
    return new Response(null, { status: 204 });
}
