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
  /**
   * For a bookcase with a sign painted in the picture: the category it belongs to (the slug, or the name
   * without accents). Such a hotspot always opens that category, whatever the order of the API list.
   */
  category?: string;
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
  /** The names are painted in the picture (signs, the open book): the text labels stay invisible (screen readers only). */
  signs?: boolean;
}

// The ground floor. The picture has the category names painted on wooden signs, so each hotspot sits on
// its sign and is tied to its category by name (see `category`). Boxes are fractions of the 1850x850 picture.
const LIBRARY: Room = {
  id: "library",
  background: "/biblioteca.jpg",
  aspect: 1850 / 850,
  signs: true,
  shelves: [
    { id: "sign-poesia", category: "poesia", left: 0.078, top: 0.2, width: 0.056, height: 0.13, rotate: 0, skewY: 0 },
    { id: "sign-arte", category: "arte", left: 0.062, top: 0.378, width: 0.074, height: 0.075, rotate: 0, skewY: 0 },
    { id: "sign-programacao", category: "programacao", left: 0.893, top: 0.03, width: 0.105, height: 0.13, rotate: 0, skewY: 0 },
    { id: "sign-ficcao", category: "ficcao", left: 0.872, top: 0.388, width: 0.074, height: 0.085, rotate: 0, skewY: 0 },
    { id: "sign-ciencia", category: "ciencia", left: 0.724, top: 0.425, width: 0.056, height: 0.05, rotate: 0, skewY: 0 },
    { id: "sign-historia", category: "historia", left: 0.724, top: 0.49, width: 0.062, height: 0.046, rotate: 0, skewY: 0 },
    { id: "sign-filosofia", category: "filosofia", left: 0.383, top: 0.49, width: 0.062, height: 0.046, rotate: 0, skewY: 0 },
    { id: "sign-romance", category: "romance", left: 0.857, top: 0.7, width: 0.07, height: 0.065, rotate: 0, skewY: 0 },
  ],
  portals: [
    // the spiral staircase: no text, just a golden glow
    { id: "spiral-staircase", to: "upstairs", label: "Subir ao segundo andar", glow: true, left: 0.17, top: 0.3, width: 0.2, height: 0.46, rotate: 0, skewY: 0 },
  ],
  // the open book on the foreground desk, with "Indicação" written on its pages. It is not a category.
  picks: { id: "open-book", left: 0.108, top: 0.815, width: 0.178, height: 0.14, rotate: 0, skewY: 0 },
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

/** Lowercase, no accents: "Programação" -> "programacao". */
export function categoryKey(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

interface CategoryLike {
  id: number;
  name: string;
  slug: string;
}

export interface Placement<C extends CategoryLike = CategoryLike> {
  spot: Hotspot;
  category: C;
}

/**
 * Decide which category stands on which bookcase.
 * 1. A bookcase with a painted sign takes the category that has that name.
 * 2. The other bookcases (unsigned rooms) take the remaining categories, room after room, in list order.
 * Categories left over appear only in the bottom dock.
 */
export function placeCategories<C extends CategoryLike>(categories: readonly C[]): { byRoom: Record<RoomId, Placement<C>[]>; placed: Set<number> } {
  const byRoom: Record<RoomId, Placement<C>[]> = { library: [], upstairs: [] };
  const placed = new Set<number>();

  for (const roomId of ROOM_ORDER) {
    for (const spot of HOME_ROOMS[roomId].shelves) {
      if (!spot.category) continue;
      const category = categories.find((c) => !placed.has(c.id) && (categoryKey(c.slug) === spot.category || categoryKey(c.name) === spot.category));
      if (category) {
        byRoom[roomId].push({ spot, category });
        placed.add(category.id);
      }
    }
  }
  const rest = categories.filter((c) => !placed.has(c.id));
  let next = 0;
  for (const roomId of ROOM_ORDER) {
    for (const spot of HOME_ROOMS[roomId].shelves) {
      if (spot.category) continue;
      const category = rest[next];
      if (!category) return { byRoom, placed };
      next += 1;
      byRoom[roomId].push({ spot, category });
      placed.add(category.id);
    }
  }
  return { byRoom, placed };
}
