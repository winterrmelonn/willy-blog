import type { PostType } from "../post/actions";
import Post from "@/lib/PostModel";
import dbConnect from "@/lib/mongoose";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import PostMenu from "@/components/PostMenu";

async function Page() {
  await dbConnect();
  const allPosts = (await Post.find().sort({ date: -1 })) as PostType[];
  const session = await (await initAuth()).api.getSession({ headers: await headers() });
  const admin = !!session && ADMIN_EMAILS.includes(session.user.email);

  return (
    <main className="w-full max-w-xl mx-auto px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Blogs</h1>
      {allPosts.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {allPosts.map((post) => (
            // a bubble per post; the whole bubble opens the post (the title link stretches over it)
            <li key={post.id} className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 pr-12 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-950">
              <div className="flex items-baseline gap-1.5">
                <Link href={`/blogs/${post.id}`} className="font-bold after:absolute after:inset-0 after:rounded-2xl">
                  {post.title}
                </Link>
                <span className="shrink-0 text-sm text-zinc-500">
                  · {post.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[15px] leading-snug">{post.content.join("\n\n")}</p>
              {admin && <PostMenu id={post.id} title={post.title} />}
            </li>
          ))}
        </ul>
      ) : (
        <Link href="/post">No blogs yet, create one here!</Link>
      )}
    </main>
  );
}

export default Page;
