
import { postBlog } from "./actions";
  import { initAuth } from "@/lib/auth";
  import { headers } from "next/headers";
  import { redirect } from "next/navigation";
  import PostFrom from "@/components/PostForm";

async function Page() {
    const auth = await initAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    // replace w/ own email address
    if (!session || session.user.email !== "asherwandenreich@gmail.com") redirect("/");

    return(
        <div>
            <h1>Create Blog</h1>
            <PostFrom postBlog={postBlog} />
        </div>
    );
}

export default Page;