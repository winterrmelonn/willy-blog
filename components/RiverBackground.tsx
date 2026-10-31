"use client";

// The stream behind the About page, ported from the AquaPlot about page (~/Documents/aquaplot/src/aquaplot/
// static/about.html). It's one small world drawn by shaders with no images: a channel deeper and faster in
// the middle, with pebbles and caustics on the bed, boulders the current foams around, reeds on the banks
// and leaves riding the surface, seen from low down looking upstream. AquaPlot also flew the camera down
// the page as you scrolled and bent the river round its text; this page is short, so only the opening
// view came over. Decorative: if WebGL is missing the soft gradient behind the canvas stays.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useDarkMode } from "./darkmode";

const LEN = 140; // length of the stretch of world kept around the camera
const ROCKS = 14;
const f = (v: number) => v.toFixed(5);

// The river's centre and half-width at z (the shaders' river() below is the same curve)
const river = (z: number) => [0.35 * Math.sin(z * 0.11) + 0.2 * Math.sin(z * 0.23 + 1.3), 3.0 + 0.2 * Math.sin(z * 0.07 + 2.0)];
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bankHeight = (d: number) => { const k = smoothstep(0.95, 1.4, d); return (-1.05 + 0.7 * d * d) * (1 - k) + 0.42 * k; }; // d: 1 at the water's edge
const flowSpeed = (a: number) => 0.25 + 1.5 * Math.max(0, 1 - a * a);

const COMMON = `
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
    vec2 river(float z) {  // centre and half-width of the channel at z
      return vec2(0.35 * sin(z * 0.11) + 0.2 * sin(z * 0.23 + 1.3), 3.0 + 0.2 * sin(z * 0.07 + 2.0));
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

// Builds the scene on `canvas` (sized to `host`). Returns setDark() and a cleanup.
function start(canvas: HTMLCanvasElement, host: HTMLElement) {
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
    const uniforms: Record<string, THREE.IUniform> = {
        uTime: { value: 0 }, uAnchor: { value: 0 }, uFogNear: { value: 8 }, uFogFar: { value: 26 },
        uEdge: { value: new THREE.Vector2(38, 48) }, uBank: { value: new THREE.Vector2(3.5, 9) },
        uWin: { value: new THREE.Vector2(-30, 48) },
        uNight: { value: 0 }, uPointK: { value: 7 }, uDpr: { value: renderer.getPixelRatio() }, uReflect: { value: 0.8 }, uSpread: { value: 1 },
        uDeep: { value: color() }, uShallow: { value: color() }, uSky: { value: color() }, uSun: { value: color() },
        uFog: { value: color() }, uFoam: { value: color() }, uCaustic: { value: color() },
        uBedA: { value: color() }, uBedB: { value: color() }, uGap: { value: color() },
        uGrassA: { value: color() }, uGrassB: { value: color() }, uEarth: { value: color() }, uFlower: { value: color() },
        uReedA: { value: color() }, uReedB: { value: color() }, uRock: { value: color() },
        // A low sun upstream: its glitter lies on the far water, never in the reader's lap.
        uLight: { value: new THREE.Vector3(-0.3, 0.5, -1.0).normalize() },
        uRocks: { value: Array.from({ length: ROCKS }, () => new THREE.Vector4()) },
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
        fragmentShader: `uniform float uTime, uNight; uniform vec3 uBedA, uBedB, uGap, uCaustic, uDeep, uFog, uGrassA, uGrassB, uEarth, uFlower, uLight;
      varying vec3 vWorld; varying vec3 vN;
      ${COMMON} ${FADE} ${VORONOI_GLSL} ${CAUSTIC_GLSL}
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
        if (h > -0.03) {  // wet earth and stones at the edge, then grass with the odd flower
          float g = fbm(p * 0.8);
          vec3 grass = mix(uGrassA, uGrassB, g) * (0.82 + 0.22 * vnoise(p * 7.0) + 0.14 * vnoise(vec2(p.x * 40.0, p.y * 9.0)));
          vec2 cell = floor(p * 14.0); float kind = hash1(cell + 7.0);
          vec3 bloom = kind < 0.4 ? uFlower : kind < 0.7 ? vec3(0.95, 0.72, 0.16) : vec3(0.62, 0.45, 0.85);
          float dot1 = 1.0 - smoothstep(0.18, 0.32, length(fract(p * 14.0) - 0.5));
          grass = mix(grass, bloom * mix(1.0, 0.3, uNight), step(0.975, hash1(cell)) * dot1 * 0.9);
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

    // ---- reeds and long grass along both banks, swaying
    const blade = new THREE.BufferGeometry();
    blade.setAttribute("position", new THREE.Float32BufferAttribute(
        [-1, 0, 0, 1, 0, 0, -0.72, 0.33, 0, 0.72, 0.33, 0, -0.42, 0.66, 0, 0.42, 0.66, 0, 0, 1, 0], 3));
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
    const REEDS = small ? 2200 : 4200;
    const reedGeo = new THREE.InstancedBufferGeometry();
    reedGeo.index = blade.index;
    reedGeo.setAttribute("position", blade.getAttribute("position"));
    const spot = new Float32Array(REEDS * 4), size = new Float32Array(REEDS * 2);
    for (let i = 0; i < REEDS; i++) {
        const out = Math.random() ** 2; // most of them close to the water
        spot.set([Math.random() < 0.5 ? -1 : 1, 1.08 + out * 1.1, Math.random(), Math.random()], i * 4);
        size.set([0.03 + Math.random() * 0.03, (0.3 + Math.random() * 0.45) * (1.25 - out * 0.6)], i * 2);
    }
    reedGeo.setAttribute("aSpot", new THREE.InstancedBufferAttribute(spot, 4));
    reedGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 2));
    reedGeo.instanceCount = REEDS;
    const reeds = new THREE.Mesh(reedGeo, new THREE.ShaderMaterial({
        uniforms, side: THREE.DoubleSide,
        vertexShader: `uniform float uTime; attribute vec4 aSpot; attribute vec2 aSize; varying float vV, vFade, vShade;
      ${COMMON} ${FADE}
      void main() {
        float z = wrapZ(aSpot.z * uWin.y);
        vec2 r = river(z);
        vec2 base = vec2(r.x + aSpot.x * aSpot.y * r.y, z);
        float v = position.y, a = aSpot.w * 6.2831;
        vec3 w = vec3(base.x, ground(base), base.y);
        w.xz += vec2(cos(a), sin(a)) * position.x * aSize.x;
        w.y += v * aSize.y;
        w.xz += (vec2(aSpot.x * 0.12, 0.08) + vec2(0.0, sin(uTime * 1.7 + aSpot.w * 30.0) * 0.1)) * v * v * aSize.y * 2.0;
        vV = v; vShade = 0.8 + 0.4 * fract(aSpot.w * 13.7);
        vFade = max(fadeAt(w), bankFade(base));
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
        fragmentShader: `uniform vec3 uReedA, uReedB, uFog; varying float vV, vFade, vShade;
      void main() {
        gl_FragColor = vec4(mix(mix(uReedA, uReedB, vV) * vShade, uFog, vFade), 1.0);
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
    world.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.4));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
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
        fragmentShader: `uniform vec3 uRock, uDeep, uShallow, uFog, uLight; varying vec3 vWorld; varying vec3 vColor;
      ${COMMON} ${FADE}
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));  // faceted, like cut stone
        vec3 col = uRock * vColor * (0.45 + 0.75 * max(dot(n, uLight), 0.0) + 0.15 * max(n.y, 0.0));
        col = mix(col, mix(uShallow, uDeep, 0.6), smoothstep(0.0, 0.4, -vWorld.y) * 0.85);
        gl_FragColor = vec4(mix(col, uFog, fadeAt(vWorld)), 1.0);
        #include <colorspace_fragment>
      }`,
    });
    const v3 = new THREE.Vector3();
    for (let i = 0; i < ROCKS; i++) {
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
        const [cx, w] = river(z), k = Math.min(1.1, w / 3), x = cx + (rng() * 2 - 1) * 0.72 * w;
        mesh.scale.set(sx * k, sy * k, sz * k);
        mesh.position.set(x, yc * k, z);
        uniforms.uRocks.value[i].set(x, z, (breaks ? sx * Math.sqrt(1 - (yc / sy) ** 2) : sx * 0.7) * k, breaks ? 1 : 0.35);
        world.add(mesh);
    }

    // ---- trees along the banks, fading into the haze upstream: a trunk and two lumps of leaves each
    const TREES = small ? 36 : 64;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.09, 1, 5).translate(0, 0.5, 0),
        new THREE.MeshLambertMaterial({ color: "#5a4632" }), TREES);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshLambertMaterial({ flatShading: true }), TREES * 2);
    const crownColors = ["#5f8a46", "#6f9a4e", "#4f7a3e", "#86a352", "#a69a48", "#6a8f5a"];
    const crownBase: THREE.Color[] = [];
    // instanced things whose colours dim at night: [mesh, day colours, how bright at night]
    const tinted: [THREE.InstancedMesh, THREE.Color[], number][] = [[crowns, crownBase, 0.32]];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), at = new THREE.Vector3();
    for (let i = 0; i < TREES; i++) {
        const z = -4 - rng() * 42, side = rng() < 0.5 ? -1 : 1;
        const [cx, w] = river(z), x = cx + side * (1.7 + rng() * 1.5) * w;
        const h = 1.4 + rng() * 1.8, r = 0.6 + rng() * 0.6, y = 0.38;
        trunks.setMatrixAt(i, m4.compose(at.set(x, y, z), q.identity(), sc.set(1, h, 1)));
        for (let j = 0; j < 2; j++) { // a big lump, and a smaller one perched off-centre on top
            const k = j ? 0.62 : 1;
            q.setFromAxisAngle(sc.set(0, 1, 0), rng() * 6.28);
            crowns.setMatrixAt(i * 2 + j, m4.compose(
                at.set(x + (j ? (rng() - 0.5) * r : 0), y + h + (j ? r * 0.75 : 0), z + (j ? (rng() - 0.5) * r : 0)),
                q, sc.set(r * k, r * k * (1.1 + rng() * 0.3), r * k)));
            crownBase.push(new THREE.Color(crownColors[Math.floor(rng() * crownColors.length)]).multiplyScalar(0.85 + rng() * 0.3));
        }
    }
    world.add(trunks, crowns);

    // ---- wildflowers along both banks: a stem and a little head each, in a few colours, nodding in the breeze
    const FLOWERS = small ? 320 : 700;
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.01, 1, 3).translate(0, 0.5, 0),
        new THREE.MeshLambertMaterial({ color: "#4f7a3a" }), FLOWERS);
    const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), FLOWERS);
    const bloomColors = ["#e8484f", "#f4c430", "#ffffff", "#b07ce0", "#f28cb8", "#ff8a3d", "#f7f0c8"];
    const headBase: THREE.Color[] = [];
    const flowerSpots: { x: number; y: number; z: number; h: number; r: number; ph: number }[] = [];
    for (let i = 0; i < FLOWERS; i++) {
        const z = 6 - rng() * 44, d = 1.12 + rng() ** 1.5 * 0.5, [cx, w] = river(z);
        const x = cx + (rng() < 0.5 ? -1 : 1) * d * w;
        flowerSpots.push({ x, y: bankHeight(d) - 0.02, z, h: 0.12 + rng() * 0.22, r: 0.025 + rng() * 0.025, ph: rng() * 6.28 });
        headBase.push(new THREE.Color(bloomColors[Math.floor(rng() * bloomColors.length)]));
    }
    tinted.push([heads, headBase, 0.3]);
    world.add(stems, heads);
    const tip = new THREE.Vector3(), nod = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
    function placeFlowers(t: number) {
        flowerSpots.forEach((fl, i) => {
            const a = Math.sin(t * 1.3 + fl.ph) * 0.12; // a gentle nod downstream and back
            nod.setFromAxisAngle(X, a);
            stems.setMatrixAt(i, m4.compose(at.set(fl.x, fl.y, fl.z), nod, sc.set(1, fl.h, 1)));
            tip.set(0, fl.h, 0).applyQuaternion(nod).add(at);
            heads.setMatrixAt(i, m4.compose(tip, nod, sc.set(fl.r * 1.3, fl.r * 0.7, fl.r * 1.3)));
        });
        stems.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    }

    // ---- koi swimming slowly upstream, weaving a little, just under the surface
    const KOI = small ? 7 : 11;
    const bodyGeo = new THREE.SphereGeometry(1, 16, 8).scale(0.06, 0.035, 0.36); // long and slim, nose towards -z
    const patchGeo = new THREE.SphereGeometry(1, 12, 6).scale(0.045, 0.03, 0.14); // a coloured patch on the back
    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, -0.11, 0, 0.2, 0.11, 0, 0.2, 0, 0, 0.12], 3));
    tailGeo.setIndex([0, 1, 3, 0, 3, 2]);
    tailGeo.computeVertexNormals();
    const koiMat = () => new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const bodies = new THREE.InstancedMesh(bodyGeo, koiMat(), KOI), tails = new THREE.InstancedMesh(tailGeo, koiMat(), KOI);
    const patches = new THREE.InstancedMesh(patchGeo, koiMat(), KOI * 2);
    bodies.renderOrder = tails.renderOrder = 3;
    patches.renderOrder = 4; // drawn after the water and softened, as if seen through it
    // body and patch colours: white with red (kohaku), orange with white, gold with black, white with orange
    const KINDS = [["#f4efe6", "#d9301c"], ["#f26b1d", "#f8f2ea"], ["#f5b335", "#2a2522"], ["#f8f2ea", "#ff7a2f"], ["#e84a1f", "#f4efe6"]];
    const koiBase: THREE.Color[] = [], patchBase: THREE.Color[] = [];
    const koi = Array.from({ length: KOI }, () => {
        const [body, patch] = KINDS[Math.floor(rng() * KINDS.length)];
        koiBase.push(new THREE.Color(body));
        patchBase.push(new THREE.Color(patch), new THREE.Color(patch));
        return { z: -26 + rng() * 34, off: (rng() * 2 - 1) * 0.55, speed: 0.35 + rng() * 0.45, ph: rng() * 6.28, size: 0.8 + rng() * 0.5 };
    });
    tinted.push([bodies, koiBase, 0.45], [tails, koiBase, 0.45], [patches, patchBase, 0.45]);
    world.add(bodies, tails, patches);
    const swim = new THREE.Quaternion(), wag = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), back = new THREE.Vector3();
    function placeKoi(t: number, dt: number) {
        koi.forEach((k, i) => {
            k.z -= k.speed * dt;
            if (k.z < -30) k.z += 40; // round again from just behind the camera
            const weave = (z: number) => { const [cx, w] = river(z); return cx + (k.off + 0.18 * Math.sin(z * 0.6 + k.ph)) * w; };
            const x = weave(k.z), heading = Math.atan2(weave(k.z - 0.1) - x, -0.1); // facing where it's going
            swim.setFromAxisAngle(Y, heading + Math.PI);
            at.set(x, -0.12, k.z);
            bodies.setMatrixAt(i, m4.compose(at, swim, sc.setScalar(k.size)));
            for (let j = 0; j < 2; j++) { // two patches along the back, one near the head and one further back
                back.set(0.012 * (j ? -1 : 1), 0.012, (j ? 0.1 : -0.12) * k.size).applyQuaternion(swim).add(at);
                patches.setMatrixAt(i * 2 + j, m4.compose(back, swim, sc.setScalar(k.size * (j ? 0.8 : 1))));
            }
            back.set(0, 0, 0.34 * k.size).applyQuaternion(swim).add(at); // tail at the back, flicking side to side
            wag.setFromAxisAngle(Y, Math.sin(t * 7 + k.ph) * 0.45);
            tails.setMatrixAt(i, m4.compose(back, swim.clone().multiply(wag), sc.setScalar(k.size)));
        });
        bodies.instanceMatrix.needsUpdate = tails.instanceMatrix.needsUpdate = patches.instanceMatrix.needsUpdate = true;
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

    // ---- colours: AquaPlot's teal water on this site's white (or near-black) page
    function setDark(dark: boolean) {
        const bg = new THREE.Color(dark ? "#0a0a0a" : "#ffffff");
        const accent = new THREE.Color(dark ? "#56b6c2" : "#0f6b7a");
        const u = uniforms, c = (hex: string) => new THREE.Color(hex), set = (name: string, value: THREE.Color) => u[name].value.copy(value);
        if (dark) {
            set("uDeep", c("#06232a")); set("uShallow", accent.clone().lerp(c("#0c3a42"), 0.55));
            set("uSky", bg.clone().lerp(accent, 0.3)); set("uSun", c("#d9f6f8").multiplyScalar(0.22));
            set("uBedA", c("#3a4a4c")); set("uBedB", c("#5d5a4e")); set("uGap", c("#1a2426")); set("uCaustic", c("#8fe3ea"));
            set("uFoam", c("#b9dfe3")); set("uGrassA", c("#1d2b22")); set("uGrassB", c("#2d3d2c")); set("uEarth", c("#2b2822"));
            set("uFlower", c("#6d7a5a")); set("uReedA", c("#1b281f")); set("uReedB", c("#4a6743"));
            set("uRock", c("#5b6466")); u.uReflect.value = 0.8;
        } else {
            set("uDeep", accent); set("uShallow", accent.clone().lerp(c("#39c0b6"), 0.7));
            set("uSky", bg.clone().lerp(accent, 0.3)); set("uSun", c("#ffffff").multiplyScalar(0.55));
            set("uBedA", c("#9a927c")); set("uBedB", c("#7a7466")); set("uGap", c("#5b5649")); set("uCaustic", c("#f4fffd"));
            set("uFoam", c("#ffffff")); set("uGrassA", c("#7fa36a")); set("uGrassB", c("#a3bd82")); set("uEarth", c("#9a8a6a"));
            set("uFlower", c("#f4efd0")); set("uReedA", c("#5d7d45")); set("uReedB", c("#b5c98a"));
            set("uRock", c("#9a958a")); u.uReflect.value = 0.5;
        }
        set("uFog", bg);
        world.fog = new THREE.Fog(bg, 8, 28);
        u.uNight.value = dark ? 1 : 0;
        for (const [mesh, base, night] of tinted) {
            base.forEach((col, i) => mesh.setColorAt(i, col.clone().multiplyScalar(dark ? night : 1)));
            mesh.instanceColor!.needsUpdate = true;
        }
        (stems.material as THREE.MeshLambertMaterial).color.set(dark ? "#1c2b16" : "#4f7a3a");
        (trunks.material as THREE.MeshLambertMaterial).color.set(dark ? "#241c14" : "#5a4632");
        renderer.setClearColor(bg);
        if (!running) draw(0);
    }

    // ---- the camera: low down, looking up the stream, leaning a little towards the pointer
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
        lean.tx = (e.clientX / innerWidth - 0.5) * 1.4;
        lean.ty = (e.clientY / innerHeight - 0.5) * 0.5;
    };
    addEventListener("pointermove", onPointer, { passive: true });
    const aim = new THREE.Vector3();

    let t = 8, last = performance.now(), running = false, frame = 0;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    function draw(dt: number) {
        t += dt;
        lean.x += (lean.tx - lean.x) * Math.min(1, dt * 2.5);
        lean.y += (lean.ty - lean.y) * Math.min(1, dt * 2.5);
        const tall = camera.aspect < 1; // tall screens look further down, so the stream fills them
        camera.position.set(lean.x, 2.1 - lean.y, 6.5);
        camera.lookAt(aim.set(lean.x * 0.4, tall ? -2.6 : -1.3, -4));
        camera.fov = tall ? 55 : 44;
        camera.updateProjectionMatrix();
        uniforms.uTime.value = t;

        placeFlowers(t);
        placeKoi(t, dt);
        for (const leaf of leaves) { // drift downstream, wrapping round the stretch of world near the camera
            const d = leaf.userData;
            d.z = -30 + ((((d.z + d.speed * dt) + 30) % 48) + 48) % 48;
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
    const resize = new ResizeObserver(() => {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        if (!running) draw(0);
    });
    resize.observe(host);
    document.addEventListener("visibilitychange", update);
    still.addEventListener("change", update);

    return {
        setDark,
        start: update,
        stop() {
            running = false;
            cancelAnimationFrame(frame);
            resize.disconnect();
            removeEventListener("pointermove", onPointer);
            document.removeEventListener("visibilitychange", update);
            still.removeEventListener("change", update);
            world.traverse((o) => {
                if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
                    o.geometry.dispose();
                    (o.material as THREE.Material).dispose();
                }
            });
            renderer.dispose();
        },
    };
}

export default function RiverBackground() {
    const host = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const scene = useRef<ReturnType<typeof start>>(null);
    const dark = useDarkMode();

    useEffect(() => {
        const s = start(canvas.current!, host.current!);
        scene.current = s;
        s?.start();
        return () => { s?.stop(); scene.current = null; };
    }, []);
    useEffect(() => scene.current?.setDark(dark), [dark]);

    return (
        // a soft teal glow shows while the scene loads, or if WebGL isn't available
        <div ref={host} aria-hidden className="fixed inset-0 -z-10 pointer-events-none
            bg-[radial-gradient(120%_80%_at_50%_62%,#c3dade_0%,#ffffff_75%)] dark:bg-[radial-gradient(120%_80%_at_50%_62%,#1a3a40_0%,#0a0a0a_75%)]">
            <canvas ref={canvas} className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-[1400ms]" />
        </div>
    );
}
