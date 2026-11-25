import { describe, expect, it } from "vitest";

import { TIMES, endDelay, fireflies, lineDelay, swirl, zoomFor } from "./forestScene";
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
    expect(TIMES.arrive).toBeLessThan(TIMES.zoom);
    expect(TIMES.title).toBeGreaterThan(TIMES.arrive);
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

describe("zoomFor", () => {
  const viewport = { w: 1920, h: 1080 };

  it("zooms until the round window covers the screen's diagonal", () => {
    const z = zoomFor(viewport, 1850 / 850, 0.049);
    const diameterOnScreen = 2 * 0.049 * Math.max(1920, 1080 * (1850 / 850)) * z;
    expect(diameterOnScreen).toBeGreaterThanOrEqual(Math.hypot(1920, 1080) * 0.99);
  });

  it("zooms more for a smaller window, and is kept within sane limits", () => {
    expect(zoomFor(viewport, 1.78, 0.03)).toBeGreaterThan(zoomFor(viewport, 1.78, 0.06));
    expect(zoomFor(viewport, 1.78, 0.001)).toBe(16);
    expect(zoomFor(viewport, 1.78, 0.9)).toBe(3);
  });

  it("also works on a phone-shaped screen, where the cover-fitted picture is wider than the screen", () => {
    const phone = zoomFor({ w: 390, h: 844 }, 1.78, 0.049);
    expect(phone).toBeGreaterThanOrEqual(3);
    expect(phone).toBeLessThanOrEqual(16);
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
