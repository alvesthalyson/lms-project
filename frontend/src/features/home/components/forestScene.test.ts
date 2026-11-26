import { describe, expect, it } from "vitest";

import { FOREST, POSTER, TIMES, VIDEO, VIDEO_SECONDS, endDelay, fireflies, forestAssets, paragraphAt, scrollSeconds } from "./forestScene";
import { STORIES, storyFor } from "./stories";

describe("forest timeline", () => {
  it("lets the text rise as long as the story takes to tell, then shows the ending", () => {
    for (const lang of ["pt", "en", "ja"] as const) {
      const { paragraphs } = STORIES[lang];
      const seconds = scrollSeconds(paragraphs, lang);
      expect(seconds).toBeGreaterThan(25);
      expect(seconds).toBeLessThan(120);
      expect(endDelay(paragraphs, lang)).toBeGreaterThan(TIMES.scrollStart + seconds);
    }
    expect(scrollSeconds(["a b c d"], "en")).toBeLessThan(scrollSeconds(["a b c d e f g h"], "en"));
  });

  it("finds the paragraph the narrator should be on, from the first to the end", () => {
    const { paragraphs } = STORIES.en;
    expect(paragraphAt(paragraphs, "en", 0)).toBe(0);
    expect(paragraphAt(paragraphs, "en", TIMES.scrollStart + 1)).toBe(0);
    const middle = paragraphAt(paragraphs, "en", TIMES.scrollStart + scrollSeconds(paragraphs, "en") / 2);
    expect(middle).toBeGreaterThan(1);
    expect(middle).toBeLessThan(paragraphs.length - 1);
    expect(paragraphAt(paragraphs, "en", 1000)).toBe(paragraphs.length);
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

describe("stories", () => {
  it("are three, one for each language of the site, each with a title, a category and several paragraphs", () => {
    expect(Object.keys(STORIES).sort()).toEqual(["en", "ja", "pt"]);
    expect(new Set(Object.values(STORIES).map((story) => story.id)).size).toBe(3);
    for (const lang of ["pt", "en", "ja"] as const) {
      const story = storyFor(lang);
      expect(story).toBe(STORIES[lang]);
      expect(story.title.trim()).not.toBe("");
      expect(story.category).toMatch(/^[a-z]+$/);
      expect(story.paragraphs.length).toBeGreaterThanOrEqual(5);
      for (const paragraph of story.paragraphs) expect(paragraph.trim().length).toBeGreaterThan(20);
    }
  });
});
