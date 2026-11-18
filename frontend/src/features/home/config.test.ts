import { describe, expect, it } from "vitest";

import { categoryKey, HOME_ROOMS, placeCategories, shapePoints, ROOM_ORDER, type Hotspot } from "./config";

function everyHotspot(): Array<[string, Hotspot]> {
  return ROOM_ORDER.flatMap((id) => {
    const room = HOME_ROOMS[id];
    return [...room.shelves, ...room.portals, ...(room.picks ? [room.picks] : []), ...(room.globe ? [room.globe] : [])].map((h): [string, Hotspot] => [id, h]);
  });
}

describe("HOME_ROOMS", () => {
  it("keeps every hotspot inside its picture", () => {
    for (const [, h] of everyHotspot()) {
      expect(h.left).toBeGreaterThanOrEqual(0);
      expect(h.top).toBeGreaterThanOrEqual(0);
      expect(h.left + h.width).toBeLessThanOrEqual(1);
      expect(h.top + h.height).toBeLessThanOrEqual(1);
    }
  });

  it("has unique hotspot ids inside each room", () => {
    for (const id of ROOM_ORDER) {
      const room = HOME_ROOMS[id];
      const ids = [...room.shelves, ...room.portals, ...(room.picks ? [room.picks] : [])].map((h) => h.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("only has portals that lead to an existing room, and every room can be left", () => {
    for (const id of ROOM_ORDER) {
      expect(HOME_ROOMS[id].portals.length).toBeGreaterThan(0);
      for (const portal of HOME_ROOMS[id].portals) expect(HOME_ROOMS[portal.to]).toBeDefined();
    }
  });

  it("ties every bookcase of the signed room to one distinct category name", () => {
    const keys = HOME_ROOMS.library.shelves.map((h) => h.category);
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["poesia", "arte", "programacao", "ficcao", "ciencia", "historia", "filosofia", "romance"]);
  });
});

describe("placeCategories", () => {
  const cat = (id: number, name: string, slug = categoryKey(name)) => ({ id, name, slug });

  it("puts each category on the sign with its name, whatever the list order", () => {
    const { byRoom } = placeCategories([cat(1, "Romance"), cat(2, "Poesia"), cat(3, "Programação")]);
    const byId = Object.fromEntries(byRoom.library.map((p) => [p.spot.id, p.category.id]));
    expect(byId).toEqual({ "sign-poesia": 2, "sign-programacao": 3, "sign-romance": 1 });
  });

  it("matches by name without accents when the slug is different", () => {
    const { byRoom } = placeCategories([cat(9, "História", "hist-1")]);
    expect(byRoom.library.map((p) => p.spot.id)).toEqual(["sign-historia"]);
  });

  it("leaves unknown categories for the dock", () => {
    const all = [cat(1, "Poesia"), cat(2, "Culinária"), cat(3, "Viagens"), cat(4, "Mistério")];
    const { byRoom, placed } = placeCategories(all);
    expect(byRoom.library.map((p) => p.category.id)).toEqual([1]);
    expect(byRoom.upstairs.map((p) => p.spot.id)).toEqual(["sign-misterio"]);
    expect(placed.has(2)).toBe(false); // only in the dock
  });
});

describe("the ground floor", () => {
  it("has the plaques painted in English and Japanese, in the light and in the night picture", () => {
    const room = HOME_ROOMS.library;
    expect(room.backgroundByLang).toEqual({ en: "/biblioteca-en.jpg", ja: "/biblioteca-ja.jpg" });
    expect(room.backgroundDarkByLang).toEqual({ en: "/biblioteca-noite-en.jpg", ja: "/biblioteca-noite-ja.jpg" });
  });
});

describe("the second floor", () => {
  it("has the plaques painted in English and Japanese too", () => {
    expect(HOME_ROOMS.upstairs.backgroundByLang).toEqual({ en: "/sala-2-en.jpg", ja: "/sala-2-ja.jpg" });
  });

  it("has the armillary sphere as the globe, outlined along its own shape", () => {
    const globe = HOME_ROOMS.upstairs.globe!;
    expect(globe.shape!.length).toBeGreaterThan(8);
    expect(HOME_ROOMS.library.globe).toBeUndefined();
  });

  it("has two bookcases on the right and two at the back for the four extra categories", () => {
    expect(HOME_ROOMS.upstairs.shelves.map((s) => s.category)).toEqual(["fantasia", "aventura", "misterio", "biografia"]);
    expect(HOME_ROOMS.upstairs.signs).toBe(true);
  });
});

describe("outlines", () => {
  const shaped = (): Array<[string, Hotspot]> => everyHotspot().filter(([, h]) => h.shape);
  const staircase = HOME_ROOMS.library.portals[0]!;

  it("gives every plaque, the open book and the staircase of the signed room their own outline", () => {
    const room = HOME_ROOMS.library;
    for (const h of [...room.shelves, ...room.portals, room.picks!]) expect(h.shape?.length, h.id).toBeGreaterThanOrEqual(4);
    expect(staircase.shape!.length).toBeGreaterThan(8);
    expect(room.picks!.shape!.length).toBeGreaterThan(8);
  });

  it("keeps each outline inside its own box, which is its bounding box", () => {
    for (const [, h] of shaped()) {
      const xs = h.shape!.map(([x]) => x);
      const ys = h.shape!.map(([, y]) => y);
      expect(Math.min(...xs)).toBeCloseTo(h.left, 3);
      expect(Math.max(...xs)).toBeCloseTo(h.left + h.width, 3);
      expect(Math.min(...ys)).toBeCloseTo(h.top, 3);
      expect(Math.max(...ys)).toBeCloseTo(h.top + h.height, 3);
    }
  });

  it("turns an outline into 0..100 points of the box, and leaves plain rectangles alone", () => {
    for (const [, h] of shaped()) {
      const points = shapePoints(h)!.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
      expect(points).toHaveLength(h.shape!.length);
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(-0.5);
        expect(x).toBeLessThanOrEqual(100.5);
        expect(y).toBeGreaterThanOrEqual(-0.5);
        expect(y).toBeLessThanOrEqual(100.5);
      }
    }
    expect(shapePoints({ id: "plain", left: 0.1, top: 0.1, width: 0.1, height: 0.1, rotate: 0, skewY: 0 })).toBeNull();
  });
});
