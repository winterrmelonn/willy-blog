"use server";

import Post from "@/lib/PostModel";
import dbConnect from "@/lib/mongoose";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import { headers } from "next/headers";

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

    /* try {
        await dbConnect();
        const newPost = await Post.create(post);
        console.log(newPost);
        } catch (error) {
            console.error("Error:" + error);
        }
    */
}