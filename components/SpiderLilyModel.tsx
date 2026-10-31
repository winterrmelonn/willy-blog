"use client";

import { Instances, useGLTF, Instance, Stats } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Mesh, Material, MeshStandardMaterial, PlaneGeometry, Float32BufferAttribute, DoubleSide } from "three";

const wind = { value: 0 };
function addWind(material: Material, strength: number) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = wind;
        shader.vertexShader = shader.vertexShader
            .replace("void main() {", "uniform float uTime;\nvoid main() {")
            .replace("#include <project_vertex>", `
                vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
                float h = max(mvPosition.y, 0.0);
                float gust = sin(uTime * 1.2 + mvPosition.x * 0.5 + mvPosition.z * 0.3)
                           + 0.4 * sin(uTime * 2.7 + mvPosition.x * 1.3);
                mvPosition.x += gust * ${strength.toFixed(2)} * h * h;
                mvPosition = modelViewMatrix * mvPosition;
                gl_Position = projectionMatrix * mvPosition;
            `);
    };
    return material;
}

/*
function LilyModel({ position }: {position: [number, number, number]}) {
    const { scene } = useGLTF("/models/spider-lily/scene.gltf");
    return <Clone object={scene} scale={1.1} position={ position }/>;
}
*/

function LilyField() {
    const { nodes } = useGLTF("/models/spider-lily/scene.gltf");
    // console.log(Object.keys(nodes));
    const lily = nodes["LycorisRadiata_LycorisRadiataTexture_0"] as Mesh;
    const shape = useMemo(() => {
        lily.updateWorldMatrix(true, false);
        addWind(lily.material as Material, 0.1);
        return lily.geometry.clone().applyMatrix4(lily.matrixWorld);
    }, [lily]);

    useFrame((state) => {
        wind.value = state.clock.elapsedTime;
    });

    return (
        <Instances geometry={shape} material={lily.material} limit={positions.length}>
        {positions.map((p, i) => <Instance key={i} position={p}/>)}
        </Instances>
    );
}

const GRASS = 8500;
const GREENS = ["#2f5a2a", "#3d6b33", "#4a7a3a", "#26472a"];

const blades = Array.from({ length: GRASS }, () => {
    const height = 0.5 + Math.random();
    return {
        position: [(Math.random() - 0.5) * 13, 0, 4 - Math.random() * 10] as [number, number, number],
        rotation: [(Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4] as [number, number, number],
        scale: [1, height, 1] as [number, number, number],
        color: GREENS[Math.floor(Math.random() * GREENS.length)]
    };
});

function makeBlade() {
    const blade = new PlaneGeometry(0.04, 0.35, 1, 4);
    blade.translate(0, 0.175, 0);

    const points = blade.attributes.position;
    const shades: number[] = [];

    for (let i = 0; i < points.count; i++) {
        const t = points.getY(i) / 0.35;
        points.setX(i, points.getX(i) * (1 - t));
        points.setZ(i, t * t * 0.08);
        const shade = 0.35 + 0.65 * t;
        shades.push(shade, shade, shade);
    }

    blade.setAttribute("color", new Float32BufferAttribute(shades, 3));
    blade.computeVertexNormals();
    return blade;
}

function Grass() {
    const bladeShape = useMemo(() => makeBlade(), []);
    const grassMaterial = useMemo(
        () => addWind(new MeshStandardMaterial({vertexColors: true, side: DoubleSide }), 0.4), []);
    return (
        <Instances limit={GRASS} frames={1} geometry={bladeShape} material={grassMaterial}>
            {/* <coneGeometry args={[0.02, 0.3, 3]} /> */}
            {blades.map((b,i) => (
                <Instance key={i} position={b.position} rotation={b.rotation} scale={b.scale} color={b.color}/>
            ))}
        </Instances>
    );
}

const SPACING = 0.34
const positions: [number, number, number][] = [];
for (let x = -7.8; x <= 8; x += SPACING) {
    for (let z = -6; z <= 4; z += SPACING) {
        positions.push([x + Math.random() * SPACING, 
            0, 
            z - Math.random() * SPACING
    ]);
}
}

/*
const COUNT = 1000
const positions = Array.from({ length: COUNT }, () => [
    (Math.random() - 0.5) * 24, 
    0, 
    2 - (Math.random() - 0.5) * 27
] as [number, number, number]);
 */

export default function SpiderLilyModel() {
    return (
    <Canvas camera={{position: [0, 1.8, 4.8], fov: 50}}>
        <Suspense fallback={null}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[50, 50]} />
                <meshStandardMaterial color="#3e6348" />
                </mesh>
            <fog attach="fog" args={["#394d36", 5, 13]} />
            <color attach="background" args={["#394d36"]} />
            <LilyField />
            <Grass />
            {/* <ambientLight intensity={0.2} /> */}
            <hemisphereLight args={["#d8ecd0", "#1b2a17", 0.9]} />
            <directionalLight position={[2, 3, 4]} />
            {/* <Stats /> */}
        </Suspense>
        </Canvas>
    );
}