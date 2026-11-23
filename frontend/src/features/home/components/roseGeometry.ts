/**
 * Geometry of the glass-window rose: a flower made of rings of petals, outer ring (one petal per category) at the back,
 * the tight bud at the front. Pure functions, so the shape and the timing can be tested and looked at without a browser.
 * All lengths are in the 400x400 drawing (centre at 0,0, petals drawn pointing up, "up" being outwards).
 */

export interface PetalSpec {
  key: string;
  /** 0 = the outer ring (the labelled petals), up to 4 = the core of the bud. */
  layer: number;
  index: number;
  /** Direction the petal points, in degrees clockwise from straight up. */
  angle: number;
  /** Distance from the centre to the petal's base. */
  baseR: number;
  length: number;
  width: number;
  /** Small natural lean and size variation (kept at 0 and 1 on the labelled petals). */
  tilt: number;
  scale: number;
  /** Flight: when it starts, how long it takes, where it starts from (in the petal's own frame) and how it tumbles. */
  delay: number;
  dur: number;
  fx: number;
  fy: number;
  fr: number;
  /** Slight difference in tone from one petal to the next (1 = the ring's colour). */
  tone: number;
  labelled: boolean;
}

/** A repeatable pseudo-random number in [0, 1): the same seed always gives the same petal, so the flower never changes. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Ring {
  count: (outer: number) => number;
  baseR: number;
  length: number;
  width: (count: number) => number;
  offset: number;
  step: (count: number) => number;
  /** Seconds before this ring starts to arrive: the bud comes first and the flower opens outwards. */
  start: number;
}

const GOLDEN = 137.5;

const RINGS: readonly Ring[] = [
  { count: (n) => Math.max(n, 3), baseR: 24, length: 150, width: (c) => Math.min(124, Math.max(66, ((2 * Math.PI * 100) / c) * 1.28)), offset: 0, step: (c) => 360 / c, start: 1.15 },
  { count: () => 7, baseR: 18, length: 90, width: () => 80, offset: 24, step: () => GOLDEN, start: 0.85 },
  { count: () => 6, baseR: 12, length: 68, width: () => 64, offset: 12, step: () => GOLDEN, start: 0.55 },
  { count: () => 5, baseR: 6, length: 50, width: () => 50, offset: 40, step: () => GOLDEN, start: 0.3 },
  { count: () => 3, baseR: 0, length: 36, width: () => 40, offset: 0, step: () => 120, start: 0 },
];

export const PETAL_STAGGER = 0.09;
export const FLIGHT_SECONDS = 1.7;

/** Every petal of a rose with `categories` labelled petals, from the back (outer ring) to the front (the bud). */
export function layout(categories: number): PetalSpec[] {
  const petals: PetalSpec[] = [];
  RINGS.forEach((ring, layer) => {
    const count = ring.count(categories);
    if (layer === 0 && categories === 0) return; // nothing to label: leave the outer ring out
    for (let i = 0; i < count; i++) {
      const labelled = layer === 0 && i < categories; // a ring padded to three petals has bare ones too
      const seed = layer * 31 + i * 7 + 3;
      const angle = (ring.offset + i * ring.step(count)) % 360;
      const side = rand(seed + 1) < 0.5 ? -1 : 1;
      petals.push({
        key: `p${layer}-${i}`,
        layer,
        index: i,
        angle,
        baseR: ring.baseR,
        length: ring.length * (labelled ? 1 : 0.94 + rand(seed + 2) * 0.12),
        width: ring.width(count) * (labelled ? 1 : 0.92 + rand(seed + 3) * 0.16),
        tilt: labelled ? 0 : (rand(seed + 4) - 0.5) * 9,
        scale: 1,
        delay: ring.start + i * PETAL_STAGGER,
        dur: FLIGHT_SECONDS + rand(seed + 5) * 0.5,
        fx: side * (50 + rand(seed + 6) * 120),
        fy: -(260 + rand(seed + 7) * 120),
        fr: side * (110 + rand(seed + 8) * 120),
        tone: labelled ? 1 : 0.9 + rand(seed + 9) * 0.2,
        labelled,
      });
    }
  });
  return petals;
}

/** Seconds from opening until each labelled petal has (nearly) landed: the moments for the chime of each note. */
export function landingTimes(categories: number): number[] {
  return layout(categories)
    .filter((p) => p.labelled)
    .map((p) => Number((p.delay + p.dur * 0.8).toFixed(2)));
}

/**
 * One rose petal pointing up from (0,0): narrow at the base, widest and rounded near the top, with a shallow notch at the
 * tip and a slight lean on each side so no two edges are the same.
 */
export function petalPath(width: number, length: number): string {
  const w = width / 2;
  const L = length;
  const f = (n: number): string => n.toFixed(1);
  return (
    `M 0 0 C ${f(-w * 0.55)} ${f(-L * 0.08)} ${f(-w * 1.12)} ${f(-L * 0.4)} ${f(-w * 0.98)} ${f(-L * 0.74)} ` +
    `C ${f(-w * 0.9)} ${f(-L * 0.97)} ${f(-w * 0.36)} ${f(-L * 1.03)} ${f(-w * 0.06)} ${f(-L * 0.985)} ` +
    `Q 0 ${f(-L * 0.975)} ${f(w * 0.06)} ${f(-L * 0.985)} ` +
    `C ${f(w * 0.38)} ${f(-L * 1.03)} ${f(w * 0.92)} ${f(-L * 0.96)} ${f(w * 1.0)} ${f(-L * 0.72)} ` +
    `C ${f(w * 1.12)} ${f(-L * 0.4)} ${f(w * 0.55)} ${f(-L * 0.08)} 0 0 Z`
  );
}

/** Soft veins fanning out from the base of a petal. */
export function veinPaths(width: number, length: number): string[] {
  const w = width / 2;
  return [-0.62, -0.31, 0, 0.31, 0.62].map((k) => {
    const x = k * w * 0.9;
    return `M 0 ${(-length * 0.06).toFixed(1)} Q ${(x * 0.45).toFixed(1)} ${(-length * 0.4).toFixed(1)} ${x.toFixed(1)} ${(-length * 0.78).toFixed(1)}`;
  });
}

/** Label size shrinks for long names so they stay inside the petal. */
export function labelSize(name: string): number {
  return Math.max(9, Math.min(15, 15 - Math.max(0, name.length - 6) * 1.0));
}
