import type { Lang } from "@/lib/i18n/dictionaries";

const TAGS: Record<Lang, string> = { pt: "pt-BR", en: "en-US", ja: "ja-JP" };

/** The best voice for a language: one of that language, preferring the natural-sounding ones the browser offers. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | undefined {
  const mine = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(lang));
  const score = (voice: SpeechSynthesisVoice): number => {
    let points = 0;
    if (/natural|neural|multilingual/i.test(voice.name)) points += 4; // the neural voices of Edge and Windows
    if (/online/i.test(voice.name)) points += 2;
    if (/google/i.test(voice.name)) points += 2;
    if (/espeak|compact/i.test(voice.name)) points -= 4;
    if (voice.lang.replace("_", "-") === TAGS[lang]) points += 1;
    return points;
  };
  return [...mine].sort((a, b) => score(b) - score(a))[0];
}

/** A piece of the story said in one breath, and how long the narrator waits after it, in milliseconds. */
export interface Chunk {
  text: string;
  pause: number;
}

const SENTENCE = /[^。.!?！？…]+(?:[。.!?！？…]+["”’」』)]*)?/g;
const LONG = 120;

/**
 * Cuts the story the way a narrator would say it: a sentence at a time (long ones at their commas), with a short
 * pause after each and a longer one between paragraphs. A voice that reads a whole paragraph at once sounds like a
 * machine; one that breathes between sentences sounds like someone telling it.
 */
export function chunksOf(paragraphs: readonly string[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const paragraph of paragraphs) {
    const first = chunks.length;
    for (const raw of paragraph.match(SENTENCE) ?? [paragraph]) {
      const sentence = raw.trim();
      if (!sentence) continue;
      const parts = sentence.length > LONG ? (sentence.match(/[^,、]+(?:[,、]|$)/g) ?? [sentence]).map((part) => part.trim()).filter(Boolean) : [sentence];
      // join the tiny scraps back so that a phrase is never said in two words
      const merged: string[] = [];
      for (const part of parts) {
        if (merged.length > 0 && merged[merged.length - 1]!.length < 40) merged[merged.length - 1] += ` ${part}`;
        else merged.push(part);
      }
      merged.forEach((text, i) => chunks.push({ text, pause: i < merged.length - 1 ? 220 : /…$|\.\.\.$/.test(text) ? 700 : 420 }));
    }
    if (chunks.length > first) chunks[chunks.length - 1]!.pause = 1200;
  }
  return chunks;
}

/**
 * Reads the story aloud with the browser's own voice, sentence by sentence, breathing between them, a little slower
 * and lower than usual, with a lift at questions. This is the fallback for when there is no recorded narration. It
 * can begin at a later paragraph. Returns a function that stops it. Does nothing where the browser has no speech.
 */
export function speak(paragraphs: readonly string[], lang: Lang, from = 0): () => void {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return () => undefined;
  let started = false;
  let stopped = false;
  let timer: number | undefined;
  let waiting: number | undefined;

  const start = (): void => {
    if (started || stopped) return;
    started = true;
    window.clearTimeout(timer);
    const voice = pickVoice(synth.getVoices(), lang);
    const chunks = chunksOf(paragraphs.slice(from));
    let index = 0;
    synth.cancel();
    const say = (): void => {
      if (stopped || index >= chunks.length) return;
      const chunk = chunks[index++]!;
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = voice?.lang ?? TAGS[lang];
      if (voice) utterance.voice = voice;
      const slow = /…$|\.\.\.$/.test(chunk.text);
      utterance.rate = (lang === "ja" ? 0.92 : 0.88) - (slow ? 0.06 : 0);
      utterance.pitch = /[?？]["”’」』)]*$/.test(chunk.text) ? 1.04 : 0.96;
      let done = false;
      const next = (): void => {
        if (done || stopped) return;
        done = true;
        waiting = window.setTimeout(say, chunk.pause);
      };
      utterance.onend = next;
      utterance.onerror = next;
      synth.speak(utterance);
    };
    say();
  };

  if (synth.getVoices().length > 0) {
    start();
  } else {
    // Some browsers load their voices late: wait for them, but not for long.
    synth.addEventListener?.("voiceschanged", start, { once: true });
    timer = window.setTimeout(start, 800);
  }
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    window.clearTimeout(waiting);
    synth.removeEventListener?.("voiceschanged", start);
    synth.cancel();
  };
}

// ── recorded narration ────────────────────────────────────────────────────────────────────────────────

/** One recorded paragraph and how long it lasts, in seconds. */
export interface Clip {
  file: string;
  seconds: number;
}

/** What `scripts/narracao.py` writes next to the recordings: the clips in order and the silence between them. */
export interface Manifest {
  /** The paragraphs that were recorded: the recording is used only while they are the ones on the screen. */
  texts: readonly string[];
  pause: number;
  clips: readonly Clip[];
}

const BASE = "/narracao/";
const manifests = new Map<Lang, Promise<Manifest | null>>();

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== "object" || value === null) return false;
  const { texts, pause, clips } = value as { texts?: unknown; pause?: unknown; clips?: unknown };
  return (
    Array.isArray(texts) &&
    texts.every((text) => typeof text === "string") &&
    typeof pause === "number" &&
    Array.isArray(clips) &&
    clips.length > 0 &&
    clips.every((clip) => typeof clip === "object" && clip !== null && typeof clip.file === "string" && typeof clip.seconds === "number" && clip.seconds > 0)
  );
}

/** The recorded narration of a language, or null if it has not been generated (or cannot be read). Asked once. */
export function loadManifest(lang: Lang): Promise<Manifest | null> {
  let found = manifests.get(lang);
  if (!found) {
    found =
      typeof fetch !== "function"
        ? Promise.resolve(null)
        : fetch(`${BASE}${lang}.json`)
            .then((response) => (response.ok ? response.json() : null))
            .then((data: unknown) => (isManifest(data) ? data : null))
            .catch(() => null); // without the recordings, the dev server answers with the page itself: not JSON
    manifests.set(lang, found);
  }
  return found;
}

/** Whether the recording is of this very story (its words may have changed since it was made). */
export function manifestMatches(manifest: Manifest, paragraphs: readonly string[]): boolean {
  return manifest.clips.length === paragraphs.length && manifest.texts.length === paragraphs.length && manifest.texts.every((text, i) => text === paragraphs[i]);
}

/** How long the recorded story lasts, with its pauses. */
export function manifestSeconds(manifest: Manifest): number {
  return Number((manifest.clips.reduce((sum, clip) => sum + clip.seconds, 0) + manifest.pause * (manifest.clips.length - 1)).toFixed(1));
}

/** Which clip is playing `elapsed` seconds into the story (the count when it is over). */
export function clipAt(manifest: Manifest, elapsed: number): number {
  let end = 0;
  for (let i = 0; i < manifest.clips.length; i += 1) {
    end += manifest.clips[i]!.seconds + manifest.pause;
    if (elapsed < end) return i;
  }
  return manifest.clips.length;
}

function playClips(manifest: Manifest, from: number, onFail: (index: number) => void): () => void {
  let stopped = false;
  let index = from;
  let current: HTMLAudioElement | null = null;
  let timer: number | undefined;

  const fail = (at: number): void => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    current?.pause();
    onFail(at);
  };
  const next = (): void => {
    if (stopped || index >= manifest.clips.length) return;
    const at = index++;
    const audio = new Audio(`${BASE}${manifest.clips[at]!.file}`);
    current = audio;
    audio.onended = () => {
      timer = window.setTimeout(next, manifest.pause * 1000);
    };
    audio.onerror = () => fail(at);
    void Promise.resolve(audio.play()).catch(() => fail(at));
    const after = manifest.clips[at + 1];
    if (after) new Audio(`${BASE}${after.file}`).preload = "auto"; // warms the next clip while this one plays
  };
  next();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    current?.pause();
  };
}

export interface NarrateOptions {
  /** First paragraph to tell (when the sound is turned on halfway through). */
  from?: number;
  /** Wait this long, in milliseconds, before the first word. */
  delay?: number;
  /** The recorded narration, if there is one; otherwise the browser's voice reads it. */
  manifest?: Manifest | null;
}

/**
 * Narrates the story: the recorded voice if it has been generated, and the browser's own voice if not (or if a
 * recording cannot be played). Returns a function that stops it.
 */
export function narrate(paragraphs: readonly string[], lang: Lang, { from = 0, delay = 0, manifest = null }: NarrateOptions = {}): () => void {
  let stopInner: () => void = () => undefined;
  let stopped = false;
  const begin = (): void => {
    if (stopped) return;
    if (manifest && manifestMatches(manifest, paragraphs) && typeof Audio !== "undefined") {
      stopInner = playClips(manifest, from, (at) => {
        stopInner = speak(paragraphs, lang, at);
      });
    } else {
      stopInner = speak(paragraphs, lang, from);
    }
  };
  const timer = delay > 0 ? window.setTimeout(begin, delay) : undefined;
  if (timer === undefined) begin();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    stopInner();
  };
}
