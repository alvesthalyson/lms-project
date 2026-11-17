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
  /**
   * Outline of the clickable area, as [x, y] fractions of the picture, so a plaque, a book or a staircase
   * is clickable (and glows) along its own borders and not as a rectangle. The hotspot box must be the
   * bounding box of these points. Without it the hotspot is a plain rectangle.
   */
  shape?: ReadonlyArray<readonly [number, number]>;
}

/** Pixel size of the picture of the signed room, in which the outlines below were traced. */
const LIBRARY_PX = { w: 1850, h: 850 } as const;

/** Turn an outline traced in picture pixels into a hotspot box plus `shape` (fractions of the picture). */
function traced(points: ReadonlyArray<readonly [number, number]>): Pick<Hotspot, "left" | "top" | "width" | "height" | "shape"> {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return {
    left: x0 / LIBRARY_PX.w,
    top: y0 / LIBRARY_PX.h,
    width: (x1 - x0) / LIBRARY_PX.w,
    height: (y1 - y0) / LIBRARY_PX.h,
    shape: points.map(([x, y]) => [x / LIBRARY_PX.w, y / LIBRARY_PX.h] as const),
  };
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
// its sign and is tied to its category by name (see `category`). Outlines are traced on the 1850x850 picture.
const LIBRARY: Room = {
  id: "library",
  background: "/biblioteca.jpg",
  aspect: 1850 / 850,
  signs: true,
  shelves: [
    { id: "sign-poesia", category: "poesia", rotate: 0, skewY: 0, ...traced([[152, 175], [239, 199], [239, 278], [152, 260]]) },
    { id: "sign-arte", category: "arte", rotate: 0, skewY: 0, ...traced([[120, 321], [241, 341], [241, 384], [122, 364]]) },
    { id: "sign-programacao", category: "programacao", rotate: 0, skewY: 0, ...traced([[1661, 90], [1843, 27], [1843, 84], [1663, 143]]) },
    { id: "sign-ficcao", category: "ficcao", rotate: 0, skewY: 0, ...traced([[1622, 355], [1743, 333], [1743, 386], [1623, 401]]) },
    { id: "sign-ciencia", category: "ciencia", rotate: 0, skewY: 0, ...traced([[1346, 373], [1436, 364], [1437, 396], [1348, 403]]) },
    { id: "sign-historia", category: "historia", rotate: 0, skewY: 0, ...traced([[1158, 413], [1238, 411], [1238, 432], [1158, 434]]) },
    { id: "sign-filosofia", category: "filosofia", rotate: 0, skewY: 0, ...traced([[714, 420], [819, 426], [820, 449], [716, 449]]) },
    { id: "sign-romance", category: "romance", rotate: 0, skewY: 0, ...traced([[1597, 601], [1707, 608], [1708, 651], [1593, 637]]) },
  ],
  portals: [
    // the spiral staircase, clickable along its own outline (its right side follows only the handrail): no text, just a golden glow
    { id: "spiral-staircase", to: "upstairs", label: "Subir ao segundo andar", glow: true, rotate: 0, skewY: 0, ...traced([
        [560, 210], [600, 226], [640, 243], [666, 257], [689, 276], [700, 294],
        [702, 308], [690, 321], [675, 329], [655, 343], [639, 356], [620, 364],
        [603, 372], [585, 380], [570, 388], [554, 399], [543, 414], [540, 424],
        [546, 450], [552, 485], [557, 520], [557, 545], [557, 584], [567, 598],
        [594, 614], [627, 637], [621, 656], [599, 668], [571, 677], [520, 681],
        [420, 682], [330, 682], [283, 678], [298, 655], [304, 610], [304, 560],
        [304, 500], [305, 476], [309, 440], [312, 415], [322, 401], [343, 402],
        [344, 448], [352, 452], [374, 436], [405, 419], [436, 403], [467, 391],
        [499, 377], [524, 364], [546, 349], [556, 338], [558, 300], [558, 270],
        [559, 240],
    ]) },
  ],
  // the open book on the foreground desk, with "Indicação" written on its pages. It is not a category.
  picks: { id: "open-book", rotate: 0, skewY: 0, ...traced([
        [200, 706], [212, 702], [228, 700], [250, 696], [275, 694], [300, 693],
        [318, 698], [330, 706], [345, 700], [365, 697], [385, 697], [405, 702],
        [425, 710], [445, 720], [465, 730], [485, 741], [505, 754], [520, 766],
        [532, 775], [530, 781], [515, 782], [485, 783], [450, 785], [420, 792],
        [405, 797], [380, 797], [350, 798], [320, 800], [290, 803], [270, 810],
        [255, 818], [248, 816], [235, 800], [220, 780], [208, 760], [202, 740],
        [200, 720],
  ]) },
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

/** The outline of a hotspot as SVG `points` in its own box (0..100 on both axes), or null for a plain rectangle. */
export function shapePoints(spot: Hotspot): string | null {
  if (!spot.shape || spot.shape.length < 3) return null;
  const pct = (value: number): string => (Math.round(value * 100) / 100).toString();
  return spot.shape
    .map(([x, y]) => `${pct(((x - spot.left) / spot.width) * 100)},${pct(((y - spot.top) / spot.height) * 100)}`)
    .join(" ");
}
