"use client";

function DarkMode() {
    return (
    <button onClick={() => document.documentElement.classList.toggle("dark")}>dark mode</button>
    )
}

export default DarkMode;
