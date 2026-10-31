"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import Inbox from "@/lib/InboxModel";
import Post from "@/lib/PostModel";

const MAX = 20000; // characters per text, so nobody can fill the database with one request

async function signedIn() {
    const session = await (await initAuth()).api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");
    return { name: session.user.name, email: session.user.email };
}

async function admin() {
    const user = await signedIn();
    if (!ADMIN_EMAILS.includes(user.email)) throw new Error("Unauthorized");
}

const text = (s: unknown) => (typeof s === "string" ? s.slice(0, MAX) : "");

export async function sendMessage(message: string) {
    const from = await signedIn();
    const body = text(message);
    if (!body.trim()) throw new Error("Empty message");
    await dbConnect();
    await Inbox.create({ kind: "message", ...from, content: [body] });
}

// Same shape postBlog takes, so the post form can send it
export async function requestBlog(post: { title: string; content: string[] }) {
    const from = await signedIn();
    const title = text(post?.title).slice(0, 300);
    const content = Array.isArray(post?.content) ? post.content.slice(0, 100).map(text).filter((p) => p.trim()) : [];
    if (!title.trim() || !content.length) throw new Error("Empty post");
    await dbConnect();
    await Inbox.create({ kind: "blog", ...from, title, content });
    revalidatePath("/profile");
}

// Admins: publish a requested blog as a post, or turn it down. Either way it leaves the review list.
export async function reviewBlog(requestId: string, approve: boolean) {
    await admin();
    await dbConnect();
    const request = await Inbox.findOneAndDelete({ _id: String(requestId), kind: "blog" });
    if (request && approve) {
        await Post.create({ id: crypto.randomUUID(), date: new Date(), title: request.title, content: request.content });
        revalidatePath("/blogs");
    }
    revalidatePath("/profile");
}
