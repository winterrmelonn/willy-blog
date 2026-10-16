import Link from "next/link";
import DarkMode from "./darkmode";

function Nav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/blogs">Blogs</Link>
      <Link href="/post">Post</Link>
      <Link href="/about">About</Link>
      <Link href="/signin">Sign in</Link>
      <DarkMode />
    </nav>
  );
}

export default Nav;
