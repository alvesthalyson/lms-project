/**
 * Geometry of the window's tree: a tree of life like the stained glass at the back of the second floor. The trunk splits
 * into branches, the branches into twigs, and glass leaves hang at the ends: small decorative ones everywhere, and a larger
 * leaf for each category. Pure functions, so the shape and the timing can be tested and drawn without a browser.
 * All lengths are in the 400x400 drawing (centre of the window at 0,0, up is negative y).
 */

export type LeafKind = "blue" | "sky" | "gold";

export interface BranchSpec {
  key: string;
  /** 0 trunk, 1 limbs, 2 and 3 branches, 4 twigs; roots count as 5. */
  depth: number;
  d: string;
  width: number;
  /** When it starts to grow and how long it takes, in seconds. */
  delay: number;
  dur: number;
}

export interface LeafSpec {
  key: string;
  /** Where its base is fixed, and the direction it points (degrees clockwise from straight up). */
  x: number;
  y: number;
  angle: number;
  length: number;
  halfWidth: number;
  kind: LeafKind;
  /** The larger leaves carry a category: `index` is that category's place in the list (left to right). */
  labelled: boolean;
  index: number;
  /** Slight difference in tone from leaf to leaf (1 = the glass colour). */
  tone: number;
  /** Flight: when it sets off, how long it takes, where it comes from (in the leaf's own frame) and how it tumbles. */
  delay: number;
  dur: number;
  fx: number;
  fy: number;
  fr: number;
}

export interface TreeLayout {
  branches: BranchSpec[];
  leaves: LeafSpec[];
}

/** More category leaves than this do not fit on the tree: the rest are still on the buttons below the picture. */
export const MAX_LABELLED = 24;

/** A repeatable pseudo-random number in [0, 1): the same seed always gives the same tree. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const RAD = Math.PI / 180;
const BASE_Y = 122;
/** Height of the middle of the crown above the window's centre, for ordering leaves round it. */
const CROWN_Y = 10;

interface Level {
  len: number;
  width: number;
  /** Angles, relative to the branch, of the branches that leave from its end. */
  children: readonly number[];
  start: number;
  dur: number;
}

const LEVELS: readonly Level[] = [
  { len: 62, width: 17, children: [-45, 0, 45], start: 0.2, dur: 0.9 },
  { len: 54, width: 10, children: [-32, 0, 32], start: 0.8, dur: 0.6 },
  { len: 44, width: 6, children: [-25, 25], start: 1.2, dur: 0.55 },
  { len: 34, width: 3.6, children: [-21, 21], start: 1.55, dur: 0.5 },
  { len: 26, width: 2.2, children: [], start: 1.9, dur: 0.45 },
];

/** No branch heads further than this from straight up, so the crown rounds off instead of drooping. */
const MAX_LEAN = 84;
/** The largest lean of a category leaf, so that its name stays inside the window and can be read. */
const LEAF_LEAN = 52;

interface End {
  x: number;
  y: number;
  /** Direction the branch was heading as it ended. */
  angle: number;
}

const at = (x: number, y: number, angle: number, len: number) => ({ x: x + Math.sin(angle * RAD) * len, y: y - Math.cos(angle * RAD) * len });
const f = (n: number): string => n.toFixed(1);

/** Grow the whole tree, level by level, remembering where every branch ends. */
function grow(): { branches: BranchSpec[]; ends: End[][] } {
  const branches: BranchSpec[] = [];
  const ends: End[][] = LEVELS.map(() => []);

  const branch = (x: number, y: number, angle: number, level: number, seed: number, side: number): void => {
    const spec = LEVELS[level]!;
    const len = spec.len;
    const end = at(x, y, angle, len);
    const bend = -side * len * 0.2; // each limb arches back towards the middle and spreads wide at its end, rounding the crown
    const cx = (x + end.x) / 2 + Math.cos(angle * RAD) * bend;
    const cy = (y + end.y) / 2 + Math.sin(angle * RAD) * bend;
    const heading = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, Math.atan2(end.x - cx, -(end.y - cy)) / RAD));
    branches.push({
      key: `b${level}-${ends[level]!.length}`,
      depth: level,
      d: `M ${f(x)} ${f(y)} Q ${f(cx)} ${f(cy)} ${f(end.x)} ${f(end.y)}`,
      width: spec.width,
      delay: Number((spec.start + rand(seed + 2) * 0.12).toFixed(2)),
      dur: spec.dur,
    });
    ends[level]!.push({ x: end.x, y: end.y, angle: heading });
    spec.children.forEach((offset, i) => branch(end.x, end.y, heading + offset, level + 1, seed * 3 + i + 1, Math.sign(offset)));
  };

  branch(0, BASE_Y, 0, 0, 5, 0);

  // the roots: they spread under the trunk, inside the window
  [-64, -32, 0, 32, 64].forEach((offset, i) => {
    const len = 36 + (i % 2 === 0 ? 8 : 0) - Math.abs(offset) * 0.1;
    const angle = 180 + offset;
    const end = at(0, BASE_Y, angle, len);
    const bend = Math.sign(offset) * len * 0.22;
    const cx = (end.x) / 2 + bend;
    const cy = (BASE_Y + end.y) / 2;
    branches.push({ key: `r-${i}`, depth: 5, d: `M 0 ${f(BASE_Y)} Q ${f(cx)} ${f(cy)} ${f(end.x)} ${f(end.y)}`, width: 8 - Math.abs(offset) * 0.06, delay: 0.45 + i * 0.05, dur: 0.9 });
  });

  return { branches, ends };
}

/** Order round the canopy, left to right over the top: by the direction from the middle of the crown. */
const polar = (e: End): number => Math.atan2(e.x, -(e.y + CROWN_Y));
const byX = (a: End, b: End): number => polar(a) - polar(b);

/**
 * The category leaves go on twig tips as far from each other as the crown allows: each new one on the tip that is
 * furthest from all those already chosen, so the names never crowd the dense top of the crown.
 */
function chooseSlots(tips: End[], n: number): End[] {
  const sorted = [...tips].sort(byX);
  if (n <= 0) return [];
  if (n >= sorted.length) return sorted;
  const chosen: End[] = [sorted[0]!];
  while (chosen.length < n) {
    let best = sorted[0]!;
    let bestGap = -1;
    for (const tip of sorted) {
      if (chosen.includes(tip)) continue;
      const gap = Math.min(...chosen.map((c) => Math.hypot(c.x - tip.x, c.y - tip.y)));
      if (gap > bestGap) {
        best = tip;
        bestGap = gap;
      }
    }
    chosen.push(best);
  }
  return chosen;
}

function kindOf(seed: number): LeafKind {
  const r = rand(seed);
  return r < 0.18 ? "gold" : r < 0.5 ? "sky" : "blue";
}

/** The whole tree for a window with `categories` category leaves. */
export function layout(categories: number): TreeLayout {
  const { branches, ends } = grow();
  const tips = ends[4]!;
  const nodes = ends[3]!;
  const labelledCount = Math.min(Math.max(categories, 0), MAX_LABELLED);
  const chosen = chooseSlots(tips, labelledCount).sort(byX);
  const used = new Set(chosen);
  const leaves: LeafSpec[] = [];

  const fly = (seed: number) => {
    const side = rand(seed + 6) < 0.5 ? -1 : 1;
    return { fx: side * (60 + rand(seed + 7) * 120), fy: -(240 + rand(seed + 8) * 120), fr: side * (110 + rand(seed + 9) * 120) };
  };

  // small glass leaves: on every twig tip and branch end that holds no category leaf
  [...tips, ...nodes].forEach((end, i) => {
    if (used.has(end)) return;
    const count = 1;
    for (let k = 0; k < count; k++) {
      const seed = 200 + i * 5 + k;
      const spread = tips.includes(end) ? (rand(seed) - 0.5) * 50 : (i % 2 === 0 ? -1 : 1) * (36 + rand(seed) * 16);
      leaves.push({
        key: `d${i}-${k}`,
        x: end.x,
        y: end.y,
        angle: end.angle + spread,
        length: 24 + rand(seed + 1) * 12,
        halfWidth: 8 + rand(seed + 2) * 3,
        kind: kindOf(seed + 3),
        labelled: false,
        index: -1,
        tone: 0.92 + rand(seed + 4) * 0.16,
        delay: Number((2.1 + rand(seed + 5) * 0.55).toFixed(2)),
        dur: 1.3 + rand(seed + 10) * 0.4,
        ...fly(seed),
      });
    }
  });

  // the category leaves, last and on top
  chosen.forEach((end, i) => {
    const seed = 500 + i * 7;
    leaves.push({
      key: `c${i}`,
      x: end.x,
      y: end.y,
      // leaves at the sides turn up a little, so they stay inside the window
      angle: Math.max(-LEAF_LEAN, Math.min(LEAF_LEAN, end.angle)),
      length: 52,
      halfWidth: 19,
      kind: i % 3 === 2 ? "sky" : "blue",
      labelled: true,
      index: i,
      tone: 1,
      delay: Number((2.2 + i * 0.08).toFixed(2)),
      dur: 1.5,
      ...fly(seed),
    });
  });

  return { branches, leaves };
}

/** Seconds from opening until each category leaf has (nearly) landed: the moments for the note of each. */
export function landingTimes(categories: number): number[] {
  return layout(categories)
    .leaves.filter((l) => l.labelled)
    .map((l) => Number((l.delay + l.dur * 0.8).toFixed(2)));
}

/** One leaf pointing up from (0,0): pointed at the tip, full in the middle. */
export function leafPath(halfWidth: number, length: number): string {
  const w = halfWidth;
  const L = length;
  return (
    `M 0 0 C ${f(w * 0.9)} ${f(-L * 0.2)} ${f(w * 1.1)} ${f(-L * 0.68)} 0 ${f(-L)} ` +
    `C ${f(-w * 1.1)} ${f(-L * 0.68)} ${f(-w * 0.9)} ${f(-L * 0.2)} 0 0 Z`
  );
}

/** The midrib and the side veins of a leaf. */
export function veinPath(halfWidth: number, length: number, side: boolean): string {
  const w = halfWidth;
  const L = length;
  let d = `M 0 ${f(-L * 0.04)} L 0 ${f(-L * 0.88)}`;
  if (side) {
    for (const t of [0.25, 0.45, 0.65]) {
      d += ` M 0 ${f(-L * t)} Q ${f(w * 0.45)} ${f(-L * (t + 0.05))} ${f(w * 0.75)} ${f(-L * (t + 0.16))}`;
      d += ` M 0 ${f(-L * t)} Q ${f(-w * 0.45)} ${f(-L * (t + 0.05))} ${f(-w * 0.75)} ${f(-L * (t + 0.16))}`;
    }
  }
  return d;
}

/** Label size shrinks for long names so they stay inside the leaf. */
export function labelSize(name: string): number {
  return Math.max(9, Math.min(14, 14 - Math.max(0, name.length - 6) * 0.9));
}
