"use client";

import { useState } from "react";
import SpiderLilyModel from "./SpiderLilyModel";

export default function LilyBackground() {
    const [on, setOn] = useState(true);

    return (
        <>
        {on && <div className="fixed inset-0 -z-10">
            <SpiderLilyModel />
            </div>
            }
<button
    role="switch"
    aria-checked={on}
    aria-label="Show spider lillies"
    onClick={() => setOn(!on)}
    className={`fixed bottom-4 left-4 rounded-full w-11 h-6 p-0.5 transition-colors ${on ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
>
    <span className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
</button>
        </>
    );
}