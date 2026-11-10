"use client";

import { useEffect, useRef, type RefObject } from "react";

// The Rustbreeder backdrop: walking slowly down a bright, misty vertical-farm greenhouse. Steel racks either side
// hold tiers of white trays overflowing with lettuce; an irrigation line with red clamps runs along each rack,
// grow-light bars hang over the aisle, yellow markings run down the floor, and green greenhouse trusses arch above. The pointer nudges the camera and
// bumping `kick` (Finalize does) makes it surge forward. Reduced motion gets one still frame.
//
// Speed: the sky/floor is painted once per resize, and the lettuce is painted once into sprites (pre-fogged at a
// few depths), so a frame is a few hundred flat quads plus drawImage calls.

type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const FOG = rgb("#edf2eb");
const mix = (c: RGB, t: number) => `rgb(${c.map((v, i) => Math.round(v + (FOG[i] - v) * t)).join()})`;
const hash = (a: number, b: number) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

const C = {
    trayTop: rgb("#fbfdfb"), trayUnder: rgb("#dfe6e1"), trayEnd: rgb("#ffffff"), trayFront: rgb("#e7ece8"), ridge: rgb("#c9d3cc"),
    shadow: rgb("#b9c4bd"), steel: rgb("#f2f5f2"), steelSide: rgb("#cdd5cf"), slot: rgb("#7d8a82"), pipe: rgb("#3b4541"),
    clamp: rgb("#d4453b"), rib: rgb("#7fae89"), ribDark: rgb("#5f9068"), trim: rgb("#e6d63a"), ink: rgb("#29312e"), light: rgb("#ffffff"),
};

// eye at y = 0; the camera walks the aisle at x = 0 toward +z
const FLOOR = -1.75, TIERS = [-1.3, -0.75, -0.2, 0.35, 0.9, 1.45], ROOF = 2.05;
const XI = 1.15, XO = 2.45;          // rack: aisle-side edge and back edge
const GAP = 1.0, TRAY = 0.78, FAR = 30;
const FOG_LEVELS = [0, 0.3, 0.55, 0.8];
const SW = 520, SH = 300, BED = 215; // lettuce sprite size and where the tray surface sits in it

// eight lettuce varieties: [kind, base hue, saturation, lightness shift]. kind 0: butterhead, 1: loose leaf, 2: romaine, 3: young heads.
// The hues run from yellow-lime through fresh green to deep and blue-green, like a real crop at different ages.
const VARIETIES = [[0, 92, 60, 4], [1, 84, 66, 10], [0, 104, 52, -6], [2, 98, 56, 0], [0, 80, 68, 12], [3, 96, 58, 6], [1, 112, 44, -8], [2, 88, 62, 4]] as const;

// A tray's worth of lettuce: a few heads of layered, ruffled leaves, outer leaves first and pale hearts last.
// Every leaf gets its own shade, length, width, bend and lean, and each ring is drawn in a shuffled order, so the
// overlaps never repeat; some leaves catch the light (paler, yellower) and some are folded edge-on.
function lettuceSprite([kind, baseHue, sat, lift]: (typeof VARIETIES)[number], seed: number) {
    const c = document.createElement("canvas");
    c.width = SW * 2; c.height = SH * 2; // 2x: the nearest trays get drawn large
    const g = c.getContext("2d")!;
    g.scale(2, 2);
    let s = seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const jit = (n: number) => (rnd() - 0.5) * 2 * n;

    const leaf = (cx: number, cy: number, a: number, len: number, wd: number, bend: number, hue: number, sa: number, light: number) => {
        const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, ph = rnd() * 6, ruffle = 0.08 + rnd() * 0.12;
        // the midline curves sideways by `bend`, so leaves arc and curl instead of sticking straight out
        const mid = (u: number): [number, number] => [cx + dx * len * u + nx * bend * len * u * u, cy + dy * len * u + ny * bend * len * u * u];
        const pt = (u: number, side: number) => {
            const prof = Math.sin(Math.PI * Math.min(1, u * 1.08)) ** 0.7; // widest just past the middle, round tip
            const frill = 1 + ruffle * Math.sin(u * 26 + ph) * u;           // ruffled edge, more toward the tip
            const [mx, my] = mid(u);
            return [mx + nx * wd * 0.5 * prof * frill * side, my + ny * wd * 0.5 * prof * frill * side];
        };
        g.beginPath();
        for (let i = 0; i <= 16; i++) { const [x, y] = pt(i / 16, 1); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        for (let i = 16; i >= 0; i--) { const [x, y] = pt(i / 16, -1); g.lineTo(x, y); }
        g.closePath();
        const [tx, ty] = mid(1);
        const grad = g.createLinearGradient(cx, cy, tx, ty);
        grad.addColorStop(0, `hsl(${hue - 10} ${sa}% ${Math.min(88, light + 18)}%)`); // pale stem end
        grad.addColorStop(0.55, `hsl(${hue} ${sa}% ${light}%)`);
        grad.addColorStop(1, `hsl(${hue + 4} ${sa + 4}% ${light - 4}%)`);
        g.fillStyle = grad; g.fill();
        g.strokeStyle = `hsla(${hue + 4} ${sa - 10}% ${light - 16}% / .32)`; g.lineWidth = 0.8; g.stroke(); // edge
        g.strokeStyle = `hsla(${hue - 12} ${sa}% ${Math.min(92, light + 24)}% / .65)`; g.lineWidth = 1.1;     // midrib and veins
        g.beginPath(); g.moveTo(cx, cy);
        for (let i = 1; i <= 8; i++) g.lineTo(...mid((i / 8) * 0.88));
        for (const v of [0.3, 0.52, 0.72]) {
            const [x, y] = mid(v);
            for (const side of [-1, 1]) { g.moveTo(x, y); g.lineTo(x + (dx * 0.5 + nx * side * 0.8) * wd * 0.32, y + (dy * 0.5 + ny * side * 0.8) * wd * 0.32); }
        }
        g.stroke();
    };

    const head = (hx: number, r: number) => {
        const romaine = kind === 2, loose = kind === 1;
        const hueShift = jit(8), lightShift = jit(6), lean = jit(0.22); // each head its own shade and lean
        const rings = [[16, 1, 36, 10], [12, 0.78, 48, 4], [9, 0.55, 62, -6]] as const; // count, size, lightness, hue offset (deep out, lime in)
        for (const [count, size, light, hueOff] of rings) {
            const slots = [...Array(count).keys()].sort(() => rnd() - 0.5); // shuffled, so overlaps differ
            for (const i of slots) {
                const spread = romaine ? 1.4 : size === 1 ? (loose ? 4.2 : 3.9) : 3.2; // outer leaves reach past horizontal and droop
                const a = -Math.PI / 2 + lean + (i / (count - 1) - 0.5) * spread + jit(0.45);
                const len = r * size * (romaine ? 1.35 : loose ? 1.12 : 1) * (0.7 + rnd() * 0.45);
                const folded = rnd() < 0.18, sunlit = rnd() < 0.16;
                const wd = len * (folded ? 0.24 : (romaine ? 0.36 : 0.55) + rnd() * 0.3);
                leaf(hx + jit(r * 0.14), BED - 4 + jit(3), a, len, wd, jit(loose ? 0.45 : 0.3),
                    baseHue + hueOff + hueShift + jit(12) - (sunlit ? 10 : 0),
                    sat + jit(10), light + lift + lightShift + jit(8) + (sunlit ? 16 : 0) + (folded ? 8 : 0));
            }
        }
        for (let i = 0; i < 6; i++) leaf(hx, BED - 6, -Math.PI / 2 + lean + jit(0.8), r * (0.26 + rnd() * 0.12), r * (0.22 + rnd() * 0.12), jit(0.3), baseHue - 12 + jit(6), sat + 6, 72 + jit(6)); // heart
    };

    const n = kind === 3 ? 4 : 3;
    for (let i = 0; i < n; i++) head(70 + (i + 0.5) * ((SW - 140) / n) + jit(14), (kind === 3 ? 58 : 90) + rnd() * 22);
    return c;
}

// pre-fogged copies (they're only drawn small: half size for the far ones), so distant trays sink into the mist too
function fogged(src: HTMLCanvasElement, t: number) {
    const k = t > 0.5 ? 0.5 : 1, c = document.createElement("canvas");
    c.width = SW * k; c.height = SH * k;
    const g = c.getContext("2d")!;
    g.drawImage(src, 0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(${FOG.join()},${t})`; g.fillRect(0, 0, c.width, c.height);
    return c;
}

// misty daylight above, a pale wet floor below, brightest down the far end of the aisle
function paintBackdrop(w: number, h: number, vx: number, vy: number) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    const sky = g.createLinearGradient(0, 0, 0, vy);
    sky.addColorStop(0, "#f3f7f2"); sky.addColorStop(1, "#edf2eb");
    g.fillStyle = sky; g.fillRect(0, 0, w, vy);
    const floor = g.createLinearGradient(0, vy, 0, h);
    floor.addColorStop(0, "#edf2eb"); floor.addColorStop(0.3, "#dfe7df"); floor.addColorStop(1, "#cbd6cd");
    g.fillStyle = floor; g.fillRect(0, vy, w, h - vy);
    g.globalAlpha = 0.35; g.fillStyle = "#fff"; // wet sheen
    for (let i = 0; i < 18; i++) { const y = vy + (h - vy) * (i / 18) ** 1.6; g.fillRect(vx - (y - vy) * 0.9, y, (y - vy) * 1.8, 1); }
    g.globalAlpha = 1;
    const glow = g.createRadialGradient(vx, vy, 0, vx, vy, Math.max(w, h) * 0.45);
    glow.addColorStop(0, "rgba(255,255,255,1)"); glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    return c;
}

export default function FarmBackground({ kick }: { kick: RefObject<number> }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const cv = ref.current!, cx = cv.getContext("2d")!;
        const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const mono = getComputedStyle(cv).getPropertyValue("--rb-mono").trim() || "monospace";
        const heads = VARIETIES.map((v, k) => { const base = lettuceSprite(v, 4321 + k * 811); return FOG_LEVELS.map((t) => (t ? fogged(base, t) : base)); });
        const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
        const pollen = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, v: 0.004 + Math.random() * 0.012 }));
        let w = 0, h = 0, d = 1, vx = 0, vy = 0, backdrop: HTMLCanvasElement, raf = 0, last = performance.now(), cam = 0, boost = 0, seen = kick.current;

        const size = () => {
            d = Math.min(devicePixelRatio, 2);
            w = innerWidth; h = innerHeight; vx = w * 0.56; vy = h * 0.44;
            cv.width = w * d; cv.height = h * d;
            cx.setTransform(d, 0, 0, d, 0, 0);
            backdrop = paintBackdrop(w + 120, h, vx + 60, vy);
        };
        const onMove = (e: PointerEvent) => { mouse.tx = e.clientX / w - 0.5; mouse.ty = e.clientY / h - 0.5; };

        function draw() {
            const f = Math.min(h * 0.95, w * 1.2), camX = mouse.x * 0.35, camY = -mouse.y * 0.2;
            const P = (x: number, y: number, z: number): [number, number] => [vx + ((x - camX) * f) / z, vy - ((y - camY) * f) / z];
            const quad = (pts: [number, number, number][], col: string) => {
                cx.fillStyle = col; cx.beginPath();
                pts.forEach(([x, y, z], i) => { const [sx, sy] = P(x, y, z); if (i) cx.lineTo(sx, sy); else cx.moveTo(sx, sy); });
                cx.fill();
            };
            const line = (a: [number, number, number], b: [number, number, number], col: string, width: number) => {
                cx.strokeStyle = col; cx.lineWidth = width; cx.beginPath(); cx.moveTo(...P(...a)); cx.lineTo(...P(...b)); cx.stroke();
            };

            cx.drawImage(backdrop, -60 - mouse.x * 30, 0);

            const first = Math.floor(cam / GAP), farthest = first + Math.ceil(FAR / GAP);
            cx.lineCap = "round";

            // ---- pass 1: the floor and the greenhouse roof, painted under everything (far to near) ----
            // the arch as a function of x, so trusses and glazing bars sit exactly on it
            const archY = (x: number) => { const u = (x + 2.95) / 5.9; return (1 - u) ** 2 * ROOF + 2 * (1 - u) * u * 3.75 + u * u * ROOF; };
            const GLAZING = [-2.5, -1.9, -1.25, -0.6, 0, 0.6, 1.25, 1.9, 2.5];
            for (let k = farthest; k >= first; k--) {
                const z = k * GAP - cam, z2 = z + GAP;
                if (z2 < 0.3) continue;
                const za = Math.max(0.3, z), t = Math.min(1, z / FAR) ** 0.85;
                const px = (wd: number) => Math.max(0.6, (wd * f) / Math.max(0.3, z));

                // floor: yellow aisle edges, a dashed centre line, and a pair of chevrons every few metres
                for (const s of [-0.85, 0.85]) line([s, FLOOR, za], [s, FLOOR, z2], mix(C.trim, t), px(0.045));
                if (k % 2 === 0) line([0, FLOOR, za], [0, FLOOR, Math.max(za, z + 0.45)], mix(C.trim, t * 0.6 + 0.25), px(0.025));
                if (k % 6 === 3 && z > 0.3) {
                    for (const dz of [0, 0.42]) {
                        const b = z + 0.15 + dz;
                        quad([[-0.38, FLOOR, b], [0, FLOOR, b + 0.42], [0.38, FLOOR, b], [0.38, FLOOR, b + 0.16], [0, FLOOR, b + 0.58], [-0.38, FLOOR, b + 0.16]], mix(C.trim, t));
                    }
                }

                // roof, running down the aisle: glazing bars on the arch, gutters, white pipes, a misting line
                for (const x of GLAZING) line([x, archY(x), za], [x, archY(x), z2], mix(C.rib, t * 0.7 + 0.3), px(0.012));
                for (const s of [-1, 1]) {
                    line([s * 2.95, ROOF, za], [s * 2.95, ROOF, z2], mix(C.ribDark, t), px(0.06));             // gutter
                    line([s * 1.7, ROOF + 0.2, za], [s * 1.7, ROOF + 0.2, z2], mix(C.steelSide, t), px(0.055)); // heating pipe
                    line([s * 1.7, ROOF + 0.21, za], [s * 1.7, ROOF + 0.21, z2], mix(C.light, t), px(0.022));    // its highlight
                    line([s * 0.55, ROOF + 0.45, za], [s * 0.55, ROOF + 0.45, z2], mix(C.slot, t), px(0.01));    // misting line
                    if (z > 0.6 && z < 14) line([s * 0.55, ROOF + 0.45, z + 0.5], [s * 0.55, ROOF + 0.35, z + 0.5], mix(C.slot, t), px(0.008)); // nozzle drop
                }
                if (k % 8 === 4) // shade cloth drawn across this bay
                    quad([[-2.3, ROOF + 0.55, za], [2.3, ROOF + 0.55, za], [2.3, ROOF + 0.55, z + 4], [-2.3, ROOF + 0.55, z + 4]], `rgba(255,255,255,${0.35 * (1 - t)})`);

                if (z < 0.3) continue;
                if (k % 4 === 0) { // main truss: posts, arch, tie beam with zig-zag webbing, and a hanging grow-light bar
                    for (const s of [-1, 1]) line([s * 2.95, FLOOR, z], [s * 2.95, ROOF, z], mix(C.ribDark, t), px(0.07));
                    cx.strokeStyle = mix(C.rib, t); cx.lineWidth = px(0.08);
                    cx.beginPath(); cx.moveTo(...P(-2.95, ROOF, z)); cx.quadraticCurveTo(...P(0, 3.75, z), ...P(2.95, ROOF, z)); cx.stroke();
                    line([-2.95, ROOF + 0.06, z], [2.95, ROOF + 0.06, z], mix(C.rib, t), px(0.04));
                    cx.strokeStyle = mix(C.rib, t * 0.8 + 0.15); cx.lineWidth = px(0.022);
                    cx.beginPath();
                    for (let i = 0; i <= 10; i++) {
                        const x = -2.95 + (5.9 * i) / 10, [sx, sy] = P(x, i % 2 ? archY(x) : ROOF + 0.06, z);
                        if (i) cx.lineTo(sx, sy); else cx.moveTo(sx, sy);
                    }
                    cx.stroke();
                    for (const s of [-0.7, 0.7]) line([s, 1.92, z], [s, ROOF + 0.06, z], mix(C.slot, t), 1);
                    quad([[-0.9, 1.85, z], [0.9, 1.85, z], [0.9, 1.92, z], [-0.9, 1.92, z]], mix(C.steelSide, t));
                    quad([[-0.86, 1.83, z], [0.86, 1.83, z], [0.86, 1.86, z], [-0.86, 1.86, z]], mix(C.light, t * 0.5));
                } else if (k % 2 === 0) { // lighter secondary rafter in between
                    cx.strokeStyle = mix(C.rib, t * 0.7 + 0.3); cx.lineWidth = px(0.035);
                    cx.beginPath(); cx.moveTo(...P(-2.95, ROOF, z)); cx.quadraticCurveTo(...P(0, 3.75, z), ...P(2.95, ROOF, z)); cx.stroke();
                }
            }

            // ---- pass 2: the racks ----
            const order = [...TIERS.keys()].sort((a, b) => Math.abs(TIERS[b]) - Math.abs(TIERS[a])); // furthest from eye level first
            // Paint order, so nothing slices through anything else: slices far to near; within a slice, per side, the
            // pipe, the trays (furthest from eye level first), and the upright last, since it stands at the slice's
            // front edge, nearer than the lettuce. Above eye level a tray's lettuce goes down first so
            // the tray's underside hides its base; below eye level the tray goes first and the lettuce sits on it.
            for (let k = farthest; k >= first; k--) {
                const z = k * GAP - cam;
                if (z < 0.25) continue; // behind the lens
                const t = Math.min(1, z / FAR) ** 0.85;
                // which two pre-fogged lettuce copies this depth falls between, and how far along (blended, so colours never jump)
                const lv = Math.min(FOG_LEVELS.length - 2, FOG_LEVELS.findLastIndex((v) => v <= t)), mixK = Math.min(1, (t - FOG_LEVELS[lv]) / (FOG_LEVELS[lv + 1] - FOG_LEVELS[lv]));
                const fade = Math.min(1, (FAR - z) / 5); // the lettuce sprites aren't fully fogged, so ease them in at the far end
                const px = (wd: number) => Math.max(0.6, (wd * f) / z);

                for (const side of [-1, 1]) {
                    const xi = side * XI, xo = side * XO;

                    // irrigation line along the rack, clamped at each upright
                    line([xi + side * 0.08, -0.5, z], [xi + side * 0.08, -0.5, z + GAP], mix(C.pipe, t), px(0.02));
                    if (k % 2 === 0) line([xi + side * 0.08, -0.46, z + 0.03], [xi + side * 0.08, -0.54, z + 0.03], mix(C.clamp, t), px(0.05));

                    for (const ti of order) {
                        const y = TIERS[ti], z1 = z + TRAY;

                        // the lettuce: bed line on the tray, a random variety, flipped, tilted and sized per tray
                        const lettuce = () => {
                            if (fade <= 0) return;
                            const zm = z + TRAY * 0.45, [sx, sy] = P(xi + side * 0.62, y, zm);
                            const sw = (1.6 * f) / zm, sh = (sw * SH) / SW, r1 = hash(k, ti * 2 + side), r2 = hash(ti + side * 3, k * 1.7);
                            const sc = 0.88 + r2 * 0.24, flip = hash(k * 5, ti + side) < 0.5 ? -1 : 1, rot = (hash(k * 3, ti * 7 + side) - 0.5) * 0.1;
                            const cs = Math.cos(rot) * sc, sn = Math.sin(rot) * sc;
                            cx.globalAlpha = fade;
                            cx.setTransform(d * cs * flip, d * sn * flip, -d * sn, d * cs, d * sx, d * sy);
                            const copies = heads[Math.floor(r1 * VARIETIES.length)];
                            cx.drawImage(copies[lv], -sw / 2, -(sh * BED) / SH, sw, sh);
                            if (mixK > 0.01) { cx.globalAlpha = fade * mixK; cx.drawImage(copies[lv + 1], -sw / 2, -(sh * BED) / SH, sw, sh); }
                            cx.setTransform(d, 0, 0, d, 0, 0);
                            cx.globalAlpha = 1;
                        };

                        if (y > 0) lettuce();
                        // tray: top (or underside above eye level), the rounded end facing the aisle, front lip, shadow
                        quad([[xi, y, z], [xo, y, z], [xo, y, z1], [xi, y, z1]], mix(y < 0 ? C.trayTop : C.trayUnder, t));
                        quad([[xi, y - 0.09, z], [xi, y, z], [xi, y, z1], [xi, y - 0.09, z1]], mix(C.trayEnd, t));
                        quad([[xi, y - 0.09, z], [xo, y - 0.09, z], [xo, y, z], [xi, y, z]], mix(C.trayFront, t));
                        line([xi, y - 0.095, z], [xi, y - 0.095, z1], mix(C.shadow, t), px(0.012));
                        if (z < 10) { // moulded ridges on the end, and the yellow trim on every third tray
                            line([xi, y - 0.03, z + 0.05], [xi, y - 0.03, z1 - 0.05], mix(C.ridge, t), px(0.006));
                            line([xi, y - 0.06, z + 0.05], [xi, y - 0.06, z1 - 0.05], mix(C.ridge, t), px(0.006));
                            if ((k + ti) % 3 === 0) line([xi, y + 0.003, z + 0.08], [xi, y + 0.003, z1 - 0.08], mix(C.trim, t), px(0.014));
                        }
                        if (y <= 0) lettuce();
                    }

                    if (k % 2 === 0) { // steel upright with punched slots, and a stencil plate at eye level
                        quad([[xi, FLOOR, z], [xi, FLOOR, z + 0.06], [xi, ROOF - 0.15, z + 0.06], [xi, ROOF - 0.15, z]], mix(C.steelSide, t));
                        quad([[xi, FLOOR, z], [xi + side * 0.06, FLOOR, z], [xi + side * 0.06, ROOF - 0.15, z], [xi, ROOF - 0.15, z]], mix(C.steel, t));
                        if (z < 9) {
                            for (let y = FLOOR + 0.2; y < ROOF - 0.3; y += 0.14) line([xi + side * 0.03, y, z], [xi + side * 0.03, y + 0.06, z], mix(C.slot, t), px(0.012));
                            if (k % 6 === 0) {
                                const [ax, ay] = P(xi + side * 0.01, 0.12, z), by = P(xi + side * 0.01, -0.02, z)[1];
                                const ph = by - ay, pw = ph * 1.5;
                                cx.fillStyle = mix(C.ink, t); cx.fillRect(ax - pw / 2, ay, pw, ph);
                                cx.fillStyle = mix(C.trim, t); cx.font = `600 ${ph * 0.62}px ${mono}`; cx.textAlign = "center";
                                cx.fillText(`${side < 0 ? "A" : "B"}${String(k % 100).padStart(2, "0")}`, ax, ay + ph * 0.75);
                                cx.textAlign = "start";
                            }
                        }
                    }
                }
            }
            cx.globalAlpha = 1;

            for (const p of pollen) { // floating up through the light
                cx.fillStyle = `rgba(150,200,110,${0.25 + p.r * 0.15})`;
                cx.beginPath(); cx.arc(p.x * w - mouse.x * 30 * p.r, p.y * h - mouse.y * 20 * p.r, p.r, 0, Math.PI * 2); cx.fill();
            }
        }

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            if (kick.current !== seen) { seen = kick.current; boost = 9; }
            boost *= 0.95 ** (dt * 60);
            cam += dt * 0.45 * (1 + boost);
            for (const p of pollen) { p.y -= p.v * dt * (1 + boost * 0.3); if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); } }
            const follow = Math.min(1, dt * 2.5);
            mouse.x += (mouse.tx - mouse.x) * follow; mouse.y += (mouse.ty - mouse.y) * follow;
            draw();
        };

        size();
        addEventListener("resize", size);
        if (still) { draw(); return () => removeEventListener("resize", size); }
        addEventListener("pointermove", onMove);
        raf = requestAnimationFrame(frame);
        return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); removeEventListener("pointermove", onMove); };
    }, [kick]);

    return <canvas ref={ref} className="farm" aria-hidden />;
}
