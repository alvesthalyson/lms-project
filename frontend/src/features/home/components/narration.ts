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
 * and lower than usual, with a lift at questions. It can begin at a later paragraph (when the sound is turned on
 * halfway through). Returns a function that stops the narration. Does nothing where the browser has no speech.
 */
export function narrate(paragraphs: readonly string[], lang: Lang, from = 0): () => void {
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
