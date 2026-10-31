"use client";

import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";
import { useUiSettings } from "./uiSettings";

const noop = () => () => {};

// willy.work on the home page: up in the header beside the ⋯ menu, except in the Lily UI,
// where it stays on the page (Lily UI keeps its flowers below it via data-garden-clear).
export default function HomeTitle() {
    const { lilyUi } = useUiSettings();
    const slot = useSyncExternalStore(noop, () => document.getElementById("nav-title"), () => null);

    if (lilyUi) return (
        <div data-garden-clear className="px-6 lg:px-[8vw]">
            <h1 className="mt-3 inline-block text-4xl font-bold rounded-xl px-3 py-1 bg-white/70 dark:bg-black/50 backdrop-blur">
                willy.work
            </h1>
        </div>
    );
    return slot && createPortal(<h1 className="text-sm font-bold">willy.work</h1>, slot);
}
