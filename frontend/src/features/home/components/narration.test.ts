import { afterEach, describe, expect, it, vi } from "vitest";

import { STORIES } from "./stories";
import { chunksOf, clipAt, loadManifest, manifestSeconds, narrate, pickVoice, type Manifest } from "./narration";

const voice = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

describe("narration", () => {
  it("cuts the story into sentences, with a longer pause at the end of each paragraph", () => {
    const chunks = chunksOf(["Primeira frase. Segunda frase! Terceira?", "Outro parágrafo, curto."]);
    expect(chunks.map((c) => c.text)).toEqual(["Primeira frase.", "Segunda frase!", "Terceira?", "Outro parágrafo, curto."]);
    expect(chunks.map((c) => c.pause)).toEqual([420, 420, 1200, 1200]);
  });

  it("breathes longer at an ellipsis, and splits Japanese at 。", () => {
    expect(chunksOf(["Está ouvindo… Ainda falta um verso."]).map((c) => c.pause)).toEqual([700, 1200]);
    expect(chunksOf(["もうひとつ。またひとつ。"]).map((c) => c.text)).toEqual(["もうひとつ。", "またひとつ。"]);
  });

  it("splits a very long sentence at its commas, without leaving tiny scraps", () => {
    const long = "Uma frase muito longa que continua e continua, com muitas partes e mais partes ainda para dizer, até que enfim chega ao ponto final, depois de tudo.";
    const chunks = chunksOf([long]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.text).join(" ").replace(/\s+/g, " ")).toBe(long);
    for (const chunk of chunks.slice(0, -1)) expect(chunk.text.length).toBeGreaterThanOrEqual(40);
  });

  it("keeps every word of the three stories", () => {
    for (const lang of ["pt", "en", "ja"] as const) {
      const said = chunksOf(STORIES[lang].paragraphs).map((c) => c.text).join("").replace(/\s/g, "");
      expect(said).toBe(STORIES[lang].paragraphs.join("").replace(/\s/g, ""));
    }
  });

  it("prefers the natural voices of the language", () => {
    const voices = [voice("Microsoft Maria - Portuguese (Brazil)", "pt-BR"), voice("Microsoft Francisca Online (Natural) - Portuguese (Brazil)", "pt-BR"), voice("Google US English", "en-US")];
    expect(pickVoice(voices, "pt")?.name).toContain("Natural");
    expect(pickVoice(voices, "en")?.name).toBe("Google US English");
    expect(pickVoice(voices, "ja")).toBeUndefined();
  });
});

const manifest: Manifest = { pause: 1, clips: [{ file: "pt-01.mp3", seconds: 4 }, { file: "pt-02.mp3", seconds: 6 }, { file: "pt-03.mp3", seconds: 5 }] };

class FakeAudio {
  static all: FakeAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  preload = "";
  paused = true;
  constructor(public src: string) {
    FakeAudio.all.push(this);
  }
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
}

describe("recorded narration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    FakeAudio.all = [];
  });

  it("measures the story and finds the clip being told", () => {
    expect(manifestSeconds(manifest)).toBe(17); // 4 + 6 + 5, and two pauses
    expect(clipAt(manifest, 0)).toBe(0);
    expect(clipAt(manifest, 4.5)).toBe(0); // still in the pause after the first
    expect(clipAt(manifest, 5.5)).toBe(1);
    expect(clipAt(manifest, 100)).toBe(3);
  });

  it("reads the manifest once, and takes anything that is not a manifest as 'not recorded'", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadManifest("pt")).toEqual(manifest);
    expect(await loadManifest("pt")).toEqual(manifest);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error("<!doctype html>")) })));
    expect(await loadManifest("en")).toBeNull(); // the dev server answers with the page when the file does not exist
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })));
    expect(await loadManifest("ja")).toBeNull();
  });

  it("plays the clips one after the other, with the pause between them, and stops on demand", () => {
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio);
    const stop = narrate(["a", "b", "c"], "pt", { manifest });
    const first = FakeAudio.all.find((audio) => audio.src === "/narracao/pt-01.mp3")!;
    expect(first.play).toHaveBeenCalledTimes(1);
    first.onended?.();
    vi.advanceTimersByTime(900);
    expect(FakeAudio.all.filter((audio) => audio.play.mock.calls.length > 0)).toHaveLength(1); // still in the pause
    vi.advanceTimersByTime(200);
    const second = FakeAudio.all.filter((audio) => audio.src === "/narracao/pt-02.mp3" && audio.play.mock.calls.length > 0);
    expect(second).toHaveLength(1);
    stop();
    expect(second[0]!.pause).toHaveBeenCalled();
    second[0]!.onended?.();
    vi.advanceTimersByTime(5000);
    expect(FakeAudio.all.some((audio) => audio.src === "/narracao/pt-03.mp3" && audio.play.mock.calls.length > 0)).toBe(false);
  });

  it("starts at a later clip, and after a delay when asked", () => {
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio);
    narrate(["a", "b", "c"], "pt", { manifest, from: 2, delay: 1000 });
    expect(FakeAudio.all).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(FakeAudio.all.find((audio) => audio.play.mock.calls.length > 0)?.src).toBe("/narracao/pt-03.mp3");
  });

  it("falls back to the browser's voice, from the same paragraph, when a clip cannot be played", () => {
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio);
    const spoken: string[] = [];
    class Utterance {
      lang = "";
      rate = 1;
      pitch = 1;
      voice: unknown = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("speechSynthesis", { speak: (u: Utterance) => spoken.push(u.text), cancel: vi.fn(), getVoices: () => [{ name: "Voz", lang: "pt-BR" }], addEventListener: vi.fn(), removeEventListener: vi.fn() });
    narrate(["Um. Dois.", "Três. Quatro.", "Cinco."], "pt", { manifest, from: 1 });
    FakeAudio.all.find((audio) => audio.play.mock.calls.length > 0)!.onerror?.();
    expect(spoken).toEqual(["Três."]); // the second paragraph, not the first
  });

  it("uses the browser's voice when the manifest does not match the story", () => {
    vi.stubGlobal("Audio", FakeAudio);
    narrate(["só um"], "pt", { manifest });
    expect(FakeAudio.all).toHaveLength(0);
  });
});
