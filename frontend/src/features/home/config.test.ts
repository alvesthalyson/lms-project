import { describe, expect, it } from "vitest";

import { categoryKey, HOME_ROOMS, placeCategories, ROOM_ORDER, type Hotspot } from "./config";

function everyHotspot(): Array<[string, Hotspot]> {
  return ROOM_ORDER.flatMap((id) => {
    const room = HOME_ROOMS[id];
    return [...room.shelves, ...room.portals, ...(room.picks ? [room.picks] : [])].map((h): [string, Hotspot] => [id, h]);
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

  it("leaves unknown categories for the unsigned room, then the dock", () => {
    const all = [cat(1, "Poesia"), cat(2, "Culinária"), cat(3, "Viagens"), cat(4, "Jogos"), cat(5, "Humor"), cat(6, "Música"), cat(7, "Esportes")];
    const { byRoom, placed } = placeCategories(all);
    expect(byRoom.library.map((p) => p.category.id)).toEqual([1]);
    expect(byRoom.upstairs.map((p) => p.category.id)).toEqual([2, 3, 4, 5, 6]); // five bookcases upstairs
    expect(placed.has(7)).toBe(false); // only in the dock
  });
});
