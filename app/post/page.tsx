
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import { headers } from "next/headers";
import { postBlog } from "./actions";
import { redirect } from "next/navigation";
import PostForm from "@/components/PostForm";

async function Page() {
    const auth = await initAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    // replace w/ own email address
    if (!session || !ADMIN_EMAILS.includes(session.user.email)) redirect("/");

    return(
        <main>
            <div className="max-w-2xl mx-auto">
                <h1 className="mt-3 text-4xl font-bold">New post</h1>
                <PostForm postBlog={postBlog} />
            </div>
        </main>
    );
}

export default Page;