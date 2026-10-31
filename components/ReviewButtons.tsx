"use client";

import { useState } from "react";
import { reviewBlog } from "@/app/profile/actions";

// Publish / Decline under a blog request on the admin profile
export default function ReviewButtons({ id }: { id: string }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);

    async function review(approve: boolean) {
        if (!approve && !confirm("Decline and delete this request?")) return;
        setBusy(true);
        setError(false);
        try {
            await reviewBlog(id, approve); // the list refreshes itself afterwards
        } catch {
            setError(true);
            setBusy(false);
        }
    }

    return (
        <div className="mt-3 flex items-center gap-2">
            <button type="button" disabled={busy} onClick={() => review(true)}
                className="rounded-full px-4 py-1.5 text-sm bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-50">
                Publish
            </button>
            <button type="button" disabled={busy} onClick={() => review(false)}
                className="rounded-full px-4 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 hover:opacity-80 disabled:opacity-50">
                Decline
            </button>
            {error && <span className="text-sm text-red-600 dark:text-red-400">Something went wrong.</span>}
        </div>
    );
}
