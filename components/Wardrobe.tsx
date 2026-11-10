"use client";

import Link from "next/link";
import { Fragment, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { deleteItem, loadWardrobe, saveItem, type Category, type Item } from "@/app/wardrobe/actions";

// Rudimentary Intelligence, the wardrobe on /wardrobe. Boot screen, then the login (the site's own accounts;
// only ADMIN_EMAILS get in), then the inventory. Styles are in app/wardrobe/wardrobe.css.

type Screen = "boot" | "login" | "app";
type Line = { t: string; text: string; state: "pend" | "ok" | "fail" };
type Draft = { name: string; cat: Category; brand: string; size: string; value: string; color: string; notes: string };
type Spot = { x: number; y: number; dx?: number; dy?: number; dur?: number; g?: boolean };

const CATS: Record<Category, string> = { TOP: "Tops", BTM: "Bottoms", OUT: "Outerwear", FTW: "Footwear", ACC: "Accessories" };
const CAT_KEYS = Object.keys(CATS) as Category[];
const BOOT_STEPS = ["Fiber genome compiling", "Textile markers indexing", "Fit matrix calibrating", "Local archive syncing"];
const BOOT_MSGS = ["Initializing", "Sequencing", "Indexing", "Calibrating", "Syncing", "Establishing uplink"];
const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ATCG/<>";
// plus marks: drifting ones have dx/dy, the rest sit still and pulse
const BOOT_PLUS: Spot[] = [{ x: 12, y: 30, dx: 40, dy: -28, dur: 7, g: true }, { x: 86, y: 22 }, { x: 20, y: 82, dx: -36, dy: 24, dur: 8.5 }, { x: 80, y: 76 }];
// login: a lattice of plus marks in steps out from the centre; ±5 steps covers even a tall, narrow panel
// (the step is a quarter of its shorter side) and the panel clips whatever falls outside
const PLANE = Array.from({ length: 11 }, (_, i) => i - 5);
const EMPTY_DRAFT: Draft = { name: "", cat: "TOP", brand: "", size: "", value: "0", color: "#c8fa1e", notes: "" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number, l = 2) => String(n).padStart(l, "0");
const money = (n: number) => "$" + (n || 0).toLocaleString();
const ts = () => new Date().toTimeString().slice(0, 8);
const fmtD = (t: number) => { const d = new Date(t); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
const scramble = (s: string) => [...s].map((c) => (c === " " ? " " : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0])).join("");
const cls = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const vars = (o: Record<string, string | number>) => o as CSSProperties;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const noop = () => () => {};

/* ---------- small pieces ---------- */

// Text that scrambles, then settles left to right
function useDecode(text: string, run: boolean, delay: number, dur = 1000) {
    const [out, setOut] = useState("");
    useEffect(() => {
        if (!run) return;
        let raf = 0;
        const t0 = performance.now() + delay;
        const f = (t: number) => {
            const p = Math.max(0, Math.min(1, (t - t0) / dur)), n = Math.floor(p * text.length);
            setOut(text.slice(0, n) + scramble(text.slice(n)));
            if (p < 1) raf = requestAnimationFrame(f);
        };
        raf = requestAnimationFrame(f);
        return () => cancelAnimationFrame(raf);
    }, [text, run, delay, dur]);
    return out;
}

function useClock() {
    const [clock, setClock] = useState({ time: "", date: "" });
    useEffect(() => {
        const tick = () => { const d = new Date(); setClock({ time: ts(), date: fmtD(d.getTime()) }); };
        const first = setTimeout(tick, 0), id = setInterval(tick, 1000);
        return () => { clearTimeout(first); clearInterval(id); };
    }, []);
    return clock;
}

function Stat({ n, label, value, fmt }: { n: number; label: string; value: number; fmt: (v: number) => string }) {
    const [shown, setShown] = useState(0);
    const from = useRef(0);
    useEffect(() => {
        let raf = 0;
        const t0 = performance.now(), a = from.current;
        const f = (t: number) => {
            const p = Math.min(1, (t - t0) / 1000), v = Math.round(a + (value - a) * (1 - (1 - p) ** 3));
            from.current = v; setShown(v);
            if (p < 1) raf = requestAnimationFrame(f);
        };
        raf = requestAnimationFrame(f);
        return () => cancelAnimationFrame(raf);
    }, [value]);
    return <div className="stat" style={vars({ "--n": n })}><span className="mono dim">{label}</span><b>{fmt(shown)}</b></div>;
}

// The light stream behind everything: a bundle of glowing strands that rushes in from the top right on load
// and keeps flowing down, with sparks running along it and dust drifting past. It leans with the cursor,
// and scrolling the inventory speeds it up (a burst while you scroll, plus a little more the further down you are).
function Stream() {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const cv = ref.current!, cx = cv.getContext("2d")!, still = reducedMotion();
        const N = 96, PTS = 56, TAU = Math.PI * 2;
        const strands = Array.from({ length: N }, (_, i) => {
            const r = Math.random(), a = 0.08 + Math.random() * 0.22;
            return {
                o: (i / (N - 1) - 0.5) * 2 + (Math.random() - 0.5) * 0.08, // place across the bundle, -1..1
                ph: Math.random() * TAU, amp: 6 + Math.random() * 22, delay: Math.random() * 0.4,
                rgb: r < 0.72 ? "200,250,30" : r < 0.9 ? "110,240,190" : "240,255,220", a,
            };
        });
        const sparks = Array.from({ length: 24 }, () => ({ k: (Math.random() * N) | 0, s: Math.random(), v: 0.08 + Math.random() * 0.12 }));
        const dust = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.6, v: 0.02 + Math.random() * 0.05, a: 0.1 + Math.random() * 0.35 }));
        const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
        const bx = new Float32Array(PTS + 1), by = new Float32Array(PTS + 1), nx = new Float32Array(PTS + 1), ny = new Float32Array(PTS + 1);
        let w = 0, h = 0, raf = 0, t = 0, boost = 0, depth = 0, lastTop = 0, last = performance.now();
        const born = last;
        const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

        const size = () => {
            const d = Math.min(devicePixelRatio || 1, 1.5);
            w = cv.clientWidth; h = cv.clientHeight;
            cv.width = w * d; cv.height = h * d;
            cx.setTransform(d, 0, 0, d, 0, 0);
        };
        const onMove = (e: PointerEvent) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; };
        const onScroll = (e: Event) => {
            if (!(e.target instanceof HTMLElement)) return;
            const el = e.target, top = el.scrollTop;
            boost = Math.min(4, boost + Math.abs(top - lastTop) * 0.015);
            lastTop = top;
            depth = top / Math.max(1, el.scrollHeight - el.clientHeight);
        };

        function draw(elapsed: number, step: number) {
            const m = Math.min(w, h), intro = ease(elapsed / 1.4);
            // the stream's spine: a curve from off the top right, bowing left through the middle, out the bottom
            const P = [[1.12 * w, -0.12 * h], [0.55 * w + mouse.x * 70, 0.12 * h + mouse.y * 50], [-0.15 * w + mouse.x * 110, 0.55 * h + mouse.y * 80], [0.78 * w, 1.18 * h]];
            const bez = (s: number) => {
                const u = 1 - s, k = [u * u * u, 3 * u * u * s, 3 * u * s * s, s * s * s];
                const dk = [-3 * u * u, 3 * u * u - 6 * u * s, 6 * u * s - 3 * s * s, 3 * s * s];
                const x = k.reduce((a, c, i) => a + c * P[i][0], 0), y = k.reduce((a, c, i) => a + c * P[i][1], 0);
                const dx = dk.reduce((a, c, i) => a + c * P[i][0], 0), dy = dk.reduce((a, c, i) => a + c * P[i][1], 0), len = Math.hypot(dx, dy) || 1;
                return [x, y, -dy / len, dx / len];
            };
            // tight where it bends, fanning out toward both ends, with a ripple that travels downstream
            const offset = (st: (typeof strands)[number], s: number) => {
                const pinch = Math.abs(s - 0.5);
                return st.o * m * (0.03 + 0.9 * pinch * pinch) + Math.sin(s * 9 - t * 1.4 + st.ph) * st.amp * (0.35 + pinch);
            };
            for (let j = 0; j <= PTS; j++) [bx[j], by[j], nx[j], ny[j]] = bez(j / PTS);

            cx.globalCompositeOperation = "source-over";
            cx.clearRect(0, 0, w, h);
            cx.globalCompositeOperation = "lighter";

            const [fx, fy] = bez(0.5), glow = cx.createRadialGradient(fx, fy, 0, fx, fy, m * 0.5);
            glow.addColorStop(0, `rgba(230,255,160,${0.32 * intro})`);
            glow.addColorStop(0.15, `rgba(200,250,30,${0.16 * intro})`);
            glow.addColorStop(0.5, `rgba(200,250,30,${0.05 * intro})`);
            glow.addColorStop(1, "rgba(200,250,30,0)");
            cx.fillStyle = glow; cx.fillRect(0, 0, w, h);

            cx.lineWidth = 1;
            const reach: number[] = [];
            for (const st of strands) {
                const p = ease((elapsed - st.delay) / 1.5); // how far this strand has reached in from the top right
                reach.push(p);
                if (p <= 0) continue;
                const n = Math.max(1, Math.round(p * PTS));
                cx.beginPath();
                for (let j = 0; j <= n; j++) {
                    const off = offset(st, j / PTS), x = bx[j] + nx[j] * off, y = by[j] + ny[j] * off;
                    if (j) cx.lineTo(x, y); else cx.moveTo(x, y);
                }
                cx.lineWidth = 3.5; cx.strokeStyle = `rgba(${st.rgb},${st.a * 0.22})`; cx.stroke(); // soft glow
                cx.lineWidth = 1; cx.strokeStyle = `rgba(${st.rgb},${st.a})`; cx.stroke();
                if (p < 1) { // a bright head on each strand while it's still rushing in
                    const off = offset(st, n / PTS);
                    cx.fillStyle = `rgba(245,255,215,${0.8 * (1 - p)})`;
                    cx.beginPath(); cx.arc(bx[n] + nx[n] * off, by[n] + ny[n] * off, 1.6, 0, TAU); cx.fill();
                }
            }

            const at = (st: (typeof strands)[number], s: number) => { const [x, y, ux, uy] = bez(s), off = offset(st, s); return [x + ux * off, y + uy * off]; };
            cx.lineWidth = 1.6;
            for (const sp of sparks) {
                sp.s += sp.v * step;
                if (sp.s > 1) { sp.s = 0; sp.k = (Math.random() * N) | 0; }
                if (sp.s > reach[sp.k] || sp.s < 0.04) continue;
                const [x1, y1] = at(strands[sp.k], sp.s - 0.04), [x2, y2] = at(strands[sp.k], sp.s);
                const trail = cx.createLinearGradient(x1, y1, x2, y2);
                trail.addColorStop(0, "rgba(245,255,215,0)"); trail.addColorStop(1, "rgba(245,255,215,.75)");
                cx.strokeStyle = trail;
                cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
            }

            for (const d of dust) {
                d.y += d.v * step;
                if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); }
                const tw = 0.6 + 0.4 * Math.sin(t * 2 + d.x * 20);
                cx.fillStyle = `rgba(210,255,120,${d.a * tw * intro})`;
                cx.beginPath(); cx.arc(d.x * w + mouse.x * 40 * d.r, d.y * h + mouse.y * 30 * d.r, d.r, 0, TAU); cx.fill();
            }
        }

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            boost *= 0.94 ** (dt * 60);
            const speed = 1 + depth * 1.6 + boost;
            t += dt * speed;
            const follow = Math.min(1, dt * 3);
            mouse.x += (mouse.tx - mouse.x) * follow; mouse.y += (mouse.ty - mouse.y) * follow;
            draw((now - born) / 1000, dt * speed);
        };

        size();
        addEventListener("resize", size);
        if (still) { draw(10, 0); return () => removeEventListener("resize", size); }
        addEventListener("pointermove", onMove);
        addEventListener("scroll", onScroll, true); // capture: the inventory scrolls inside .main, not the window
        raf = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(raf);
            removeEventListener("resize", size); removeEventListener("pointermove", onMove); removeEventListener("scroll", onScroll, true);
        };
    }, []);
    return <canvas ref={ref} className="stream" aria-hidden />;
}

const PlusField = ({ spots }: { spots: Spot[] }) => (
    <div className="plusfield" aria-hidden>
        {spots.map((s, k) => (
            <i key={k} className={cls("plus", s.g && "g", s.dx === undefined && "fixed")}
                style={vars({ left: `${s.x}%`, top: `${s.y}%`, "--dx": `${s.dx ?? 0}px`, "--dy": `${s.dy ?? 0}px`, "--dur": `${s.dur ?? 6}s`, "--dl": `${0.3 + k * 0.15}s` })} />
        ))}
    </div>
);

// The login's left panel: plus marks at every grid point, appearing (and then pulsing) in a ripple out from
// the centre. A scattered few (picked by a fixed hash, so the same ones every time) are green and turn.
const isGreen = (x: number, y: number) => (!x && !y) || ((x + 7) * 1103 + (y + 7) * 2087 + (x + 7) * (y + 7) * 37) % 5 === 0;
const Plane = () => (
    <div className="plusfield plane" aria-hidden>
        {PLANE.flatMap((y, r) => PLANE.map((x, c) => (
            <i key={`${r}-${c}`} className={cls("plus fixed", isGreen(x, y) && "g")}
                style={vars({ "--kx": x, "--ky": y, "--dl": `${0.4 + Math.hypot(x, y) * 0.12}s`, "--turn": `${5 + (((x + 7) * (y + 7)) % 4)}s` })} />
        )))}
    </div>
);

// Letters slide up into place one after another; remount (change its key) to play it again
const Split = ({ text, delay = 0 }: { text: string; delay?: number }) => (
    <>{[...text].map((c, i) => <span key={i} className="ch"><span style={{ animationDelay: `${delay + i * 40}ms` }}>{c === " " ? " " : c}</span></span>)}</>
);
// A quiet way back for anyone who opened this by mistake: a third line under the boot and login corner labels
const Back = () => <Link href="/" className="back"><span aria-hidden>←</span> willy.work</Link>;
const Brackets = () => <><i className="br a" /><i className="br b" /><i className="br c" /><i className="br d" /></>;
const NoImg = ({ title = "No image" }: { title?: string }) => <div className="noimg mono"><b>{title}</b><span>ERR 404 — IMG_NULL</span></div>;
const Arrow = () => <svg viewBox="0 0 16 16" aria-hidden><path d="M1 8h13M9 3l5 5-5 5" /></svg>;
const PlusIcon = () => <svg viewBox="0 0 16 16" aria-hidden><path d="M8 2v12M2 8h12" /></svg>;

/* ---------- the app ---------- */

export default function Wardrobe({ className, initial }: { className: string; initial: { operator: string; email: string; items: Item[] } | null }) {
    // render nothing on the server: the boot sequence, clock and canvas only make sense in the browser
    const mounted = useSyncExternalStore(noop, () => true, () => false);
    const clock = useClock();

    const [screen, setScreen] = useState<Screen | null>("boot");
    const [leaving, setLeaving] = useState<Screen | null>(null);
    const screenRef = useRef<Screen | null>("boot");
    const sweepRef = useRef<HTMLDivElement>(null);
    const [toasts, setToasts] = useState<{ id: number; msg: string; bye?: boolean }[]>([]);

    const [operator, setOperator] = useState(initial?.operator ?? "");
    const initialEmail = useRef(initial?.email ?? "");
    const [autoTyping, setAutoTyping] = useState(false);
    const [pressed, setPressed] = useState(false);
    const passRef = useRef<HTMLInputElement>(null);
    const hasSession = useRef(!!initial); // an admin was already signed in when the page loaded
    const [items, setItems] = useState<Item[]>(initial?.items ?? []);

    // boot
    const [boot, setBoot] = useState({ p: 0, msg: BOOT_MSGS[0], step: BOOT_STEPS[0], pk: "5767 928", ready: false });
    const title1 = useDecode("RUDIMENTARY", mounted, 200);
    const title2 = useDecode("INTELLIGENCE", mounted, 500);

    // login
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [authError, setAuthError] = useState("");
    const [log, setLog] = useState<Line[]>([]);
    const [sync, setSync] = useState(0);
    const [loginRun, setLoginRun] = useState(0);
    const busy = useRef(false);
    const panelRef = useRef<HTMLDivElement>(null), grantRef = useRef<HTMLDivElement>(null), emailRef = useRef<HTMLInputElement>(null);

    // inventory
    const [entered, setEntered] = useState(0);
    const [filter, setFilter] = useState<"ALL" | Category>("ALL");
    const [q, setQ] = useState("");
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<"recent" | "value" | "name">("recent");
    const [view, setView] = useState<"grid" | "table">(() => { try { return localStorage.getItem("ri.view") === "table" ? "table" : "grid"; } catch { return "grid"; } });
    const searchRef = useRef<HTMLInputElement>(null);
    const [sel, setSel] = useState<Item | null>(null);
    const [drawerOn, setDrawerOn] = useState(false);
    const [drawerRun, setDrawerRun] = useState(0);
    const [armed, setArmed] = useState(false);
    const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [modalOn, setModalOn] = useState(false);
    const [editing, setEditing] = useState<Item | null>(null);
    const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
    const [saving, setSaving] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    /* ----- screens ----- */
    function sweep() {
        const s = sweepRef.current;
        if (!s) return;
        s.classList.remove("go"); void s.offsetWidth; s.classList.add("go");
    }
    async function go(next: Screen) {
        sweep();
        const prev = screenRef.current;
        screenRef.current = next;
        if (prev) {
            setLeaving(prev); setScreen(null);
            await sleep(380);
            setTimeout(() => setLeaving((l) => (l === prev ? null : l)), 80);
        }
        setScreen(next);
    }
    function toast(msg: string) {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, msg }]);
        setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, bye: true } : x))), 2600);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
    }

    // Already signed in on willy.work: "type" the account's email and a masked passkey into the form and press
    // Authenticate, as if the system logged itself in. The passkey is filler dots, never a real password.
    async function autoType() {
        const fill = initialEmail.current;
        setAutoTyping(true); setEmail(""); setPassword("");
        emailRef.current?.focus({ preventScroll: true });
        for (let i = 1; i <= fill.length; i++) { setEmail(fill.slice(0, i)); await sleep(35 + Math.random() * 45); }
        await sleep(250);
        passRef.current?.focus({ preventScroll: true });
        for (let i = 1; i <= 12; i++) { setPassword("x".repeat(i)); await sleep(45 + Math.random() * 40); }
        await sleep(300);
        passRef.current?.blur();
        setPressed(true); await sleep(380); setPressed(false);
        setAutoTyping(false);
    }

    async function showLogin() {
        setLoginRun((r) => r + 1);
        await go("login");
        if (hasSession.current) { await sleep(1300); await autoType(); authenticate(null); } // already signed in: fill the form in, then verify
        else setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 1300);
    }

    /* ----- boot sequence ----- */
    const finishBoot = useEffectEvent(() => { showLogin(); });
    useEffect(() => {
        if (!mounted) return;
        let dead = false, skip = false;
        const sk = () => { skip = true; };
        addEventListener("keydown", sk); addEventListener("pointerdown", sk);
        (async () => {
            await sleep(1100);
            for (let p = 0; p < 100 && !dead;) {
                p = Math.min(100, p + (skip ? 25 : Math.random() * 3.4 + 0.8));
                const at = (list: string[]) => list[Math.min(list.length - 1, ((p / 100) * list.length) | 0)];
                setBoot({ p, msg: at(BOOT_MSGS), step: at(BOOT_STEPS), pk: `${pad((Math.random() * 1e4) | 0, 4)} ${pad((Math.random() * 1e3) | 0, 3)}`, ready: false });
                await sleep(skip ? 25 : 70);
            }
            removeEventListener("keydown", sk); removeEventListener("pointerdown", sk);
            if (dead) return;
            setBoot((b) => ({ ...b, msg: "Access node ready", ready: true }));
            await sleep(skip ? 150 : 700);
            if (!dead) finishBoot();
        })();
        return () => { dead = true; removeEventListener("keydown", sk); removeEventListener("pointerdown", sk); };
    }, [mounted]);

    /* ----- login ----- */
    // Each step is a line in the log; the real work (sign in, clearance check) runs inside its line.
    async function authenticate(creds: { email: string; password: string } | null) {
        if (busy.current) return;
        busy.current = true;
        setAuthError(""); setLog([]); setSync(0); setVerifying(true);
        const mark = (state: Line["state"]) => setLog((l) => l.map((s, i) => (i === l.length - 1 ? { ...s, state } : s)));
        async function line<T>(text: string, pct: number, work?: () => Promise<T>) {
            setLog((l) => [...l, { t: ts(), text, state: "pend" }]);
            const [r] = await Promise.all([work?.(), sleep(200 + Math.random() * 200)]);
            mark("ok"); setSync(pct);
            return r;
        }
        async function deny(msg: string) {
            mark("fail");
            hasSession.current = false;
            await sleep(1100);
            setVerifying(false); setAuthError(msg); setPassword("");
        }
        try {
            await sleep(750);
            await line("Handshake — node 0x7F3A", 20);
            if (creds) {
                const res = await line(`Operator lookup — ${creds.email}`, 40, () => authClient.signIn.email({ email: creds.email, password: creds.password, rememberMe: true }));
                if (!res || res.error) return await deny(`Access denied — ${res?.error?.message || "check your email and passkey"}`);
            } else {
                await line("Session token — valid", 40);
            }
            const data = await line("Clearance check", 70, () => loadWardrobe());
            if (!data) return await deny("Access denied — this account has no wardrobe clearance");
            await line("Decrypting wardrobe archive", 90);
            await line(`Indexing ${data.items.length} item${data.items.length === 1 ? "" : "s"}`, 100);
            hasSession.current = true;
            setItems(data.items); setOperator(data.operator);
            await sleep(350);
            await grant();
        } catch {
            await deny("Uplink failed — try again");
        } finally {
            busy.current = false;
        }
    }

    // The login panel grows (still dark) to fill the screen, fades to green, then slides aside to reveal the inventory
    async function grant() {
        const g = grantRef.current, panel = panelRef.current;
        if (!g || !panel) return enterApp();
        const r = panel.getBoundingClientRect(), t = (ms: number) => (reducedMotion() ? 1 : ms);
        const smooth = "cubic-bezier(.65,0,.35,1)", full = "inset(0px 0px 0px 0px)";
        g.classList.add("on");
        await g.animate([
            { clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`, backgroundColor: "#070707", easing: smooth },
            { clipPath: full, backgroundColor: "#070707", offset: 0.5, easing: smooth },
            { clipPath: full, backgroundColor: "#c8fa1e" },
        ], { duration: t(1700), fill: "forwards" }).finished;
        await sleep(t(900));
        enterApp();
        await g.animate([{ transform: "none" }, { transform: "translateX(-102%)" }], { duration: t(1000), easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" }).finished;
        g.classList.remove("on");
        g.getAnimations().forEach((a) => a.cancel());
        setVerifying(false);
    }

    function enterApp() {
        setFilter("ALL"); setQ(""); setQuery(""); setDrawerOn(false);
        setEntered((e) => e + 1);
        screenRef.current = "app"; setLeaving(null); setScreen("app");
    }

    async function signOut() {
        setDrawerOn(false); setModalOn(false);
        await authClient.signOut().catch(() => {});
        hasSession.current = false;
        setEmail(""); setPassword(""); setAuthError("");
        await showLogin();
        setItems([]); setOperator("");
    }

    /* ----- inventory ----- */
    useEffect(() => {
        const id = setTimeout(() => setQuery(q.trim().toLowerCase()), 140);
        return () => clearTimeout(id);
    }, [q]);

    const inFilter = useMemo(() => items.filter((i) => filter === "ALL" || i.cat === filter), [items, filter]);
    const shown = useMemo(() => {
        const by = { recent: (a: Item, b: Item) => b.added - a.added, value: (a: Item, b: Item) => b.value - a.value, name: (a: Item, b: Item) => a.name.localeCompare(b.name) }[sort];
        return inFilter.filter((i) => !query || `${i.name} ${i.brand} ${i.code} ${i.size} ${i.notes} ${CATS[i.cat]}`.toLowerCase().includes(query)).sort(by);
    }, [inFilter, query, sort]);
    const total = inFilter.reduce((s, i) => s + i.value, 0);
    const title = filter === "ALL" ? "Wardrobe" : CATS[filter];
    const navRows: { k: "ALL" | Category; label: string; count: number }[] = [
        { k: "ALL", label: "All items", count: items.length },
        ...CAT_KEYS.map((k) => ({ k, label: CATS[k], count: items.filter((i) => i.cat === k).length })),
    ];

    function changeView(v: "grid" | "table") {
        setView(v);
        try { localStorage.setItem("ri.view", v); } catch {}
    }
    function openDrawer(item: Item) {
        setSel(item); setArmed(false); setDrawerRun((r) => r + 1); setDrawerOn(true);
    }
    async function onDelete() {
        if (!sel) return;
        if (!armed) {
            setArmed(true);
            clearTimeout(armTimer.current);
            armTimer.current = setTimeout(() => setArmed(false), 3000);
            return;
        }
        clearTimeout(armTimer.current); setArmed(false);
        try {
            await deleteItem(sel.id);
            setDrawerOn(false); sweep();
            setItems((list) => list.filter((i) => i.id !== sel.id));
            toast(`${sel.code} deleted`);
        } catch { toast("Delete failed — try again"); }
    }
    function openModal(item: Item | null) {
        setEditing(item);
        setDraft(item
            ? { name: item.name, cat: item.cat, brand: item.brand, size: item.size, value: String(item.value), color: item.color, notes: item.notes }
            : { ...EMPTY_DRAFT, cat: filter === "ALL" ? "TOP" : filter });
        setModalOn(true);
        setTimeout(() => nameRef.current?.focus(), 200);
    }
    async function onSave(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (saving || !draft.name.trim()) return;
        setSaving(true);
        try {
            const saved = await saveItem({ ...draft, id: editing?.id, value: Number(draft.value) || 0 });
            setItems((list) => (editing ? list.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...list]));
            if (sel?.id === saved.id) setSel(saved);
            setModalOn(false);
            toast(`${saved.code} ${editing ? "updated" : "added"}`);
        } catch { toast("Save failed — try again"); }
        finally { setSaving(false); }
    }

    const onKey = useEffectEvent((e: KeyboardEvent) => {
        if (screenRef.current !== "app") return;
        const typing = e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
        if (e.key === "Escape") { if (modalOn) setModalOn(false); else setDrawerOn(false); }
        else if (!typing && e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
        else if (!typing && e.key.toLowerCase() === "n" && !modalOn) { e.preventDefault(); openModal(null); }
    });
    useEffect(() => {
        const h = (e: KeyboardEvent) => onKey(e);
        addEventListener("keydown", h);
        return () => removeEventListener("keydown", h);
    }, []);

    if (!mounted) return <div className={`ri ${className}`} />;

    const scr = (name: Screen) => cls("screen", name, screen === name && "active", leaving === name && "out");
    const onCardKey = (item: Item) => (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(item); }
    };

    return (
        <div className={`ri ${className}`} data-stage={screen ?? leaving ?? "boot"}>
            {/* the login's plus grid sits under the stream (lined up with the login's left panel) so the light passes over it;
                keyed so its ripple replays each time the login appears */}
            <div className="underlay" aria-hidden><div className="plane-cell"><Plane key={loginRun} /></div></div>
            <Stream />
            <div className="scanlines" aria-hidden />
            <div className="sweep" ref={sweepRef} aria-hidden />

            {/* ============ boot ============ */}
            <section className={scr("boot")} aria-label="Loading">
                <PlusField spots={BOOT_PLUS} />
                <div className="corner tl mono">RI-OS <b>0.3.0</b> · {clock.date}<br />Cold boot sequence<br /><Back /></div>
                <div className="corner bl mono">Heap <b>OK</b><br />Mem 0x00FF:A3C1</div>
                <div className="corner br mono">Press any key to skip</div>
                <div className="boot-wrap">
                    <div className="boot-meta">
                        <div className="bm-l">RI—01</div>
                        <div className="bm-r">BIOTEXTILE ARCHIVE<br />LOCAL INDEX<br />RESTRICTED</div>
                    </div>
                    <h1 className="display" aria-label="Rudimentary Intelligence">
                        <span className="line" data-text="RUDIMENTARY">{title1}</span>
                        <span className="line" data-text="INTELLIGENCE">{title2}</span>
                    </h1>
                    <div className="boot-log">
                        <div>
                            <div style={{ animationDelay: ".6s" }}>{"// "}{boot.step}</div>
                            <div style={{ animationDelay: ".75s" }}>{"// "}Elliptical recalibration</div>
                            <div style={{ animationDelay: ".9s" }}>{"// "}Sync: [<span className="dbar"><i style={{ width: `${boot.p}%` }} /></span>] {pad(boot.p | 0, 3)}</div>
                        </div>
                        <div>
                            <div style={{ animationDelay: ".8s" }}>{"// "}3.12 M&nbsp;&nbsp;0.783±0</div>
                            <div style={{ animationDelay: ".95s" }}>{"// "}PK&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{boot.pk}</div>
                        </div>
                    </div>
                </div>
                <div className="boot-spin">
                    <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="10" /></svg>
                    <span className={cls("mono", boot.ready && "ready")}>{boot.msg}</span>
                </div>
            </section>

            {/* ============ login ============ */}
            <section className={scr("login")} aria-label="Sign in">
                <div className="lg-left">
                    <div className="corner tl mono"><span className="sq" />&nbsp; Rudimentary Intelligence<br />Auth gate<br /><Back /></div>
                    <div className="corner tr mono">{clock.time} Local</div>
                    <div className="corner bl mono">Uplink <b>willy.work</b><br />Clearance <b>Admin</b></div>
                </div>
                <div className="lg-brand" aria-hidden>
                    <div>{[0, 1, 2, 3].map((k) => <Fragment key={k}>RUDIMENTARY <span>INTELLIGENCE</span> </Fragment>)}</div>
                </div>
                <div className={cls("lg-right", verifying && "verifying")} ref={panelRef}>
                    <form className="lg-form" onSubmit={(e) => { e.preventDefault(); authenticate({ email: email.trim(), password }); }}>
                        <span className="mono dim" data-in style={vars({ "--i": 3 })}>[Auth] — Operator access</span>
                        <h1 className="hero" aria-label="Access"><Split key={loginRun} text="Access" delay={350} /></h1>
                        <p className="lg-p" data-in style={vars({ "--i": 5 })}>Sign in with your willy.work admin account.</p>
                        <label className="uf" data-in style={vars({ "--i": 6 })}>
                            <span>01 — Operator</span>
                            <input ref={emailRef} readOnly={autoTyping} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </label>
                        <label className="uf" data-in style={vars({ "--i": 7 })}>
                            <span>02 — Passkey</span>
                            <input ref={passRef} readOnly={autoTyping} type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </label>
                        {authError && <p className="lg-err mono" role="alert">{"// "}{authError}</p>}
                        <button className={cls("btn solid", pressed && "pressed")} type="submit" disabled={verifying || autoTyping} data-in style={vars({ "--i": 8 })}><span>Authenticate</span><Arrow /></button>
                        <p className="mono dim" data-in style={vars({ "--i": 9 })}>{"// "}Admins only — same login as willy.work</p>
                    </form>
                    <div className="verify" aria-live="polite">
                        <span className="mono dim">[Verification]</span>
                        <h2 className="hero">Verifying</h2>
                        <div className="authlog">
                            {log.map((l, i) => (
                                <div key={i}>
                                    <span className="dim">{l.t}</span><span>{"// "}{l.text}</span>
                                    <b className={l.state}>{l.state === "ok" ? "OK" : l.state === "fail" ? "DENIED" : "···"}</b>
                                </div>
                            ))}
                        </div>
                        <div className="auth-sync">{"// "}SYNC: [<span className="dbar"><i style={{ width: `${sync}%` }} /></span>] {pad(sync, 3)}</div>
                    </div>
                </div>
            </section>

            <div className="grant" ref={grantRef} aria-live="polite">
                <div className="grant-in">
                    <span className="mono" style={vars({ "--n": 0 })}>[Access granted]</span>
                    <div className="display" style={vars({ "--n": 1 })}>Access<br />granted</div>
                    <span className="mono" style={vars({ "--n": 2 })}>{"// "}Welcome back, {operator}</span>
                </div>
            </div>

            {/* ============ inventory ============ */}
            <section className={scr("app")} aria-label="Wardrobe">
                <aside className="side">
                    <div className="wordmark"><span className="sq" /><span>RUDIMENTARY<br />INTELLIGENCE</span></div>
                    <span className="mono dim side-h">[Index]</span>
                    <nav className="nav" aria-label="Categories">
                        {navRows.map((r, i) => (
                            <button key={r.k} type="button" className={cls("nav-i", filter === r.k && "on")} style={vars({ "--n": i })} onClick={() => setFilter(r.k)}>
                                <span>{r.label}</span><span className="mono dim">{pad(r.count)}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="side-foot mono dim">
                        <span className="hide-sm">Operator <b>{operator}</b></span>
                        <span className="hide-sm">{clock.time}</span>
                        <Link className="link" href="/">← willy.work</Link>
                        <button type="button" className="link" onClick={signOut}>Sign out</button>
                    </div>
                </aside>
                <main className="main">
                    <section className="hero-row">
                        <h1 className="hero lg" aria-label={title}><Split key={`${title}${entered}`} text={title} delay={150} /></h1>
                        <span className="mono dim hero-tag">[{filter === "ALL" ? "All items" : CATS[filter]}]</span>
                    </section>
                    <div className="stats" key={entered}>
                        <Stat n={0} label="Items indexed" value={inFilter.length} fmt={(v) => pad(v)} />
                        <Stat n={1} label="Total value" value={total} fmt={money} />
                    </div>
                    <div className="toolbar">
                        <label className="search">
                            <svg viewBox="0 0 16 16" aria-hidden><circle cx="7" cy="7" r="5" /><path d="m11 11 4 4" /></svg>
                            <input ref={searchRef} placeholder="Search wardrobe" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
                            <kbd>/</kbd>
                        </label>
                        <div className="tb-r">
                            <select className="sel" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                                <option value="recent">Sort: Recent</option>
                                <option value="value">Sort: Value</option>
                                <option value="name">Sort: A–Z</option>
                            </select>
                            <div className="seg" role="group" aria-label="View">
                                <button type="button" className={cls(view === "grid" && "on")} onClick={() => changeView("grid")}>Grid</button>
                                <button type="button" className={cls(view === "table" && "on")} onClick={() => changeView("table")}>List</button>
                            </div>
                            <button type="button" className="btn sm" onClick={() => openModal(null)}><span>Add item</span><PlusIcon /></button>
                        </div>
                    </div>

                    {/* the key replays the staggered entrance whenever the filter, search, sort or view changes */}
                    <div key={`${entered}|${filter}|${query}|${sort}|${view}`} className={view === "table" ? "tblwrap" : "grid"}>
                        {shown.length === 0 ? (
                            <div className="empty mono">
                                <b>{items.length ? "Nothing found." : "Nothing indexed yet."}</b>
                                {items.length ? "Zero items match the current query." : "Add your first item to begin."}
                            </div>
                        ) : view === "grid" ? (
                            shown.map((i, idx) => (
                                <article key={i.id} className="card" tabIndex={0} role="button" aria-label={i.name} style={vars({ "--d": `${Math.min(idx, 16) * 55}ms` })}
                                    onClick={() => openDrawer(i)} onKeyDown={onCardKey(i)}>
                                    <div className="art"><NoImg /><Brackets /><span className="sw" style={{ background: i.color }} /><span className="lbl mono">{i.code}</span></div>
                                    <div className="c-top mono dim"><span>{CATS[i.cat]}</span><b>{money(i.value)}</b></div>
                                    <h3>{i.name}</h3>
                                    <div className="c-meta">{i.brand || "Unbranded"} · {i.size || "—"}</div>
                                </article>
                            ))
                        ) : (
                            <>
                                <table className="tbl">
                                    <thead><tr>
                                        <th>ID</th><th style={{ paddingLeft: 30 }}>NAME</th><th>CATEGORY</th>
                                        <th className="hide-sm">BRAND</th><th className="hide-sm">SIZE</th><th className="hide-sm">ADDED</th><th className="num">VALUE</th>
                                    </tr></thead>
                                    <tbody>
                                        {shown.map((i, idx) => (
                                            <tr key={i.id} tabIndex={0} style={vars({ "--d": `${Math.min(idx, 20) * 35}ms` })} onClick={() => openDrawer(i)} onKeyDown={onCardKey(i)}>
                                                <td className="id">{i.code}</td><td className="nm">{i.name}</td><td>{CATS[i.cat]}</td>
                                                <td className="hide-sm">{i.brand || "—"}</td><td className="hide-sm">{i.size || "—"}</td>
                                                <td className="hide-sm mono">{fmtD(i.added)}</td><td className="num">{money(i.value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="tbl-foot mono"><span>Total <b>{shown.length}</b> items</span><span>Value <b>{money(shown.reduce((s, i) => s + i.value, 0))}</b></span></div>
                            </>
                        )}
                    </div>
                </main>

                {/* item profile */}
                <div className={cls("scrim", drawerOn && "on")} onClick={() => setDrawerOn(false)} />
                <aside className={cls("drawer", drawerOn && "on")} aria-label="Item details" aria-hidden={!drawerOn}>
                    {sel && (
                        <Fragment key={drawerRun}>
                            <div className="dr-top" style={vars({ "--n": 0 })}><span className="mono dim">[Profile]</span><button type="button" className="link" onClick={() => setDrawerOn(false)}>Close ✕</button></div>
                            <div className="scanner locked" style={vars({ "--n": 1 })}>
                                <div className="rings">
                                    <svg className="r1" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" strokeWidth=".4" strokeDasharray="1 3" /></svg>
                                    <svg className="r2" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" strokeWidth=".5" strokeDasharray="18 70" /></svg>
                                </div>
                                <div className="x" /><NoImg title="No image data" /><Brackets /><div className="scanline" />
                                <div className="profile mono">Profile locked<br /><b>{sel.code}</b><br />{CATS[sel.cat]}</div>
                                <span className="sw" style={{ background: sel.color }} />
                            </div>
                            <div className="dr-name" style={vars({ "--n": 2 })}><span className="mono dim">{sel.brand || "Unbranded"}</span><h2>{sel.name}</h2></div>
                            <dl className="specs mono" style={vars({ "--n": 3 })}>
                                <div><dt>Category</dt><dd>{CATS[sel.cat]}</dd></div>
                                <div><dt>Size</dt><dd>{sel.size || "—"}</dd></div>
                                <div><dt>Value</dt><dd>{money(sel.value)}</dd></div>
                                <div><dt>Colour</dt><dd><span className="dot" style={{ background: sel.color }} />{sel.color.toUpperCase()}</dd></div>
                                <div><dt>Added</dt><dd>{fmtD(sel.added)}</dd></div>
                            </dl>
                            {sel.notes && <div className="notes" style={vars({ "--n": 4 })}><span className="mono dim">[Notes]</span><p>{sel.notes}</p></div>}
                            <div className="dr-actions" style={vars({ "--n": 5 })}>
                                <button type="button" className="btn solid" onClick={() => openModal(sel)}><span>Edit</span><Arrow /></button>
                                <button type="button" className={cls("btn", armed && "armed")} onClick={onDelete}><span>{armed ? "Confirm delete" : "Delete"}</span></button>
                            </div>
                        </Fragment>
                    )}
                </aside>

                {/* add / edit */}
                <div className={cls("modal", modalOn && "on")} onClick={(e) => { if (e.target === e.currentTarget) setModalOn(false); }}>
                    <form className="mbox" onSubmit={onSave}>
                        <div className="m-head">
                            <div><span className="mono dim">[{editing ? editing.code : "New entry"}]</span><h2>{editing ? "Edit item" : "Add item"}</h2></div>
                            <button type="button" className="link" onClick={() => setModalOn(false)}>Close ✕</button>
                        </div>
                        <div className="fgrid">
                            <label className="uf full"><span>Name</span><input ref={nameRef} required maxLength={60} placeholder="Tech shell jacket" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
                            <label className="uf"><span>Category</span>
                                <select value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value as Category })}>
                                    {CAT_KEYS.map((k) => <option key={k} value={k}>{CATS[k]}</option>)}
                                </select>
                            </label>
                            <label className="uf"><span>Brand</span><input maxLength={40} placeholder="—" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} /></label>
                            <label className="uf"><span>Size</span><input maxLength={10} placeholder="M / 32 / 10.5" value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} /></label>
                            <label className="uf"><span>Value ($)</span><input type="number" min={0} step={1} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></label>
                            <label className="uf full"><span>Colour</span><input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></label>
                            <label className="uf full"><span>Notes</span><textarea rows={2} maxLength={300} placeholder="Care instructions, fit notes…" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
                        </div>
                        <div className="m-foot">
                            <button type="button" className="btn" onClick={() => setModalOn(false)}><span>Cancel</span></button>
                            <button type="submit" className="btn solid" disabled={saving}><span>{saving ? "Saving…" : "Save"}</span><Arrow /></button>
                        </div>
                    </form>
                </div>

                <div className="toasts" aria-live="polite">
                    {toasts.map((t) => <div key={t.id} className={cls("toast mono", t.bye && "bye")}><span className="sq" /><span>{t.msg}</span></div>)}
                </div>
            </section>
        </div>
    );
}
