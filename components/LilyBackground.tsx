"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useUiSettings } from "./uiSettings";
import { useDarkMode } from "./darkmode";

// Both scenes are big, so they load in their own bundles, only in the browser.
const SpiderLilyModel = dynamic(() => import("./SpiderLilyModel"), { ssr: false });
const LilyGarden = dynamic(() => import("./LilyGarden"), { ssr: false });

// Full-screen loading page: a spider lily's stamens slowly turning until the field is ready.
function Loader({ done }: { done: boolean }) {
    const [gone, setGone] = useState(false);
    if (gone) return null;
    return (
        <div
            role="status"
            onTransitionEnd={() => done && setGone(true)}
            className={`fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-white dark:bg-black
                transition-opacity duration-700 ${done ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
            <svg viewBox="-50 -50 100 100" className="h-28 w-28 animate-spin [animation-duration:6s]" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => {
                    const a = (i / 6) * Math.PI * 2;
                    // rounded so the server and browser write identical numbers
                    const at = (r: number, turn: number) => [Math.cos(turn) * r, Math.sin(turn) * r].map((n) => n.toFixed(2));
                    const end = at(26, a);
                    const bend = at(17, a + 0.6);
                    return (
                        <g key={i}>
                            <path d={`M0 0 Q${bend[0]} ${bend[1]} ${end[0]} ${end[1]}`} fill="none" stroke="#c81e2c" strokeWidth="1.6" strokeLinecap="round" />
                            <circle cx={end[0]} cy={end[1]} r="1.8" fill="#c81e2c" className="animate-pulse" />
                        </g>
                    );
                })}
                <circle r="4" fill="#9e1020" />
            </svg>
            <p className="text-sm text-zinc-500 animate-pulse">growing lilies…</p>
        </div>
    );
}

function Field() {
    const [ready, setReady] = useState(false);
    return (
        <>
            <div className="fixed inset-0 -z-10">
                <SpiderLilyModel onReady={() => setReady(true)} />
            </div>
            <Loader done={ready} />
            <p className="fixed bottom-4 right-4 text-[0.75rem] text-zinc-400 dark:text-zinc-700">
                &ldquo;Spider Lily (Lycoris Radiata)&rdquo; <a href="https://skfb.ly/oJJBW" target="_blank">(Spider Lily)</a> by Osian CG is licensed under Creative Commons Attribution <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank">(CC BY 4.0)</a>
            </p>
        </>
    );
}

function Garden() {
    const [ready, setReady] = useState(false);
    return (
        <>
            <LilyGarden onReady={() => setReady(true)} />
            <Loader done={ready} />
        </>
    );
}

// The home page background, picked in the ⋯ menu: the Lily UI garden, the lily field, or nothing.
// Each one shows the loading screen while it starts up, including when switching between them.
export default function LilyBackground() {
    const { field, lilyUi } = useUiSettings();
    const night = useDarkMode();
    if (lilyUi) return <Garden />;
    // a new key when day/night flips rebuilds the field, so the loading screen covers the switch
    return field ? <Field key={night ? "night" : "day"} /> : null;
}
