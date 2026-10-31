"use client";

import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { CatmullRomCurve3 } from "three";

export default function SpiderLily() {

    return (
        <Canvas>
            <OrbitControls />
            <ambientLight intensity={0.3} />
            <directionalLight position={[2, 3, 4]} />
            <mesh>
                <meshStandardMaterial color="green" />
                <tubeGeometry args={[stem, 64, 0.2, 8, false]} />
            </mesh>
        </Canvas>
    )
}

const stem = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(-0.5, 2, 0),
    new Vector3(0, 4, 0),
    new Vector3(0.5, 6, 0),
    new Vector3(0, 8, 0)
]);