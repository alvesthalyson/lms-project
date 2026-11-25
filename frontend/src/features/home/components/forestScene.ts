/**
 * The scene of the window onto the firefly forest, as plain data: the timeline, the sparks of the swirl, the
 * fireflies, and how far the camera has to zoom to go through the stained glass. Pure, so it can be tested.
 *
 * Timeline (seconds after the window opens): the picture of the room zooms into the stained glass (0 - 3), the
 * glass turns into a swirl of light that flashes (about 2), the forest arrives out of the light (2.4), then the
 * title (3.6) and the tale, one line at a time, and at the end the way back to the shelves.
 */

export const TIMES = {
  zoom: 3,
  swirlStart: 0.5,
  flash: 2.1,
  arrive: 2.4,
  title: 3.6,
  firstLine: 4.6,
  line: 5.2,
} as const;

/** When line `i` of the tale appears. */
export function lineDelay(i: number): number {
  return Number((TIMES.firstLine + i * TIMES.line).toFixed(2));
}

/** When the buttons that end the tale appear: a little after its last line. */
export function endDelay(lines: number): number {
  return Number((lineDelay(Math.max(lines, 1) - 1) + 3).toFixed(2));
}

/** Small deterministic generator (mulberry32), so that the scene looks the same on every render. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Spark {
  id: number;
  /** Starting angle (degrees) and how many turns it makes while it spirals in. */
  angle: number;
  turns: number;
  /** Starting distance from the centre of the glass, in vmin. */
  radius: number;
  delay: number;
  dur: number;
  /** Size in px. */
  size: number;
  /** Gold instead of icy blue. */
  warm: boolean;
}

/** The sparks that swirl into the stained glass. They all arrive before the flash is over. */
export function swirl(count = 64): Spark[] {
  const r = rng(7);
  return Array.from({ length: count }, (_, id) => {
    const delay = TIMES.swirlStart + r() * 1.4;
    return {
      id,
      angle: Math.round(r() * 360),
      turns: Number((1.1 + r() * 0.9).toFixed(2)),
      radius: Math.round(30 + r() * 34),
      delay: Number(delay.toFixed(2)),
      dur: Number((1.3 + r() * 0.6).toFixed(2)),
      size: Math.round(3 + r() * 5),
      warm: r() < 0.35,
    };
  });
}

export interface Firefly {
  id: number;
  /** Position, in percent of the screen. */
  x: number;
  y: number;
  size: number;
  delay: number;
  dur: number;
  /** How far it drifts, in vmin. */
  dx: number;
  dy: number;
}

/** The fireflies that float in the forest once it has arrived. */
export function fireflies(count = 22): Firefly[] {
  const r = rng(11);
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: Math.round(3 + r() * 94),
    y: Math.round(30 + r() * 65),
    size: Math.round(3 + r() * 4),
    delay: Number((TIMES.arrive + 0.6 + r() * 5).toFixed(2)),
    dur: Number((6 + r() * 5).toFixed(2)),
    dx: Math.round(-12 + r() * 24),
    dy: Math.round(8 + r() * 14),
  }));
}

/**
 * How much to zoom the room's picture so that the (round) stained-glass window grows to cover the whole screen.
 * The picture is cover-fitted, so it is as wide as the screen or `aspect` times as wide as it is tall, whichever is more.
 */
export function zoomFor(viewport: { w: number; h: number }, aspect: number, radius: number): number {
  const pictureWidth = Math.max(viewport.w, viewport.h * aspect);
  const diameter = 2 * radius * pictureWidth;
  const zoom = (1.05 * Math.hypot(viewport.w, viewport.h)) / diameter;
  return Number(Math.min(16, Math.max(3, zoom)).toFixed(2));
}
