"use client";

import { useSyncExternalStore } from "react";

// UI style options from the ⋯ menu, remembered in localStorage and shared by every component.
export type UiSettings = { field: boolean; lilyUi: boolean };

const KEY = "ui-settings";
const DEFAULTS: UiSettings = { field: true, lilyUi: false };
const listeners = new Set<() => void>();
let current: UiSettings | null = null;

function read(): UiSettings {
    if (!current) {
        try {
            current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
        } catch {
            current = DEFAULTS;
        }
    }
    return current!;
}

export function setUiSetting(change: Partial<UiSettings>) {
    current = { ...read(), ...change };
    try {
        localStorage.setItem(KEY, JSON.stringify(current));
    } catch {}
    listeners.forEach((listener) => listener());
}

export function useUiSettings() {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        read,
        () => DEFAULTS, // the server can't see localStorage
    );
}
