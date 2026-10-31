import Link from "next/link";
import SpiderLilyModel from "@/components/SpiderLilyModel";
import LilyBackground from "@/components/LilyBackground";
// import SpiderLily from "@/components/SpiderLily";

export default function Home() {
  return (<main>
    <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <h1 className="mt-3 text-4xl font-bold">
          willy.work
        </h1>
          {/* <p className="my-3 leading-relaxed text-zinc-900 dark:text-zinc-100"> */}
            {/* hi */}
        {/* </p> */}
          <Link href="/blogs" className="inline-block rounded-full px-5 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-80">My Blogs</Link>
          {/* <div className="fixed inset-0 -z-10"> */}
            {/* <SpiderLilyModel /> */}
            {/* </div> */}
<LilyBackground />
            <p className="fixed inset bottom-4 inset right-4 text-[0.75rem] text-zinc-400 dark:text-zinc-700">
            &ldquo;Spider Lily (Lycoris Radiata)&rdquo; <a href="https://skfb.ly/oJJBW" target="_blank">(Spider Lily)</a> by Osian CG is licensed under Creative Commons Attribution <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" >(CC BY 4.0)</a>
            </p>
    </div>
  </main>
);
}

