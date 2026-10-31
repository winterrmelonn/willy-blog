import { headers } from "next/headers";
import Link from "next/link";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import Inbox from "@/lib/InboxModel";
import SignInForm from "@/components/SignInForm";
import SignOutButton from "@/components/SignOutButton";
import PostForm from "@/components/PostForm";
import MessageForm from "@/components/MessageForm";
import ReviewButtons from "@/components/ReviewButtons";
import { requestBlog } from "./actions";

const heading = "mt-10 mb-6 text-4xl font-bold";

type Request = { _id: unknown; name: string; email: string; title: string; content: string[]; createdAt: Date };

// Admins: blog requests from visitors, oldest first
async function BlogRequests() {
  await dbConnect();
  const requests = (await Inbox.find({ kind: "blog" }).sort({ createdAt: 1 }).lean()) as Request[];
  return (<>
    <h1 className={heading}>Blog requests</h1>
    {requests.length === 0 && <p className="text-zinc-500">Nothing to review right now.</p>}
    <ul className="flex flex-col gap-4">
      {requests.map((r) => (
        <li key={String(r._id)} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-xl font-bold">{r.title}</h2>
          <p className="mb-3 text-sm text-zinc-500">
            from {r.name} ({r.email}) · {r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          <div className="flex flex-col gap-3 whitespace-pre-wrap leading-relaxed">
            {r.content.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <ReviewButtons id={String(r._id)} />
        </li>
      ))}
    </ul>
  </>);
}

export default async function Profile({ searchParams }: PageProps<"/profile">) {
  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <main><SignInForm /></main>;

  const admin = ADMIN_EMAILS.includes(session.user.email);
  // the sidebar's choices; ?tab= picks which one fills the main area
  const tabs = admin
    ? [{ tab: "", label: "Home" }, { tab: "requests", label: "Blog requests" }]
    : [{ tab: "", label: "Home" }, { tab: "contribute", label: "Contribute a blog" }, { tab: "message", label: "Send a message" }];
  const asked = (await searchParams).tab;
  const current = tabs.find((t) => t.tab === asked)?.tab ?? "";

  return (
    <main className="flex-1 flex flex-col sm:flex-row">
      <aside className="sm:w-56 shrink-0 flex sm:flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.tab}
            href={t.tab ? `/profile?tab=${t.tab}` : "/profile"}
            aria-current={t.tab === current ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${t.tab === current
              ? "bg-zinc-100 dark:bg-zinc-900 font-bold"
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-950 dark:hover:text-zinc-100"}`}
          >
            {t.label}
          </Link>
        ))}
      </aside>
      <section className="flex-1 min-w-0 px-4 sm:px-10 pb-10">
        <div className="max-w-2xl mx-auto">
          {current === "" && (<>
            <h1 className={heading}>Welcome, {session.user.name}</h1>
            <SignOutButton />
          </>)}
          {current === "contribute" && (<>
            <h1 className={heading}>Contribute a blog</h1>
            <p className="-mt-3 text-zinc-500">Write it here and Willy will look it over before it goes up.</p>
            <PostForm postBlog={requestBlog} request />
          </>)}
          {current === "message" && (<>
            <h1 className={heading}>Send a message</h1>
            <MessageForm />
          </>)}
          {current === "requests" && <BlogRequests />}
        </div>
      </section>
    </main>
  );
}
