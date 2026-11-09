import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import FollowBack from "@/components/FollowBack";
import { loadSnapshot } from "./actions";

export const metadata: Metadata = { title: "Instagram · willy.work" };

// Who doesn't follow back on Instagram, from Willy's data export. Admins only.
export default async function FollowBackPage() {
    const session = await (await initAuth()).api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session.user.email)) redirect("/");
    return (
        <main className="w-full max-w-2xl mx-auto px-4 pb-14">
            <FollowBack initialSnapshot={await loadSnapshot()} />
        </main>
    );
}
