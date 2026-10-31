import Link from "next/link";
import { headers } from "next/headers";
import UiMenu from "./UiMenu";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";

async function Nav() {
  // Post only shows for admins (app/post/page.tsx and postBlog check again, so hiding it is just tidiness)
  const session = await (await initAuth()).api.getSession({ headers: await headers() });
  const admin = !!session && ADMIN_EMAILS.includes(session.user.email);
  const box = "rounded-md px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors";
  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800">
      <UiMenu />
      {/* the home page puts its title here (components/HomeTitle.tsx) */}
      <div id="nav-title" className="absolute left-14 top-1/2 -translate-y-1/2" />
      <nav className="flex flex-wrap justify-center gap-1 items-center pl-36 pr-4 sm:px-36 py-1.5">
        <Link href="/" className={box}>Home</Link>
        <Link href="/blogs" className={box}>Blogs</Link>
        {admin && <Link href="/post" className={box}>Post</Link>}
        <Link href="/calendar" className={box}>Calendar</Link>
        <Link href="/about" className={box}>About</Link>
        <Link href="/profile" className={box}>Profile</Link>
      </nav>
    </header>
  );
}

export default Nav;
