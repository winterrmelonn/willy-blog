// Rustbreeder: Rust's plant-breeding rules and the planter search, ported from the Stardance project
// (rustbreeder.py + layout.py). Runs in the browser, so there's no Python backend.

// G Y H X W = Growth, Yield, Hardiness, Nothing, Water
export const GENES = "GYHXW";

// How hard each gene fights to be passed on. Red genes (W, X) are stickier than green ones,
// so two matching green neighbors (3 + 3) are needed to beat one red center gene (5).
const WEIGHTS: Record<string, number> = { G: 3, Y: 3, H: 3, W: 5, X: 5 };

export const isGenome = (g: string) => /^[GYHXW]{6}$/.test(g);

// One gene slot: neighbors vote with their weights (only identical genes stack), and the heaviest
// neighbor gene replaces the center's only if it's strictly heavier. Ties go to the center.
export function breedSlot(center: string, neighbors: string[]) {
    const weights: Record<string, number> = {};
    for (const g of neighbors) weights[g] = (weights[g] ?? 0) + WEIGHTS[g];
    let winner = center, best = 0;
    for (const g of GENES) if ((weights[g] ?? 0) > best) { winner = g; best = weights[g]; }
    return best > WEIGHTS[center] ? winner : center;
}

// A plant is six independent slots; slot i only ever competes with slot i of the neighbors.
export const breed = (center: string, neighbors: string[]) =>
    [...center].map((g, i) => breedSlot(g, neighbors.map((n) => n[i]))).join("");

// Our own opinion of "good", not a game rule: G and Y are worth 10, H 2, and min(G, Y) * 5 rewards
// balance, which is what makes GGGYYY the target.
export function score(plant: string) {
    const count = (g: string) => plant.split(g).length - 1;
    return count("G") * 10 + count("Y") * 10 + count("H") * 2 + Math.min(count("G"), count("Y")) * 5;
}

// The planter: a 3x3 grid, positions 0..8 read left to right, top to bottom.
// Neighbors are up/down/left/right only, so corners have 2, edges 3 and the center 4.
const NEIGHBORS = Array.from({ length: 9 }, (_, p) => {
    const r = Math.floor(p / 3), c = p % 3;
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([y, x]) => y >= 0 && y < 3 && x >= 0 && x < 3)
        .map(([y, x]) => y * 3 + x);
});

// Busiest spots first (center, edges, corners): with fewer than 9 seeds, fill the cells with the most influence.
const POSITIONS = [...NEIGHBORS.keys()].sort((a, b) => NEIGHBORS[b].length - NEIGHBORS[a].length);

export type Layout = Record<number, string>; // position -> plant, empty cells left out

// breed() only adds up weights, so neighbor order doesn't matter; sorting them makes every
// ordering share one cache entry. The search asks the same few thousand questions millions of times.
const cache = new Map<string, string>();
function cellOutcome(center: string, neighbors: string[]) {
    const key = center + neighbors.sort().join("");
    let child = cache.get(key);
    if (child === undefined) cache.set(key, (child = breed(center, neighbors)));
    return child;
}

// Every planted cell's predicted offspring, and their scores added up.
export function layoutFitness(layout: Layout) {
    const offspring: Layout = {};
    let total = 0;
    for (const key in layout) {
        const pos = Number(key);
        const neighbors = NEIGHBORS[pos].filter((n) => n in layout).map((n) => layout[n]);
        offspring[pos] = cellOutcome(layout[pos], neighbors);
        total += score(offspring[pos]);
    }
    return { total, offspring };
}

// Small seeded random generator (mulberry32), so the same plants always give the same plan.
function seeded(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Hill climbing: start from a random layout of one-of-each seed, then keep making the best swap of
// two cells (or a planted seed for an unplanted one) until no swap helps.
function climb(pool: string[], slots: number[], rand: () => number) {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let current: Layout = Object.fromEntries(slots.map((p, i) => [p, shuffled[i]]));
    let best = layoutFitness(current).total;

    for (let improved = true; improved;) {
        improved = false;
        for (const pos of slots) {
            for (const candidate of pool) {
                if (candidate === current[pos]) continue;
                const trial = { ...current }; // copy, so a rejected try can't change the layout we compare against
                const other = slots.find((p) => current[p] === candidate);
                trial[pos] = candidate;
                if (other !== undefined) trial[other] = current[pos]; // it was planted elsewhere: swap
                const value = layoutFitness(trial).total;
                if (value > best) { current = trial; best = value; improved = true; }
            }
        }
    }
    return { layout: current, total: best };
}

// The best arrangement of the seeds you hold (one of each), checking a few hundred layouts instead
// of all 9! = 362,880. Hill climbing can stop on a lower peak, so it restarts 30 times and keeps the best.
export function bestLayout(held: string[], restarts = 30) {
    const pool = [...new Set(held)].sort();
    const slots = POSITIONS.slice(0, Math.min(pool.length, 9));
    const rand = seeded(0);
    let winner = { layout: {} as Layout, total: -1 };
    for (let i = 0; i < restarts && pool.length; i++) {
        const tried = climb(pool, slots, rand);
        if (tried.total > winner.total) winner = tried;
    }
    return { layout: winner.layout, ...layoutFitness(winner.layout) };
}
