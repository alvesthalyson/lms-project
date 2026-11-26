import { describe, expect, it } from "vitest";

import { STORIES } from "./stories";
import { chunksOf, pickVoice } from "./narration";

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
