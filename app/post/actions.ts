"use server";

import Post from "@/lib/PostModel";
import dbConnect from "@/lib/mongoose";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isImageId, deleteUnusedImage } from "@/lib/ImageModel";

export interface PostType {
    id: string;
    date: Date;
    title: string;
    content: string[];
    image?: string;
}

export async function postBlog(post: PostType) {
    const auth = await initAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session?.user.email)) {
        throw new Error("Unauthorized");
    }
    if (post.image !== undefined && !isImageId(post.image)) throw new Error("Bad image");
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

// Admins: give a published post a cover image, or take it away (image undefined)
export async function setPostImage(id: string, image: string | undefined) {
    const auth = await initAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session.user.email)) throw new Error("Unauthorized");
    if (image !== undefined && !isImageId(image)) throw new Error("Bad image");
    await dbConnect();
    const old = await Post.findOneAndUpdate({ id: String(id) }, image ? { image } : { $unset: { image: 1 } });
    if (old?.image !== image) await deleteUnusedImage(old?.image);
    revalidatePath("/blogs");
    revalidatePath(`/blogs/${id}`);
}

export async function deletePost(id: string) {
    const auth = await initAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session.user.email)) {
        throw new Error("Unauthorized");
    }
    await dbConnect();
    const old = await Post.findOneAndDelete({ id });
    await deleteUnusedImage(old?.image);
    revalidatePath("/blogs");
}
