"use client";
import { useLayoutEffect, useSyncExternalStore } from "react";

// Dark mode = the "dark" class on <html>, remembered in localStorage under "darkMode".
// (app/layout.tsx applies it before the page paints, so there's no flash.)

const html = () => document.documentElement;

// re-render whenever the class on <html> changes
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(html(), { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
}

export function setDarkMode(dark: boolean) {
    html().classList.toggle("dark", dark);
    try {
        localStorage.setItem("darkMode", dark ? "true" : "false");
    } catch {}
}

export function useDarkMode() {
    // React Strict Mode resets <html> attributes in dev, so re-apply the saved choice after mounting
    useLayoutEffect(() => {
        try {
            html().classList.toggle("dark", localStorage.getItem("darkMode") === "true");
        } catch {}
    }, []);
    return useSyncExternalStore(subscribe, () => html().classList.contains("dark"), () => false);
}
