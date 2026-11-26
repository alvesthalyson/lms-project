import { describe, expect, it } from "vitest";

import { FOREST, POSTER, TIMES, VIDEO, VIDEO_SECONDS, endDelay, fireflies, forestAssets, lineDelay } from "./forestScene";
import { TALES, dayNumber, taleOfTheDay } from "./stories";

describe("forest timeline", () => {
  it("shows the lines one after another, then the ending", () => {
    for (let i = 1; i < 5; i += 1) expect(lineDelay(i) - lineDelay(i - 1)).toBeCloseTo(TIMES.line, 5);
    expect(lineDelay(0)).toBeGreaterThan(TIMES.title);
    expect(endDelay(5)).toBeGreaterThan(lineDelay(4));
    expect(endDelay(0)).toBeGreaterThan(lineDelay(0));
  });

  it("knows the film, its first frame and the forest, to fetch them ahead of time", () => {
    const { images, video } = forestAssets();
    expect(video).toBe(VIDEO);
    expect(images).toEqual([POSTER, FOREST]);
    expect(VIDEO_SECONDS).toBeGreaterThan(3);
  });
});

describe("fireflies", () => {
  it("are the same on every render", () => {
    expect(fireflies()).toEqual(fireflies());
  });

  it("have unique ids, stay on the screen in the forest part, and start soon after the forest is live", () => {
    const flies = fireflies(30);
    expect(new Set(flies.map((f) => f.id)).size).toBe(30);
    for (const fly of flies) {
      expect(fly.x).toBeGreaterThanOrEqual(0);
      expect(fly.x).toBeLessThanOrEqual(100);
      expect(fly.y).toBeGreaterThanOrEqual(25);
      expect(fly.y).toBeLessThanOrEqual(100);
      expect(fly.delay).toBeLessThan(5);
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
