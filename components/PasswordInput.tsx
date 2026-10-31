"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DOT = "•";

// Password box that shows the last typed character for a second, like a phone.
// The real password lives in state; the input itself only ever holds dots plus
// that one revealed character, so the full password never sits in the DOM.
// ponytail: plain text input, so browser password managers won't autofill it.
function PasswordInput({
    value,
    onChange,
    className,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
}) {
    const ref = useRef<HTMLInputElement>(null);
    const selStart = useRef(0); // where the selection started before the edit
    const caret = useRef<number | null>(null); // caret to restore after re-render
    const [reveal, setReveal] = useState(-1); // index of the visible character

    const display = value
        .split("")
        .map((c, i) => (i === reveal ? c : DOT))
        .join("");

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const typed = e.target.value;
        const end = e.target.selectionEnd ?? typed.length;
        const start = Math.min(selStart.current, end);
        const after = typed.length - end; // characters after the caret didn't change

        onChange(value.slice(0, start) + typed.slice(start, end) + value.slice(value.length - after));
        setReveal(end > start ? end - 1 : -1);
        caret.current = end;
        selStart.current = end;
    }

    function rememberSelection(e: React.SyntheticEvent<HTMLInputElement>) {
        selStart.current = e.currentTarget.selectionStart ?? 0;
    }

    // re-hide the character after a second
    useEffect(() => {
        if (reveal < 0) return;
        const timer = setTimeout(() => {
            caret.current = ref.current?.selectionStart ?? null;
            setReveal(-1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [reveal, value]);

    // React moves the caret to the end when it swaps the text; put it back
    useLayoutEffect(() => {
        if (caret.current === null || !ref.current) return;
        ref.current.setSelectionRange(caret.current, caret.current);
        caret.current = null;
    });

    return (
        <input
            ref={ref}
            type="text"
            value={display}
            onChange={handleChange}
            onKeyDown={rememberSelection}
            onSelect={rememberSelection}
            placeholder={placeholder}
            aria-label={placeholder}
            className={className}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
        />
    );
}

export default PasswordInput;
