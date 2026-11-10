"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { bestLayout, isGenome, score, type Layout } from "@/lib/rustbreeder";
import FarmBackground from "./FarmBackground";

// Rudimentary Intelligence – Rustbreeder: a camera HUD over a vertical farm (components/FarmBackground.tsx).
// The boot is the camera pulling focus while the log types in; styles are in app/rustbreeder/rustbreeder.css.

const GENE_TABLE = [
    ["G", 3, "Growth", 10, "Priority"],
    ["Y", 3, "Yield", 10, "Priority"],
    ["H", 3, "Hardiness", 2, "Neutral"],
    ["W", 5, "Water", 0, "Purge"],
    ["X", 5, "Null", 0, "Purge"],
] as const;
const WEIGHT: Record<string, number> = Object.fromEntries(GENE_TABLE.map(([g, w]) => [g, w]));

// 3x5 pixel digits for the big specimen counter
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001",
    "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];

const pad = (n: number, l = 3) => String(n).padStart(l, "0");
const vars = (o: Record<string, string | number>) => o as CSSProperties;

function Tiles({ plant }: { plant: string }) {
    return <span className="tiles" aria-label={plant}>{[...plant].map((g, i) => <span key={i} className={g}>{g}</span>)}</span>;
}

const Mark = () => <span className="mark" aria-hidden><i /><i /></span>;

function Pixels({ n }: { n: number }) {
    return (
        <div className="pixels" aria-hidden>
            {[...pad(n, 2)].map((d, i) => (
                <span key={i}>{[...DIGITS[+d]].map((on, j) => <i key={j} className={on === "1" ? "on" : ""} />)}</span>
            ))}
        </div>
    );
}

function Grid({ label, cells, scores }: { label: string; cells: Layout; scores?: boolean }) {
    return (
        <div>
            <p className="hd"><span>{label}</span><span className="dim">3×3</span></p>
            <div className={`grid ${scores ? "out" : ""}`}>
                {[...Array(9).keys()].map((p) => (
                    <div key={p} className={`cell ${cells[p] ? "on" : ""}`} style={vars({ "--i": p })}>
                        <span className="pos">{String.fromCharCode(65 + Math.floor(p / 3))}{p % 3 + 1}</span>
                        {cells[p] ? <>
                            <Tiles plant={cells[p]} />
                            {scores && <span className="sc">{pad(score(cells[p]))}</span>}
                        </> : <span className="none">· · ·</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Rustbreeder({ className }: { className: string }) {
    const [plants, setPlants] = useState<string[]>([]);
    const [input, setInput] = useState("");
    const [error, setError] = useState("");
    const [plan, setPlan] = useState<ReturnType<typeof bestLayout> | null>(null);
    const resultRef = useRef<HTMLElement>(null);
    const kick = useRef(0); // bumped on Finalize: the camera surges down the aisle
    const menuRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => { if (plan) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [plan]);

    // any change to the seeds makes the shown layout stale, so it goes away until Finalize again
    const update = (next: string[]) => { setPlants(next); setPlan(null); };

    function add(e: FormEvent) {
        e.preventDefault();
        const g = input.toUpperCase();
        if (!isGenome(g)) return setError("ERR // need exactly 6 of G Y H W X");
        update([...plants, g]);
        setInput("");
        setError("");
    }

    function finalize() {
        kick.current++;
        if (menuRef.current) menuRef.current.open = false; // don't let the gene table cover the results
        setPlan(bestLayout(plants));
    }

    return (
        <div className={`rb ${className}`}>
            <FarmBackground kick={kick} />
            <div className="mist" aria-hidden />
            <div className="reticle" aria-hidden><i /><i /><i /><i /></div>

            <div className="hud">
                <section className="left">
                    <Link href="/" className="back in" style={vars({ "--i": 0 })}>← willy.work</Link>

                    <header className="in" style={vars({ "--i": 1 })}>
                        <h1><Mark />Rudimentary Intelligence <span>— Rustbreeder</span></h1>
                        <p className="type" style={vars({ "--i": 2 })}>Terminal log:</p>
                        <p className="type caret" style={vars({ "--i": 4 })}>Connection established</p>
                    </header>

                    <p className="blurb in" style={vars({ "--i": 3 })}>
                        Log the genes of the Rust berry seeds you hold, then finalize for where to plant each one and
                        what the planter grows. Target GGGYYY. Rules: <a href="https://rustbreeder.com/guide/">rustbreeder.com/guide</a>
                    </p>

                    <form onSubmit={add} className="glass in" style={vars({ "--i": 4 })}>
                        <p className="hd"><span>Seq_in</span><span className="dim">6 genes / specimen</span></p>
                        <div className="row">
                            <span className="dim">&gt;</span>
                            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={6} autoComplete="off" spellCheck={false}
                                aria-label="Plant genes" placeholder="GGYYHX" />
                            <button className="add">+ Log</button>
                        </div>
                        <p role="alert" className="err">{error}</p>
                    </form>

                    <section className="glass in" style={vars({ "--i": 5 })}>
                        <p className="hd"><span>Specimens [ {pad(plants.length)} ]</span><span className="dim">vector · score</span></p>
                        {plants.length ? (
                            <ul className="log">
                                {plants.map((g, i) => (
                                    <li key={`${i}${g}`}>
                                        <span className="dim">{pad(i + 1, 2)}</span>
                                        <Tiles plant={g} />
                                        <span className="vec dim">{[...g].map((x) => WEIGHT[x]).join(".")}</span>
                                        <span className="sc">{pad(score(g))}</span>
                                        <button type="button" onClick={() => { setInput(g); update(plants.filter((_, j) => j !== i)); }}>edit</button>
                                        <button type="button" aria-label={`Remove ${g}`} onClick={() => update(plants.filter((_, j) => j !== i))}>✕</button>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="dim">No specimens logged_</p>}
                        <button type="button" className="finalize" disabled={!plants.length} onClick={finalize}>
                            <span>&gt;&gt; Finalize layout</span><span className="dim">{plants.length ? "ready" : "standby"}</span>
                        </button>
                    </section>
                </section>

                {/* gene reference, folded away behind a ⋯ button in the top right */}
                <details className="menu in" style={vars({ "--i": 3 })} ref={menuRef}>
                    <summary aria-label="Gene reference"><i /><i /><i /></summary>
                    <div className="table">
                        <table>
                            <thead><tr><th>Gene</th><th>Weight</th><th>Class</th><th>Value</th><th>Status</th></tr></thead>
                            <tbody>
                                {GENE_TABLE.map(([g, w, name, v, status]) => (
                                    <tr key={g}><td><Tiles plant={g} /></td><td>{w}</td><td>{name}</td><td>{pad(v, 2)}</td>
                                        <td><span className={`chip ${status}`}>{status}</span></td></tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="dim">Red alleles weigh 5, green 3. Neighbors must outweigh the center to overwrite a slot.</p>
                    </div>
                </details>

                <section className="right">
                    {plan && (
                        <section className="result glass" ref={resultRef} aria-live="polite">
                            <p className="hd"><span>Trace // planter_a</span><span className="dim">Finalized</span></p>
                            <div className="grids">
                                <Grid label="Plant here" cells={plan.layout} />
                                <Grid label="Results" cells={plan.offspring} scores />
                            </div>
                        </section>
                    )}
                </section>

                <footer className="foot in" style={vars({ "--i": 6 })}>
                    <Pixels n={plants.length} />
                    <p className="dim">RB_CAM_01 · Aisle 07 · 22.4°C · RH 68%<br />&gt;&gt; Trace</p>
                </footer>
            </div>
        </div>
    );
}
