/**
 * Configuration of the point-and-click Home: the rooms, their pictures and where things are in them.
 *
 * - Replace `public/sua-imagem-de-fundo.jpg` / `public/sala-2.jpg` (or change the URLs) to use other pictures.
 * - If a picture has a different aspect ratio, update its `aspect` and re-measure its hotspots.
 * - The pictures are cover-fitted, so on screens squarer than the picture its left and right edges are
 *   cropped: keep hotspots (and their labels) within roughly 8%..92% horizontally so they stay visible.
 */

/**
 * A clickable area, as fractions (0..1) of the picture.
 * `rotate` / `skewY` tilt its label (degrees) so the text lies in the plane of the shelf it names.
 */
export interface Hotspot {
  /** Short name of the place in the picture, used only for documentation/tests. */
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Clockwise is positive. */
  rotate: number;
  skewY: number;
}

export type RoomId = "library" | "upstairs";

/** A hotspot that takes the visitor to another room (a staircase, a doorway). */
export interface Portal extends Hotspot {
  to: RoomId;
  /** Accessible name, and the text of the label when the portal is not `glow`. */
  label: string;
  /** Show only a soft golden glow (no text) instead of a label. */
  glow?: boolean;
}

export interface Room {
  id: RoomId;
  background: string;
  /** Width / height of the picture. */
  aspect: number;
  /** Bookcases. Categories from the API are assigned to them in order, across rooms. */
  shelves: readonly Hotspot[];
  portals: readonly Portal[];
  /** The "Indicação" book, if this room has one. */
  picks?: Hotspot;
}

const LIBRARY: Room = {
  id: "library",
  background: "/sua-imagem-de-fundo.jpg",
  aspect: 1672 / 941,
  shelves: [
    // shelves on the left wall descend towards the vanishing point (to the right); on the right wall, to the left
    { id: "left-map-bookcases", left: 0.08, top: 0.3, width: 0.12, height: 0.25, rotate: 4, skewY: 3 },
    { id: "ladder-bookcases", left: 0.71, top: 0.32, width: 0.12, height: 0.3, rotate: -3, skewY: -2 },
    { id: "right-wall-bookcases", left: 0.86, top: 0.25, width: 0.08, height: 0.38, rotate: -4, skewY: -3 },
    { id: "back-left-alcoves", left: 0.38, top: 0.47, width: 0.1, height: 0.12, rotate: 2, skewY: 1 },
    { id: "back-right-alcoves", left: 0.64, top: 0.46, width: 0.1, height: 0.13, rotate: -2, skewY: -1 },
    { id: "left-upper-bookcases", left: 0.1, top: 0.1, width: 0.12, height: 0.17, rotate: 5, skewY: 4 },
    { id: "gallery-bookcases", left: 0.73, top: 0.03, width: 0.1, height: 0.2, rotate: -4, skewY: -3 },
    { id: "chest-and-table", left: 0.8, top: 0.66, width: 0.12, height: 0.12, rotate: 4, skewY: 3 },
  ],
  portals: [
    // the spiral staircase: no text, just a golden glow
    { id: "spiral-staircase", to: "upstairs", label: "Subir ao segundo andar", glow: true, left: 0.17, top: 0.3, width: 0.2, height: 0.46, rotate: 0, skewY: 0 },
  ],
  // the open book on the foreground desk. It is not a category: it opens the "Indicação" list
  picks: { id: "open-book", left: 0.13, top: 0.78, width: 0.16, height: 0.08, rotate: 0, skewY: 2 },
};

// The second floor: the blue, magical library, with the same spiral staircase leading back down.
const UPSTAIRS: Room = {
  id: "upstairs",
  background: "/sala-2.jpg",
  aspect: 1672 / 941,
  shelves: [
    { id: "ladder-bookcase", left: 0.71, top: 0.3, width: 0.12, height: 0.34, rotate: -3, skewY: -2 },
    { id: "far-right-bookcase", left: 0.86, top: 0.12, width: 0.07, height: 0.45, rotate: -4, skewY: -3 },
    { id: "gallery-bookcases", left: 0.73, top: 0.08, width: 0.1, height: 0.18, rotate: -4, skewY: -3 },
    { id: "back-left-alcove", left: 0.26, top: 0.45, width: 0.08, height: 0.15, rotate: 2, skewY: 1 },
    { id: "desk-with-scrolls", left: 0.55, top: 0.7, width: 0.25, height: 0.12, rotate: 5, skewY: 3 },
  ],
  portals: [{ id: "staircase-down", to: "library", label: "Descer ao andar de baixo", glow: true, left: 0.1, top: 0.42, width: 0.2, height: 0.38, rotate: 0, skewY: 0 }],
};

export const HOME_ROOMS: Readonly<Record<RoomId, Room>> = { library: LIBRARY, upstairs: UPSTAIRS };
export const FIRST_ROOM: RoomId = "library";

/** Room order, for assigning categories to shelves. */
export const ROOM_ORDER: readonly RoomId[] = ["library", "upstairs"];

/** Total number of shelves across all rooms: more categories than this only appear in the bottom buttons. */
export const TOTAL_SHELVES = ROOM_ORDER.reduce((sum, id) => sum + HOME_ROOMS[id].shelves.length, 0);

/** Index of the first category shown in a room (the rooms are filled one after the other). */
export function firstCategoryIndex(room: RoomId): number {
  let offset = 0;
  for (const id of ROOM_ORDER) {
    if (id === room) return offset;
    offset += HOME_ROOMS[id].shelves.length;
  }
  return offset;
}
