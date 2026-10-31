"use client";

import { useEffect, useRef, useState } from "react";
import { deletePost } from "@/app/post/actions";

// The ⋯ in the top right of a post bubble, with a Delete option (admins only; deletePost checks too).
export default function PostMenu({ id, title }: { id: string; title: string }) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const root = useRef<HTMLDivElement>(null);

    // close on Escape or a click anywhere else
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        const onClick = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onClick);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, [open]);

    async function remove() {
        if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
        setDeleting(true);
        try {
            await deletePost(id); // the list refreshes itself afterwards
        } catch {
            alert("Couldn't delete the post.");
            setDeleting(false);
        }
    }

    return (
        <div ref={root} className="absolute right-3 top-3 z-10">
            <button
                type="button"
                aria-label="Post options"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className={`flex h-7 w-7 items-center justify-center gap-[2px] rounded-full text-zinc-500 transition-colors
                    hover:bg-zinc-100 dark:hover:bg-zinc-900 ${open ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}
            >
                {[0, 1, 2].map((i) => (
                    <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
                ))}
            </button>
            <div
                inert={!open}
                className={`absolute right-0 top-full mt-1 w-36 origin-top-right rounded-xl border border-zinc-200 dark:border-zinc-800
                    bg-white dark:bg-zinc-950 p-1 shadow-lg transition-[opacity,transform] duration-200 ease-[cubic-bezier(.3,.7,.4,1)]
                    ${open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-90"}`}
            >
                <button
                    type="button"
                    disabled={deleting}
                    onClick={remove}
                    className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                >
                    {deleting ? "Deleting…" : "Delete"}
                </button>
            </div>
        </div>
    );
}
