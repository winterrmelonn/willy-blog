"use client";
import { useLayoutEffect } from "react";

function DarkMode() {
    const box = "border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-1.5 text-sm bg-white/70 dark:bg-black/50 backdrop-blur"
    useLayoutEffect(() => {
        const darkMode = localStorage.getItem("darkMode");
        if (darkMode === "true") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }, []);
    function toggleDarkMode() {
        document.documentElement.classList.toggle("dark");
        const isDarkMode = document.documentElement.classList.contains("dark");
        localStorage.setItem("darkMode", isDarkMode ? "true" : "false");
    }
    return (
        <button className={box} onClick={toggleDarkMode}>Theme</button>
    )
}

export default DarkMode;
