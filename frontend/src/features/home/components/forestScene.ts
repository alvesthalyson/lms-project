import type { Lang } from "@/lib/i18n/dictionaries";

import { chunksOf, clipAt, manifestSeconds, type Manifest } from "./narration";

/**
 * The scene of the window onto the firefly forest, as plain data: the timeline and the fireflies. Pure, so it can be
 * tested.
 *
 * The window opens with a film of the journey (the second floor, the camera going up to the stained-glass window, the
 * window opening onto the night, and the camera flying out into the forest of fireflies). When the film ends (or cannot
 * play) the forest is "live": the film fades out into the same forest, the fireflies float, and the tale is told
 * as text that rises. All the times below are seconds after that moment.
 */

/** The film of the journey and its first frame, shown while it loads. */
export const VIDEO = "/janela-floresta.mp4";
export const POSTER = "/janela-floresta-capa.jpg";
export const FOREST = "/floresta-vagalumes.jpg";
/** How long the film lasts, in seconds; if it has not ended a little after that, the forest goes live anyway. */
export const VIDEO_SECONDS = 10.1;

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
 * breath after each sentence). Japanese is counted by characters, the other languages by words.
 */
export function scrollSeconds(paragraphs: readonly string[], lang: Lang, manifest?: Manifest | null): number {
  if (manifest) return manifestSeconds(manifest); // the recorded voice says how long it takes
  const text = paragraphs.join(" ");
  const speech = lang === "ja" ? text.replace(/\s/g, "").length / 4.6 : text.split(/\s+/).filter(Boolean).length / 2.1;
  const breaths = chunksOf(paragraphs).reduce((sum, chunk) => sum + chunk.pause, 0) / 1000; // the narrator's pauses
  return Number((speech + breaths).toFixed(1));
}

/** When each paragraph is told, in seconds from the start of the story: from the recording, or estimated. */
export function paragraphTimes(paragraphs: readonly string[], lang: Lang, manifest?: Manifest | null): { start: number; end: number }[] {
  const times: { start: number; end: number }[] = [];
  let at = 0;
  paragraphs.forEach((paragraph, i) => {
    let seconds: number;
    let gap: number;
    const clip = manifest?.clips[i];
    if (manifest && clip) {
      seconds = clip.seconds;
      gap = manifest.pause;
    } else {
      const chunks = chunksOf([paragraph]);
      const speech = lang === "ja" ? paragraph.replace(/\s/g, "").length / 4.6 : paragraph.split(/\s+/).filter(Boolean).length / 2.1;
      gap = chunks.length > 0 ? chunks[chunks.length - 1]!.pause / 1000 : 0;
      seconds = speech + chunks.slice(0, -1).reduce((sum, chunk) => sum + chunk.pause, 0) / 1000;
    }
    times.push({ start: Number(at.toFixed(2)), end: Number((at + seconds).toFixed(2)) });
    at += seconds + gap;
  });
  return times;
}

/** Where the paragraphs sit in the scrolling block (top and height, in pixels). */
export interface Box {
  top: number;
  height: number;
}

/** The line of the screen where the words being told are, as a fraction of the height of the viewport. */
export const READING_LINE = 0.5;

/**
 * The keyframes that make the text rise in step with the voice. A reading mark runs down the text: at the start of a
 * paragraph it is at the paragraph's top, at its end at the bottom, and in the pause between paragraphs it crosses the
 * gap. The block is moved so that the mark always stays on the reading line, so the words appear just as they are said.
 */
export function scrollKeyframes(boxes: readonly Box[], times: readonly { start: number; end: number }[], view: number, total: number): { offset: number; transform: string }[] {
  const at = (y: number): string => `translateY(${Number((view * READING_LINE - y).toFixed(1))}px)`;
  const frames: { offset: number; transform: string }[] = [];
  const push = (time: number, y: number): void => {
    const offset = Math.min(1, Math.max(frames.length > 0 ? frames[frames.length - 1]!.offset : 0, total > 0 ? time / total : 0));
    frames.push({ offset: Number(offset.toFixed(4)), transform: at(y) });
  };
  boxes.forEach((box, i) => {
    const time = times[i];
    if (!time) return;
    push(time.start, box.top);
    push(time.end, box.top + box.height);
  });
  const last = frames[frames.length - 1];
  if (!last) return [];
  if (frames[0]!.offset > 0) frames.unshift({ offset: 0, transform: frames[0]!.transform });
  if (last.offset < 1) frames.push({ offset: 1, transform: last.transform });
  return frames;
}

/** Which paragraph the narrator should be on, `elapsed` seconds after the forest went live (the count when it is over). */
export function paragraphAt(paragraphs: readonly string[], lang: Lang, elapsed: number, manifest?: Manifest | null): number {
  const t = Math.max(0, elapsed - TIMES.scrollStart);
  if (manifest) return clipAt(manifest, t);
  let end = 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    end += scrollSeconds([paragraphs[i]!], lang);
    if (t < end) return i;
  }
  return paragraphs.length;
}

/** When the buttons that end the story appear: a moment after the text has finished rising. */
export function endDelay(paragraphs: readonly string[], lang: Lang, manifest?: Manifest | null): number {
  return Number((TIMES.scrollStart + scrollSeconds(paragraphs, lang, manifest) + 1).toFixed(1));
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
