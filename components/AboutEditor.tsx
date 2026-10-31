"use client";

import { useState } from "react";
import { saveAbout } from "@/app/about/actions";

const field = "w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2";
const pill = "rounded-full px-4 py-1.5 text-sm hover:opacity-80 disabled:opacity-50";

// The About page's heading and text. Admins get an Edit button that turns them into fields in place.
export default function AboutEditor({ title, body, admin }: { title: string; body: string; admin: boolean }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({ title, body });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);

    async function save() {
        setSaving(true);
        setError(false);
        try {
            await saveAbout(draft.title, draft.body);
            setEditing(false);
        } catch {
            setError(true);
        }
        setSaving(false);
    }

    if (!editing) return (<>
        <h1 className="mt-10 mb-6 text-center text-4xl font-bold">{title}</h1>
        <p className="leading-relaxed whitespace-pre-wrap">{body}</p>
        {admin && ( /* tucked in the top right of the page, under the header */
            <button type="button" className={`absolute right-4 top-4 border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-black/50 backdrop-blur ${pill}`}
                onClick={() => { setDraft({ title, body }); setEditing(true); }}>
                Edit
            </button>
        )}
    </>);

    return (<>
        <input aria-label="Heading" className={`${field} mt-10 mb-6 text-center text-4xl font-bold`}
            value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <textarea aria-label="About text" rows={10} className={`${field} leading-relaxed resize-y`}
            value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <div className="mt-3 flex items-center gap-2">
            <button type="button" disabled={saving} onClick={save} className={`bg-black dark:bg-white text-white dark:text-black ${pill}`}>
                {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" disabled={saving} onClick={() => setEditing(false)} className={`border border-zinc-200 dark:border-zinc-800 ${pill}`}>
                Cancel
            </button>
            {error && <span className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t save.</span>}
        </div>
    </>);
}
