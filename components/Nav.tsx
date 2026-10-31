import Link from "next/link";
import DarkMode from "./darkmode";

function Nav() {
  const box = "border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-1.5 text-sm bg-white/70 dark:bg-black/50 backdrop-blur";
  return (
    <nav className="flex gap-2 items-center px-6 py-4 ml-auto">
      <Link href="/" className={box}>Home</Link>
      <Link href="/blogs" className={box}>Blogs</Link>
      <Link href="/post" className={box}>Post</Link>
      <Link href="/calendar" className={box}>Calendar</Link>
      <Link href="/about" className={box}>About</Link>
      <Link href="/signin" className={box}>Sign in</Link>
      <DarkMode />
    </nav>
  );
}

export default Nav;
