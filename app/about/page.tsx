  import Link from "next/link";

export default function Home() {
  return (<main>
    <div className="max-w-2xl mx-auto">
          <h1 className="mt-3 text-4xl font-bold">
          Hi, I&rsquo;m Will.
        </h1>
          <p className="my-3 leading-relaxed text-zinc-900 dark:text-zinc-100">
            I&rsquo;m currently a senior in high school. I hope to study an engineering field at any UC that&rsquo;ll take me. I would love to do either Aerospace Engineering or Bioengineering, at UCLA and UCSD respectively. All engineering majors need to know how to code, so I&rsquo;ve gotten wrapped up in Hack Club and its community recently. I have high hopes for my first real project: this blog.
        </p>
          <Link href="/blogs" className="inline-block rounded-full px-5 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-80">My Blogs</Link>
    </div>
  </main>
);
}
