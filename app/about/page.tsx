import Link from "next/link";
import { headers } from "next/headers";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import About from "@/lib/AboutModel";
import AboutEditor from "@/components/AboutEditor";
import RiverBackground from "@/components/RiverBackground";

// shown until an admin saves their own version
const DEFAULT = {
  title: "Hi, I’m Will.",
  body: "I’m currently a senior in high school. I hope to study an engineering field at any UC that’ll take me. I would love to do either Aerospace Engineering or Bioengineering, at UCLA and UCSD respectively. All engineering majors need to know how to code, so I’ve gotten wrapped up in Hack Club and its community recently. I have high hopes for my first real project: this blog.",
};

export default async function AboutPage() {
  const session = await (await initAuth()).api.getSession({ headers: await headers() });
  const admin = !!session && ADMIN_EMAILS.includes(session.user.email);
  await dbConnect();
  const saved = await About.findOne().lean<{ title?: string; body?: string }>();

  return (<main className="relative flex-1">
    <RiverBackground />
    {/* a frosted card keeps the text readable over the water */}
    <div className="max-w-2xl mt-6 mx-4 sm:mx-auto rounded-3xl px-6 pb-6 pt-1 bg-white/60 dark:bg-black/45 backdrop-blur-md">
      <AboutEditor title={saved?.title || DEFAULT.title} body={saved?.body ?? DEFAULT.body} admin={admin} />
      <Link href="/blogs" className="mt-4 inline-block rounded-full px-5 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-80">My Blogs</Link>
    </div>
  </main>
);
}
