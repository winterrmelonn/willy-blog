"use client";

import { useState } from "react";
import { saveProject, type ProjectType } from "@/app/projects/actions";
import ImagePicker from "./ImagePicker";
import Cover from "./Cover";

const field = "w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2";
const pill = "rounded-full px-4 py-1.5 text-sm hover:opacity-80 disabled:opacity-50";

// One project on /projects. Admins get an Edit button in its top right that turns the card into fields.
export default function ProjectCard({ project, admin }: { project: ProjectType; admin: boolean }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(project);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const setLink = (i: number, change: Partial<ProjectType["links"][number]>) =>
        setDraft({ ...draft, links: draft.links.map((l, j) => (j === i ? { ...l, ...change } : l)) });

    async function save() {
        setSaving(true);
        setError("");
        try {
            await saveProject(draft);
            setEditing(false);
        } catch (e) {
            setError(e instanceof Error && e.message.startsWith("Links") ? e.message : "Couldn't save.");
        }
        setSaving(false);
    }

    if (!editing) return (
        <li className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {admin && (
                <button type="button" className={`absolute right-3 top-3 z-10 border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/60 backdrop-blur ${pill}`}
                    onClick={() => { setDraft(project); setEditing(true); }}>
                    Edit
                </button>
            )}
            {/* the cover image, with the name and date in its top left (or just those, without one) */}
            <Cover image={project.image} title={<h2>{project.name}</h2>} sub={project.when} className={project.image ? "" : `px-5 pt-5 ${admin ? "pr-20" : ""}`} />
            <div className="px-5 pb-5">
                <p className="mt-2 leading-relaxed whitespace-pre-wrap">{project.about}</p>
                {project.links.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {project.links.map((l) => (
                            <a key={l.href} href={l.href} target="_blank" rel="noreferrer"
                                className="rounded-full px-4 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                                {l.label} ↗
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </li>
    );

    return (
        <li className="flex flex-col gap-2 rounded-2xl border border-zinc-300 dark:border-zinc-700 p-5">
            <ImagePicker value={draft.image} onChange={(image) => setDraft({ ...draft, image })} />
            <input aria-label="Name" className={`${field} text-xl font-bold`} value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input aria-label="Year and event" placeholder="2026 · Hackathon name" className={`${field} text-sm`} value={draft.when}
                onChange={(e) => setDraft({ ...draft, when: e.target.value })} />
            <textarea aria-label="Description" rows={4} className={`${field} leading-relaxed resize-y`} value={draft.about}
                onChange={(e) => setDraft({ ...draft, about: e.target.value })} />
            {draft.links.map((l, i) => (
                <div key={i} className="flex gap-2">
                    <input aria-label={`Link ${i + 1} label`} placeholder="Label" className={`${field} w-28 shrink-0 text-sm`} value={l.label}
                        onChange={(e) => setLink(i, { label: e.target.value })} />
                    <input aria-label={`Link ${i + 1} address`} placeholder="https://" className={`${field} text-sm`} value={l.href}
                        onChange={(e) => setLink(i, { href: e.target.value })} />
                    <button type="button" aria-label={`Remove link ${i + 1}`} className="shrink-0 px-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                        onClick={() => setDraft({ ...draft, links: draft.links.filter((_, j) => j !== i) })}>×</button>
                </div>
            ))}
            <div className="mt-1 flex flex-wrap items-center gap-2">
                <button type="button" disabled={saving} onClick={save} className={`bg-black dark:bg-white text-white dark:text-black ${pill}`}>
                    {saving ? "Saving..." : "Save"}
                </button>
                <button type="button" disabled={saving} onClick={() => setEditing(false)} className={`border border-zinc-200 dark:border-zinc-800 ${pill}`}>
                    Cancel
                </button>
                <button type="button" onClick={() => setDraft({ ...draft, links: [...draft.links, { label: "", href: "" }] })}
                    className={`ml-auto border border-zinc-200 dark:border-zinc-800 ${pill}`}>
                    Add link
                </button>
                {error && <span className="w-full text-sm text-red-600 dark:text-red-400">{error}</span>}
            </div>
        </li>
    );
}
