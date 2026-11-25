import { describe, expect, it } from "vitest";

import { FOREST, FRAMES, TIMES, endDelay, fireflies, forestAssets, frameDelay, frameUrl, lineDelay, swirl } from "./forestScene";
import { TALES, dayNumber, taleOfTheDay } from "./stories";

describe("forest timeline", () => {
  it("shows the lines one after another, then the ending", () => {
    for (let i = 1; i < 5; i += 1) expect(lineDelay(i) - lineDelay(i - 1)).toBeCloseTo(TIMES.line, 5);
    expect(lineDelay(0)).toBeGreaterThan(TIMES.title);
    expect(endDelay(5)).toBeGreaterThan(lineDelay(4));
    expect(endDelay(0)).toBeGreaterThan(lineDelay(0));
  });

  it("brings the forest in after the flash starts, and the tale after the forest", () => {
    expect(TIMES.arrive).toBeGreaterThan(TIMES.flash);
    expect(TIMES.title).toBeGreaterThan(TIMES.arrive);
  });

  it("melts the frames in one after another, the last before the flash, so that nothing jumps", () => {
    for (let i = 1; i < FRAMES; i += 1) expect(frameDelay(i) - frameDelay(i - 1)).toBeCloseTo(TIMES.frame, 5);
    expect(frameDelay(0)).toBe(0);
    expect(frameDelay(FRAMES - 1)).toBeLessThan(TIMES.flash);
    expect(TIMES.swirlStart).toBeLessThan(TIMES.flash);
  });

  it("knows where every picture is, to fetch them ahead of time", () => {
    expect(frameUrl(0)).toBe("/transicao/f1.jpg");
    expect(frameUrl(FRAMES - 1)).toBe(`/transicao/f${FRAMES}.jpg`);
    const assets = forestAssets();
    expect(assets).toHaveLength(FRAMES + 1);
    expect(assets).toContain(FOREST);
    expect(new Set(assets).size).toBe(assets.length);
  });
});

describe("swirl and fireflies", () => {
  it("are the same on every render", () => {
    expect(swirl()).toEqual(swirl());
    expect(fireflies()).toEqual(fireflies());
  });

  it("have the asked number of sparks, which all start inside the zoom and are gone soon after the flash", () => {
    const sparks = swirl(50);
    expect(sparks).toHaveLength(50);
    expect(new Set(sparks.map((s) => s.id)).size).toBe(50);
    for (const s of sparks) {
      expect(s.delay).toBeGreaterThanOrEqual(TIMES.swirlStart);
      expect(s.delay + s.dur).toBeLessThanOrEqual(TIMES.flash + 1.8);
      expect(s.turns).toBeGreaterThan(1);
      expect(s.size).toBeGreaterThanOrEqual(3);
    }
    expect(sparks.some((s) => s.warm)).toBe(true);
    expect(sparks.some((s) => !s.warm)).toBe(true);
  });

  it("keeps the fireflies on the screen, in the forest part, and waits for the forest to arrive", () => {
    for (const fly of fireflies(30)) {
      expect(fly.x).toBeGreaterThanOrEqual(0);
      expect(fly.x).toBeLessThanOrEqual(100);
      expect(fly.y).toBeGreaterThanOrEqual(25);
      expect(fly.y).toBeLessThanOrEqual(100);
      expect(fly.delay).toBeGreaterThan(TIMES.arrive);
    }
  });
});

describe("tales", () => {
  it("are told in the three languages, five lines each, with a title and a category", () => {
    expect(TALES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(TALES.map((t) => t.id)).size).toBe(TALES.length);
    for (const tale of TALES) {
      expect(tale.category).toMatch(/^[a-z]+$/);
      for (const lang of ["pt", "en", "ja"] as const) {
        expect(tale.title[lang].trim()).not.toBe("");
        expect(tale.lines[lang]).toHaveLength(5);
        for (const line of tale.lines[lang]) expect(line.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it("changes every day, and is the same all day long", () => {
    const morning = new Date(2026, 4, 10, 6, 0);
    const night = new Date(2026, 4, 10, 23, 30);
    const tomorrow = new Date(2026, 4, 11, 6, 0);
    expect(taleOfTheDay(morning)).toBe(taleOfTheDay(night));
    expect(dayNumber(tomorrow) - dayNumber(morning)).toBe(1);
    expect(taleOfTheDay(tomorrow)).not.toBe(taleOfTheDay(morning));
    const week = Array.from({ length: TALES.length }, (_, i) => taleOfTheDay(new Date(2026, 4, 10 + i)).id);
    expect(new Set(week).size).toBe(TALES.length);
  });
});
