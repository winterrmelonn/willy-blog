"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
    const router = useRouter();
    return (
        <button
            type="button"
            className="rounded-full px-5 py-2 border border-zinc-200 dark:border-zinc-800 hover:opacity-80"
            onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.refresh() } })}
        >
            Sign out
        </button>
    );
}
