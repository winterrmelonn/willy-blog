"use server";

import { headers } from "next/headers";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import WardrobeItem, { CATEGORIES } from "@/lib/WardrobeModel";

export type Category = (typeof CATEGORIES)[number];
export type Item = {
    id: string; code: string; name: string; cat: Category; brand: string; size: string;
    color: string; value: number; notes: string; added: number;
};
export type ItemInput = Omit<Item, "id" | "code" | "added"> & { id?: string };

type Doc = { _id: unknown; seq: number; name: string; cat: Category; brand?: string; size?: string; color?: string; value?: number; notes?: string; createdAt: Date };

const toItem = (d: Doc): Item => ({
    id: String(d._id), code: `RI-${d.cat}-${String(d.seq).padStart(4, "0")}`, name: d.name, cat: d.cat,
    brand: d.brand ?? "", size: d.size ?? "", color: d.color ?? "#888888", value: d.value ?? 0, notes: d.notes ?? "",
    added: new Date(d.createdAt).getTime(),
});
const text = (s: unknown, max: number) => (typeof s === "string" ? s.slice(0, max).trim() : "");
const isId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{24}$/.test(id);

async function adminSession() {
    const session = await (await initAuth()).api.getSession({ headers: await headers() });
    return session && ADMIN_EMAILS.includes(session.user.email) ? session : null;
}

// The whole wardrobe and who's signed in, or null when the visitor isn't an admin. The page calls it on load,
// and the login screen calls it right after signing in. Returns null rather than throwing: in production
// Next hides a server action's error message from the browser.
export async function loadWardrobe(): Promise<{ operator: string; items: Item[] } | null> {
    const session = await adminSession();
    if (!session) return null;
    await dbConnect();
    const docs = await WardrobeItem.find().sort({ createdAt: -1 }).lean<Doc[]>();
    return { operator: session.user.name || session.user.email, items: docs.map(toItem) };
}

// Add an item (no id) or update one (with its id). Returns it as saved.
export async function saveItem(input: ItemInput): Promise<Item> {
    if (!(await adminSession())) throw new Error("Unauthorized");
    const name = text(input?.name, 60);
    if (!name) throw new Error("An item needs a name");
    const fields = {
        name,
        cat: (CATEGORIES as readonly string[]).includes(input.cat) ? input.cat : "TOP",
        brand: text(input.brand, 40),
        size: text(input.size, 10),
        color: typeof input.color === "string" && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#888888",
        value: Math.max(0, Math.min(1e7, Math.round(Number(input.value) || 0))),
        notes: text(input.notes, 300),
    };
    await dbConnect();
    if (input.id !== undefined) {
        if (!isId(input.id)) throw new Error("Not found");
        const doc = await WardrobeItem.findByIdAndUpdate(input.id, fields, { returnDocument: "after" }).lean<Doc>();
        if (!doc) throw new Error("Not found");
        return toItem(doc);
    }
    // ponytail: next number is the highest + 1; two adds in the same instant would clash on the unique index
    // and the second fails (single admin, so retry-on-conflict isn't worth it yet)
    const last = await WardrobeItem.findOne().sort({ seq: -1 }).select("seq").lean<{ seq: number }>();
    const doc = await WardrobeItem.create({ ...fields, seq: (last?.seq ?? 0) + 1 });
    return toItem(doc.toObject() as Doc);
}

export async function deleteItem(id: string) {
    if (!(await adminSession())) throw new Error("Unauthorized");
    if (!isId(id)) return;
    await dbConnect();
    await WardrobeItem.findByIdAndDelete(id);
}
