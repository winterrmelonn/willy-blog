"use client";

import { useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
    AdditiveBlending, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute,
    InstancedMesh, Material, Matrix4, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry,
    Quaternion, ShaderMaterial, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import SceneReady from "./SceneReady";
import { useDarkMode } from "./darkmode";

type Vec3 = [number, number, number];
type Item = { position: Vec3; rotation?: Vec3; scale?: Vec3; color?: string };

// Seeded random numbers, so the forest looks the same on every visit.
function seeded(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];

// How wide the field is at depth z, so nothing gets placed off-screen.
const CAMERA_Z = 5.5;
// `spread` 1.3 covers screens up to ~2.5x wider than tall.
const halfWidth = (z: number, margin: number, spread = 1.3) => margin + (CAMERA_Z - z) * spread;
// The detailed lilies only cover the middle; simple ones fill the sides.
const nearHalfWidth = (z: number) => halfWidth(z, 0.8, 0.9);
const NEAR_END = -0.8; // detailed lilies stop here
// The ground rises gently into the distance, like the photo, so the field fills more of the view.
const groundY = (z: number) => Math.max(0, -z - 2) * 0.07;

// ---------- wind ----------

const wind = { value: 0 };
function addWind(material: Material, strength: number, lift = 0) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = wind;
        shader.vertexShader = shader.vertexShader
            .replace("void main() {", "uniform float uTime;\nvoid main() {")
            .replace("#include <project_vertex>", `
                vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
                float h = max(mvPosition.y - instanceMatrix[3].y, 0.0) + ${lift.toFixed(2)};
                float gust = sin(uTime * 1.2 + mvPosition.x * 0.5 + mvPosition.z * 0.3)
                           + 0.4 * sin(uTime * 2.7 + mvPosition.x * 1.3);
                mvPosition.x += gust * ${strength.toFixed(4)} * h * h;
                mvPosition = modelViewMatrix * mvPosition;
                gl_Position = projectionMatrix * mvPosition;
            `);
    };
    return material;
}

function WindClock() {
    useFrame((state) => {
        wind.value = state.clock.elapsedTime;
    });
    return null;
}

// ---------- drawing many copies ----------

// One InstancedMesh with a copy of `geometry` at every item.
function Scatter({ geometry, material, items }: { geometry: BufferGeometry; material: Material; items: Item[] }) {
    const ref = useRef<InstancedMesh>(null);
    useLayoutEffect(() => {
        const mesh = ref.current!;
        const o = new Object3D();
        const c = new Color();
        items.forEach((item, i) => {
            o.position.set(...item.position);
            o.rotation.set(...(item.rotation ?? [0, 0, 0]));
            o.scale.set(...(item.scale ?? [1, 1, 1]));
            o.updateMatrix();
            mesh.setMatrixAt(i, o.matrix);
            if (item.color) mesh.setColorAt(i, c.set(item.color));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, [items]);
    return <instancedMesh ref={ref} args={[geometry, material, items.length]} />;
}

// Give a shape a colour per vertex, so different parts can be merged into one shape.
function paint(geometry: BufferGeometry, color: string | ((y: number) => Color)) {
    const pos = geometry.attributes.position;
    const colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
        const c = typeof color === "string" ? new Color(color) : color(pos.getY(i));
        colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geometry;
}

// ---------- spider lilies ----------

// Close to the camera: the detailed Sketchfab model.
const nearLilies: Item[] = (() => {
    const r = seeded(1);
    const items: Item[] = [];
    for (let z = 4.1; z > NEAR_END; z -= 0.3) {
        const w = nearHalfWidth(z);
        for (let x = -w; x < w; x += 0.3) {
            const s = 0.95 + r() * 0.45;
            items.push({
                position: [x + r() * 0.3, 0, z - r() * 0.3],
                rotation: [(r() - 0.5) * 0.15, r() * Math.PI * 2, (r() - 0.5) * 0.15],
                scale: [s, s, s],
            });
        }
    }
    return items;
})();

function NearLilies() {
    const { nodes } = useGLTF("/models/spider-lily/scene.gltf");
    const lily = nodes["LycorisRadiata_LycorisRadiataTexture_0"] as Mesh;
    const shape = useMemo(() => {
        lily.updateWorldMatrix(true, false);
        return lily.geometry.clone().applyMatrix4(lily.matrixWorld);
    }, [lily]);
    const material = useMemo(() => {
        const m = (lily.material as MeshStandardMaterial).clone();
        m.color.set("#d84848"); // deep, saturated red like the photo
        return addWind(m, 0.12);
    }, [lily]);
    return <Scatter geometry={shape} material={material} items={nearLilies} />;
}

// Further away: a simple home-made lily (stem + ring of petals + long stamens).
// ponytail: ~100 triangles each instead of 39k; fog and distance hide the difference.
function makeSimpleLily() {
    const up = new Vector3(0, 1, 0);
    const head = new Vector3(0, 0.45, 0);
    const parts: BufferGeometry[] = [];

    const stem = new CylinderGeometry(0.006, 0.008, 0.45, 4, 1);
    stem.translate(0, 0.225, 0);
    parts.push(paint(stem, "#3f6e2c"));

    const spike = (length: number, radius: number, dir: Vector3, color: string) => {
        const g = new ConeGeometry(radius, length, 3, 1);
        g.translate(0, length / 2, 0);
        g.applyQuaternion(new Quaternion().setFromUnitVectors(up, dir.normalize()));
        g.translate(head.x, head.y, head.z);
        parts.push(paint(g, color));
    };
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        spike(0.08, 0.014, new Vector3(Math.cos(a), 0.15, Math.sin(a)), "#a80c14"); // petals
        spike(0.13, 0.003, new Vector3(Math.cos(a + 0.3), 0.9, Math.sin(a + 0.3)), "#c41820"); // stamens
        spike(0.12, 0.003, new Vector3(Math.cos(a + 0.8), 0.6, Math.sin(a + 0.8)), "#c41820");
    }
    return mergeGeometries(parts)!;
}

const farLilies: Item[] = (() => {
    const r = seeded(2);
    const items: Item[] = [];
    while (items.length < 30000) {
        // more samples near the front, where each flower covers more of the screen
        const z = 4.2 - Math.pow(r(), 1.7) * 52;
        const w = halfWidth(z, 2);
        const x = (r() * 2 - 1) * w;
        if (z > NEAR_END && Math.abs(x) < nearHalfWidth(z)) continue; // the detailed lilies are here
        const s = 0.85 + r() * 0.5;
        items.push({
            position: [x, groundY(z), z],
            rotation: [(r() - 0.5) * 0.25, r() * Math.PI * 2, (r() - 0.5) * 0.25],
            scale: [s, s * (0.8 + r() * 0.5), s],
        });
    }
    return items;
})();

function FarLilies() {
    const shape = useMemo(() => makeSimpleLily(), []);
    const material = useMemo(() => addWind(new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 0.14), []);
    return <Scatter geometry={shape} material={material} items={farLilies} />;
}

// ---------- grass ----------

function makeBlade() {
    const blade = new PlaneGeometry(0.04, 0.35, 1, 4);
    blade.translate(0, 0.175, 0);
    const points = blade.attributes.position;
    for (let i = 0; i < points.count; i++) {
        const t = points.getY(i) / 0.35;
        points.setX(i, points.getX(i) * (1 - t));
        points.setZ(i, t * t * 0.08);
    }
    blade.computeVertexNormals();
    return paint(blade, (y) => new Color().setScalar(0.35 + 0.65 * (y / 0.35)));
}

const GREENS = ["#2f5a2a", "#3d6b33", "#4a7a3a", "#26472a", "#5b7f3a", "#1e3b1f"];

const blades: Item[] = (() => {
    const r = seeded(3);
    return Array.from({ length: 40000 }, () => {
        const z = 4.4 - Math.pow(r(), 1.6) * 40;
        const h = 0.5 + r();
        return {
            position: [(r() * 2 - 1) * halfWidth(z, 1.5), groundY(z), z] as Vec3,
            rotation: [(r() - 0.5) * 0.5, r() * Math.PI, (r() - 0.5) * 0.5] as Vec3,
            scale: [1, h, 1] as Vec3,
            color: pick(r, GREENS),
        };
    });
})();

function Grass() {
    const shape = useMemo(() => makeBlade(), []);
    const material = useMemo(
        () => addWind(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide }), 0.18), []);
    return <Scatter geometry={shape} material={material} items={blades} />;
}

// ---------- trees ----------

type Branch = { y0: number; length: number; radius: number; dir: Vector3 };
type Tree = {
    x: number; z: number; radius: number; lean: number; bend: number; phase: number;
    shade: number; moss: number; branches: Branch[];
};

const TRUNK_HEIGHT = 14;

const trees: Tree[] = (() => {
    const r = seeded(4);
    const rb = seeded(5);
    const list: Tree[] = [];
    while (list.length < 150) {
        const z = 1 - Math.pow(r(), 0.8) * 45;
        const x = (r() * 2 - 1) * halfWidth(z, 4);
        if (Math.abs(x) < 1.6 && z > -4) continue; // keep the foreground open
        if (list.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6)) continue; // no trunks touching
        const radius = 0.16 + r() * 0.2;
        // branches angle up and out from the upper trunk
        const branches = Array.from({ length: 4 + Math.floor(rb() * 4) }, () => {
            const turn = rb() * Math.PI * 2;
            const tilt = 0.5 + rb() * 0.6; // radians away from straight up
            return {
                y0: 3 + rb() * 5,
                length: 1.2 + rb() * 2.2,
                radius: radius * (0.25 + rb() * 0.15),
                dir: new Vector3(Math.sin(tilt) * Math.cos(turn), Math.cos(tilt), Math.sin(tilt) * Math.sin(turn)),
            };
        });
        list.push({
            x, z, radius, lean: (r() - 0.5) * 0.18, bend: 0.15 + r() * 0.35,
            phase: r() * 6, shade: r(), moss: r(), branches,
        });
    }
    return list;
})();

// Shared tree shape maths, so bark, branches, leaves and vines all line up.
const bendAt = (t: Tree, y: number) => Math.sin(y * 0.35 + t.phase) * t.bend;
const flareAt = (y: number) => 1 + 0.7 * Math.exp(-y * 2.5);
const trunkRadiusAt = (t: Tree, y: number) => t.radius * (1 - 0.45 * (y / TRUNK_HEIGHT)) * flareAt(y);
const placeOf = (t: Tree) => new Matrix4().makeRotationZ(t.lean).setPosition(t.x, groundY(t.z) - 0.2, t.z);
// a point in the tree's own space (before bending) moved into the world
const treeToWorld = (t: Tree, x: number, y: number, z: number) =>
    new Vector3(x + bendAt(t, y), y, z + bendAt(t, y) * 0.4).applyMatrix4(placeOf(t));
// a point `along` metres out a branch, in the world
const branchPoint = (t: Tree, b: Branch, along: number) => {
    const p = b.dir.clone().multiplyScalar(along);
    const k = bendAt(t, b.y0);
    return new Vector3(p.x + k, b.y0 + p.y, p.z + k * 0.4).applyMatrix4(placeOf(t));
};

// Every trunk and branch merged into one shape.
function makeTrunks() {
    const up = new Vector3(0, 1, 0);
    const dark = new Color("#221f1a");
    const light = new Color("#5f5a4d");
    const moss = new Color("#56663a");

    const shapes = trees.flatMap((t) => {
        const base = dark.clone().lerp(light, t.shade);

        // Bark: vertical streaks around the trunk, moss low down on one side.
        const barkColor = (x: number, y: number, z: number) => {
            const a = Math.atan2(z, x);
            const streak = 0.72 + 0.18 * Math.sin(a * 7 + t.phase * 3) + 0.1 * Math.sin(a * 17 + y * 0.8);
            const mossy = Math.min(1, Math.max(0, (1.1 - y * 0.1 + Math.cos(a - t.phase) * 0.6) * t.moss));
            return base.clone().lerp(moss, mossy).multiplyScalar(streak);
        };
        const colorize = (g: BufferGeometry, yOffset: number) => {
            const pos = g.attributes.position;
            const colors: number[] = [];
            for (let i = 0; i < pos.count; i++) {
                const c = barkColor(pos.getX(i), pos.getY(i) + yOffset, pos.getZ(i));
                colors.push(c.r, c.g, c.b);
            }
            g.setAttribute("color", new Float32BufferAttribute(colors, 3));
        };

        // trunk: tapered, flared at the base, gently bent
        const trunk = new CylinderGeometry(t.radius * 0.55, t.radius, TRUNK_HEIGHT, 10, 16, true);
        trunk.translate(0, TRUNK_HEIGHT / 2, 0);
        colorize(trunk, 0);
        const pos = trunk.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            pos.setXYZ(i, pos.getX(i) * flareAt(y) + bendAt(t, y), y, pos.getZ(i) * flareAt(y) + bendAt(t, y) * 0.4);
        }
        const parts: BufferGeometry[] = [trunk];

        for (const b of t.branches) {
            const g = new CylinderGeometry(b.radius * 0.2, b.radius, b.length, 6, 4, true);
            g.translate(0, b.length / 2, 0);
            colorize(g, b.y0);
            g.applyQuaternion(new Quaternion().setFromUnitVectors(up, b.dir));
            g.translate(bendAt(t, b.y0), b.y0, bendAt(t, b.y0) * 0.4);
            parts.push(g);
        }

        const place = placeOf(t);
        for (const g of parts) {
            g.computeVertexNormals();
            g.applyMatrix4(place);
        }
        return parts;
    });
    return mergeGeometries(shapes)!;
}

function Trunks() {
    const shape = useMemo(() => makeTrunks(), []);
    return (
        <mesh geometry={shape}>
            <meshStandardMaterial vertexColors roughness={1} />
        </mesh>
    );
}

// ---------- leaves ----------

const LEAF_GREENS = ["#4f7a2a", "#6b9233", "#86a83c", "#3a6026", "#9cbc4f", "#b3c95e", "#c2c56a", "#5d8a30"];
const IVY_GREENS = ["#2f5524", "#3c6a2b", "#4d7d33", "#284a1f", "#5a8a3a"];

const leaves: Item[] = (() => {
    const r = seeded(6);
    const items: Item[] = [];
    const leaf = (p: Vector3, size = 1) => {
        const s = (0.7 + r() * 0.8) * size;
        items.push({
            position: [p.x, p.y, p.z],
            rotation: [r() * Math.PI, r() * Math.PI, r() * Math.PI],
            scale: [s, s, s],
            color: pick(r, LEAF_GREENS),
        });
    };
    const around = (c: Vector3, spread: number) =>
        new Vector3(c.x + (r() - 0.5) * spread, c.y + (r() - 0.4) * spread * 0.7, c.z + (r() - 0.5) * spread);

    for (const t of trees) {
        // clumps of leaves along every branch, biggest at the tip
        for (const b of t.branches) {
            for (let k = 1; k <= 6; k++) {
                const along = b.length * (0.3 + 0.7 * (k / 6));
                const centre = branchPoint(t, b, along);
                const spread = 0.5 + (k / 6) * 0.9;
                for (let i = 0; i < 18 + k * 9; i++) leaf(around(centre, spread));
            }
        }
        // a crown over the top of the trunk
        const crown = treeToWorld(t, 0, 9 + r() * 2, 0);
        for (let i = 0; i < 350; i++) leaf(around(crown, 4.5));
    }
    // a looser ceiling over everything, so no sky gaps show
    for (let i = 0; i < 40000; i++) {
        const z = 2 - r() * 48;
        leaf(new Vector3((r() * 2 - 1) * halfWidth(z, 6), groundY(z) + 7 + r() * 6, z));
    }
    return items;
})();

// Ivy: small leaves hugging the bark, spiralling up some trunks plus a patch at the base.
const ivy: Item[] = (() => {
    const r = seeded(7);
    const items: Item[] = [];
    const cling = (t: Tree, angle: number, y: number) => {
        const radius = trunkRadiusAt(t, y) + 0.02;
        const p = treeToWorld(t, Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        const s = 0.55 + r() * 0.45;
        items.push({
            position: [p.x, p.y, p.z],
            // face outwards from the trunk, with a little wobble
            rotation: [(r() - 0.5) * 0.8, Math.PI / 2 - angle + (r() - 0.5) * 0.8, (r() - 0.5) * Math.PI],
            scale: [s, s, s],
            color: pick(r, IVY_GREENS),
        });
    };
    for (const t of trees) {
        if (t.moss < 0.3) continue; // not every tree is overgrown
        const vines = 1 + Math.floor(t.moss * 3);
        for (let v = 0; v < vines; v++) {
            const start = r() * Math.PI * 2;
            const twist = (r() - 0.5) * 1.4; // how fast it wraps around, per metre
            const top = 2 + r() * 6;
            for (let y = 0.1; y < top; y += 0.05) {
                for (let n = 0; n < 2; n++) cling(t, start + y * twist + (r() - 0.5) * 0.5, y + (r() - 0.5) * 0.05);
            }
        }
        // a thick patch around the mossy side of the base
        for (let i = 0; i < 160 * t.moss; i++) cling(t, t.phase + (r() - 0.5) * 2.4, Math.pow(r(), 1.5) * 1.6);
    }
    return items;
})();

function Leaves({ glow }: { glow: string }) {
    const shape = useMemo(() => {
        const g = new CircleGeometry(0.1, 5).scale(1.5, 0.8, 1); // a small pointed oval
        return paint(g, (y) => new Color().setScalar(0.85 + y * 2));
    }, []);
    const canopy = useMemo(
        () => addWind(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.8, emissive: glow }), 0.025, 1), [glow]);
    const clinging = useMemo(() => new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.9 }), []);
    return (
        <>
            <Scatter geometry={shape} material={canopy} items={leaves} />
            <Scatter geometry={shape} material={clinging} items={ivy} />
        </>
    );
}

// ---------- scene ----------

function Ground({ color }: { color: string }) {
    const shape = useMemo(() => {
        const g = new PlaneGeometry(160, 160, 1, 160).rotateX(-Math.PI / 2);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(pos.getZ(i)));
        g.computeVertexNormals();
        return g;
    }, []);
    return (
        <mesh geometry={shape}>
            <meshStandardMaterial color={color} />
        </mesh>
    );
}

// ---------- fireflies (night only) ----------

// Soft glowing dots that drift in little loops and blink, all moved by the graphics card.
function Fireflies() {
    const pixelRatio = useThree((state) => state.gl.getPixelRatio());
    const geometry = useMemo(() => {
        const r = seeded(8);
        const positions: number[] = [];
        const seeds: number[] = [];
        for (let i = 0; i < 260; i++) {
            const z = 4 - Math.pow(r(), 1.3) * 30;
            positions.push((r() * 2 - 1) * halfWidth(z, 1), groundY(z) + 0.3 + r() * 2.2, z);
            seeds.push(r() * 100, 0.4 + r() * 0.8, 0.5 + r() * 1.5); // phase, drift speed, blink speed
        }
        const g = new BufferGeometry();
        g.setAttribute("position", new Float32BufferAttribute(positions, 3));
        g.setAttribute("seed", new Float32BufferAttribute(seeds, 3));
        return g;
    }, []);
    const material = useMemo(() => new ShaderMaterial({
        uniforms: { uTime: wind, uSize: { value: 70 * pixelRatio } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexShader: `
            uniform float uTime;
            uniform float uSize;
            attribute vec3 seed;
            varying float vBlink;
            void main() {
                float t = uTime * seed.y + seed.x;
                vec3 p = position + vec3(sin(t) * 0.6, sin(t * 1.7) * 0.25, cos(t * 0.8) * 0.6);
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                vBlink = smoothstep(0.15, 1.0, 0.5 + 0.5 * sin(uTime * seed.z + seed.x * 3.0));
                gl_PointSize = uSize / -mv.z; // bigger when closer
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            varying float vBlink;
            void main() {
                float glow = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
                gl_FragColor = vec4(vec3(1.0, 0.92, 0.5) * glow * glow * vBlink * 1.6, 1.0);
            }`,
    }), [pixelRatio]);
    return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------- scene ----------

// Warm autumn afternoon, or (in dark mode) a moonlit night with fireflies.
const DAY = {
    haze: "#c9cf8f", fog: [6, 46], ground: "#3a3a1f", leafGlow: "#3b4210",
    sky: ["#fff1d2", "#4a3b22", 1.8] as const,
    back: { color: "#ffd89a", intensity: 2.2 }, // low sun behind the trees
    front: { color: "#ffe9c4", intensity: 1.3 },
};
const NIGHT = {
    haze: "#0c1424", fog: [3, 30], ground: "#10140f", leafGlow: "#000000",
    sky: ["#5468a0", "#07080c", 0.55] as const,
    back: { color: "#a9bdff", intensity: 1.2 }, // moonlight
    front: { color: "#8090c0", intensity: 0.3 },
};

export default function SpiderLilyModel({ onReady }: { onReady?: () => void }) {
    const night = useDarkMode();
    const look = night ? NIGHT : DAY;
    return (
        <Canvas flat camera={{ position: [0, 1.55, CAMERA_Z], rotation: [-0.12, 0, 0], fov: 55, far: 80 }}>
            <color attach="background" args={[look.haze]} />
            <fog attach="fog" args={[look.haze, look.fog[0], look.fog[1]]} />
            <hemisphereLight args={[...look.sky]} />
            <directionalLight position={[-4, 9, -12]} intensity={look.back.intensity} color={look.back.color} />
            <directionalLight position={[3, 6, 8]} intensity={look.front.intensity} color={look.front.color} />
            {night && <Fireflies />}
            <Ground color={look.ground} />
            <Trunks />
            <Leaves glow={look.leafGlow} />
            <Grass />
            <FarLilies />
            <Suspense fallback={null}>
                <NearLilies />
                <SceneReady onReady={onReady} />
            </Suspense>
            <WindClock />
        </Canvas>
    );
}
