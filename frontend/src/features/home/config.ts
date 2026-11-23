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

/** Pixel size of the pictures, in which the outlines below were traced. */
const LIBRARY_PX = { w: 1850, h: 850 } as const;
const UPSTAIRS_PX = { w: 1672, h: 941 } as const;

/** Turn an outline traced in picture pixels into a hotspot box plus `shape` (fractions of the picture). */
function traced(
  points: ReadonlyArray<readonly [number, number]>,
  px: { readonly w: number; readonly h: number } = LIBRARY_PX,
): Pick<Hotspot, "left" | "top" | "width" | "height" | "shape"> {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return {
    left: x0 / px.w,
    top: y0 / px.h,
    width: (x1 - x0) / px.w,
    height: (y1 - y0) / px.h,
    shape: points.map(([x, y]) => [x / px.w, y / px.h] as const),
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
  /** Picture for the dark theme (a night version of the same scene, so every hotspot stays in place). Defaults to `background`. */
  backgroundDark?: string;
  /** Pictures for other languages (key: language code), for rooms whose painted plaques carry text. Falls back to `background`. */
  backgroundByLang?: Readonly<Record<string, string>>;
  /** The same for the dark theme (night picture). */
  backgroundDarkByLang?: Readonly<Record<string, string>>;
  /** Width / height of the picture. */
  aspect: number;
  /** Bookcases. Categories from the API are assigned to them in order, across rooms. */
  shelves: readonly Hotspot[];
  // the great stained-glass rosette at the back of the hall: a rose of glass, one petal per category
  rose: { id: "rose-window", rotate: 0, skewY: 0, ...traced([[1108, 307], [1106, 322], [1100, 336], [1091, 348], [1079, 357], [1065, 363], [1050, 365], [1035, 363], [1021, 357], [1009, 348], [1000, 336], [994, 322], [992, 307], [994, 292], [1000, 278], [1009, 266], [1021, 257], [1035, 251], [1050, 249], [1065, 251], [1079, 257], [1091, 266], [1100, 278], [1106, 292]]) },
  portals: readonly Portal[];
  /** The "Indicação" book, if this room has one. */
  picks?: Hotspot;
  /** The armillary sphere: opens the globe ("Literary journey"). */
  globe?: Hotspot;
  /** The hourglass: opens the reader's loans and when each is due. */
  hourglass?: Hotspot;
  /** The stained-glass rosette at the back: opens the rose of categories. */
  rose?: Hotspot;
  /** The great open book on the desk: the reader's favourites (wish list). */
  favorites?: Hotspot;
  /** The names are painted in the picture (signs, the open book): the text labels stay invisible (screen readers only). */
  signs?: boolean;
}

// The ground floor. The picture has the category names painted on wooden signs, so each hotspot sits on
// its sign and is tied to its category by name (see `category`). Outlines are traced on the 1850x850 picture.
const LIBRARY: Room = {
  id: "library",
  background: "/biblioteca.jpg", // light theme: the warm, bright picture
  backgroundDark: "/biblioteca-noite.jpg", // dark theme: the same room at night, recoloured
  // the painted plaques of the eight shelves in English and Japanese (the book "Indicação" stays as painted)
  backgroundByLang: { en: "/biblioteca-en.jpg", ja: "/biblioteca-ja.jpg" },
  backgroundDarkByLang: { en: "/biblioteca-noite-en.jpg", ja: "/biblioteca-noite-ja.jpg" },
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
    // the spiral staircase, clickable along its own outline (it follows the two handrails that go down and the steps, ignoring the lamp posts): no text, just a golden glow
    { id: "spiral-staircase", to: "upstairs", label: "Subir ao segundo andar", glow: true, rotate: 0, skewY: 0, ...traced([
        [560, 210], [600, 226], [640, 243], [666, 257], [689, 276], [700, 294],
        [702, 308], [690, 321], [675, 329], [655, 343], [639, 356], [620, 364],
        [603, 372], [585, 380], [570, 388], [556, 398], [556, 450], [557, 520],
        [557, 545], [557, 584], [567, 598], [594, 614], [627, 637], [621, 656],
        [599, 668], [571, 677], [520, 681], [420, 682], [330, 682], [294, 675],
        [306, 586], [306, 490], [318, 480], [337, 474], [346, 459], [361, 446],
        [378, 434], [396, 426], [414, 417], [431, 409], [449, 403], [466, 396],
        [484, 389], [502, 381], [519, 373], [534, 362], [546, 351], [555, 339],
        [559, 291], [560, 250],
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

// The second floor: the blue, magical library, with a round stairwell in the floor leading back down.
const UPSTAIRS: Room = {
  id: "upstairs",
  background: "/sala-2.jpg", // Portuguese plaques
  backgroundByLang: { en: "/sala-2-en.jpg", ja: "/sala-2-ja.jpg" }, // the same room with the plaques in English and Japanese
  backgroundDark: "/sala-2-noite.jpg", // counter mode: the same room at night
  backgroundDarkByLang: { en: "/sala-2-noite-en.jpg", ja: "/sala-2-noite-ja.jpg" },
  aspect: 1672 / 941,
  signs: true,
  // painted category plaques of the second floor (same look as the ground floor): two on the right bookcases, two at the back
  shelves: [
    { id: "sign-fantasia", category: "fantasia", rotate: 0, skewY: 0, ...traced([[1084, 434], [1178, 414], [1178, 446], [1084, 466]], UPSTAIRS_PX) },
    { id: "sign-aventura", category: "aventura", rotate: 0, skewY: 0, ...traced([[1544, 332], [1664, 298], [1664, 342], [1544, 376]], UPSTAIRS_PX) },
    { id: "sign-misterio", category: "misterio", rotate: 0, skewY: 0, ...traced([[448, 447], [534, 447], [534, 478], [448, 478]], UPSTAIRS_PX) },
    { id: "sign-biografia", category: "biografia", rotate: 0, skewY: 0, ...traced([[890, 442], [962, 442], [962, 470], [890, 470]], UPSTAIRS_PX) },
  ],
  // the armillary sphere at the back of the room: the globe of the literary journey
  globe: { id: "armillary-globe", rotate: 0, skewY: 0, ...traced([[715, 490], [719, 495], [719, 500], [727, 502], [736, 507], [744, 507], [744, 511], [738, 516], [737, 524], [738, 531], [733, 536], [726, 541], [721, 546], [729, 556], [727, 560], [707, 560], [703, 556], [710, 547], [706, 543], [700, 538], [695, 532], [689, 531], [688, 527], [696, 520], [699, 510], [705, 504], [712, 500], [712, 495]], UPSTAIRS_PX) },
  // the hourglass on the desk beside the lamp: time running out, so it shows the loans and their due dates
  hourglass: { id: "hourglass", rotate: 0, skewY: 0, ...traced([[1051, 602], [1087, 602], [1088, 608], [1084, 610], [1084, 650], [1086, 660], [1082, 666], [1055, 667], [1051, 660], [1055, 650], [1055, 610], [1051, 607]], UPSTAIRS_PX) },
  // the open book of constellations on the desk: the reader's own favourites, spread open
  favorites: { id: "favorites-book", rotate: 0, skewY: 0, ...traced([[1080, 728], [1105, 708], [1147, 680], [1180, 665], [1203, 663], [1263, 668], [1287, 665], [1370, 670], [1387, 675], [1403, 692], [1390, 703], [1357, 750], [1348, 755], [1300, 745], [1223, 739], [1193, 736], [1137, 730], [1083, 732]], UPSTAIRS_PX) },
  portals: [
    // the steps that go down through the round stairwell in the floor: the way back down (clickable along the outline drawn by hand on the 1672x941 picture)
    { id: "staircase-down", to: "library", label: "Descer ao andar de baixo", glow: true, rotate: 0, skewY: 0, ...traced([
        [543, 676], [542, 738], [544, 759], [548, 762], [551, 771], [551, 789],
        [549, 791], [562, 793], [567, 797], [601, 803], [608, 807], [625, 807],
        [647, 813], [664, 813], [692, 820], [831, 825], [816, 812], [797, 805],
        [790, 806], [783, 801], [783, 783], [768, 770], [736, 750], [687, 727],
        [679, 726], [658, 716], [614, 702], [593, 692], [576, 688], [547, 674],
    ], UPSTAIRS_PX) },
  ],
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
