import { describe, expect, it } from "vitest";

import { FIRST_ROOM, firstCategoryIndex, HOME_ROOMS, ROOM_ORDER, TOTAL_SHELVES, type Hotspot } from "./config";

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

  it("fills rooms in order: the second room starts after the shelves of the first", () => {
    expect(firstCategoryIndex(FIRST_ROOM)).toBe(0);
    expect(firstCategoryIndex("upstairs")).toBe(HOME_ROOMS.library.shelves.length);
    expect(TOTAL_SHELVES).toBe(HOME_ROOMS.library.shelves.length + HOME_ROOMS.upstairs.shelves.length);
  });
});
