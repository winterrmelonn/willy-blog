"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// Put inside a <Canvas> (after everything else, inside the same Suspense): calls onReady a few frames
// after the scene first draws, so a loading screen can fade out.
export default function SceneReady({ onReady }: { onReady?: () => void }) {
    const frames = useRef(0);
    useFrame(() => {
        if (++frames.current === 3) onReady?.();
    });
    return null;
}
