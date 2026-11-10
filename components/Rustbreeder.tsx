"use client";

import { useState } from "react";
import { bestLayout, isGenome, score, type Layout } from "@/lib/rustbreeder";

const COLORS: Record<string, string> = { G: "#3d9970", Y: "#7fb800", H: "#2e8b8b", W: "#d64545", X: "#8b3a3a" };
const pill = "rounded-full px-3 py-1 text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900";

// six colored squares, one per gene
function Tiles({ plant }: { plant: string }) {
    return (
        <span className="inline-flex gap-0.5 font-mono text-[13px] font-bold text-white">
            {[...plant].map((g, i) => (
                <span key={i} className="w-[2ch] text-center py-0.5 rounded-sm" style={{ background: COLORS[g] }}>{g}</span>
            ))}
        </span>
    );
}

function Grid({ title, cells, scores }: { title: string; cells: Layout; scores?: boolean }) {
    return (
        <div className="flex-1 min-w-[280px]">
            <h2 className="mb-2 text-xs tracking-wide text-zinc-500">{title}</h2>
            <div className="grid grid-cols-3 gap-1.5">
                {[...Array(9).keys()].map((p) => (
                    <div key={p} className="h-16 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-1">
                        {cells[p] ? <>
                            <Tiles plant={cells[p]} />
                            {scores && <span className="text-[11px] text-zinc-500">score {score(cells[p])}</span>}
                        </> : <span className="text-zinc-400">—</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

// Enter the seeds you hold; the planter below always shows the best arrangement for them.
export default function Rustbreeder() {
    const [plants, setPlants] = useState<string[]>([]);
    const [input, setInput] = useState("");
    const [error, setError] = useState("");
    const plan = bestLayout(plants);
    const best = plants.length ? plants.reduce((a, b) => (score(b) > score(a) ? b : a)) : "";

    function add(e: React.FormEvent) {
        e.preventDefault();
        const g = input.toUpperCase();
        if (!isGenome(g)) return setError("Need exactly 6 letters from G Y H X W.");
        setPlants([...plants, g]);
        setInput("");
        setError("");
    }

    return (
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold">Rustbreeder</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Plan your Rust berry crossbreeds. Add the genes of the seeds you hold, and get where to plant each one
                    and what the planter will grow. Aim: GGGYYY. Rules from the <a href="https://rustbreeder.com/guide/" className="underline">rustbreeder.com guide</a>.
                </p>
            </div>

            <form onSubmit={add} className="flex flex-wrap items-center gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={6} autoComplete="off" aria-label="Plant genes" placeholder="GGYYHX"
                    className="w-28 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-1.5 text-center font-mono font-bold uppercase" />
                <button className="rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-1.5 text-sm hover:opacity-80">Add</button>
                <span className="text-xs text-zinc-500">G growth · Y yield · H hardiness · W water · X nothing</span>
                <p role="alert" className="w-full text-sm text-red-500 empty:hidden">{error}</p>
            </form>

            {plants.length > 0 && (
                <section>
                    <h2 className="mb-2 text-xs tracking-wide text-zinc-500">YOUR PLANTS</h2>
                    <ul className="flex flex-col gap-1.5">
                        {plants.map((g, i) => (
                            <li key={i} className="flex items-center gap-2">
                                <Tiles plant={g} />
                                <span className="text-xs text-zinc-500 w-16">score {score(g)}</span>
                                <button type="button" className={pill} onClick={() => { setInput(g); setPlants(plants.filter((_, j) => j !== i)); }}>edit</button>
                                <button type="button" className={pill} aria-label={`Remove ${g}`} onClick={() => setPlants(plants.filter((_, j) => j !== i))}>✕</button>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-sm font-bold">Best plant: {best} · score {score(best)}</p>
                </section>
            )}

            <section>
                <p className="mb-3 text-sm font-bold">{plants.length ? `Planter total score ${plan.total}` : "Add a seed to see the planter."}</p>
                <div className="flex flex-wrap gap-6">
                    <Grid title="PLANT HERE" cells={plan.layout} />
                    <Grid title="RESULTS" cells={plan.offspring} scores />
                </div>
            </section>
        </main>
    );
}
