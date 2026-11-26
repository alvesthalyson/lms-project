import type { Lang } from "@/lib/i18n/dictionaries";

const TAGS: Record<Lang, string> = { pt: "pt-BR", en: "en-US", ja: "ja-JP" };

/** The best voice for a language: one of that language, preferring the natural-sounding ones the browser offers. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | undefined {
  const mine = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(lang));
  const score = (voice: SpeechSynthesisVoice): number => (/natural|neural/i.test(voice.name) ? 2 : /google/i.test(voice.name) ? 1 : 0) + (voice.lang === TAGS[lang] ? 0.5 : 0);
  return [...mine].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Reads the story aloud with the browser's own voice, one paragraph at a time (the pause between them is the
 * narrator's breath). It can begin at a later paragraph (when the sound is turned on halfway through). Returns a function that stops the narration. Does nothing where the browser has no speech.
 */
export function narrate(paragraphs: readonly string[], lang: Lang, from = 0): () => void {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return () => undefined;
  let started = false;
  let stopped = false;
  let timer: number | undefined;

  const start = (): void => {
    if (started || stopped) return;
    started = true;
    window.clearTimeout(timer);
    const voice = pickVoice(synth.getVoices(), lang);
    synth.cancel();
    for (const text of paragraphs.slice(from)) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang ?? TAGS[lang];
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      synth.speak(utterance);
    }
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
    synth.removeEventListener?.("voiceschanged", start);
    synth.cancel();
  };
}
