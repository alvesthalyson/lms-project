import { describe, expect, it } from "vitest";

import { between, dragged, invert, linePath, project, ringContains, ringPath, wrapLon } from "./geo";
import { countryName, flagOf } from "./world";

const brazilCentre = { lon: -50, lat: -10 };

describe("project / invert", () => {
  it("puts the centre of the view in the middle of the disc", () => {
    const p = project(-50, -10, brazilCentre);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.visible).toBe(true);
  });

  it("puts east to the right and north up", () => {
    expect(project(-30, -10, brazilCentre).x).toBeGreaterThan(0);
    expect(project(-50, 20, brazilCentre).y).toBeLessThan(0);
  });

  it("hides the other side of the Earth", () => {
    expect(project(130, 10, brazilCentre).visible).toBe(false);
    expect(project(-45, -5, brazilCentre).visible).toBe(true);
  });

  it("inverts a projected point back to where it came from", () => {
    for (const [lon, lat] of [[-43, -22], [-60, 5], [-20, -30], [-50, -10]] as const) {
      const p = project(lon, lat, brazilCentre);
      const back = invert(p.x, p.y, brazilCentre)!;
      expect(back.lon).toBeCloseTo(lon, 4);
      expect(back.lat).toBeCloseTo(lat, 4);
    }
  });

  it("finds nothing outside the disc", () => {
    expect(invert(1.2, 0, brazilCentre)).toBeNull();
  });
});

describe("paths", () => {
  const square = [-52, -12, -48, -12, -48, -8, -52, -8];

  it("draws a ring that faces us and skips one that does not", () => {
    expect(ringPath(square, brazilCentre, 200, 200, 190)).toMatch(/^M.*Z$/);
    expect(ringPath([128, 8, 132, 8, 132, 12, 128, 12], brazilCentre, 200, 200, 190)).toBeNull();
  });

  it("keeps every point of a ring that sticks over the horizon inside the disc", () => {
    const d = ringPath([-50, 0, 40, 0, 40, 30], { lon: -50, lat: 0 }, 0, 0, 100)!;
    for (const [x, y] of [...d.matchAll(/(-?\d+\.\d),(-?\d+\.\d)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)) {
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(100.2);
    }
  });

  it("breaks a graticule line where it goes behind the globe", () => {
    const meridian: Array<[number, number]> = [];
    for (let lat = -80; lat <= 80; lat += 10) meridian.push([130, lat]);
    expect(linePath(meridian, brazilCentre, 0, 0, 100)).toBe("");
  });
});

describe("moving the globe", () => {
  it("follows a drag: dragging right shows what lies to the west", () => {
    const r = dragged({ lon: 0, lat: 0 }, 50, 0, 190);
    expect(r.lon).toBeLessThan(0);
    expect(dragged({ lon: 0, lat: 0 }, 0, 100000, 190).lat).toBeLessThanOrEqual(80);
  });

  it("wraps longitudes and takes the short way round", () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    const half = between({ lon: 170, lat: 0 }, { lon: -170, lat: 0 }, 0.5);
    expect(Math.abs(half.lon)).toBeCloseTo(180, 6);
  });

  it("tells whether a point is inside a ring", () => {
    const square = [0, 0, 10, 0, 10, 10, 0, 10];
    expect(ringContains(square, 5, 5)).toBe(true);
    expect(ringContains(square, 15, 5)).toBe(false);
  });
});

describe("country names and flags", () => {
  it("gives the name in the language asked for, and the code when unknown", () => {
    expect(countryName("BR", "en")).toBe("Brazil");
    expect(countryName("JP", "pt")).toBe("Japão");
    expect(countryName("ZZ", "en")).toBeTruthy();
  });

  it("builds the flag emoji from the code", () => {
    expect(flagOf("BR")).toBe("🇧🇷");
    expect(flagOf("br")).toBe("");
  });
});
