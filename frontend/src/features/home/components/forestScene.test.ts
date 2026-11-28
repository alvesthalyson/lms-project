import { describe, expect, it } from "vitest";

import { FOREST, POSTER, TIMES, VIDEO, VIDEO_SECONDS, endDelay, fireflies, forestAssets, paragraphAt, paragraphTimes, scrollKeyframes, scrollSeconds } from "./forestScene";
import { STORIES, storyFor } from "./stories";

describe("forest timeline", () => {
  it("lets the text rise as long as the story takes to tell, then shows the ending", () => {
    for (const lang of ["pt", "en", "ja"] as const) {
      const { paragraphs } = STORIES[lang];
      const seconds = scrollSeconds(paragraphs, lang);
      expect(seconds).toBeGreaterThan(25);
      expect(seconds).toBeLessThan(160);
      expect(endDelay(paragraphs, lang)).toBeGreaterThan(TIMES.scrollStart + seconds);
    }
    expect(scrollSeconds(["a b c d"], "en")).toBeLessThan(scrollSeconds(["a b c d e f g h"], "en"));
  });

  it("takes its length from the recorded narration when there is one", () => {
    const manifest = { texts: ["a", "b"], pause: 1, clips: [{ file: "a", seconds: 30 }, { file: "b", seconds: 40 }] };
    const paragraphs = STORIES.pt.paragraphs.slice(0, 2);
    expect(scrollSeconds(paragraphs, "pt", manifest)).toBe(71);
    expect(endDelay(paragraphs, "pt", manifest)).toBeCloseTo(TIMES.scrollStart + 72, 5);
    expect(paragraphAt(paragraphs, "pt", TIMES.scrollStart + 31.5, manifest)).toBe(1);
  });

  it("times each paragraph, from the recording when there is one", () => {
    const manifest = { texts: ["a", "b"], pause: 1, clips: [{ file: "a", seconds: 30 }, { file: "b", seconds: 40 }] };
    expect(paragraphTimes(["a", "b"], "pt", manifest)).toEqual([{ start: 0, end: 30 }, { start: 31, end: 71 }]);
    const guess = paragraphTimes(STORIES.en.paragraphs, "en");
    expect(guess).toHaveLength(STORIES.en.paragraphs.length);
    guess.forEach((time, i) => {
      expect(time.end).toBeGreaterThan(time.start);
      if (i > 0) expect(time.start).toBeGreaterThan(guess[i - 1]!.end); // a breath between paragraphs
    });
    expect(guess[guess.length - 1]!.end).toBeLessThanOrEqual(scrollSeconds(STORIES.en.paragraphs, "en"));
  });

  it("keeps the words being told on the reading line: each paragraph's top at its start, its bottom at its end", () => {
    const boxes = [{ top: 200, height: 100 }, { top: 330, height: 60 }];
    const times = [{ start: 0, end: 10 }, { start: 12, end: 20 }];
    const frames = scrollKeyframes(boxes, times, 200, 21);
    // the reading line is at half the height (100 px): the block moves up by (position - 100)
    expect(frames.map((f) => f.transform)).toEqual(["translateY(-100px)", "translateY(-200px)", "translateY(-230px)", "translateY(-290px)", "translateY(-290px)"]);
    expect(frames[0]!.offset).toBe(0);
    expect(frames[frames.length - 1]!.offset).toBe(1);
    for (let i = 1; i < frames.length; i += 1) expect(frames[i]!.offset).toBeGreaterThanOrEqual(frames[i - 1]!.offset);
    expect(scrollKeyframes([], [], 200, 20)).toEqual([]);
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
