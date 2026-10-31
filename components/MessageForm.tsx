"use client";

import { useState } from "react";
import { sendMessage } from "@/app/profile/actions";

export default function MessageForm() {
    const [message, setMessage] = useState("");
    const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setState("sending");
        try {
            await sendMessage(message);
            setState("sent");
        } catch {
            setState("error");
        }
    }

    if (state === "sent") return <p className="my-6 text-lg">Sent! Thanks for the message.</p>;

    return (
        <form onSubmit={handleSubmit} className="my-3 flex flex-col gap-3">
            <textarea
                aria-label="Message"
                placeholder="Say hi..."
                required
                rows={8}
                maxLength={20000}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 leading-relaxed resize-y"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
            />
            {state === "error" && <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t send. Are you signed in?</p>}
            <button
                type="submit"
                disabled={state === "sending"}
                className="self-end rounded-full px-5 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-50"
            >
                {state === "sending" ? "Sending..." : "Submit"}
            </button>
        </form>
    );
}
