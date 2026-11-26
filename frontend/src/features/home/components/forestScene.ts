import type { Lang } from "@/lib/i18n/dictionaries";

/**
 * The scene of the window onto the firefly forest, as plain data: the timeline and the fireflies. Pure, so it can be
 * tested.
 *
 * The window opens with a short film of the journey (the library, the camera going up to the stained glass, the
 * glass turning into a swirl of light, a tunnel, a flash, and the forest arriving). When the film ends (or cannot
 * play) the forest is "live": the film fades out into the same forest, the fireflies float, and the tale is told
 * as text that rises. All the times below are seconds after that moment.
 */

/** The film of the journey and its first frame, shown while it loads. */
export const VIDEO = "/transicao-viagem.mp4";
export const POSTER = "/transicao-capa.jpg";
export const FOREST = "/floresta-vagalumes.jpg";
/** How long the film lasts, in seconds; if it has not ended a little after that, the forest goes live anyway. */
export const VIDEO_SECONDS = 5.8;

/** Everything the window shows, so that it can be fetched before the reader opens it. */
export function forestAssets(): { images: string[]; video: string } {
  return { images: [POSTER, FOREST], video: VIDEO };
}

export const TIMES = {
  title: 0.4,
  /** The text starts to rise this long after the forest goes live. */
  scrollStart: 1.2,
} as const;

/**
 * How long the text takes to rise, in seconds: about as long as the narrator takes to say it (a slow, easy pace, and a
 * breath between paragraphs). Japanese is counted by characters, the other languages by words.
 */
export function scrollSeconds(paragraphs: readonly string[], lang: Lang): number {
  const text = paragraphs.join(" ");
  const speech = lang === "ja" ? text.replace(/\s/g, "").length / 4.6 : text.split(/\s+/).filter(Boolean).length / 2.1;
  return Number((speech + paragraphs.length * 0.8).toFixed(1));
}

/** When the buttons that end the story appear: a moment after the text has finished rising. */
export function endDelay(paragraphs: readonly string[], lang: Lang): number {
  return Number((TIMES.scrollStart + scrollSeconds(paragraphs, lang) + 1).toFixed(1));
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

/** The fireflies that float in the forest once it is live. */
export function fireflies(count = 22): Firefly[] {
  const r = rng(11);
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: Math.round(3 + r() * 94),
    y: Math.round(30 + r() * 65),
    size: Math.round(3 + r() * 4),
    delay: Number((0.3 + r() * 4).toFixed(2)),
    dur: Number((6 + r() * 5).toFixed(2)),
    dx: Math.round(-12 + r() * 24),
    dy: Math.round(8 + r() * 14),
  }));
}
