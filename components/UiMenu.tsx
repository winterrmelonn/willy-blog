"use client";

import { useEffect, useRef, useState } from "react";
import { setUiSetting, useUiSettings } from "./uiSettings";
import { setDarkMode, useDarkMode } from "./darkmode";

// Apple-style on/off switch: a real checkbox underneath, so keyboards and screen readers just work.
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
    return (
        <label className="flex items-center justify-between gap-6 py-2 cursor-pointer select-none">
            <span className="text-sm">{label}</span>
            <input
                type="checkbox"
                role="switch"
                className="peer sr-only"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span
                aria-hidden
                className="relative h-6 w-11 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700 transition-colors duration-300
                    peer-checked:bg-green-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-green-500
                    after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow
                    after:transition-transform after:duration-300 after:ease-[cubic-bezier(.3,.7,.4,1)] peer-checked:after:translate-x-5"
            />
        </label>
    );
}

// The ⋯ button on the left of the header, opening a small panel of UI style switches.
export default function UiMenu() {
    const [open, setOpen] = useState(false);
    const settings = useUiSettings();
    const dark = useDarkMode();
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

    return (
        <div ref={root} className="absolute left-4 top-1/2 -translate-y-1/2">
            <button
                type="button"
                aria-label="UI options"
                aria-expanded={open}
                aria-controls="ui-menu"
                onClick={() => setOpen(!open)}
                className={`flex h-7 w-7 items-center justify-center gap-[2px] rounded-full text-zinc-500 transition-colors
                    hover:bg-zinc-100 dark:hover:bg-zinc-900 ${open ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}
            >
                {[0, 1, 2].map((i) => (
                    <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
                ))}
            </button>

            <div
                id="ui-menu"
                inert={!open}
                className={`absolute left-0 top-full mt-2 w-56 origin-top-left rounded-2xl border border-zinc-200 dark:border-zinc-800
                    bg-white dark:bg-zinc-950 px-4 py-2 shadow-lg transition-[opacity,transform] duration-300 ease-[cubic-bezier(.3,.7,.4,1)]
                    ${open ? "opacity-100 scale-100 translate-y-0" : "pointer-events-none opacity-0 scale-90 -translate-y-2"}`}
            >
                <p className="pt-1 pb-1 text-xs uppercase tracking-wider text-zinc-500">UI style</p>
                {/* the field and the Lily UI take turns: turning one on turns the other off, and back */}
                <Switch label="Lily field" checked={settings.field} onChange={(field) => setUiSetting(field ? { field, lilyUi: false } : { field })} />
                <Switch label="Lily UI" checked={settings.lilyUi} onChange={(lilyUi) => setUiSetting({ lilyUi, field: !lilyUi })} />
                <Switch label="Dark mode" checked={dark} onChange={setDarkMode} />
            </div>
        </div>
    );
}
