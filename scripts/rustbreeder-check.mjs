// Self-check for lib/rustbreeder.ts (the asserts from rustbreeder.py and layout.py). Run: node scripts/rustbreeder-check.mjs
import assert from "node:assert/strict";
import { breedSlot, breed, score, layoutFitness, bestLayout } from "../lib/rustbreeder.ts";

assert.equal(breedSlot("X", ["G"]), "X");           // one green (3) can't beat a red center (5)
assert.equal(breedSlot("X", ["G", "G"]), "G");      // two matching greens (6) can
assert.equal(breedSlot("X", ["G", "Y"]), "X");      // different genes don't stack
assert.equal(breedSlot("X", ["G", "Y", "Y", "Y"]), "Y");
assert.equal(breed("XYGWGG", ["GGGGGG", "GGGGGG"]), "GGGGGG");
assert.equal(score("GGGYYY"), 75);

const nine = Object.fromEntries([...Array(9).keys()].map((p) => [p, "GGGGGG"]));
assert.equal(layoutFitness(nine).total, 9 * score("GGGGGG"));

// hill climbing has to find the same best layout as trying every arrangement of 5 plants
const held = ["GGGYYY", "GGGGGG", "YYYYYY", "GYHXWG", "GGGHHH"];
const slots = [4, 1, 3, 5, 7]; // center, then edges
const perms = (a) => (a.length ? a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])) : [[]]);
const exhaustive = Math.max(...perms(held).map((o) => layoutFitness(Object.fromEntries(slots.map((p, i) => [p, o[i]]))).total));
assert.equal(bestLayout(held).total, exhaustive, "hill climbing missed the true optimum");

console.log("rustbreeder: ok");
