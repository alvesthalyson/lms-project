/**
 * Geometry of the window's tree: a tree of life drawn like the stained glass at the back of the second floor. A wide
 * trunk that tapers and spreads into roots, thick limbs that fork into branches and twigs, a crown of pointed glass cells,
 * and, for each category, a tile of dark glass with the name written flat so that it can be read at a glance.
 * Pure functions, so the shape, the placing and the timing can be tested and drawn without a browser.
 * All lengths are in the 400x400 drawing (centre of the window at 0,0, up is negative y).
 */

export type LeafKind = "blue" | "sky" | "gold";

export interface BranchSpec {
  key: string;
  /** 0 trunk, 1 limbs, 2 and 3 branches, 4 twigs; roots count as 5. */
  depth: number;
  /** The centre line (also what reveals the branch as it grows). */
  d: string;
  width: number;
  /** Limbs and roots are solid shapes that taper: `fill` is the closed outline, `left` and `right` its two edges. */
  shape?: { fill: string; left: string; right: string };
  /** Faint lines along the wood, like the engraving on the trunk in the window. */
  grain: string[];
  /** When it starts to grow and how long it takes, in seconds. */
  delay: number;
  dur: number;
}

/** Where something comes from when it flies in (in the window's own directions), and how it tumbles. */
interface Flight {
  delay: number;
  dur: number;
  fx: number;
  fy: number;
  fr: number;
}

export interface LeafSpec extends Flight {
  key: string;
  /** Where its base is fixed, and the direction it points (degrees clockwise from straight up). */
  x: number;
  y: number;
  angle: number;
  length: number;
  halfWidth: number;
  kind: LeafKind;
  /** Slight difference in tone from leaf to leaf (1 = the glass colour). */
  tone: number;
}

/** A tile of glass that carries one category, centred on (x, y), always flat so that its name reads left to right. */
export interface TileSpec extends Flight {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  /** The category's place in the list. */
  index: number;
}

export interface TreeLayout {
  branches: BranchSpec[];
  leaves: LeafSpec[];
  tiles: TileSpec[];
}

/** More category tiles than this do not fit on the tree: the rest are still on the buttons below the picture. */
export const MAX_LABELLED = 20;

/** A repeatable pseudo-random number in [0, 1): the same seed always gives the same tree. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const RAD = Math.PI / 180;
const BASE_Y = 126;
/** Where the glass ends: nothing may reach past this distance from the centre. */
const WINDOW_R = 170;
const TILE_H = 28;

interface Level {
  len: number;
  /** Width at the start and at the end (limbs taper). */
  w0: number;
  w1: number;
  /** Angles, relative to the branch, of the branches that leave from its end. */
  children: readonly number[];
  start: number;
  dur: number;
}

const LEVELS: readonly Level[] = [
  { len: 62, w0: 44, w1: 26, children: [-46, 0, 46], start: 0.2, dur: 0.9 },
  { len: 54, w0: 21, w1: 12, children: [-32, 0, 32], start: 0.8, dur: 0.6 },
  { len: 44, w0: 14, w1: 8, children: [-25, 25], start: 1.2, dur: 0.55 },
  { len: 34, w0: 7.5, w1: 5, children: [-21, 21], start: 1.55, dur: 0.5 },
  { len: 26, w0: 4.5, w1: 3, children: [], start: 1.9, dur: 0.45 },
];

/** Limbs up to this depth are solid shapes; the thin twigs are drawn as lines. */
const SOLID_DEPTH = 2;

/** No branch heads further than this from straight up, so the crown rounds off instead of drooping. */
const MAX_LEAN = 84;

interface End {
  x: number;
  y: number;
  /** Direction the branch was heading as it ended. */
  angle: number;
}

interface Pt {
  x: number;
  y: number;
}

const at = (x: number, y: number, angle: number, len: number): Pt => ({ x: x + Math.sin(angle * RAD) * len, y: y - Math.cos(angle * RAD) * len });
const f = (n: number): string => n.toFixed(1);
const poly = (pts: readonly Pt[]): string => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${f(p.x)} ${f(p.y)}`).join(" ");

/** Both edges of a quadratic limb whose width goes from `w0` to `w1`, sampled along its length. */
function edges(p0: Pt, c: Pt, p1: Pt, w0: number, w1: number): { left: Pt[]; right: Pt[]; centre: Pt[] } {
  const steps = 14;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const centre: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const p = { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
    const dx = 2 * u * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    const dy = 2 * u * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    const n = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * Math.pow(t, 0.85)) / 2;
    left.push({ x: p.x - (dy / n) * w, y: p.y + (dx / n) * w });
    right.push({ x: p.x + (dy / n) * w, y: p.y - (dx / n) * w });
    centre.push(p);
  }
  return { left, right, centre };
}

/** A line running along a limb, at `k` of its half-width from the middle (negative = left). */
function along(e: { left: Pt[]; right: Pt[]; centre: Pt[] }, k: number): string {
  return poly(e.centre.map((p, i) => ({ x: p.x + (e.right[i]!.x - e.left[i]!.x) * 0.5 * k, y: p.y + (e.right[i]!.y - e.left[i]!.y) * 0.5 * k })));
}

function shaped(key: string, depth: number, p0: Pt, c: Pt, p1: Pt, w0: number, w1: number, delay: number, dur: number): BranchSpec {
  const e = edges(p0, c, p1, w0, w1);
  const grain = depth === 0 ? [along(e, -0.42), along(e, 0.42)] : depth === 1 ? [along(e, 0)] : [];
  return {
    key,
    depth,
    d: `M ${f(p0.x)} ${f(p0.y)} Q ${f(c.x)} ${f(c.y)} ${f(p1.x)} ${f(p1.y)}`,
    width: Math.max(w0, w1),
    shape: { fill: `${poly(e.left)} ${poly([...e.right].reverse()).replace("M", "L")} Z`, left: poly(e.left), right: poly(e.right) },
    grain,
    delay,
    dur,
  };
}

/** Grow the whole tree, level by level, remembering where every branch ends. */
function grow(): { branches: BranchSpec[]; ends: End[][] } {
  const branches: BranchSpec[] = [];
  const ends: End[][] = LEVELS.map(() => []);

  const branch = (x: number, y: number, angle: number, level: number, seed: number, side: number): void => {
    const spec = LEVELS[level]!;
    const end = at(x, y, angle, spec.len);
    const bend = -side * spec.len * 0.2; // each limb arches back towards the middle and spreads wide at its end
    const c = { x: (x + end.x) / 2 + Math.cos(angle * RAD) * bend, y: (y + end.y) / 2 + Math.sin(angle * RAD) * bend };
    const heading = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, Math.atan2(end.x - c.x, -(end.y - c.y)) / RAD));
    const key = `b${level}-${ends[level]!.length}`;
    const delay = Number((spec.start + rand(seed + 2) * 0.12).toFixed(2));
    if (level <= SOLID_DEPTH) {
      branches.push(shaped(key, level, { x, y }, c, end, spec.w0, spec.w1, delay, spec.dur));
    } else {
      branches.push({ key, depth: level, d: `M ${f(x)} ${f(y)} Q ${f(c.x)} ${f(c.y)} ${f(end.x)} ${f(end.y)}`, width: spec.w0, grain: [], delay, dur: spec.dur });
    }
    ends[level]!.push({ x: end.x, y: end.y, angle: heading });
    spec.children.forEach((offset, i) => branch(end.x, end.y, heading + offset, level + 1, seed * 3 + i + 1, Math.sign(offset)));
  };

  branch(0, BASE_Y, 0, 0, 5, 0);

  // the roots: thick arcs that spread under the trunk and curve up along the edge of the window, as in the picture
  [
    { side: -1, x: 50, y: 150, w: 22 },
    { side: 1, x: 50, y: 150, w: 22 },
    { side: -1, x: 112, y: 112, w: 17 },
    { side: 1, x: 112, y: 112, w: 17 },
    { side: -1, x: 18, y: 160, w: 13 },
    { side: 1, x: 18, y: 160, w: 13 },
  ].forEach((root, i) => {
    const p1 = { x: root.side * root.x, y: root.y };
    const c = { x: root.side * root.x * 0.5, y: Math.max(root.y, BASE_Y) + 20 };
    branches.push(shaped(`r-${i}`, 5, { x: root.side * 6, y: BASE_Y - 12 }, c, p1, root.w, 3, 0.45 + i * 0.05, 0.9));
  });

  return { branches, ends };
}

const tileWidth = (name: string, size: number): number => Math.max(58, Math.min(116, Math.round(name.length * size * 0.62 + 28)));

/** Size of the writing: a little smaller when there are many names to fit. */
export function labelSize(count: number): number {
  return count > 18 ? 10 : count > 11 ? 11 : 12;
}

function fly(seed: number, x: number, y: number): Pick<Flight, "fx" | "fy" | "fr"> {
  // each piece comes in from beyond the edge of the window nearest to where it ends up
  const theta = Math.atan2(y, x) + (rand(seed + 6) - 0.5) * 1.4;
  const reach = 250 + rand(seed + 7) * 100;
  const side = rand(seed + 8) < 0.5 ? -1 : 1;
  return { fx: Math.round(Math.cos(theta) * reach - x), fy: Math.round(Math.sin(theta) * reach - y), fr: side * (110 + rand(seed + 9) * 120) };
}

function kindOf(seed: number): LeafKind {
  const r = rand(seed);
  return r < 0.1 ? "gold" : r < 0.42 ? "sky" : "blue";
}

/** Free places across the crown for the tiles: a staggered grid over the foliage, clear of the trunk and the main fork. */
function crownSlots(): End[] {
  const slots: End[] = [];
  for (let row = 0, y = -130; y <= 58; row++, y += 14) {
    for (let x = -140 + (row % 2) * 8; x <= 140; x += 16) {
      if (Math.hypot(x, y + 30) > 142) continue; // the round crown
      if (Math.abs(x) < 34 && y > -24) continue; // the top of the trunk and the fork
      slots.push({ x, y, angle: 0 });
    }
  }
  return slots;
}

/**
 * Where the tiles go: each new one as far as possible, measured in tile sizes, from those already placed, so that the
 * names never overlap. They are then read top to bottom and left to right.
 */
function placeTiles(n: number, w: number): End[] {
  const inside = (e: End) => Math.hypot(Math.abs(e.x) + w / 2, Math.abs(e.y) + TILE_H / 2) <= WINDOW_R;
  const pool = crownSlots().filter(inside);
  if (n <= 0 || pool.length === 0) return [];
  const count = Math.min(n, pool.length);
  const gap = (a: End, b: End) => Math.max(Math.abs(a.x - b.x) / (w + 8), Math.abs(a.y - b.y) / (TILE_H + 8));
  const chosen: End[] = [pool.reduce((top, e) => (e.y < top.y || (e.y === top.y && Math.abs(e.x) < Math.abs(top.x)) ? e : top))];
  while (chosen.length < count) {
    let best = pool[0]!;
    let bestGap = -1;
    for (const e of pool) {
      if (chosen.includes(e)) continue;
      const g = Math.min(...chosen.map((c) => gap(c, e)));
      if (g > bestGap) {
        best = e;
        bestGap = g;
      }
    }
    chosen.push(best);
  }
  return chosen.sort((a, b) => Math.round(a.y / 36) - Math.round(b.y / 36) || a.x - b.x);
}

/** The whole tree for a window with the given category names. */
export function layout(names: readonly string[]): TreeLayout {
  const { branches, ends } = grow();
  const tips = ends[4]!;
  const nodes = [...ends[3]!, ...ends[2]!];
  const shown = names.slice(0, MAX_LABELLED);
  const size = labelSize(shown.length);
  const widths = shown.map((name) => tileWidth(name, size));
  const typical = widths.length ? Math.round(widths.reduce((a, b) => a + b, 0) / widths.length) : 0;

  const slots = placeTiles(shown.length, typical);
  const tiles: TileSpec[] = slots.map((slot, i) => {
    const seed = 500 + i * 7;
    const w = widths[i]!;
    // a long name on a slot near the edge slides inwards until it is inside the glass
    const room = Math.sqrt(Math.max(0, WINDOW_R * WINDOW_R - (Math.abs(slot.y) + TILE_H / 2) ** 2)) - w / 2;
    const x = Math.max(-room, Math.min(room, slot.x));
    return { key: `t${i}`, x, y: slot.y, w, h: TILE_H, size, index: i, delay: Number((2.3 + i * 0.09).toFixed(2)), dur: 1.5, ...fly(seed, x, slot.y) };
  });

  // the crown: pointed glass cells on every twig tip and branch end, a few small yellow buds among them
  const leaves: LeafSpec[] = [];
  [...tips, ...nodes].forEach((end, i) => {
    const isTip = i < tips.length;
    const count = isTip ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const seed = 200 + i * 5 + k;
      const bud = isTip && k === 1 && rand(seed + 11) < 0.22;
      const spread = isTip ? (k === 0 ? -1 : 1) * (14 + rand(seed) * 22) : (i % 2 === 0 ? -1 : 1) * (38 + rand(seed) * 16);
      const x = end.x;
      const y = end.y;
      leaves.push({
        key: `d${i}-${k}`,
        x,
        y,
        angle: end.angle + spread,
        length: bud ? 14 : 30 + rand(seed + 1) * 12,
        halfWidth: bud ? 5.5 : 10 + rand(seed + 2) * 3,
        kind: bud ? "gold" : kindOf(seed + 3),
        tone: 0.92 + rand(seed + 4) * 0.16,
        delay: Number((2.05 + rand(seed + 5) * 0.55).toFixed(2)),
        dur: 1.3 + rand(seed + 10) * 0.4,
        ...fly(seed, x, y),
      });
    }
  });

  return { branches, leaves, tiles };
}

/** Seconds from opening until each category tile has (nearly) landed: the moments for the note of each. */
export function landingTimes(names: readonly string[]): number[] {
  return layout(names).tiles.map((t) => Number((t.delay + t.dur * 0.8).toFixed(2)));
}

/** One glass cell pointing up from (0,0): pointed at both ends, full in the middle. */
export function leafPath(halfWidth: number, length: number): string {
  const w = halfWidth;
  const L = length;
  return (
    `M 0 0 C ${f(w * 0.9)} ${f(-L * 0.2)} ${f(w * 1.1)} ${f(-L * 0.68)} 0 ${f(-L)} ` +
    `C ${f(-w * 1.1)} ${f(-L * 0.68)} ${f(-w * 0.9)} ${f(-L * 0.2)} 0 0 Z`
  );
}

/** The bright core of a cell, where the light comes through. */
export function coreLeafPath(halfWidth: number, length: number): string {
  return leafPath(halfWidth * 0.4, length * 0.62).replace(/^M 0 0/, `M 0 ${f(-length * 0.14)}`);
}

/** The lead line along a cell. */
export function veinPath(length: number): string {
  return `M 0 ${f(-length * 0.04)} L 0 ${f(-length * 0.9)}`;
}

/** A tile of glass with a point at each end, centred on (0,0): the writing runs along its middle. */
export function tilePath(w: number, h: number): string {
  const a = w / 2;
  const b = h / 2;
  return (
    `M ${f(-a)} 0 C ${f(-a * 0.55)} ${f(-b * 1.15)} ${f(a * 0.55)} ${f(-b * 1.15)} ${f(a)} 0 ` +
    `C ${f(a * 0.55)} ${f(b * 1.15)} ${f(-a * 0.55)} ${f(b * 1.15)} ${f(-a)} 0 Z`
  );
}
