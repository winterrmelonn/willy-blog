
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
        <div>
            <h1>Create Blog</h1>
            <PostForm postBlog={postBlog} />
        </div>
    );
}

export default Page;