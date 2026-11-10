import type { PostType } from "../post/actions";
import Post from "@/lib/PostModel";
import About from "@/lib/AboutModel";
import dbConnect from "@/lib/mongoose";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import PostMenu from "@/components/PostMenu";
import Cover from "@/components/Cover";
import AboutEditor from "@/components/AboutEditor";
import RiverBackground from "@/components/RiverBackground";
import "./timeline.css";

// shown until an admin saves their own version
const DEFAULT = {
  title: "Hi, I’m Will.",
  body: "I’m currently a senior in high school. I hope to study an engineering field at any UC that’ll take me. I would love to do either Aerospace Engineering or Bioengineering, at UCLA and UCSD respectively. All engineering majors need to know how to code, so I’ve gotten wrapped up in Hack Club and its community recently. I have high hopes for my first real project: this blog.",
};
// how far each row of posts leans left or right, so the river between them winds (timeline.css)
const SHIFTS = [["-2.5vw", "0px"], ["3vw", "2vw"], ["-3vw", "-1vw"], ["2.5vw", "1.5vw"]];
const frost = "rounded-2xl bg-white/60 dark:bg-black/45 backdrop-blur-md";
const pill = "inline-block rounded-full px-5 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-80 [text-shadow:none]";

// A bubble per post; the whole bubble opens the post (the title link stretches over it)
function PostCard({ post, admin, side }: { post: PostType; admin: boolean; side: "a" | "b" }) {
  return (
    <div className={`${side} reveal`}>
      <article className={`relative overflow-hidden transition-colors hover:bg-white/80 dark:hover:bg-black/65 ${frost}`}>
        <Cover
          image={post.image}
          className={post.image ? "" : "px-4 pt-4 pr-12"}
          title={<Link href={`/blogs/${post.id}`} className="after:absolute after:inset-0 after:rounded-2xl">{post.title}</Link>}
          sub={post.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        />
        {/* padding goes on a wrapper: on the clamped paragraph itself, the cut-off line shows through it */}
        <div className="px-4 pb-4 pt-2">
          <p className="line-clamp-4 whitespace-pre-wrap text-[15px] leading-snug">{post.content.join("\n\n")}</p>
        </div>
        {admin && <PostMenu id={post.id} title={post.title} image={post.image} />}
      </article>
    </div>
  );
}

// About me over the stream, then, as you scroll, the camera rises to look down on the river and the posts
// line its banks, newest first, alternating sides.
export default async function Page() {
  const session = await (await initAuth()).api.getSession({ headers: await headers() });
  const admin = !!session && ADMIN_EMAILS.includes(session.user.email);
  await dbConnect();
  const [posts, saved] = await Promise.all([
    Post.find().sort({ date: -1 }) as Promise<PostType[]>,
    About.findOne().lean<{ title?: string; body?: string }>(),
  ]);
  const rows: PostType[][] = [];
  for (let i = 0; i < posts.length; i += 2) rows.push(posts.slice(i, i + 2));

  return (
    <main className="relative flex-1">
      <section id="river-hero" className="river-hero">
        {/* down in the open water below the bridge (timeline.css), straight on the scene, with a soft glow behind
            the letters so they read over it */}
        <div className="max-w-2xl mx-4 sm:mx-auto sm:w-full px-6 pb-6 pt-1 [text-shadow:0_0_2px_#fff,0_0_5px_#fff,0_0_10px_#fff,0_0_22px_rgb(255_255_255/.85)]
          dark:[text-shadow:0_0_2px_#000,0_0_5px_#000,0_0_10px_#000,0_0_22px_rgb(0_0_0/.85)]">
          <AboutEditor title={saved?.title || DEFAULT.title} body={saved?.body ?? DEFAULT.body} admin={admin} />
          <div className="mt-4 flex items-center gap-3">
            <a href="#river-flow" className={pill}>My Blogs</a>
            {admin && (<>
              <span aria-hidden className="text-xl font-bold">·</span>
              <Link href="/post" className={pill}>Post</Link>
            </>)}
          </div>
        </div>
      </section>
      <div id="river-flow" className="river-flow">
        <h2 className="sr-only">Blogs</h2>
        {rows.map(([a, b], k) => (
          <section key={a.id} className="river-row" style={{ "--shift": SHIFTS[k % 4][0], "--shift-n": SHIFTS[k % 4][1] } as React.CSSProperties}>
            <PostCard post={a} admin={admin} side="a" />
            <div className="ch" aria-hidden />
            {b && <PostCard post={b} admin={admin} side="b" />}
          </section>
        ))}
        {!posts.length && <Link href="/post" className={`justify-self-center px-4 py-2 ${frost}`}>No blogs yet, create one here!</Link>}
      </div>
      <RiverBackground />
    </main>
  );
}
