"use client";

// The stream behind /blogs, ported from the AquaPlot about page (~/Documents/aquaplot/src/aquaplot/
// static/about.html). It's one small world drawn by shaders with no images: a channel deeper and faster in
// the middle, with pebbles and caustics on the bed, boulders the current foams around, reeds on the banks
// and leaves riding the surface. Restyled after a Chinese mountain stream: jade water, mossy boulders,
// bonsai-like trees, stone lanterns and a red pavilion upstream in the mist.
// The page scroll flies the camera, as on AquaPlot: a low view up the stream behind About me (#river-hero),
// rising to look straight down on it. From above, the river runs down the channels the posts leave free
// (#river-flow .ch, see app/blogs/timeline.css), bending from one to the next, and scrolls exactly with the
// page so the bends stay beside the posts they go round. The trees, lanterns, bridge and pavilion belong to
// the low view and fade out as the camera rises.
// Decorative: if WebGL is missing the soft gradient behind the canvas stays.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useDarkMode } from "./darkmode";

const LEN = 140; // length of the stretch of world kept around the camera
const ROCKS = 14;
const TOP_FOV = 30; // the camera's field of view looking straight down
const BRIDGE_Z = -0.5; // where the red bridge crosses, just ahead of the camera
const f = (v: number) => v.toFixed(5);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v)), ease = (v: number) => v * v * (3 - 2 * v);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

// The low view's gentle meander: centre and half-width at z (the shaders' river() below is the same curve)
const heroRiver = (z: number) => [0.35 * Math.sin(z * 0.11) + 0.2 * Math.sin(z * 0.23 + 1.3), 3.0 + 0.2 * Math.sin(z * 0.07 + 2.0)];
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bankHeight = (d: number) => { const k = smoothstep(0.95, 1.4, d); return (-1.05 + 0.7 * d * d) * (1 - k) + 0.42 * k; }; // d: 1 at the water's edge
const flowSpeed = (a: number) => 0.25 + 1.5 * Math.max(0, 1 - a * a);

const COMMON = `
    uniform sampler2D uPath; uniform vec2 uPathRange; uniform float uPathMix;
    float hash1(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    vec2 hash2(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33);
                         return fract((q.xx + q.yz) * q.zy); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x), mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
      return s / 0.9375;
    }
    vec2 river(float z) {  // centre and half-width of the channel at z: the meander, becoming the page's path
      vec2 hero = vec2(0.35 * sin(z * 0.11) + 0.2 * sin(z * 0.23 + 1.3), 3.0 + 0.2 * sin(z * 0.07 + 2.0));
      if (uPathMix <= 0.0) return hero;
      return mix(hero, texture2D(uPath, vec2((z - uPathRange.x) * uPathRange.y, 0.5)).rg, uPathMix);
    }
    float across(vec2 p) { vec2 r = river(p.y); return (p.x - r.x) / r.y; }   // 0 mid-channel, 1 at the edge
    float ground(vec2 p) {   // the bed, deepest in the middle, rising into the banks
      float d = abs(across(p));
      float h = mix(-1.05 + 0.7 * d * d, 0.42, smoothstep(0.95, 1.4, d));
      h += (vnoise(p * 0.45) - 0.5) * 0.5 * smoothstep(1.3, 2.2, d);
      h += (vnoise(p * 2.3) - 0.5) * 0.07;
      return h;
    }
    float flowSpeed(vec2 p) { float a = across(p); return 0.25 + 1.5 * max(0.0, 1.0 - a * a); }`;
// Patches of colour across the grass, shared by the banks and the blades standing on them, so the blades
// match the ground they grow from: the two greens, sunny yellow-green and cool blue-green drifts, darker clumps.
const MEADOW = `
    uniform vec3 uGrassA, uGrassB, uGrassC, uGrassD;
    vec3 meadow(vec2 p) {
      vec3 g = mix(uGrassA, uGrassB, fbm(p * 0.8));
      g = mix(g, uGrassC, smoothstep(0.42, 0.68, fbm(p * 0.45 + 5.3)));
      g = mix(g, uGrassD, smoothstep(0.48, 0.72, fbm(p * 0.55 + 17.0)) * 0.9);
      return g * mix(0.68, 1.08, smoothstep(0.25, 0.6, vnoise(p * 0.6 + 3.1)));
    }`;
// Fading into the page: by distance from the camera (haze), towards both ends of the world, and away from the river
const FADE = `
    uniform float uFogNear, uFogFar, uAnchor; uniform vec2 uEdge, uBank, uWin;
    float fadeAt(vec3 w) {
      float f = smoothstep(uFogNear, uFogFar, length(cameraPosition - w));
      return max(f, smoothstep(uEdge.x, uEdge.y, abs(w.z - uAnchor)));
    }
    float bankFade(vec2 p) { return smoothstep(uBank.x, uBank.y, abs(across(p))); }
    float wrapZ(float z) { return uAnchor + uWin.x + mod(z - uAnchor - uWin.x, uWin.y); }  // keep things near the camera`;

// Small waves running downstream (+z). One table drives the surface shader and the leaves.
const WAVES = [ // direction x, direction z, wavenumber, amplitude, speed
    [0.15, 1.0, 1.1, 0.05, 1.2],
    [-0.45, 1.0, 2.0, 0.028, 1.9],
    [0.8, 0.6, 3.2, 0.014, 2.5],
    [1.0, 0.15, 4.7, 0.007, 3.2],
].map(([x, z, k, a, s]) => { const l = Math.hypot(x, z); return [x / l, z / l, k, a, s]; });
const WAVE_GLSL = `vec3 waves(vec2 p, float t) {  // height, d/dx, d/dz
    vec3 r = vec3(0.0); float ph;
    ${WAVES.map(([x, z, k, a, s]) => `ph = dot(vec2(${f(x)}, ${f(z)}), p) * ${f(k)} - t * ${f(s)};
    r += vec3(${f(a)} * sin(ph), ${f(a * k * x)} * cos(ph), ${f(a * k * z)} * cos(ph));`).join("\n    ")}
    return r;
  }`;
function wavesAt(x: number, z: number, t: number) {
    let h = 0, dx = 0, dz = 0;
    for (const [wx, wz, k, a, s] of WAVES) {
        const ph = (wx * x + wz * z) * k - t * s;
        h += a * Math.sin(ph); dx += a * k * wx * Math.cos(ph); dz += a * k * wz * Math.cos(ph);
    }
    return [h, dx, dz];
}
const VORONOI_GLSL = `
    vec3 voronoi(vec2 x) {  // nearest distance, second-nearest distance, cell id
      vec2 n = floor(x), fr = fract(x); float d1 = 8.0, d2 = 8.0; vec2 cell = vec2(0.0);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j)); vec2 r = g + hash2(n + g) - fr; float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; cell = n + g; } else if (d < d2) { d2 = d; }
      }
      return vec3(sqrt(d1), sqrt(d2), hash1(cell));
    }`;
// Tileable water caustics (after Dave Hoskins' well-known Shadertoy pattern): bright, wandering filaments.
const CAUSTIC_GLSL = `
    float caustic(vec2 uv, float t) {
      vec2 p = mod(uv * 6.28318, 6.28318) - 250.0, i = p;
      float c = 1.0, inten = 0.005;
      for (int n = 0; n < 5; n++) {
        float tt = t * (1.0 - 3.5 / float(n + 1));
        i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
      }
      c = 1.17 - pow(c / 5.0, 1.4);
      return pow(abs(c), 8.0);
    }`;

// Builds the scene on `canvas` (sized to `host`), flying over `hero` into a river round `flow`'s channels.
// Returns setDark(), start() and a cleanup.
function start(canvas: HTMLCanvasElement, host: HTMLElement, hero: HTMLElement, flow: HTMLElement) {
    let renderer: THREE.WebGLRenderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 1.5 });
    } catch {
        return null;
    }
    const small = matchMedia("(max-width: 700px)").matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); // a soft background; the text over it stays sharp

    const world = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 600);
    const color = () => new THREE.Color();
    const blankPath = new THREE.DataTexture(new Uint16Array(4), 2, 1, THREE.RGFormat, THREE.HalfFloatType);
    blankPath.needsUpdate = true;
    const uniforms: Record<string, THREE.IUniform> = {
        uTime: { value: 0 }, uAnchor: { value: 0 }, uFogNear: { value: 8 }, uFogFar: { value: 26 },
        uEdge: { value: new THREE.Vector2(38, 48) }, uBank: { value: new THREE.Vector2(3.5, 9) },
        uWin: { value: new THREE.Vector2(-30, 48) },
        uPath: { value: blankPath }, uPathRange: { value: new THREE.Vector2(0, 1) }, uPathMix: { value: 0 },
        uNight: { value: 0 }, uPointK: { value: 7 }, uDpr: { value: renderer.getPixelRatio() }, uReflect: { value: 0.8 }, uSpread: { value: 1 },
        uDeep: { value: color() }, uShallow: { value: color() }, uSky: { value: color() }, uSun: { value: color() },
        uFog: { value: color() }, uFoam: { value: color() }, uCaustic: { value: color() },
        uBedA: { value: color() }, uBedB: { value: color() }, uGap: { value: color() },
        uGrassA: { value: color() }, uGrassB: { value: color() }, uGrassC: { value: color() }, uGrassD: { value: color() }, uEarth: { value: color() }, uFlower: { value: color() },
        uReedA: { value: color() }, uReedB: { value: color() }, uRock: { value: color() },
        // A low sun upstream: its glitter lies on the far water, never in the reader's lap.
        uLight: { value: new THREE.Vector3(-0.3, 0.5, -1.0).normalize() },
        uRocks: { value: Array.from({ length: ROCKS }, () => new THREE.Vector4()) },
    };
    // The river's shape. In the low view, the meander; from above, the path measured from the page, stored
    // in a small texture every shader reads. pathMix blends one into the other as the camera rises.
    let path: { n: number; xs: Float32Array; ws: Float32Array; z0: number; dz: number } | null = null, pathMix = 0;
    const river = (z: number) => { // [centre, half-width] at z, exactly as the shaders see it
        const [hx, hw] = heroRiver(z);
        if (!path || pathMix <= 0) return [hx, hw];
        const u = Math.min(path.n - 1, Math.max(0, (z - path.z0) / path.dz - 0.5));
        const i = Math.min(Math.floor(u), path.n - 2), k = u - i;
        return [mix(hx, mix(path.xs[i], path.xs[i + 1], k), pathMix), mix(hw, mix(path.ws[i], path.ws[i + 1], k), pathMix)];
    };
    // A strip along z whose columns are offsets from the river's centre, packed towards it
    const strip = (w: number, segX: number, segZ: number, curve: number) => {
        const g = new THREE.PlaneGeometry(2, LEN, segX, segZ).rotateX(-Math.PI / 2);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) { const u = pos.getX(i); pos.setX(i, Math.sign(u) * Math.pow(Math.abs(u), curve) * w); }
        return g;
    };

    // ---- the ground: the bed under the water and the banks either side, one surface
    const groundSeg: [number, number] = small ? [110, 220] : [170, 340];
    const terrain = new THREE.Mesh(strip(30, ...groundSeg, 1.6), new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `uniform float uSpread; varying vec3 vWorld; varying vec3 vN;
      ${COMMON}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.x = river(w.z).x + position.x * uSpread;
        w.y = ground(w.xz);
        float e = 0.15;
        vN = normalize(vec3(ground(w.xz - vec2(e, 0.0)) - ground(w.xz + vec2(e, 0.0)), 2.0 * e,
                            ground(w.xz - vec2(0.0, e)) - ground(w.xz + vec2(0.0, e))));
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
        fragmentShader: `uniform float uTime, uNight; uniform vec3 uBedA, uBedB, uGap, uCaustic, uDeep, uFog, uEarth, uFlower, uLight;
      varying vec3 vWorld; varying vec3 vN;
      ${COMMON} ${MEADOW} ${FADE} ${VORONOI_GLSL} ${CAUSTIC_GLSL}
      void main() {
        vec2 p = vWorld.xz; float h = vWorld.y;
        float fade = max(fadeAt(vWorld), bankFade(p));
        if (fade > 0.995) {
          gl_FragColor = vec4(uFog, 1.0);
          #include <colorspace_fragment>
          return;
        }
        float depth = max(-h, 0.0);
        // Pebbles on the bed and along the waterline, wobbled by the moving surface above them.
        vec3 stone = uBedA; float pebble = 0.0;
        if (h < 0.25) {
          vec2 q = p + vec2(sin(p.y * 1.7 + uTime * 1.3), cos(p.x * 1.9 + uTime * 1.1)) * 0.035 * smoothstep(0.0, 0.3, depth);
          vec3 v = voronoi(q * 3.2);
          pebble = smoothstep(0.02, 0.16, v.y - v.x);
          stone = mix(uBedA, uBedB, v.z) * (0.8 + 0.28 * (1.0 - smoothstep(0.0, 0.8, v.x)));
          vec3 v2 = voronoi(q * 9.0 + 3.7);  // small grit between the pebbles
          stone *= mix(0.84, 1.04, smoothstep(0.02, 0.1, v2.y - v2.x)) * (0.9 + 0.2 * vnoise(q * 11.0));
          stone = mix(stone, uGrassA * 0.8, smoothstep(0.55, 0.8, fbm(q * 1.3)) * 0.35);  // patches of algae
        }
        vec3 bed = vec3(0.0), bank = vec3(0.0);
        if (h < 0.03) {
          bed = mix(mix(uGap, stone, 0.45), stone, pebble * mix(0.8, 0.35, smoothstep(0.1, 0.9, depth)));
          bed = mix(bed, uDeep, smoothstep(0.0, 1.0, depth) * 0.6);
          if (depth > 0.05) bed += uCaustic * caustic(p * 0.3 - vec2(0.0, uTime * 0.09), uTime * 0.45) * 0.32 * smoothstep(0.05, 0.4, depth);
        }
        if (h > -0.03) {  // wet earth and stones at the edge, then grass
          float g = fbm(p * 0.8);
          vec3 grass = meadow(p) * (0.82 + 0.22 * vnoise(p * 7.0) + 0.14 * vnoise(vec2(p.x * 40.0, p.y * 9.0)));
          bank = mix(mix(uEarth, stone, pebble * 0.7), grass, smoothstep(0.1, 0.32, h + (g - 0.5) * 0.3));
          bank *= mix(0.7, 1.0, smoothstep(0.0, 0.16, h));
          bank *= 0.66 + 0.44 * max(dot(normalize(vN), uLight), 0.0);
        }
        vec3 col = mix(bed, bank, smoothstep(-0.03, 0.03, h));
        gl_FragColor = vec4(mix(col, uFog, fade), 1.0);
        #include <colorspace_fragment>
      }`,
    }));
    terrain.frustumCulled = false;
    world.add(terrain);

    // ---- the surface: waves, ripples and foam carried by the current, a fresnel reflection and glints
    const waterSeg: [number, number] = small ? [40, 260] : [64, 400];
    const water = new THREE.Mesh(strip(1, ...waterSeg, 1.0), new THREE.ShaderMaterial({
        uniforms, transparent: true, depthWrite: false,
        vertexShader: `uniform float uTime; varying vec3 vWorld; varying vec3 vNormal;
      ${COMMON} ${WAVE_GLSL}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 r = river(w.z);
        w.x = r.x + position.x * r.y * 1.45;  // just wider than the water
        vec3 h = waves(w.xz, uTime) * smoothstep(0.0, 0.45, -ground(w.xz));  // calmer in the shallows
        w.y += h.x; vWorld = w.xyz;
        vNormal = normalize(vec3(-h.y, 1.0, -h.z));
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
        fragmentShader: `uniform float uTime, uReflect; uniform vec3 uDeep, uShallow, uSky, uSun, uFog, uLight, uFoam;
      uniform vec4 uRocks[${ROCKS}];
      varying vec3 vWorld; varying vec3 vNormal;
      ${COMMON} ${FADE}
      vec2 ripple(vec2 q) {  // slope of the small ripples, in the water's own moving frame
        vec2 g = vec2(0.2, 1.0) * cos(dot(q, vec2(0.2, 1.0)) * 5.0) * 0.5
               + vec2(-0.6, 0.8) * cos(dot(q, vec2(-0.6, 0.8)) * 8.3 + 1.7) * 0.3
               + vec2(0.9, 0.45) * cos(dot(q, vec2(0.9, 0.45)) * 11.9 + 4.1) * 0.22;
        float n0 = vnoise(q * 2.6);
        return g + vec2(vnoise(q * 2.6 + vec2(0.08, 0.0)) - n0, vnoise(q * 2.6 + vec2(0.0, 0.08)) - n0) * 2.2;
      }
      float streaks(vec2 q) { return vnoise(vec2(q.x * 3.2, q.y * 0.7)) * 0.6 + vnoise(vec2(q.x * 7.0, q.y * 1.6)) * 0.4; }
      float foamAt(vec2 p, float depth, float st) {
        float f = (1.0 - smoothstep(0.0, 0.14, depth)) * 0.9;   // lace along the shallows
        float wake = 0.0;
        for (int i = 0; i < ${ROCKS}; i++) {                     // a collar round each rock, and its wake
          vec4 r = uRocks[i];
          vec2 d = p - r.xy;
          f += (1.0 - smoothstep(0.0, 0.18 + r.z * 0.35, length(d) - r.z)) * r.w;
          float down = max(d.y, 0.0);
          wake += exp(-down * 1.1) * (1.0 - smoothstep(r.z * 0.1, r.z * 0.55 + down * 0.05, abs(d.x)))
                * smoothstep(-0.2, 0.3, d.y) * r.w;
        }
        f = clamp(f, 0.0, 1.0);
        float foam = f * smoothstep(0.25, 0.75, st * (0.6 + 0.6 * f));
        float threads = vnoise(vec2(p.x * 9.0, p.y * 1.2 - uTime * 1.5));
        return clamp(foam + min(wake, 1.0) * smoothstep(0.62, 0.92, threads) * 0.3, 0.0, 1.0);
      }
      void main() {
        vec2 p = vWorld.xz; float t = uTime;
        float depth = vWorld.y - ground(p);
        if (depth < 0.0) discard;
        // The current carries ripples and foam downstream, fastest mid-channel. Two copies half a
        // cycle apart are blended, so the pattern keeps moving without ever smearing out.
        float spd = flowSpeed(p), c1 = fract(t * 0.2), c2 = fract(t * 0.2 + 0.5), blend = abs(c1 * 2.0 - 1.0);
        vec2 q1 = p - vec2(0.0, spd * c1 * 5.0), q2 = p - vec2(0.0, spd * c2 * 5.0) + vec2(0.31, 0.57);
        vec2 slope = mix(ripple(q1), ripple(q2), blend);
        float st = mix(streaks(q1), streaks(q2), blend);
        vec3 n = normalize(normalize(vNormal) + vec3(slope.x, 0.0, slope.y) * 0.06);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = mix(0.03, 1.0, pow(1.0 - max(dot(n, V), 0.0), 4.0));
        float nh = max(dot(n, normalize(uLight + V)), 0.0);
        float spec = (pow(nh, 900.0) * 2.2 + pow(nh, 90.0) * 0.04) * smoothstep(9.0, 17.0, length(cameraPosition - vWorld));
        float deep = smoothstep(0.02, 0.95, depth);
        float foam = foamAt(p, depth, st);
        vec3 col = mix(mix(uShallow, uDeep, deep), uSky, fres * uReflect) + uSun * spec * (1.0 - foam);
        col = mix(col, uFoam, foam);
        float alpha = max(mix(0.28, 0.9, deep), max(fres * 0.9, foam));
        float fade = fadeAt(vWorld);
        gl_FragColor = vec4(mix(col, uFog, fade), mix(alpha, 1.0, fade));
        #include <colorspace_fragment>
      }`,
    }));
    water.renderOrder = 2;
    water.frustumCulled = false;
    world.add(water);

    // ---- specks drifting just under the surface
    const MOTES = small ? 160 : 280;
    const motePos = new Float32Array(MOTES * 3), moteSeed = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
        motePos.set([Math.random() * 2 - 1, -0.1 - Math.random() * 0.6, Math.random()], i * 3);
        moteSeed[i] = Math.random();
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    moteGeo.setAttribute("seed", new THREE.BufferAttribute(moteSeed, 1));
    const motes = new THREE.Points(moteGeo, new THREE.ShaderMaterial({
        uniforms, transparent: true, depthWrite: false,
        vertexShader: `uniform float uTime, uPointK, uDpr; attribute float seed; varying float vAlpha;
      ${COMMON} ${FADE}
      void main() {
        float z = wrapZ(position.z * uWin.y + uTime * (0.35 + seed * 0.5));
        vec2 r = river(z);
        vec3 w = vec3(r.x + position.x * r.y * 0.85, position.y + sin(uTime * (0.6 + seed) + seed * 40.0) * 0.05, z);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_PointSize = (2.0 + seed * 3.5) * (uPointK / -mv.z) * uDpr;
        vAlpha = (0.25 + seed * 0.35) * (1.0 - fadeAt(w));
        gl_Position = projectionMatrix * mv;
      }`,
        fragmentShader: `uniform vec3 uCaustic; varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uCaustic, vAlpha * smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)));
        #include <colorspace_fragment>
      }`,
    }));
    motes.renderOrder = 1;
    motes.frustumCulled = false;
    world.add(motes);

    // ---- long grass along both banks, thick near the water and thinning out, swaying
    const blade = new THREE.BufferGeometry();
    blade.setAttribute("position", new THREE.Float32BufferAttribute(
        [-1, 0, 0, 1, 0, 0, -0.72, 0.33, 0, 0.72, 0.33, 0, -0.42, 0.66, 0, 0.42, 0.66, 0, 0, 1, 0], 3));
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
    const REEDS = small ? 7000 : 14000;
    const reedGeo = new THREE.InstancedBufferGeometry();
    reedGeo.index = blade.index;
    reedGeo.setAttribute("position", blade.getAttribute("position"));
    const spot = new Float32Array(REEDS * 4), size = new Float32Array(REEDS * 2);
    for (let i = 0; i < REEDS; i++) {
        const out = Math.random() ** 1.6; // most of them close to the water
        spot.set([Math.random() < 0.5 ? -1 : 1, 1.05 + out * 2.0, Math.random(), Math.random()], i * 4);
        size.set([0.035 + Math.random() * 0.045, (0.35 + Math.random() * 0.5) * (1.25 - out * 0.5)], i * 2);
    }
    reedGeo.setAttribute("aSpot", new THREE.InstancedBufferAttribute(spot, 4));
    reedGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 2));
    reedGeo.instanceCount = REEDS;
    const reeds = new THREE.Mesh(reedGeo, new THREE.ShaderMaterial({
        uniforms, side: THREE.DoubleSide,
        vertexShader: `uniform float uTime; attribute vec4 aSpot; attribute vec2 aSize; varying float vV, vFade; varying vec3 vCol;
      ${COMMON} ${MEADOW} ${FADE}
      void main() {
        float z = wrapZ(aSpot.z * uWin.y);
        vec2 r = river(z);
        vec2 base = vec2(r.x + aSpot.x * aSpot.y * r.y, z);
        float v = position.y, a = aSpot.w * 6.2831;
        vec3 w = vec3(base.x, ground(base), base.y);
        w.xz += vec2(cos(a), sin(a)) * position.x * aSize.x;
        w.y += v * aSize.y;
        w.xz += (vec2(aSpot.x * 0.12, 0.08) + vec2(0.0, sin(uTime * 1.7 + aSpot.w * 30.0) * 0.1)) * v * v * aSize.y * 2.0;
        vV = v;
        float j = fract(aSpot.w * 7.31);  // and each blade leans a little warmer or cooler than its patch
        vCol = mix(meadow(base), j < 0.5 ? uGrassC : uGrassD, 0.45 * fract(aSpot.w * 3.97)) * (0.8 + 0.4 * fract(aSpot.w * 13.7));
        vFade = max(fadeAt(w), bankFade(base));
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
        fragmentShader: `uniform vec3 uReedA, uReedB, uFog; varying float vV, vFade; varying vec3 vCol;
      void main() {  // shaded at the root, catching the light at the tip
        vec3 col = mix(mix(uReedA, vCol * 0.6, 0.6), mix(uReedB, vCol * 1.4, 0.75), vV);
        gl_FragColor = vec4(mix(col, uFog, vFade), 1.0);
        #include <colorspace_fragment>
      }`,
    }));
    reeds.frustumCulled = false;
    world.add(reeds);

    // ---- boulders: low-poly stones, wet below the waterline, the same ones on every visit
    const rng = ((seed: number) => () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    })(20260930);
    world.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.0));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
    sunLight.position.copy(uniforms.uLight.value).multiplyScalar(10);
    world.add(sunLight);
    const rockMat = new THREE.ShaderMaterial({
        uniforms, vertexColors: true,
        vertexShader: `varying vec3 vWorld; varying vec3 vColor;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz; vColor = color;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
        fragmentShader: `uniform vec3 uRock, uDeep, uShallow, uFog, uLight, uGrassA; varying vec3 vWorld; varying vec3 vColor;
      ${COMMON} ${FADE}
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));  // faceted, like cut stone
        float lit = 0.45 + 0.75 * max(dot(n, uLight), 0.0) + 0.15 * max(n.y, 0.0);
        vec3 col = uRock * vColor * lit;
        // thick moss on the upward faces, patchy
        float moss = smoothstep(0.25, 0.7, n.y) * smoothstep(0.3, 0.6, vnoise(vWorld.xz * 2.5) + 0.25 * n.y);
        col = mix(col, uGrassA * 1.25 * lit, moss * 0.9);
        col = mix(col, mix(uShallow, uDeep, 0.6), smoothstep(0.0, 0.4, -vWorld.y) * 0.85);
        gl_FragColor = vec4(mix(col, uFog, fadeAt(vWorld)), 1.0);
        #include <colorspace_fragment>
      }`,
    });
    const v3 = new THREE.Vector3();
    const rocks = Array.from({ length: ROCKS }, (_, i) => {
        const sx = 0.35 + rng() * 0.6, sy = 0.3 + rng() * 0.3, sz = sx * (0.8 + rng() * 0.5);
        const top = -0.12 + rng() * 0.42, yc = top - sy;
        const geo = new THREE.IcosahedronGeometry(1, 2);
        const pos = geo.attributes.position, colors: number[] = [];
        const bumps = Array.from({ length: 4 }, () => [rng() * 6.28, rng() * 6.28, 1.5 + rng() * 2.5, 0.06 + rng() * 0.08]);
        for (let k = 0; k < pos.count; k++) {
            v3.fromBufferAttribute(pos, k).normalize();
            let s = 1;
            for (const [a, b, n, amp] of bumps) s += amp * Math.sin(n * v3.x + a) * Math.cos(n * v3.z + b);
            v3.multiplyScalar(s);
            if (v3.y < 0) v3.y *= 0.65; // flatter underneath, so less of it shows through the water
            pos.setXYZ(k, v3.x, v3.y, v3.z);
            const wet = yc + v3.y * sy < 0.06, moss = v3.y > 0.6;
            colors.push(wet ? 0.72 : moss ? 0.86 : 1, wet ? 0.75 : 1, wet ? 0.75 : moss ? 0.8 : 1);
        }
        geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, rockMat);
        mesh.rotation.y = rng() * Math.PI;
        // Where the rock meets the surface, for the foam: a collar if it breaks the water, a boil if not
        const breaks = top > 0;
        let z = -30 + ((i + rng() * 0.8) / ROCKS) * 48;
        if (z > 0 && z < 12) z -= 14; // none right under the camera, where one fills the view
        if (Math.abs(z - BRIDGE_Z) < 2.5) z -= 5; // nor under the bridge
        // placed every frame (draw), in a window round the camera, scaled with the river they sit in
        mesh.userData = { z, off: (rng() * 2 - 1) * 0.72, size: [sx, sy, sz], yc,
            r: breaks ? sx * Math.sqrt(1 - (yc / sy) ** 2) : sx * 0.7, strength: breaks ? 1 : 0.35 };
        world.add(mesh);
        return mesh;
    });

    // Solid shapes in one colour each, merged into one mesh per object (vertex colours, no textures)
    const painted = (g: THREE.BufferGeometry, hex: string) => {
        const out = g.index ? g.toNonIndexed() : g;
        out.deleteAttribute("uv");
        const c = new THREE.Color(hex), n = out.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
        out.setAttribute("color", new THREE.BufferAttribute(col, 3));
        return out;
    };
    // The low view's scenery (trees, lanterns, bridge, pavilion), faded out as the camera rises (draw).
    // Its materials are always transparent, so fading never recompiles a shader.
    const decor = new THREE.Group(), decorMats: THREE.Material[] = [];
    world.add(decor);
    const solid = () => {
        const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, transparent: true });
        decorMats.push(m);
        return m;
    };
    // things whose colours dim at night: [material, how bright at night]
    const dimmed: [THREE.MeshLambertMaterial, number][] = [];

    // ---- trees: bonsai-like pines in a few classic styles, Japanese maples, the odd golden ginkgo, and
    // clumps of bamboo. Each kind is built a few times with different seeds, then scattered as instances,
    // each slightly re-tinted so no two side by side look the same.
    const BARK = ["#4e4036", "#5b4a3a", "#3f3a35", "#6a5847"];
    const FOLIAGE = {
        pine: ["#2f5a2c", "#3b6a32", "#2a4f2e", "#466f36", "#35603a", "#52783e"],
        maple: ["#a8321e", "#c2481f", "#d9692a", "#8f2a1c", "#b8551f", "#e08a3a"],
        ginkgo: ["#c9a73a", "#d8b84a", "#b8932e", "#e2c65a"],
    };
    const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)];
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // A branch or trunk that narrows from r0 to r1 along its length
    function limb(points: THREE.Vector3[], r0: number, r1: number, color: string, segs = 12) {
        const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, segs, r0, 6);
        const pos = g.attributes.position, ring = 7, c = new THREE.Vector3(), p = new THREE.Vector3();
        for (let i = 0; i <= segs; i++) {
            curve.getPointAt(i / segs, c);
            const k = (r0 + (r1 - r0) * (i / segs)) / r0;
            for (let j = 0; j < ring; j++) {
                const idx = i * ring + j;
                p.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
                pos.setXYZ(idx, p.x, p.y, p.z);
            }
        }
        return painted(g, color);
    }
    // A flat cloud of leaves: lumps spread in a disc, the top ones catching more light
    function pad(parts: THREE.BufferGeometry[], at: THREE.Vector3, r: number, colors: string[], flat = 0.36) {
        const lumps = 5 + Math.floor(rng() * 3);
        for (let k = 0; k < lumps; k++) {
            const a = rng() * 6.28, d = k ? r * (0.35 + rng() * 0.5) : 0, rr = r * (k ? 0.45 + rng() * 0.3 : 0.75);
            const g = new THREE.IcosahedronGeometry(1, 1).scale(rr, rr * flat, rr)
                .translate(at.x + Math.cos(a) * d, at.y + (k ? (rng() - 0.3) * r * 0.25 : r * 0.08), at.z + Math.sin(a) * d);
            const col = new THREE.Color(pick(colors)).multiplyScalar(k ? 0.9 + rng() * 0.2 : 1.12);
            parts.push(painted(g, "#" + col.getHexString()));
        }
    }
    // style: how the trunk grows. upright (straight, tiered), informal (an S-curve), slant (leaning hard),
    // windswept (every branch blown to one side)
    function tree(style: "upright" | "informal" | "slant" | "windswept", leaves: string[], flat = 0.36) {
        const parts: THREE.BufferGeometry[] = [], bark = pick(BARK);
        const H = 1.3 + rng() * 1.0, lean = style === "slant" ? 0.7 + rng() * 0.4 : style === "upright" ? 0.08 : (rng() - 0.5) * 0.8;
        const wig = style === "informal" ? 0.4 : 0.12;
        const pts = [v(0, -0.2, 0), v(lean * 0.25 + (rng() - 0.5) * wig, H * 0.3, (rng() - 0.5) * wig),
            v(lean * 0.55 - (rng() - 0.5) * wig, H * 0.62, (rng() - 0.5) * wig), v(lean, H, (rng() - 0.5) * 0.2)];
        const trunk = new THREE.CatmullRomCurve3(pts);
        parts.push(limb(pts, 0.12, 0.045, bark, 16));
        for (let r = 0; r < 4; r++) { // roots gripping the bank
            const a = (r / 4) * 6.28 + rng() * 0.8, len = 0.25 + rng() * 0.2;
            parts.push(limb([v(0, 0.02, 0), v(Math.cos(a) * len * 0.5, -0.01, Math.sin(a) * len * 0.5), v(Math.cos(a) * len, -0.12, Math.sin(a) * len)], 0.05, 0.012, bark, 6));
        }
        const wind = rng() * 6.28, branches = style === "upright" ? 4 : 2 + Math.floor(rng() * 3);
        for (let b = 0; b < branches; b++) {
            const from = trunk.getPoint(0.4 + (b / branches) * 0.5);
            const a = style === "windswept" ? wind + (rng() - 0.5) * 0.7 : style === "upright" ? (b / branches) * 6.28 + rng() : rng() * 6.28;
            const len = (style === "upright" ? 0.75 - (b / branches) * 0.4 : 0.45 + rng() * 0.5) * (style === "windswept" ? 1.3 : 1);
            const to = from.clone().add(v(Math.cos(a) * len, 0.08 + rng() * 0.22, Math.sin(a) * len));
            const mid = from.clone().lerp(to, 0.5).add(v(0, -0.08, 0)); // droops a little, then lifts
            parts.push(limb([from, mid, to], 0.04, 0.015, bark, 8));
            if (rng() < 0.5) { // a twig off the branch, with its own small pad
                const tw = mid.clone().add(v((rng() - 0.5) * 0.4, 0.12 + rng() * 0.1, (rng() - 0.5) * 0.4));
                parts.push(limb([mid, tw], 0.018, 0.008, bark, 4));
                pad(parts, tw.add(v(0, 0.04, 0)), 0.18 + rng() * 0.1, leaves, flat);
            }
            pad(parts, to.add(v(0, 0.06, 0)), (style === "upright" ? 0.42 - (b / branches) * 0.15 : 0.32 + rng() * 0.22), leaves, flat);
        }
        pad(parts, trunk.getPoint(1).add(v(0, 0.08, 0)), 0.45 + rng() * 0.25, leaves, flat); // the crown
        return mergeGeometries(parts)!;
    }
    // A clump of bamboo: tall jointed canes leaning out a little, with sprays of thin leaves near the top
    function bamboo() {
        const parts: THREE.BufferGeometry[] = [], canes = 6 + Math.floor(rng() * 6);
        for (let c = 0; c < canes; c++) {
            const bx = (rng() - 0.5) * 0.5, bz = (rng() - 0.5) * 0.5, H = 2.2 + rng() * 1.6;
            const tip = v(bx * 2.2 + (rng() - 0.5) * 0.3, H, bz * 2.2 + (rng() - 0.5) * 0.3), base = v(bx, -0.1, bz);
            const green = pick(["#6f8f3c", "#5f8436", "#7d9a45", "#88a052"]);
            parts.push(limb([base, base.clone().lerp(tip, 0.5), tip], 0.03, 0.018, green, 6));
            for (let n = 1; n < 8; n++) { // the joints
                const p = base.clone().lerp(tip, n / 8);
                parts.push(painted(new THREE.CylinderGeometry(0.034, 0.034, 0.025, 6).translate(p.x, p.y, p.z), "#556f30"));
            }
            for (let l = 0; l < 7; l++) { // leaves: long thin blades hanging from the upper canes
                const p = base.clone().lerp(tip, 0.6 + rng() * 0.4), a = rng() * 6.28;
                const leaf = new THREE.ConeGeometry(0.028, 0.32, 3).rotateZ(Math.PI / 2 + 0.5).rotateY(a).scale(1, 0.35, 1)
                    .translate(p.x + Math.cos(a) * 0.14, p.y - 0.04, p.z - Math.sin(a) * 0.14);
                parts.push(painted(leaf, pick(["#4f7d36", "#5f8e3e", "#3f6c30", "#6a9a46"])));
            }
        }
        return mergeGeometries(parts)!;
    }

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), at = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    // where the pavilion stands (built further down): on the right bank upstream, beside the page's card
    const PAV_Z = -11, PAV_X = river(PAV_Z)[0] + 2.5 * river(PAV_Z)[1];
    const treeMat = solid();
    dimmed.push([treeMat, 0.3]);
    // [geometry, how many, nearest to the water (1 = the edge), how far back]
    const kinds: [THREE.BufferGeometry, number, number, number][] = [
        [tree("informal", FOLIAGE.pine), 7, 1.45, 1.5], [tree("informal", FOLIAGE.pine), 6, 1.45, 1.5],
        [tree("upright", FOLIAGE.pine, 0.3), 6, 1.6, 1.5], [tree("slant", FOLIAGE.pine), 5, 1.4, 1.2],
        [tree("windswept", FOLIAGE.pine), 5, 1.5, 1.4], [tree("informal", FOLIAGE.maple, 0.5), 5, 1.5, 1.5],
        [tree("upright", FOLIAGE.maple, 0.55), 4, 1.6, 1.4], [tree("slant", FOLIAGE.ginkgo, 0.5), 3, 1.6, 1.4],
        [bamboo(), 6, 1.9, 1.4], [bamboo(), 6, 1.9, 1.4],
    ];
    const tint = new THREE.Color();
    for (const [geo, n, near, spread] of kinds) {
        const count = Math.max(1, Math.round(n * (small ? 0.6 : 1))), mesh = new THREE.InstancedMesh(geo, treeMat, count);
        for (let i = 0; i < count; i++) {
            let z = 0, side = 1, d = 0, cx = 0, w = 0;
            do { // anywhere on the banks, but leave the pavilion clear
                z = -3 - rng() * 40; side = rng() < 0.5 ? -1 : 1; d = near + rng() * spread;
                [cx, w] = river(z);
            } while (Math.hypot(cx + side * d * w - PAV_X, z - PAV_Z) < 2.8);
            q.setFromAxisAngle(Y, rng() * 6.28);
            const k = 0.75 + rng() * 0.6;
            mesh.setMatrixAt(i, m4.compose(at.set(cx + side * d * w, bankHeight(Math.min(d, 1.4)) - 0.05, z), q, sc.set(k, k * (0.9 + rng() * 0.25), k)));
            const shade = 0.85 + rng() * 0.25; // each one a touch lighter or darker, warmer or cooler
            mesh.setColorAt(i, tint.setRGB(shade * (0.97 + rng() * 0.06), shade, shade * (0.95 + rng() * 0.08)));
        }
        decor.add(mesh);
    }

    // ---- stone lanterns on the banks: base, pillar, a lamp box that glows at night, a curved roof and a jewel
    const STONE = "#8d8a80";
    const lantern = mergeGeometries([
        painted(new THREE.CylinderGeometry(0.2, 0.25, 0.1, 6).translate(0, 0.05, 0), STONE),
        painted(new THREE.CylinderGeometry(0.065, 0.085, 0.5, 6).translate(0, 0.35, 0), STONE),
        painted(new THREE.CylinderGeometry(0.21, 0.15, 0.08, 6).translate(0, 0.64, 0), STONE),
        ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z]) => painted(new THREE.BoxGeometry(0.04, 0.2, 0.04).translate(x * 0.09, 0.78, z * 0.09), STONE)),
        painted(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 6).translate(0, 0.895, 0), STONE),
        painted(new THREE.ConeGeometry(0.27, 0.17, 6).translate(0, 0.995, 0), STONE),
        painted(new THREE.SphereGeometry(0.045, 8, 6).translate(0, 1.1, 0), STONE),
    ])!;
    const lanternMat = solid();
    dimmed.push([lanternMat, 0.4]);
    const lampMat = new THREE.MeshBasicMaterial({ color: "#e9dcc0", transparent: true }); // paper windows, lit from inside at night
    decorMats.push(lampMat);
    const glowTexture = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d")!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        r.addColorStop(0, "rgba(255,190,110,0.85)");
        r.addColorStop(0.35, "rgba(255,160,80,0.25)");
        r.addColorStop(1, "rgba(255,150,70,0)");
        g.fillStyle = r;
        g.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    })();
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, opacity: 0 });
    for (const [side, d, z] of [[-1, 1.28, BRIDGE_Z - 1.4], [1, 1.3, -6.5], [-1, 1.32, -11.5]]) {
        const [cx, w] = river(z), x = cx + side * d * w, y = bankHeight(d) - 0.04;
        const stone = new THREE.Mesh(lantern, lanternMat);
        stone.position.set(x, y, z);
        stone.scale.setScalar(1.25);
        stone.rotation.y = rng();
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.14), lampMat);
        lamp.position.set(0, 0.78, 0);
        const glow = new THREE.Sprite(glowMat);
        glow.position.set(0, 0.78, 0);
        glow.scale.setScalar(1.6);
        stone.add(lamp, glow);
        decor.add(stone);
    }

    // ---- a red arched bridge (taiko-bashi) across the stream: a curved plank deck on vermilion piers,
    // railings with posts, and bronze onion-shaped caps (giboshi) on the end posts
    {
        const VERMILION = "#b8342a", PLANK = "#6e4a33", BRONZE = "#a8873e";
        const SPAN = 9.4, RISE = 0.95, WIDE = 0.62, SEGS = 28, BANK = 0.42;
        const deckY = (x: number) => BANK + RISE * (1 - (2 * x / SPAN) ** 2) - 0.05;
        const parts: THREE.BufferGeometry[] = [];
        // a box from (x0,y0) to (x1,y1) along the arch, w deep and t thick, its top at those points
        const along = (x0: number, x1: number, y0: number, y1: number, t: number, w: number, z: number, color: string) => {
            const len = Math.hypot(x1 - x0, y1 - y0);
            return painted(new THREE.BoxGeometry(len, t, w).translate(0, -t / 2, 0).rotateZ(Math.atan2(y1 - y0, x1 - x0))
                .translate((x0 + x1) / 2, (y0 + y1) / 2, z), color);
        };
        for (let i = 0; i < SEGS; i++) {
            const x0 = -SPAN / 2 + (i / SEGS) * SPAN, x1 = x0 + SPAN / SEGS;
            parts.push(along(x0, x1, deckY(x0), deckY(x1), 0.06, WIDE * 2, 0, PLANK)); // planks
            parts.push(along(x0, x1, deckY(x0) - 0.06, deckY(x1) - 0.06, 0.1, 0.06, WIDE, VERMILION), // side beams
                along(x0, x1, deckY(x0) - 0.06, deckY(x1) - 0.06, 0.1, 0.06, -WIDE, VERMILION));
            for (const z of [WIDE, -WIDE]) { // top rail and a lower rail
                parts.push(along(x0, x1, deckY(x0) + 0.36, deckY(x1) + 0.36, 0.04, 0.05, z, VERMILION),
                    along(x0, x1, deckY(x0) + 0.18, deckY(x1) + 0.18, 0.025, 0.03, z, VERMILION));
            }
        }
        for (let i = 0; i <= SEGS; i += 4) { // railing posts, with caps on the four end posts
            const x = -SPAN / 2 + (i / SEGS) * SPAN, y = deckY(x), end = i === 0 || i === SEGS;
            for (const z of [WIDE, -WIDE]) {
                parts.push(painted(new THREE.BoxGeometry(0.07, 0.42, 0.07).translate(x, y + 0.19, z), VERMILION));
                if (end) {
                    parts.push(painted(new THREE.SphereGeometry(0.055, 10, 8).scale(1, 1.15, 1).translate(x, y + 0.46, z), BRONZE),
                        painted(new THREE.ConeGeometry(0.03, 0.08, 8).translate(x, y + 0.55, z), BRONZE));
                }
            }
        }
        for (const x of [-2.9, -1.2, 1.2, 2.9]) { // piers standing in the stream, braced across
            const top = deckY(x) - 0.12;
            for (const z of [WIDE - 0.08, -WIDE + 0.08]) parts.push(painted(new THREE.CylinderGeometry(0.06, 0.07, top + 1.2, 8).translate(x, (top - 1.2) / 2, z), VERMILION));
            parts.push(painted(new THREE.BoxGeometry(0.08, 0.08, WIDE * 2).translate(x, top - 0.05, 0), VERMILION),
                painted(new THREE.BoxGeometry(0.06, 0.06, WIDE * 2).translate(x, Math.min(0.1, top - 0.4), 0), VERMILION));
        }
        const mat = solid();
        dimmed.push([mat, 0.35]);
        const bridge = new THREE.Mesh(mergeGeometries(parts)!, mat);
        const [cx] = river(BRIDGE_Z);
        bridge.position.set(cx, 0, BRIDGE_Z);
        bridge.rotation.y = Math.atan2(river(BRIDGE_Z + 0.5)[0] - river(BRIDGE_Z - 0.5)[0], 1); // square across the current
        decor.add(bridge);
    }

    // ---- a red pavilion upstream on the far bank, half lost in the mist
    const RED = "#9e2b24", ROOF = "#3f3d3b";
    const roofCurve = [[0.02, 1.2], [0.2, 1.05], [0.55, 0.62], [0.95, 0.3], [1.3, 0.14], [1.52, 0.24]] // eaves turn up at the edge
        .map(([r, y]) => new THREE.Vector2(r, y));
    const pavilion = new THREE.Mesh(mergeGeometries([
        painted(new THREE.CylinderGeometry(1.2, 1.3, 0.5, 6).translate(0, -0.05, 0), "#8a857c"),
        ...Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return painted(new THREE.CylinderGeometry(0.06, 0.06, 1.45, 8).translate(Math.cos(a) * 0.9, 0.92, Math.sin(a) * 0.9), RED);
        }),
        painted(new THREE.CylinderGeometry(0.98, 0.98, 0.14, 6).translate(0, 1.6, 0), RED),
        painted(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 6, 1, true).translate(0, 0.45, 0), RED), // low railing
        painted(new THREE.LatheGeometry(roofCurve, 6).translate(0, 1.55, 0), ROOF),
        painted(new THREE.ConeGeometry(0.07, 0.4, 6).translate(0, 2.9, 0), ROOF),
        painted(new THREE.SphereGeometry(0.08, 8, 6).translate(0, 2.72, 0), ROOF),
    ])!, solid());
    dimmed.push([pavilion.material as THREE.MeshLambertMaterial, 0.3]);
    {
        pavilion.position.set(PAV_X, 0.42, PAV_Z);
        pavilion.scale.setScalar(0.75);
        pavilion.rotation.y = -0.3;
        decor.add(pavilion);
    }

    // ---- koi swimming slowly upstream, weaving a little, just under the surface. The fish is
    // "IkanKoi3D_032" by nurulaini on Sketchfab (CC-BY-4.0, credited on the page), shrunk for the web; it
    // loads after the rest of the scene. It has no animation, so the vertex shader swims it: a wave runs
    // down the body, growing towards the tail.
    const KOI = small ? 7 : 11, KOI_LENGTH = 0.7;
    const koiMat = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.88 }); // a little see-through, as if under water
    koiMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
          float tailward = clamp(transformed.z / ${KOI_LENGTH.toFixed(2)} + 0.5, 0.0, 1.0);  // 0 at the nose, 1 at the tail
          transformed.x += sin(transformed.z * 8.0 - uTime * 7.0 + float(gl_InstanceID) * 1.9) * (0.015 + 0.07 * tailward * tailward);`);
    };
    dimmed.push([koiMat, 0.45]);
    const koi = Array.from({ length: KOI }, () => {
        const z = -24 + rng() * 30;
        // a: across the stream (0 mid-channel, ±1 at the edges), so they stay in the water wherever it goes
        return { a: (rng() * 2 - 1) * 0.5, z, heading: (rng() - 0.5) * 2.4 + (rng() < 0.25 ? Math.PI : 0), // mostly upstream
            speed: 0.3 + rng() * 0.35, ph: rng() * 6.28, size: 0.8 + rng() * 0.5 };
    });
    const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    let school: THREE.InstancedMesh | null = null;
    const toFloat = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => { // the file is quantized; undo it before transforming
        const out = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
        return new THREE.BufferAttribute(out, a.itemSize);
    };
    // The model is posed mid-turn, bent into a C seen from above. Unbend it so the shader's swimming wave
    // starts from a straight fish: find the spine (the middle of the body in slices along z), then turn each
    // slice so the spine runs straight down z, keeping each vertex's distance from it.
    function straighten(geo: THREE.BufferGeometry) {
        const pos = geo.attributes.position as THREE.BufferAttribute, nor = geo.attributes.normal as THREE.BufferAttribute;
        geo.computeBoundingBox();
        const { min, max } = geo.boundingBox!, BINS = 24, len = max.z - min.z;
        const sum = new Float64Array(BINS), count = new Float64Array(BINS);
        const bin = (z: number) => Math.min(BINS - 1, Math.max(0, Math.floor(((z - min.z) / len) * BINS)));
        for (let i = 0; i < pos.count; i++) { const b = bin(pos.getZ(i)); sum[b] += pos.getX(i); count[b]++; }
        const raw = Array.from(sum, (v, b) => (count[b] ? v / count[b] : NaN));
        raw.forEach((v, b) => { if (Number.isNaN(v)) raw[b] = raw[b - 1] ?? 0; });
        const spine = raw.map((v, b) => (raw[b - 1] ?? v) * 0.25 + v * 0.5 + (raw[b + 1] ?? v) * 0.25); // smoothed
        const step = len / BINS, zAt = (b: number) => min.z + (b + 0.5) * step;
        const angle = spine.map((_, b) => Math.atan2((spine[Math.min(b + 1, BINS - 1)] - spine[Math.max(b - 1, 0)]),
            (Math.min(b + 1, BINS - 1) - Math.max(b - 1, 0)) * step));
        const arc = [0]; // distance along the spine to each slice's centre
        for (let b = 1; b < BINS; b++) arc.push(arc[b - 1] + Math.hypot(spine[b] - spine[b - 1], step));
        const sample = (list: number[], z: number) => { // linear between slice centres
            const u = Math.min(BINS - 1, Math.max(0, (z - min.z) / step - 0.5)), b = Math.min(Math.floor(u), BINS - 2), k = u - b;
            return list[b] + (list[b + 1] - list[b]) * k;
        };
        for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i), dx = pos.getX(i) - sample(spine, z), th = sample(angle, z), c = Math.cos(th), sn = Math.sin(th);
            pos.setXYZ(i, dx * c, pos.getY(i), zAt(0) + sample(arc, z) + dx * sn);
            const nx = nor.getX(i), nz = nor.getZ(i);
            nor.setXYZ(i, nx * c - nz * sn, nor.getY(i), nx * sn + nz * c);
        }
        pos.needsUpdate = nor.needsUpdate = true;
    }
    let disposed = false;
    new GLTFLoader().load("/models/koi/koi.glb", (gltf) => {
        if (disposed) return;
        let src: THREE.Mesh | undefined;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) src = o as THREE.Mesh; });
        if (!src) return;
        const geo = new THREE.BufferGeometry();
        for (const name of ["position", "normal", "uv"]) geo.setAttribute(name, toFloat(src.geometry.getAttribute(name)));
        geo.setIndex(src.geometry.index);
        // the model lies along z with its tail at -z; turn it to face -z, centre it, straighten it and size it
        geo.applyMatrix4(src.matrixWorld).rotateY(Math.PI).center();
        straighten(geo);
        geo.center();
        geo.computeBoundingBox();
        const box = geo.boundingBox!;
        geo.scale(KOI_LENGTH / (box.max.z - box.min.z), KOI_LENGTH / (box.max.z - box.min.z), KOI_LENGTH / (box.max.z - box.min.z));
        koiMat.map = (src.material as THREE.MeshStandardMaterial).map;
        koiMat.needsUpdate = true;
        school = new THREE.InstancedMesh(geo, koiMat, KOI);
        school.renderOrder = 3; // drawn after the water, so they show through it
        school.frustumCulled = false;
        world.add(school);
    });
    const swim = new THREE.Quaternion();
    // Heading 0 is upstream (-z). Each fish drifts left and right on its own slow rhythm, and near a bank
    // turns back towards the middle of the stream, so they wander rather than march in step.
    function placeKoi(t: number, dt: number, wrap: (z: number) => number) {
        if (!school) return;
        koi.forEach((k, i) => {
            const w = river(k.z)[1];
            k.heading += (0.5 * Math.sin(t * 0.35 + k.ph) + 0.3 * Math.sin(t * 0.83 + k.ph * 2.3)) * dt;
            if (Math.abs(k.a) > 0.45) { // steer back towards the middle, keeping up- or downstream
                const ahead = Math.cos(k.heading) >= 0 ? -2 : 2;
                k.heading += wrapAngle(Math.atan2(k.a * w, -ahead) - k.heading) * Math.min(1, (Math.abs(k.a) - 0.45) * 6) * dt * 1.5;
            }
            const speed = k.speed * (0.75 + 0.25 * Math.sin(t * 0.5 + k.ph)); // easing off and picking up
            k.a -= (Math.sin(k.heading) * speed * dt) / w;
            k.z = wrap(k.z - Math.cos(k.heading) * speed * dt); // round again from the other end of the window
            const [cx, w2] = river(k.z);
            swim.setFromAxisAngle(Y, k.heading);
            school!.setMatrixAt(i, m4.compose(at.set(cx + k.a * w2, -0.12, k.z), swim, sc.setScalar(k.size * Math.min(1, w2 / 2.8))));
        });
        school.instanceMatrix.needsUpdate = true;
    }

    // ---- leaves riding the current
    const leafShape = new THREE.Shape();
    leafShape.moveTo(-0.32, 0);
    leafShape.bezierCurveTo(-0.18, 0.2, 0.14, 0.2, 0.34, 0);
    leafShape.bezierCurveTo(0.14, -0.2, -0.18, -0.2, -0.32, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 10).rotateX(-Math.PI / 2);
    const leaves = ["#6f8f3a", "#8a9a3c", "#b0892f", "#9c6b2c", "#5f7f36", "#a47a34", "#7d8f3e", "#8f7a33", "#6a8a40",
        "#a88a3a", "#7f6a2e", "#94a045", "#c0703a", "#8f9d3a", "#b4572e", "#6b8c3c", "#a9963f", "#7a5a2a",
        "#98a64a", "#c28a3c", "#5d7a34", "#a0682e", "#86983e", "#b8a04a"].map((c, i) => {
        const leaf = new THREE.Mesh(leafGeo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
        const off = (rng() * 2 - 1) * 0.8;
        leaf.userData = { off, z: -30 + ((i + rng() * 0.5) / 24) * 48, speed: flowSpeed(off) * (0.85 + rng() * 0.3),
            yaw: rng() * Math.PI * 2, spin: (rng() - 0.5) * 0.4, size: 0.45 + rng() * 0.4 };
        world.add(leaf);
        return leaf;
    });
    const up = new THREE.Vector3(0, 1, 0), normal = new THREE.Vector3(), tilt = new THREE.Quaternion(), yaw = new THREE.Quaternion();

    // ---- clouds the camera climbs through between the two views: soft billows strewn round its path (draw
    // places them and fades them in mid-climb, so neither view has any)
    const puffTexture = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const g = c.getContext("2d")!;
        for (let i = 0; i < 7; i++) { // a few soft blobs overlapping into one billow
            const x = 64 + (Math.random() - 0.5) * 44, y = 64 + (Math.random() - 0.5) * 28, r = 18 + Math.random() * 16;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, "rgba(255,255,255,0.55)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = grad;
            g.fillRect(0, 0, 128, 128);
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    })();
    const cloudMat = new THREE.SpriteMaterial({ map: puffTexture, transparent: true, depthWrite: false, fog: false, opacity: 0 });
    const clouds = Array.from({ length: small ? 26 : 44 }, () => {
        const puff = new THREE.Sprite(cloudMat);
        puff.userData = { u: Math.random(), x: Math.random() * 2 - 1, z: Math.random() * 2 - 1, size: 0.7 + Math.random() * 0.8 };
        puff.renderOrder = 5;
        world.add(puff);
        return puff;
    });

    // ---- colours: AquaPlot's teal water on this site's white (or near-black) page
    const fog = new THREE.Fog("#d9e0da", 8, 30);
    world.fog = fog;
    let night = false;
    function setDark(dark: boolean) {
        const bg = new THREE.Color(dark ? "#0a0a0a" : "#d9e0da"); // mist
        const accent = new THREE.Color(dark ? "#3f9c8e" : "#1d6b62"); // jade
        const u = uniforms, c = (hex: string) => new THREE.Color(hex), set = (name: string, value: THREE.Color) => u[name].value.copy(value);
        if (dark) {
            set("uDeep", c("#04201c")); set("uShallow", accent.clone().lerp(c("#0b3832"), 0.6));
            set("uSky", bg.clone().lerp(accent, 0.3)); set("uSun", c("#d9f6f8").multiplyScalar(0.22));
            set("uBedA", c("#3a4a4c")); set("uBedB", c("#5d5a4e")); set("uGap", c("#1a2426")); set("uCaustic", c("#8fe3ea"));
            set("uFoam", c("#b9dfe3")); set("uGrassA", c("#1d2b22")); set("uGrassB", c("#2d3d2c")); set("uGrassC", c("#3b4622")); set("uGrassD", c("#1c3631")); set("uEarth", c("#2b2822"));
            set("uFlower", c("#6d7a5a")); set("uReedA", c("#1b281f")); set("uReedB", c("#4a6743"));
            set("uRock", c("#5b6466")); u.uReflect.value = 0.8;
        } else {
            set("uDeep", accent); set("uShallow", accent.clone().lerp(c("#5fb3a0"), 0.6));
            set("uSky", bg.clone().lerp(accent, 0.25)); set("uSun", c("#ffffff").multiplyScalar(0.35));
            set("uBedA", c("#7c7a70")); set("uBedB", c("#5f5d55")); set("uGap", c("#3d3c36")); set("uCaustic", c("#cdeee4"));
            set("uFoam", c("#eef6f2")); set("uGrassA", c("#3d6636")); set("uGrassB", c("#587c43")); set("uGrassC", c("#a9c24e")); set("uGrassD", c("#4a8f78")); set("uEarth", c("#4f4334"));
            set("uFlower", c("#f4efd0")); set("uReedA", c("#2c4f2c")); set("uReedB", c("#6f9353"));
            set("uRock", c("#858175")); u.uReflect.value = 0.35;
        }
        set("uFog", bg);
        fog.color.copy(bg);
        u.uNight.value = dark ? 1 : 0;
        for (const [mat, k] of dimmed) mat.color.setScalar(dark ? k : 1);
        lampMat.color.set(dark ? "#ffc27a" : "#e9dcc0");
        cloudMat.color.set(dark ? "#3a4448" : "#ffffff");
        night = dark; // the lanterns' glow (draw)
        renderer.setClearColor(bg);
        if (!running) draw(0);
    }

    // ---- reading the page: where the posts leave room for the river (AquaPlot's measure())
    let wpp = 0.024, topH = 30, win = [-30, 48], pathTex: THREE.DataTexture | null = null;
    type Chan = { top: number; bottom: number; c: number; h: number };
    // The river's centre: alongside a row, the middle of the channel its posts leave free; between two rows,
    // a smooth bend from one channel to the next, begun a little before the first row ends and finished a
    // little after the next begins.
    function centreAt(chans: Chan[], y: number) {
        for (let k = 0; k + 1 < chans.length; k++) {
            const a = chans[k], b = chans[k + 1];
            // long enough to bend gently, never so long it runs into the next bend on a short row
            const reach = Math.max(16, Math.min(Math.max((b.top - a.bottom) * 1.6, Math.abs(b.c - a.c) * 1.5),
                (a.bottom - a.top) / 2, (b.bottom - b.top) / 2));
            const from = a.bottom - reach, to = b.top + reach;
            if (y < from) break;
            if (y > to) continue;
            return mix(a.c, b.c, ease(clamp01((y - from) / (to - from))));
        }
        return (chans.find((q) => y <= q.bottom) || chans[chans.length - 1]).c;
    }
    function measure() {
        const W = host.clientWidth, H = host.clientHeight;
        if (!W || !H) return;
        const chans = [...flow.querySelectorAll(".ch")].map((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top + scrollY, bottom: r.bottom + scrollY, c: (r.left + r.right) / 2, h: r.width / 2 };
        }).filter((q) => q.bottom > q.top && q.h > 4);
        // From above, 5.6 world units either side of the middle fill a typical channel; everything else, rocks
        // and koi included, is sized in world units, so this sets the scale of the whole scene.
        const typical = chans.length ? chans.map((q) => q.h * 2).sort((a, b) => a - b)[chans.length >> 1] : W * 0.3;
        const across = Math.min(34, Math.max(14, (2 * 5.6 * W) / typical));
        wpp = across / W;
        topH = across / (2 * Math.tan(THREE.MathUtils.degToRad(TOP_FOV / 2)) * (W / H));
        const reach = (across * H) / W / 2; // world visible above and below the middle of the screen
        win = [-Math.max(30, reach + 6), Math.max(30, reach + 6) + Math.max(18, reach + 6)];
        uniforms.uWin.value.set(win[0], win[1]);
        uniforms.uEdge.value.set(Math.max(38, reach + 5), Math.max(48, reach + 12));
        if (!chans.length) { path = null; return; }

        // Page y to world z: the middle of the screen, once the first screen has scrolled away, is z = 0.
        const zOf = (y: number) => (y - hero.offsetHeight - H / 2) * wpp;
        const y0 = chans[0].top - H, y1 = chans[chans.length - 1].bottom + H;
        const n = Math.min(4096, Math.max(2, Math.ceil((y1 - y0) / 4))), step = (y1 - y0) / n;
        // First the centre line, then one width for the whole river: as wide as its tightest place beside the
        // posts allows. A river that narrows and swells round every bend looks pinched.
        const xs = new Float32Array(n), ws = new Float32Array(n), data = new Uint16Array(n * 2);
        // The river also meanders inside the channels, so it curves even beside a single row. The bends reach a
        // third of the way from the channel's middle to its edge, and the water narrows to fit beside them.
        const amp = typical * 0.17, TAU = Math.PI * 2;
        const centre = (y: number) => centreAt(chans, y) + amp * (0.65 * Math.sin((y / 1100) * TAU) + 0.35 * Math.sin((y / 520) * TAU + 1.7));
        let room = Infinity;
        for (let i = 0; i < n; i++) {
            const y = y0 + (i + 0.5) * step, c = centre(y);
            xs[i] = (c - W / 2) * wpp;
            for (const q of chans) if (y >= q.top && y <= q.bottom) room = Math.min(room, c - (q.c - q.h), q.c + q.h - c);
        }
        const width = Math.max(0.35, ((Math.min(room, typical / 2) - 8) * wpp) / 1.72); // banks gone 8px before the posts
        const shore = (1.12 * width) / wpp; // px from the middle to the waterline (ground() crosses 0 at about 1.12 across)
        ws.fill(width);
        for (let i = 0; i < n; i++) {
            data[i * 2] = THREE.DataUtils.toHalfFloat(xs[i]);
            data[i * 2 + 1] = THREE.DataUtils.toHalfFloat(width);
        }
        pathTex?.dispose();
        pathTex = new THREE.DataTexture(data, n, 1, THREE.RGFormat, THREE.HalfFloatType);
        pathTex.magFilter = pathTex.minFilter = THREE.LinearFilter;
        pathTex.needsUpdate = true;
        path = { n, xs, ws, z0: zOf(y0), dz: step * wpp };
        uniforms.uPath.value = pathTex;
        uniforms.uPathRange.value.set(path.z0, 1 / (n * path.dz));

        // Each post's line runs level with its title to the water's edge (app/blogs/timeline.css; 30 is
        // its top there). Layout offsets, not getBoundingClientRect: a post may be mid drift-in, moved by a transform.
        for (const el of flow.querySelectorAll<HTMLElement>(".river-row > .reveal")) {
            const parent = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect();
            if (!parent) continue;
            const left = parent.left + el.offsetLeft, right = left + el.offsetWidth, c = centre(parent.top + scrollY + el.offsetTop + 30);
            const toRight = c > (left + right) / 2;
            el.dataset.river = toRight ? "right" : "left";
            const edge = toRight ? c - shore : c + shore;
            el.style.setProperty("--reach", `${Math.round(Math.max(0, toRight ? edge - right : left - edge))}px`);
        }
    }

    // ---- the camera: low down looking up the stream behind About me, leaning a little towards the pointer;
    // rising as you scroll to look straight down on the river beside the posts
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
        lean.tx = (e.clientX / innerWidth - 0.5) * 1.4;
        lean.ty = (e.clientY / innerHeight - 0.5) * 0.5;
    };
    addEventListener("pointermove", onPointer, { passive: true });
    const aim = new THREE.Vector3(), eye0 = new THREE.Vector3(), eye1 = new THREE.Vector3(), NORTH = new THREE.Vector3(0, 0, -1);
    const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
    const snap = (z: number, step: number) => Math.round(z / step) * step;

    let t = 8, last = performance.now(), running = false, frame = 0, eased = scrollY;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    function draw(dt: number) {
        t += dt;
        eased = still.matches ? scrollY : eased + (scrollY - eased) * (1 - Math.exp(-dt * 8));
        const heroH = Math.max(hero.offsetHeight, 1);
        const p = clamp01(eased / heroH), e = ease(p), banks = ease(clamp01((p - 0.15) / 0.65)), gone = ease(clamp01((p - 0.05) / 0.5));
        pathMix = path ? ease(clamp01((p - 0.15) / 0.7)) : 0;
        const haze = Math.sin(Math.PI * clamp01((p - 0.06) / 0.88)) ** 1.5; // 0 in either view, 1 mid-climb
        // locked to the page, not eased: the bends have to stay beside the posts they go round
        const zc = Math.max(0, scrollY - heroH) * wpp;
        const tall = camera.aspect < 1, heroFov = tall ? 55 : 44; // tall screens look further down, so the stream fills them
        lean.x += (lean.tx - lean.x) * Math.min(1, dt * 2.5);
        lean.y += (lean.ty - lean.y) * Math.min(1, dt * 2.5);

        eye0.set(lean.x, 2.1 - lean.y, zc + 6.5);
        q0.setFromRotationMatrix(m4.lookAt(eye0, aim.set(lean.x * 0.4, tall ? -2.6 : -1.3, zc - 4), up));
        eye1.set(0, topH, zc);
        q1.setFromRotationMatrix(m4.lookAt(eye1, aim.set(0, 0, zc), NORTH));
        camera.position.lerpVectors(eye0, eye1, e);
        camera.quaternion.slerpQuaternions(q0, q1, e);
        camera.fov = mix(heroFov, TOP_FOV, e);
        camera.updateProjectionMatrix();

        const u = uniforms;
        u.uTime.value = t; u.uAnchor.value = zc; u.uPathMix.value = pathMix;
        const thick = 1 - 0.75 * haze, thin = 1 - 0.55 * haze; // the mist closes in while the camera is in the clouds
        u.uFogNear.value = mix(8, topH * 2.5, e) * thick; u.uFogFar.value = mix(26, topH * 5, e) * thin;
        fog.near = mix(8, topH * 2.5, e) * thick; fog.far = mix(30, topH * 5, e) * thin;
        u.uBank.value.set(mix(3.5, 1.32, banks), mix(9, 1.72, banks));
        // From above the banks have faded to the page's colour a few units out, and the clear colour is that
        // colour too: no need to shade the land beyond them.
        u.uSpread.value = Math.min(1, (u.uBank.value.y * Math.max(3.2, path ? path.ws[0] : 0) * 1.15) / 30);
        u.uPointK.value = mix(7, topH * 0.3, e);
        terrain.position.z = snap(zc, LEN / groundSeg[1]);
        water.position.z = snap(zc, LEN / waterSeg[1]);
        decor.visible = gone < 1;
        for (const m of decorMats) m.opacity = 1 - gone;
        glowMat.opacity = night ? 1 - gone : 0;
        cloudMat.opacity = haze * 0.85;
        cloudMat.visible = haze > 0.001;
        for (const puff of clouds) { // each at its own height, beside where the camera is when it gets there
            const d = puff.userData, y = mix(4, topH * 0.85, d.u), k = clamp01((y - 2.1) / (topH - 2.1)), spread = 3 + y * 0.5;
            puff.position.set(d.x * spread, y, zc + 6.5 * (1 - k) - 4 * (1 - k) + d.z * spread);
            puff.scale.setScalar((5 + y * 0.45) * d.size);
        }

        // Rocks, koi and leaves live in a window round the camera, and scale with the river they sit in.
        const lo = zc + win[0], wrap = (z: number) => lo + ((((z - lo) % win[1]) + win[1]) % win[1]);
        rocks.forEach((rock, i) => {
            const d = rock.userData;
            d.z = wrap(d.z);
            const [cx, w] = river(d.z), k = Math.min(1.1, w / 3), x = cx + d.off * w;
            rock.scale.set(d.size[0] * k, d.size[1] * k, d.size[2] * k);
            rock.position.set(x, d.yc * k, d.z);
            u.uRocks.value[i].set(x, d.z, d.r * k, d.strength);
        });
        placeKoi(t, dt, wrap);
        for (const leaf of leaves) { // drift downstream
            const d = leaf.userData;
            d.z = wrap(d.z + d.speed * dt);
            d.yaw += d.spin * dt;
            const [cx, w] = river(d.z), x = cx + d.off * w;
            const [h, dx, dz] = wavesAt(x, d.z, t);
            leaf.scale.setScalar(d.size * Math.min(1.1, Math.max(0.45, w / 3)));
            leaf.position.set(x, h + 0.05, d.z);
            tilt.setFromUnitVectors(up, normal.set(-dx, 1, -dz).normalize());
            yaw.setFromAxisAngle(up, d.yaw);
            leaf.quaternion.copy(tilt).multiply(yaw);
        }
        renderer.render(world, camera);
        canvas.classList.add("opacity-100");
    }
    function loop(now: number) {
        if (!running) return;
        draw(Math.min((now - last) / 1000, 0.05));
        last = now;
        frame = requestAnimationFrame(loop);
    }
    function update() { // pause when hidden; with motion reduced, a still frame instead
        const go = !document.hidden && !still.matches;
        if (go && !running) { running = true; last = performance.now(); frame = requestAnimationFrame(loop); }
        if (!go) { running = false; cancelAnimationFrame(frame); }
        if (still.matches) draw(0);
    }
    let pending = false;
    const onScroll = () => { // with motion reduced, a still frame for each scroll position
        if (running || pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; draw(0); });
    };
    addEventListener("scroll", onScroll, { passive: true });
    const relayout = () => { measure(); if (!running) draw(0); };
    const resize = new ResizeObserver(() => {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        relayout();
    });
    resize.observe(host);
    const reflow = new ResizeObserver(relayout); // cover images loading, posts added or removed, fonts
    reflow.observe(flow);
    document.addEventListener("visibilitychange", update);
    still.addEventListener("change", update);

    return {
        setDark,
        start: update,
        stop() {
            running = false;
            disposed = true;
            cancelAnimationFrame(frame);
            resize.disconnect();
            reflow.disconnect();
            removeEventListener("pointermove", onPointer);
            removeEventListener("scroll", onScroll);
            document.removeEventListener("visibilitychange", update);
            still.removeEventListener("change", update);
            world.traverse((o) => {
                if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
                    o.geometry.dispose();
                    (o.material as THREE.Material).dispose();
                }
            });
            pathTex?.dispose();
            blankPath.dispose();
            puffTexture.dispose();
            cloudMat.dispose();
            renderer.dispose();
        },
    };
}

// The first screen and the way off it, separate from the scene so it works without WebGL. About me fades and
// lifts away as you scroll (--hero-p, 0..1, on the page; app/blogs/timeline.css). Between the two views the camera
// is mid-climb, which looks wrong to stop on, so the page never rests there: My Blogs, or any scroll down from
// About me (wheel, touch or keys), glides all the way through the climb to the river, and a scroll up from the top
// of the timeline glides back. Not while About me is being edited, so the form can scroll.
function heroScroll(hero: HTMLElement) {
    const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
    let queued = false, glide = 0, gliding = false, touching = false, touchY = 0, lastY = scrollY, dir = 1, rest = 0, calm = 0;
    const link = hero.querySelector<HTMLAnchorElement>('a[href="#river-flow"]');
    function glideTo(to: number) {
        cancelAnimationFrame(glide);
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return scrollTo({ top: to, behavior: "instant" });
        const from = scrollY, ms = 1000 + Math.min(1, Math.abs(to - from) / innerHeight) * 1200, t0 = performance.now();
        gliding = true;
        const step = (now: number) => {
            const k = Math.min(1, (now - t0) / ms);
            scrollTo({ top: from + (to - from) * easeInOut(k), behavior: "instant" });
            if (k < 1) glide = requestAnimationFrame(step);
            else { gliding = false; calm = performance.now() + 500; } // let a trackpad's momentum die out first
        };
        glide = requestAnimationFrame(step);
    }
    const editing = () => !!hero.querySelector("input, textarea");
    // Whether a scroll this way is ours to turn into a glide: anything on the first screen or mid-climb, and
    // scrolling up from the top of the timeline. Returns false to let the page scroll as usual.
    function take(down: boolean) {
        const h = hero.offsetHeight;
        if (editing() || !(scrollY < h - 2 || (!down && scrollY <= h + 2) || gliding || performance.now() < calm)) return false;
        if (!gliding && performance.now() >= calm) glideTo(down ? h : 0);
        return true;
    }
    function settle() { // a scroll that came to rest mid-climb (the scrollbar, momentum) goes on the way it was going
        const h = hero.offsetHeight;
        if (gliding || touching || editing()) return;
        if (scrollY > 2 && scrollY < h - 2) glideTo(dir > 0 ? h : 0);
    }
    const later = () => { clearTimeout(rest); rest = window.setTimeout(settle, 160); };
    const onScroll = () => {
        dir = Math.sign(scrollY - lastY) || dir;
        lastY = scrollY;
        later();
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            // on the page, not just the hero: the posts' lines use it too
            (hero.parentElement ?? hero).style.setProperty("--hero-p", clamp01(scrollY / Math.max(hero.offsetHeight, 1)).toFixed(4));
        });
    };
    const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey || !e.deltaY) return; // ctrl: pinch-zooming
        if (take(e.deltaY > 0)) e.preventDefault();
    };
    const KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "End", "Home"]);
    const onKey = (e: KeyboardEvent) => {
        if (!KEYS.has(e.key) || (e.target as HTMLElement).closest?.("input, textarea, select, button, [contenteditable]")) return;
        if (take(!["ArrowUp", "PageUp", "Home"].includes(e.key))) e.preventDefault();
    };
    const onTouch = (e: TouchEvent) => {
        touching = e.type === "touchstart";
        if (touching) touchY = e.touches[0]?.clientY ?? 0;
        else later();
    };
    const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 1 || !e.cancelable) return; // two fingers: pinch-zooming
        const dy = touchY - e.touches[0].clientY; // > 0: the finger moves up, scrolling down
        if (Math.abs(dy) < 8) { // too small to tell which way yet; on the first screen, don't let the page start moving
            if (!editing() && scrollY < hero.offsetHeight - 2) e.preventDefault();
            return;
        }
        if (take(dy > 0)) e.preventDefault();
    };
    const onLink = (e: MouseEvent) => { e.preventDefault(); glideTo(hero.offsetHeight); };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("wheel", onWheel, { passive: false });
    addEventListener("keydown", onKey);
    addEventListener("touchstart", onTouch, { passive: true });
    addEventListener("touchend", onTouch, { passive: true });
    addEventListener("touchmove", onTouchMove, { passive: false });
    link?.addEventListener("click", onLink);
    onScroll();
    return () => {
        cancelAnimationFrame(glide);
        clearTimeout(rest);
        removeEventListener("scroll", onScroll);
        removeEventListener("wheel", onWheel);
        removeEventListener("keydown", onKey);
        removeEventListener("touchstart", onTouch);
        removeEventListener("touchend", onTouch);
        removeEventListener("touchmove", onTouchMove);
        link?.removeEventListener("click", onLink);
    };
}

// Expects #river-hero and #river-flow on the page (app/blogs/page.tsx).
export default function RiverBackground() {
    const host = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const scene = useRef<ReturnType<typeof start>>(null);
    const dark = useDarkMode();

    useEffect(() => {
        const hero = document.getElementById("river-hero")!, flow = document.getElementById("river-flow")!;
        const unhero = heroScroll(hero);
        const s = start(canvas.current!, host.current!, hero, flow);
        scene.current = s;
        s?.start();
        return () => { unhero(); s?.stop(); scene.current = null; };
    }, []);
    useEffect(() => scene.current?.setDark(dark), [dark]);

    return (<>
        {/* a soft glow shows while the scene loads, or if WebGL isn't available */}
        <div ref={host} aria-hidden className="fixed inset-0 -z-10 pointer-events-none
            bg-[radial-gradient(120%_80%_at_50%_62%,#a9c7bf_0%,#d9e0da_75%)] dark:bg-[radial-gradient(120%_80%_at_50%_62%,#1a3a40_0%,#0a0a0a_75%)]">
            <canvas ref={canvas} className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-[1400ms]" />
        </div>
        <p className="px-4 pb-4 text-right text-[0.75rem] text-zinc-600 dark:text-zinc-400">
            &ldquo;IkanKoi3D_032&rdquo; <a href="https://sketchfab.com/3d-models/ikankoi3d-032-721a743e2a7d49eaa59e07a67a23a7e8" target="_blank">(koi)</a> by nurulaini is licensed under Creative Commons Attribution <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank">(CC BY 4.0)</a>
        </p>
    </>);
}
