import { describe, expect, it } from "vitest";

import { archPathData, NOOK_ASPECT } from "./frame";
import { computeNookGeometry, parallaxOffsets } from "./geometry";
import { createRng, shade } from "./random";

describe("computeNookGeometry", () => {
  it("uses 68% of the height on a landscape screen and keeps the nook's aspect ratio", () => {
    const g = computeNookGeometry(1440, 900);
    expect(g.nook.height).toBeCloseTo(612);
    expect(g.nook.width / g.nook.height).toBeCloseTo(NOOK_ASPECT);
    expect(g.nook.x + g.nook.width / 2).toBeCloseTo(720); // centred
    expect(g.nook.y).toBeCloseTo(180);
  });

  it("limits the width on a tall, narrow phone so the nook never overflows", () => {
    const g = computeNookGeometry(390, 844);
    expect(g.nook.width).toBeLessThanOrEqual(390 * 0.92 + 0.001);
  });

  it("keeps the opening inside the frame", () => {
    const { nook, opening } = computeNookGeometry(1440, 900);
    expect(opening.x).toBeGreaterThan(0);
    expect(opening.y).toBeGreaterThan(0);
    expect(opening.x + opening.width).toBeLessThan(nook.width);
    expect(opening.y + opening.height).toBeLessThan(nook.height);
  });
});

describe("parallaxOffsets", () => {
  it("moves the front layer further than the back layer, in the opposite direction of the pointer", () => {
    const [back, mid, front] = parallaxOffsets(1, 0);
    expect(back.x).toBeLessThan(0);
    expect(Math.abs(front.x)).toBeGreaterThan(Math.abs(mid.x));
    expect(Math.abs(mid.x)).toBeGreaterThan(Math.abs(back.x));
  });

  it("is still when the pointer is centred", () => {
    for (const o of parallaxOffsets(0, 0)) {
      expect(Math.abs(o.x)).toBe(0);
      expect(Math.abs(o.y)).toBe(0);
    }
  });
});

describe("archPathData", () => {
  it("starts and ends on the bottom edge of the opening and closes the path", () => {
    const d = archPathData({ x: 10, y: 20, width: 100, height: 300 });
    expect(d.startsWith("M10,320")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("L110,320"); // right bottom corner
  });
});

describe("random helpers", () => {
  it("the generator is deterministic for a seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("shade scales brightness and clamps to the valid range", () => {
    expect(shade("#808080", 0.5)).toBe("rgb(64,64,64)");
    expect(shade("#ffffff", 2)).toBe("rgb(255,255,255)");
    expect(shade("#000000", 3)).toBe("rgb(0,0,0)");
  });
});
