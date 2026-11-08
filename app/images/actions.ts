"use server";

import { headers } from "next/headers";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import Image from "@/lib/ImageModel";

const TYPES = ["image/webp", "image/jpeg", "image/png"]; // no SVG: it can carry scripts

// Admins: store an image and get back its id (shown at /images/<id>)
export async function uploadImage(form: FormData) {
    const session = await (await initAuth()).api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session.user.email)) throw new Error("Unauthorized");
    const file = form.get("image");
    if (!(file instanceof File) || !TYPES.includes(file.type)) throw new Error("Not an image");
    if (file.size > 1_000_000) throw new Error("Image too large");
    await dbConnect();
    const saved = await Image.create({ data: Buffer.from(await file.arrayBuffer()), type: file.type });
    return String(saved._id);
}
