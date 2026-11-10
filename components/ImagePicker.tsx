"use client";

import { useRef, useState } from "react";
import { uploadImage, discardImage } from "@/app/images/actions";

// Shrink a picked photo in the browser (at most 1600px wide, WebP or JPEG, under ~900KB), upload it, and
// return its id. Server actions accept up to 1MB, and big photos would make pages slow anyway.
export async function shrinkAndUpload(file: File) {
    const bitmap = await createImageBitmap(file);
    const k = Math.min(1, 1600 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.82, 0.65, 0.5]) {
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
        if (blob && blob.type !== "image/webp") blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality)); // Safari can't write WebP
        if (blob && blob.size < 900_000) break;
    }
    if (!blob || blob.size >= 900_000) throw new Error("Image too large");
    const form = new FormData();
    form.append("image", new File([blob], "cover", { type: blob.type }));
    return uploadImage(form);
}

const pill = "rounded-full px-4 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 hover:opacity-80 disabled:opacity-50";

// Add / change / remove a cover image while editing. `value` is the image id. A replaced or removed image is
// deleted unless something saved still uses it (then saving cleans it up instead).
export default function ImagePicker({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function pick(file: File | undefined) {
        if (!file) return;
        setBusy(true);
        setError("");
        try {
            onChange(await shrinkAndUpload(file));
            if (value) discardImage(value).catch(() => {});
        } catch {
            setError("Couldn't upload that image.");
        }
        setBusy(false);
        if (input.current) input.current.value = "";
    }

    return (
        <div className="flex flex-col gap-2">
            {value && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/images/${value}`} alt="" className="h-32 w-full rounded-lg object-cover" />
            )}
            <div className="flex flex-wrap items-center gap-2">
                <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                <button type="button" disabled={busy} className={pill} onClick={() => input.current?.click()}>
                    {busy ? "Uploading..." : value ? "Change image" : "Add image"}
                </button>
                {value && !busy && <button type="button" className={pill} onClick={() => { onChange(undefined); discardImage(value).catch(() => {}); }}>Remove image</button>}
                {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
            </div>
        </div>
    );
}
