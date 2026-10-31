"use server";

import Post from "@/lib/PostModel";
import dbConnect from "@/lib/mongoose";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export interface PostType {
    id: string;
    date: Date;
    title: string;
    content: string[];
}

export async function postBlog(post: PostType) {
    const auth = await initAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session?.user.email)) {
        throw new Error("Unauthorized");
    }
    await dbConnect();
    await Post.create(post);
    revalidatePath("/blogs"); // the list is cached (and prerendered on Vercel), so refresh it to show the new post

    /* try {
        await dbConnect();
        const newPost = await Post.create(post);
        console.log(newPost);
        } catch (error) {
            console.error("Error:" + error);
        }
    */
}

export async function deletePost(id: string) {
    const auth = await initAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session.user.email)) {
        throw new Error("Unauthorized");
    }
    await dbConnect();
    await Post.deleteOne({ id });
    revalidatePath("/blogs");
}
