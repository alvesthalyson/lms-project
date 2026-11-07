/**
 * Deterministic randomness and value noise for the procedural artwork.
 * Everything here is pure: the same seed always paints the same picture.
 */

/** Small linear-congruential generator. Returns a function that yields numbers in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Integer-lattice hash in [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [0, 1). */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Multiply an #rrggbb colour by a brightness factor; returns an rgb() string. */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${clamp(n >> 16)},${clamp((n >> 8) & 255)},${clamp(n & 255)})`;
}
