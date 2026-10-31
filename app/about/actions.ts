"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import About from "@/lib/AboutModel";

export async function saveAbout(title: string, body: string) {
    const session = await (await initAuth()).api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session.user.email)) throw new Error("Unauthorized");
    if (typeof title !== "string" || typeof body !== "string") throw new Error("Bad input");
    await dbConnect();
    await About.findOneAndUpdate({}, { title: title.slice(0, 300), body: body.slice(0, 20000) }, { upsert: true });
    revalidatePath("/about");
}
