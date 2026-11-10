"use client";

import { useRef, useState, type DragEvent } from "react";
import { compare, kindOf, parseExport, type Entry, type Result, type Snapshot } from "@/lib/followback";
import { saveSnapshot } from "@/app/followback/actions";
import { setDarkMode, useDarkMode } from "./darkmode";

const TABS = {
    notBack: ["Don't follow you back", "You follow them, they don't follow you. Date is when you followed them."],
    fans: ["You don't follow back", "They follow you, you don't follow them. Date is when they followed you."],
    lost: ["Unfollowed you", "Followed you in the last export, gone now. Includes deactivated accounts."],
    gained: ["New followers", "Followed you since the last export."],
} as const;
type Tab = keyof typeof TABS;

const line = "border-zinc-200 dark:border-zinc-800";
const pill = `rounded-full border ${line} px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900`;
const label = "text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400";
const fmt = (t: number) => (t ? new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// /followback: pick the unzipped Instagram export, and the lists are worked out right here in the browser.
// Only the follower usernames go to the server, saved so the next export can show who unfollowed.
export default function FollowBack({ initialSnapshot }: { initialSnapshot: Snapshot | null }) {
    const [snapshot, setSnapshot] = useState(initialSnapshot);
    const [result, setResult] = useState<Result | null>(null);
    const [comparedTo, setComparedTo] = useState<number | null>(null);
    const [files, setFiles] = useState<string[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [saveNote, setSaveNote] = useState("");
    const [tab, setTab] = useState<Tab>("notBack");
    const [query, setQuery] = useState("");
    const [over, setOver] = useState(false);
    const [copied, setCopied] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const dark = useDarkMode();

    async function load(list: FileList | null) {
        const followers = new Map<string, number>(), following = new Map<string, number>();
        const used: string[] = [], errs: string[] = [];
        for (const f of Array.from(list ?? [])) {
            const path = f.webkitRelativePath || f.name, kind = kindOf(path);
            if (!kind) continue;
            try {
                for (const [u, t] of parseExport(f.name, await f.text())) (kind === "followers" ? followers : following).set(u, t);
                used.push(path);
            } catch {
                errs.push(`Couldn't read ${f.name}. Download the export again in JSON format.`);
            }
        }
        if (!followers.size || !following.size)
            errs.push(`No ${!followers.size ? "followers_1.json" : "following.json"} found. Pick the whole unzipped export folder.`);
        setFiles(used);
        setErrors(errs);
        if (!followers.size || !following.size) return;

        setResult(compare(followers, following, snapshot));
        setComparedTo(snapshot?.date ?? null);
        setTab("notBack");
        setSaveNote("Saving…");
        try {
            const saved = await saveSnapshot([...followers.keys()]);
            if (saved) setSnapshot(saved);
            setSaveNote(saved ? "" : "Couldn't save this export, so the next one will compare against the older one.");
        } catch {
            setSaveNote("Couldn't save this export, so the next one will compare against the older one.");
        }
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        setOver(false);
        load(e.dataTransfer.files);
    }

    async function copy(list: Entry[]) {
        try {
            await navigator.clipboard.writeText(list.map(([u]) => u).join("\n"));
            setCopied("Copied");
        } catch {
            setCopied("Copy failed");
        }
        setTimeout(() => setCopied(""), 1500);
    }

    const list = result?.[tab];
    const rows = list?.filter(([u]) => u.includes(query.trim().toLowerCase())) ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-3xl font-semibold uppercase tracking-wide text-balance">Who doesn&apos;t follow back</h1>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        Your Instagram export is read in this browser. Only your follower usernames are saved, so the next export can show who unfollowed you.
                    </p>
                </div>
                <button type="button" className={pill} onClick={() => setDarkMode(!dark)} aria-label={`Switch to ${dark ? "light" : "dark"} mode`}>
                    {dark ? "Light" : "Dark"}
                </button>
            </div>

            <section
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center gap-4 rounded-2xl border px-5 py-10 text-center transition-colors ${over ? "border-zinc-400 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950" : line}`}
            >
                <button type="button" onClick={() => input.current?.click()}
                    className="rounded-full bg-black px-6 py-2.5 text-sm font-medium uppercase tracking-wider text-white hover:opacity-80 dark:bg-white dark:text-black">
                    Load export data
                </button>
                {/* webkitdirectory makes it a folder picker on computers (phones ignore it); spread because React's types lack it */}
                <input ref={input} type="file" multiple accept=".json,.html" hidden
                    {...{ webkitdirectory: "" }} onChange={(e) => { load(e.target.files); e.target.value = ""; }} />
                <p className={label}>
                    {snapshot ? `Last export saved ${day(snapshot.date)}` : "No export saved yet"}
                </p>
                {(files.length > 0 || errors.length > 0) && (
                    <div className="text-xs leading-relaxed text-zinc-500">
                        {files.map((f) => <div key={f}>✓ {f}</div>)}
                        {errors.map((e) => <div key={e} className="text-red-600 dark:text-red-400">{e}</div>)}
                    </div>
                )}
                <details className="w-full text-left text-sm">
                    <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">How to get your export</summary>
                    <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 leading-relaxed">
                        <li>Instagram → Settings → Accounts Center → Your information and permissions → Download your information.</li>
                        <li>Choose Some of your information → Followers and following.</li>
                        <li>Download to device, date range All time, format JSON.</li>
                        <li>When the email arrives, download and unzip it, then load the folder here.</li>
                    </ol>
                </details>
            </section>

            {result && (
                <>
                    <p className="border-l-2 border-zinc-200 pl-3 text-sm text-zinc-500 dark:border-zinc-800">
                        {comparedTo ? `Compared with the export from ${day(comparedTo)}.` : "First export saved. Load a newer one later to see who unfollowed you."}
                        {saveNote && <span className="text-red-600 dark:text-red-400"> {saveNote}</span>}
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {([["Followers", result.followers], ["Following", result.following], ["Mutual", result.mutual], ["Not following back", result.notBack.length]] as const).map(([name, n]) => (
                            <div key={name} className={`flex flex-col gap-1 rounded-2xl border ${line} px-4 py-3`}>
                                <span className={label}>{name}</span>
                                <b className="text-2xl font-medium tabular-nums">{n.toLocaleString()}</b>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        <div role="tablist" className="flex flex-wrap gap-1">
                            {(Object.keys(TABS) as Tab[]).map((k) => {
                                const l = result[k];
                                return (
                                    <button key={k} type="button" role="tab" aria-selected={k === tab} onClick={() => setTab(k)}
                                        className={`inline-flex items-baseline gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium uppercase tracking-wide transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 ${k === tab ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}>
                                        {TABS[k][0]}
                                        <span className={k === "lost" && l?.length ? "text-red-600 dark:text-red-400" : ""}>{l ? l.length : "–"}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className={`overflow-hidden rounded-2xl border ${line}`}>
                            <div className={`flex flex-wrap items-center justify-between gap-3 border-b ${line} px-5 py-4`}>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-semibold uppercase tracking-wider">{TABS[tab][0]}</h2>
                                    <p className="mt-1 text-xs leading-snug text-zinc-500">{TABS[tab][1]}</p>
                                </div>
                                {list && list.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter usernames" aria-label="Filter usernames"
                                            className={`w-44 max-w-full rounded-full border ${line} bg-transparent px-3.5 py-1.5 text-sm placeholder:text-zinc-500`} />
                                        <button type="button" className={pill} onClick={() => copy(rows)}>{copied || "Copy list"}</button>
                                    </div>
                                )}
                            </div>
                            {!list ? (
                                <p className="px-5 py-8 text-center text-sm text-zinc-500">This compares against the last export saved. Load a newer export later and this list fills in.</p>
                            ) : rows.length === 0 ? (
                                <p className="px-5 py-8 text-center text-sm text-zinc-500">{list.length ? "No usernames match that filter." : "Nobody here."}</p>
                            ) : (
                                <ul className="max-h-[32rem] overflow-y-auto">
                                    {rows.map(([u, t]) => (
                                        <li key={u} className={`flex items-baseline justify-between gap-3 border-b ${line} px-5 py-2.5 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-950`}>
                                            <a href={`https://www.instagram.com/${u}/`} target="_blank" rel="noreferrer" className="min-w-0 break-all text-sm hover:underline underline-offset-4">@{u}</a>
                                            <time className="shrink-0 text-xs tabular-nums text-zinc-500">{fmt(t)}</time>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
