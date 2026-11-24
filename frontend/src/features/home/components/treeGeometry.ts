/**
 * Geometry of the category window: the oak picture with one beam of light per category. Each beam comes down from the
 * crown at the slant of the sun in the picture, and the category's name is written down it, the letters small at the
 * top and growing as the beam opens out. Pure functions, so that the layout can be tested without a browser.
 *
 * Everything is in picture pixels (the picture is `W` x `H`). A beam has its own frame: origin at its top, the y axis
 * running down the beam and x across it; the frame is rotated by `ROTATE_DEG` into the picture.
 */

export const W = 1038;
export const H = 1516;

/** The most beams drawn; further categories stay reachable from the dock. */
export const MAX_LABELLED = 12;

/** How far a beam leans to the right per pixel it goes down: the slant of the sun's rays in the picture. */
export const SLANT = 0.3;
const NORM = Math.hypot(1, SLANT);
const AXIS = { x: SLANT / NORM, y: 1 / NORM };
/** Rotation (degrees, SVG sense) that takes a beam's frame into the picture. */
export const ROTATE_DEG = -(Math.atan(SLANT) * 180) / Math.PI;

const X_MID = 520;
const X_MIN = 150;
const X_MAX = 890;
const MAX_SPACING = 108;
/** Where the beams are lined up: the row at which their axes are evenly spaced. */
const Y_REF = 600;
const MIN_LENGTH = 620;

export interface GlyphSpec {
  ch: string;
  /** Distance of the letter's centre down the beam. */
  dist: number;
  size: number;
  /** Seconds after the window opens. */
  delay: number;
}

export interface BeamSpec {
  index: number;
  key: string;
  name: string;
  /** Top of the beam, in the picture. */
  x0: number;
  y0: number;
  length: number;
  /** Half the beam's width at the top and at the bottom. */
  halfTop: number;
  halfBottom: number;
  glyphs: GlyphSpec[];
  /** The beam opens at `delay` and takes `dur` seconds. */
  delay: number;
  dur: number;
}

/** Narrow letters are packed closer, wide ones given room. */
export function glyphWeight(ch: string): number {
  if ("iljtf.,'!|I".includes(ch)) return 0.55;
  if ("mwMW".includes(ch)) return 1.3;
  return 1;
}

export function halfWidth(beam: BeamSpec, dist: number): number {
  return beam.halfTop + (beam.halfBottom - beam.halfTop) * (dist / beam.length);
}

/** A point of a beam (distance down its axis, offset across it) in the picture. */
export function point(beam: Pick<BeamSpec, "x0" | "y0">, dist: number, offset = 0): { x: number; y: number } {
  return { x: beam.x0 + AXIS.x * dist - AXIS.y * offset, y: beam.y0 + AXIS.y * dist + AXIS.x * offset };
}

/** The picture is shown in an arch: a half circle on top of a rectangle. */
export function insideArch(x: number, y: number, margin: number): boolean {
  const r = W / 2;
  if (y < r) return Math.hypot(x - r, y - r) <= r - margin;
  return x >= margin && x <= W - margin && y <= H - margin;
}

/** The beam's outline in its own frame, as SVG polygon points; `grow` fattens it (the click area is a little wider). */
export function beamPolygon(beam: BeamSpec, grow = 0): string {
  const a = beam.halfTop + grow;
  const b = beam.halfBottom + grow;
  return `${-a},0 ${a},0 ${b},${beam.length} ${-b},${beam.length}`;
}

function build(name: string, index: number, xRef: number, size: number, y0: number): BeamSpec {
  const small = size * 0.3;
  const count = Array.from(name).length;
  const glyphs: GlyphSpec[] = [];
  let dist = 0;
  Array.from(name).forEach((ch, i) => {
    const s = small + (size - small) * ((i + 0.5) / count);
    const half = s * 0.34 * glyphWeight(ch);
    dist += half;
    glyphs.push({ ch, dist, size: s, delay: 0 });
    dist += half + 2;
  });
  const length = Math.max(dist + 90, MIN_LENGTH);
  return {
    index,
    key: `beam-${index}`,
    name,
    x0: xRef - SLANT * (Y_REF - y0),
    y0,
    length,
    halfTop: 6,
    halfBottom: size * 0.5,
    glyphs,
    delay: 0,
    dur: 1.3,
  };
}

function fits(beam: BeamSpec): boolean {
  return beam.glyphs.every((g) => {
    const p = point(beam, g.dist);
    return insideArch(p.x, p.y, g.size * 0.55);
  });
}

export function layout(names: readonly string[]): BeamSpec[] {
  const shown = names.slice(0, MAX_LABELLED);
  const n = shown.length;
  if (n === 0) return [];
  const spacing = n === 1 ? MAX_SPACING : Math.min(MAX_SPACING, (X_MAX - X_MIN) / (n - 1));
  const size = Math.min(82, spacing * 0.78);
  const first = X_MID - (spacing * (n - 1)) / 2;
  return shown.map((name, i) => {
    const xRef = first + spacing * i;
    // The beams start staggered, a little lower towards the edges so that their first (smallest) letters stay inside the arch.
    let y0 = 60 + (i % 2) * 40;
    const edge = Math.abs(xRef - SLANT * (Y_REF - y0) - X_MID) / X_MID;
    y0 = Math.max(y0, 90 + 300 * edge ** 1.6);
    let beam = build(name, i, xRef, size, y0);
    for (let guard = 0; guard < 40 && !fits(beam); guard += 1) {
      y0 += 12;
      beam = build(name, i, xRef, size, y0);
    }
    const delay = 1 + i * 0.32;
    const glyphs = beam.glyphs.map((g, j) => ({ ...g, delay: Number((delay + 0.35 + j * 0.1).toFixed(2)) }));
    return { ...beam, delay: Number(delay.toFixed(2)), glyphs };
  });
}

/** When each name has been written out, in seconds after the window opens: the moment for its note of sound. */
export function landingTimes(names: readonly string[]): number[] {
  return layout(names).map((beam) => Number((beam.glyphs[beam.glyphs.length - 1]!.delay + 0.25).toFixed(2)));
}
