/**
 * The great hall, painted on a canvas: a gothic window full of afternoon sun, a brass chandelier,
 * two storeys of bookcases with a balcony, ivy, a reading desk, a stone floor and a rug.
 *
 * The composition follows a reference painting of a sunlit library. Nothing is loaded from the
 * network: the picture is generated, so it has no licence to worry about and it is crisp at any size.
 *
 * `HALL_SLOTS` is the single source of truth for where each bookcase is. The painter draws a
 * bookcase in every slot, and the UI places one clickable shelf (a category) over each slot, so the
 * painting and the links can never drift apart.
 */
import { createRng, shade } from "./random";

/** Width / height of the painting. Both the canvas and the CSS cover-fit use it. */
export const HALL_ASPECT = 1.396;
const WIDTH = 1920;
const HEIGHT = Math.round(WIDTH / HALL_ASPECT);

/** A place in the painting where a category's shelf lives. Coordinates are fractions (0..1) of the painting. */
export interface HallSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Arched top (the bay with the carved arch). */
  arch?: boolean;
  /** A free-standing book stack on the floor instead of a bookcase. */
  stand?: boolean;
}

export const HALL_SLOTS: readonly HallSlot[] = [
  { x: 0.2, y: 0.05, width: 0.13, height: 0.25 }, // upper left, behind the balustrade
  { x: 0.345, y: 0.1, width: 0.105, height: 0.22 }, // upper, left of the chandelier
  { x: 0.0, y: 0.44, width: 0.11, height: 0.38 }, // far left wall
  { x: 0.125, y: 0.49, width: 0.085, height: 0.33 }, // left bay
  { x: 0.22, y: 0.53, width: 0.1, height: 0.29, arch: true }, // arched bay
  { x: 0.385, y: 0.545, width: 0.135, height: 0.22 }, // behind the desk
  { x: 0.745, y: 0.52, width: 0.12, height: 0.28 }, // right of the window
  { x: 0.88, y: 0.26, width: 0.12, height: 0.5 }, // far right wall
  { x: 0.76, y: 0.09, width: 0.1, height: 0.34 }, // upper right
  { x: 0.29, y: 0.855, width: 0.075, height: 0.1, stand: true },
  { x: 0.47, y: 0.88, width: 0.075, height: 0.1, stand: true },
  { x: 0.65, y: 0.86, width: 0.075, height: 0.1, stand: true },
];

type Ctx = CanvasRenderingContext2D;

const SPINES = ["#4a2a18", "#5a2220", "#2c3d2a", "#1f2d44", "#6b4a26", "#3b2a3f", "#7a5a30", "#2a2a2a", "#8a3a22", "#35503a", "#a08052", "#442016"] as const;

function pick<T>(items: readonly [T, ...T[]], r: number): T {
  return items[Math.floor(r * items.length)] ?? items[0];
}

function px(fraction: number, axis: "x" | "y"): number {
  return fraction * (axis === "x" ? WIDTH : HEIGHT);
}

/** Soft additive light: a radial gradient painted with `screen`. */
function glow(ctx: Ctx, x: number, y: number, radius: number, rgb: string, alpha: number, squashY = 1): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(x, y);
  ctx.scale(1, squashY);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.45, `rgba(${rgb},${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

/** Pointed (gothic) arch outline: straight sides up to `spring`, then curving to the apex. */
function pointedArch(ctx: Ctx, x0: number, x1: number, spring: number, apex: number, bottom: number): void {
  const cx = (x0 + x1) / 2;
  const rise = spring - apex;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  ctx.lineTo(x0, spring);
  ctx.bezierCurveTo(x0, spring - rise * 0.55, cx - (x1 - x0) * 0.12, apex + rise * 0.16, cx, apex);
  ctx.bezierCurveTo(cx + (x1 - x0) * 0.12, apex + rise * 0.16, x1, spring - rise * 0.55, x1, spring);
  ctx.lineTo(x1, bottom);
  ctx.closePath();
}

function paintWallAndCeiling(ctx: Ctx): void {
  const wall = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  wall.addColorStop(0, "#1a0f08");
  wall.addColorStop(0.45, "#3a2414");
  wall.addColorStop(1, "#2a1a10");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // vaulted ceiling: dark timber ribs fanning towards the window
  ctx.strokeStyle = "rgba(10,5,2,.7)";
  ctx.lineWidth = 14;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(px(0.63 + i * 0.015, "x"), px(0.04, "y"));
    ctx.quadraticCurveTo(px(0.63 + i * 0.12, "x"), px(0.0, "y"), px(0.63 + i * 0.28, "x"), px(-0.02, "y"));
    ctx.stroke();
  }
  // big stone arch framing the window
  ctx.lineWidth = 34;
  ctx.strokeStyle = "#2b1a0e";
  pointedArch(ctx, px(0.535, "x"), px(0.735, "x"), px(0.27, "y"), px(0.045, "y"), px(0.78, "y"));
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(220,170,100,.35)";
  pointedArch(ctx, px(0.545, "x"), px(0.725, "x"), px(0.27, "y"), px(0.06, "y"), px(0.78, "y"));
  ctx.stroke();
}

function paintWindow(ctx: Ctx): void {
  const x0 = px(0.552, "x");
  const x1 = px(0.718, "x");
  const spring = px(0.27, "y");
  const apex = px(0.075, "y");
  const bottom = px(0.69, "y");
  const rand = createRng(31);

  ctx.save();
  pointedArch(ctx, x0, x1, spring, apex, bottom);
  ctx.clip();

  const sky = ctx.createLinearGradient(0, apex, 0, bottom);
  sky.addColorStop(0, "#5a9fe0");
  sky.addColorStop(0.45, "#9ccdf2");
  sky.addColorStop(0.75, "#dfeecb");
  sky.addColorStop(1, "#f3e7a8");
  ctx.fillStyle = sky;
  ctx.fillRect(x0, apex, x1 - x0, bottom - apex);

  // soft clouds
  ctx.filter = "blur(14px)";
  ctx.fillStyle = "rgba(255,255,255,.55)";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(x0 + rand() * (x1 - x0), apex + (0.1 + rand() * 0.35) * (bottom - apex), 40 + rand() * 60, 12 + rand() * 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // the garden: layers of foliage, far to near, out of focus like a lens would render them
  ctx.filter = "blur(7px)";
  const layers: Array<[string[], number, number, number]> = [
    [["#6f9a4a", "#a5c25e", "#5f8a40"], 0.42, 60, 60],
    [["#4a7a32", "#5d8e3a", "#3f6c2c"], 0.58, 52, 90],
    [["#2f5a24", "#3d6d2c", "#27491f", "#6f9a3a"], 0.62, 90, 90],
  ];
  for (const [palette, start, count, size] of layers) {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = pick(palette as [string, ...string[]], rand());
      ctx.beginPath();
      ctx.ellipse(x0 + rand() * (x1 - x0), apex + (start + rand() * 0.25) * (bottom - apex), size * (0.5 + rand() * 0.7), size * (0.4 + rand() * 0.5), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.filter = "blur(3px)";
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(x0 + (x1 - x0) * 0.45, bottom);
  ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.5, bottom - 160, x0 + (x1 - x0) * 0.42, bottom - 300);
  ctx.stroke();
  ctx.filter = "none";

  // low sun, upper left, as in the reference
  glow(ctx, x0 + (x1 - x0) * 0.12, bottom - 150, 360, "255,236,160", 0.9);
  glow(ctx, x0 + (x1 - x0) * 0.5, apex + 60, 300, "190,225,255", 0.35);

  // window tracery: dark mullions with a bright rim on the sun side
  const cx = (x0 + x1) / 2;
  ctx.lineCap = "round";
  const bars = (colour: string, width: number, dx: number): void => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    for (const f of [0.28, 0.5, 0.72]) {
      ctx.beginPath();
      ctx.moveTo(x0 + (x1 - x0) * f + dx, bottom);
      ctx.lineTo(x0 + (x1 - x0) * f + dx, spring - (f === 0.5 ? 150 : 40));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x0, px(0.5, "y") + dx);
    ctx.lineTo(x1, px(0.5, "y") + dx);
    ctx.moveTo(x0, px(0.36, "y") + dx);
    ctx.lineTo(x1, px(0.36, "y") + dx);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * (x1 - x0) * 0.22 + dx, spring - 40);
      ctx.quadraticCurveTo(cx + side * (x1 - x0) * 0.2 + dx, apex + 120, cx + dx, apex + 20);
      ctx.stroke();
    }
  };
  bars("#24160c", 9, 0);
  bars("rgba(255,220,150,.45)", 2.5, -3);
  ctx.restore();

  // deep reveal shadow where the glass meets the stone
  ctx.save();
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(0,0,0,.45)";
  pointedArch(ctx, x0, x1, spring, apex, bottom);
  ctx.stroke();
  ctx.restore();
}

interface CaseOptions {
  seed: number;
  arch?: boolean;
  /** 0..1, how much warm light reaches this case. */
  light: number;
}

/** One bookcase: dark carved frame, boards, and rows of leaning, colourful, aged spines. */
function paintBookcase(ctx: Ctx, x: number, y: number, w: number, h: number, o: CaseOptions): void {
  const rand = createRng(o.seed);
  const frame = Math.max(6, w * 0.06);
  ctx.save();
  if (o.arch) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w * 0.5);
    ctx.arc(x + w / 2, y + w * 0.5, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.clip();
  }
  ctx.fillStyle = "#2a190d";
  ctx.fillRect(x, y, w, h);
  const back = ctx.createLinearGradient(0, y, 0, y + h);
  back.addColorStop(0, "#150b05");
  back.addColorStop(1, "#24140a");
  ctx.fillStyle = back;
  ctx.fillRect(x + frame, y + frame, w - frame * 2, h - frame * 2);

  const rows = Math.max(3, Math.round(h / (HEIGHT * 0.05)));
  const rowH = (h - frame * 2) / rows;
  for (let r = 0; r < rows; r++) {
    const shelfY = y + frame + (r + 1) * rowH;
    let bx = x + frame + 2;
    const limit = x + w - frame - 2;
    while (bx < limit - 5) {
      const bw = Math.min(limit - bx, (5 + rand() * 11) * (WIDTH / 1920));
      const bh = rowH * (0.68 + rand() * 0.27);
      const lean = rand() < 0.05 ? (rand() - 0.5) * 0.25 : 0;
      const colour = pick(SPINES, rand());
      ctx.save();
      ctx.translate(bx + bw / 2, shelfY);
      ctx.rotate(lean);
      const body = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      body.addColorStop(0, shade(colour, 0.6));
      body.addColorStop(0.35, shade(colour, 1.3));
      body.addColorStop(1, shade(colour, 0.55));
      ctx.fillStyle = body;
      ctx.fillRect(-bw / 2, -bh, bw, bh);
      // gilt bands and a label, the details that make spines read as real books
      ctx.fillStyle = "rgba(235,200,130,.55)";
      ctx.fillRect(-bw / 2, -bh * 0.82, bw, 1.6);
      ctx.fillRect(-bw / 2, -bh * 0.22, bw, 1.6);
      if (rand() < 0.4) {
        ctx.fillStyle = rand() < 0.5 ? "rgba(230,215,175,.7)" : "rgba(160,40,30,.7)";
        ctx.fillRect(-bw / 2 + bw * 0.15, -bh * 0.62, bw * 0.7, bh * 0.16);
      }
      ctx.restore();
      bx += bw + (rand() < 0.1 ? 3 : 0.4);
    }
    // the board and the shadow it throws on the books below
    ctx.fillStyle = "#3a2314";
    ctx.fillRect(x + frame, shelfY, w - frame * 2, Math.max(3, rowH * 0.07));
    const under = ctx.createLinearGradient(0, shelfY, 0, shelfY + rowH * 0.3);
    under.addColorStop(0, "rgba(0,0,0,.55)");
    under.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = under;
    ctx.fillRect(x + frame, shelfY + 3, w - frame * 2, rowH * 0.3);
  }

  // warm light, stronger on the side facing the window
  const lit = ctx.createLinearGradient(x, 0, x + w, 0);
  lit.addColorStop(0, `rgba(255,170,70,${0.32 * o.light})`);
  lit.addColorStop(1, `rgba(255,140,50,${0.04 * o.light})`);
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = lit;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

function paintStack(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number): void {
  const rand = createRng(seed);
  let top = y + h;
  let n = 0;
  while (top > y && n < 9) {
    const bh = h * (0.09 + rand() * 0.05);
    const bw = w * (0.8 + rand() * 0.3);
    const bx = x + (w - bw) / 2 + (rand() - 0.5) * w * 0.12;
    const colour = pick(SPINES, rand());
    const g = ctx.createLinearGradient(0, top - bh, 0, top);
    g.addColorStop(0, shade(colour, 1.35));
    g.addColorStop(1, shade(colour, 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(bx, top - bh, bw, bh);
    ctx.fillStyle = "rgba(240,225,185,.85)"; // page edges
    ctx.fillRect(bx + bw * 0.06, top - bh * 0.72, bw * 0.88, bh * 0.4);
    ctx.fillStyle = "rgba(235,200,130,.5)";
    ctx.fillRect(bx, top - bh, bw, 1.4);
    top -= bh;
    n++;
  }
}

function paintBalconies(ctx: Ctx): void {
  const left = (y0: number, y1: number, xEnd: number): void => {
    const top = px(y0, "y");
    const bottom = px(y1, "y");
    ctx.fillStyle = "#33200f";
    ctx.fillRect(0, bottom, xEnd, px(0.028, "y"));
    ctx.fillStyle = "rgba(255,170,80,.22)";
    ctx.fillRect(0, bottom, xEnd, 3);
    ctx.fillStyle = "#4a2f1a";
    ctx.fillRect(0, top, xEnd, px(0.012, "y"));
    for (let bx = 8; bx < xEnd; bx += 16) {
      const g = ctx.createLinearGradient(bx, 0, bx + 7, 0);
      g.addColorStop(0, "#2a1a0d");
      g.addColorStop(0.5, "#6a4626");
      g.addColorStop(1, "#24150a");
      ctx.fillStyle = g;
      ctx.fillRect(bx, top + 8, 7, bottom - top - 8);
    }
    // carved brackets under the balcony
    ctx.fillStyle = "#2a190d";
    for (let bx = px(0.04, "x"); bx < xEnd; bx += px(0.11, "x")) {
      ctx.beginPath();
      ctx.moveTo(bx, bottom + px(0.028, "y"));
      ctx.quadraticCurveTo(bx + 4, bottom + px(0.07, "y"), bx + 36, bottom + px(0.075, "y"));
      ctx.lineTo(bx + 40, bottom + px(0.028, "y"));
      ctx.closePath();
      ctx.fill();
    }
  };
  left(0.335, 0.4, px(0.43, "x"));
  // the right gallery, higher and seen from below
  ctx.fillStyle = "#2e1c0e";
  ctx.beginPath();
  ctx.moveTo(px(0.84, "x"), px(0.0, "y"));
  ctx.lineTo(WIDTH, px(0.0, "y"));
  ctx.lineTo(WIDTH, px(0.24, "y"));
  ctx.lineTo(px(0.86, "x"), px(0.36, "y"));
  ctx.closePath();
  ctx.fill();
}

/** A drooping vine: a curve of leaves, each lit on one side. */
function paintIvy(ctx: Ctx, x: number, y: number, length: number, drop: number, seed: number, leaf = 11): void {
  const rand = createRng(seed);
  const colours = ["#2f5a22", "#3f7a2c", "#5b9a3a", "#264a1c"] as const;
  const count = Math.round(length / 4);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const lx = x + t * length + (rand() - 0.5) * 18;
    const ly = y + Math.sin(t * Math.PI) * drop * rand() + rand() * 14;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rand() * Math.PI);
    ctx.fillStyle = pick(colours, rand());
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf * (0.7 + rand() * 0.7), leaf * 0.55 * (0.7 + rand() * 0.6), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(190,230,110,.35)";
    ctx.beginPath();
    ctx.ellipse(-leaf * 0.2, -leaf * 0.15, leaf * 0.4, leaf * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintChandelier(ctx: Ctx, cx: number, top: number, scale: number, brightness: number): void {
  const rand = createRng(77);
  ctx.save();
  ctx.translate(cx, 0);
  ctx.strokeStyle = "#6b5120";
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, top);
  ctx.stroke();

  const gold = ctx.createLinearGradient(-60 * scale, 0, 60 * scale, 0);
  gold.addColorStop(0, "#6a4a14");
  gold.addColorStop(0.35, "#f0cf7a");
  gold.addColorStop(0.7, "#b88a2c");
  gold.addColorStop(1, "#5a3c0e");
  ctx.fillStyle = gold;
  // central column
  ctx.beginPath();
  ctx.moveTo(-9 * scale, top);
  ctx.quadraticCurveTo(-34 * scale, top + 60 * scale, -14 * scale, top + 150 * scale);
  ctx.lineTo(14 * scale, top + 150 * scale);
  ctx.quadraticCurveTo(34 * scale, top + 60 * scale, 9 * scale, top);
  ctx.fill();

  // two tiers of curling arms with candles
  const tiers: Array<[number, number, number]> = [
    [top + 70 * scale, 92 * scale, 4],
    [top + 130 * scale, 62 * scale, 3],
  ];
  for (const [ay, reach, pairs] of tiers) {
    for (let i = 0; i < pairs; i++) {
      for (const side of [-1, 1]) {
        const ax = side * reach * ((i + 1) / pairs);
        const arm = ay + (1 - (i + 1) / pairs) * 20 * scale;
        ctx.strokeStyle = gold;
        ctx.lineWidth = 5 * scale;
        ctx.beginPath();
        ctx.moveTo(0, arm + 30 * scale);
        ctx.bezierCurveTo(ax * 0.3, arm + 55 * scale, ax * 0.9, arm + 50 * scale, ax, arm);
        ctx.stroke();
        ctx.fillStyle = "#f4ead0";
        ctx.fillRect(ax - 3.5 * scale, arm - 30 * scale, 7 * scale, 28 * scale);
        glow(ctx, ax, arm - 36 * scale, 52 * scale * brightness, "255,196,90", 0.85 * brightness);
        ctx.fillStyle = "#fff6cf";
        ctx.beginPath();
        ctx.ellipse(ax, arm - 37 * scale, 3 * scale, 7 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // crystals: teardrops that catch the candlelight
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI;
    const r = (30 + rand() * 130) * scale;
    const cxl = Math.cos(a) * r * (rand() < 0.5 ? -1 : 1);
    const cyl = top + (60 + rand() * 170) * scale;
    const len = (9 + rand() * 14) * scale;
    const g = ctx.createLinearGradient(cxl, cyl, cxl, cyl + len);
    g.addColorStop(0, "rgba(255,248,225,.95)");
    g.addColorStop(1, "rgba(190,220,255,.35)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cxl, cyl + len / 2, 3 * scale, len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (rand() < 0.2) glow(ctx, cxl, cyl, 14 * scale, "255,240,200", 0.7);
  }
  ctx.restore();
  glow(ctx, cx, top + 120 * scale, 260 * scale, "255,190,90", 0.35 * brightness, 0.9);
}

function paintFloor(ctx: Ctx): void {
  const top = px(0.78, "y");
  const g = ctx.createLinearGradient(0, top, 0, HEIGHT);
  g.addColorStop(0, "#7a6550");
  g.addColorStop(0.4, "#5a4636");
  g.addColorStop(1, "#32261c");
  ctx.fillStyle = g;
  ctx.fillRect(0, top, WIDTH, HEIGHT - top);

  // stone slabs in perspective: horizontals bunch up towards the back, verticals converge
  const vx = px(0.62, "x");
  ctx.strokeStyle = "rgba(20,12,6,.45)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const y = top + (HEIGHT - top) * t * t;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  for (let i = -14; i <= 14; i++) {
    ctx.beginPath();
    ctx.moveTo(vx + i * 14, top);
    ctx.lineTo(vx + i * 150, HEIGHT);
    ctx.stroke();
  }
  // sunlight pooled on the stone, falling from the window towards the viewer
  ctx.save();
  ctx.filter = "blur(18px)";
  ctx.globalCompositeOperation = "screen";
  const patch = ctx.createLinearGradient(0, top, 0, HEIGHT);
  patch.addColorStop(0, "rgba(255,214,130,.55)");
  patch.addColorStop(1, "rgba(255,190,100,.12)");
  ctx.fillStyle = patch;
  for (const [a, b, c, d] of [
    [0.56, 0.68, 0.38, 0.62],
    [0.4, 0.5, 0.18, 0.34],
    [0.7, 0.78, 0.66, 0.9],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(px(a, "x"), top);
    ctx.lineTo(px(b, "x"), top);
    ctx.lineTo(px(d, "x"), HEIGHT);
    ctx.lineTo(px(c, "x"), HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function paintStairs(ctx: Ctx): void {
  for (let i = 0; i < 5; i++) {
    const inset = i * px(0.006, "x");
    const y = px(0.7, "y") + i * px(0.0185, "y");
    const g = ctx.createLinearGradient(0, y, 0, y + px(0.0185, "y"));
    g.addColorStop(0, "#c9b48a");
    g.addColorStop(1, "#7a6648");
    ctx.fillStyle = g;
    ctx.fillRect(px(0.535, "x") + inset, y, px(0.2, "x") - inset * 2, px(0.0185, "y"));
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(px(0.535, "x") + inset, y + px(0.0135, "y"), px(0.2, "x") - inset * 2, px(0.005, "y"));
  }
}

function paintDeskAndChairs(ctx: Ctx): void {
  const chair = (x: number, flip: number): void => {
    const y = px(0.66, "y");
    ctx.fillStyle = "#24140a"; // carved back
    ctx.fillRect(x, y, px(0.03, "x"), px(0.12, "y"));
    ctx.fillStyle = "#6e1f2e"; // velvet
    ctx.fillRect(x - flip * 4, y + px(0.04, "y"), px(0.03, "x"), px(0.045, "y"));
    ctx.fillStyle = "#8a2d3d";
    ctx.fillRect(x - flip * 4, y + px(0.04, "y"), px(0.03, "x"), 5);
    ctx.fillStyle = "#24140a";
    ctx.fillRect(x - flip * 8, y + px(0.09, "y"), px(0.036, "x"), px(0.012, "y"));
    ctx.fillRect(x - flip * 6, y + px(0.1, "y"), 6, px(0.075, "y"));
    ctx.fillRect(x + px(0.03, "x") - flip * 6, y + px(0.1, "y"), 6, px(0.075, "y"));
  };
  chair(px(0.272, "x"), 1);
  chair(px(0.476, "x"), -1);

  const x = px(0.318, "x");
  const w = px(0.196, "x");
  const y = px(0.715, "y");
  const top = ctx.createLinearGradient(0, y, 0, y + px(0.022, "y"));
  top.addColorStop(0, "#7a5230");
  top.addColorStop(1, "#33200f");
  ctx.fillStyle = top;
  ctx.fillRect(x, y, w, px(0.022, "y"));
  ctx.fillStyle = "rgba(255,200,120,.35)";
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = "#2a190d";
  for (const lx of [x + 10, x + w - 24]) {
    ctx.beginPath();
    ctx.moveTo(lx, y + px(0.022, "y"));
    ctx.quadraticCurveTo(lx - 10, y + px(0.06, "y"), lx + 4, y + px(0.09, "y"));
    ctx.lineTo(lx + 16, y + px(0.09, "y"));
    ctx.quadraticCurveTo(lx + 8, y + px(0.06, "y"), lx + 14, y + px(0.022, "y"));
    ctx.fill();
  }
  // lamp and open book
  ctx.fillStyle = "#e9d9a8";
  ctx.beginPath();
  ctx.moveTo(px(0.405, "x") - 16, y - 34);
  ctx.lineTo(px(0.405, "x") + 16, y - 34);
  ctx.lineTo(px(0.405, "x") + 24, y - 6);
  ctx.lineTo(px(0.405, "x") - 24, y - 6);
  ctx.fill();
  ctx.fillStyle = "#2a190d";
  ctx.fillRect(px(0.405, "x") - 2, y - 8, 4, 8);
  glow(ctx, px(0.405, "x"), y - 24, 110, "255,200,110", 0.8);
  ctx.fillStyle = "#efe2bd";
  ctx.beginPath();
  ctx.moveTo(px(0.35, "x"), y);
  ctx.lineTo(px(0.375, "x"), y - 7);
  ctx.lineTo(px(0.395, "x"), y);
  ctx.fill();
}

function paintRightDesk(ctx: Ctx): void {
  const x = px(0.755, "x");
  const y = px(0.79, "y");
  const w = px(0.2, "x");
  ctx.fillStyle = "#3a2314";
  ctx.fillRect(x, y, w, px(0.1, "y"));
  const top = ctx.createLinearGradient(0, y - 6, 0, y + 14);
  top.addColorStop(0, "#8a5c34");
  top.addColorStop(1, "#4a2d18");
  ctx.fillStyle = top;
  ctx.fillRect(x - 10, y - 6, w + 20, 20);
  // open book with pages catching the light
  ctx.fillStyle = "#f2e6bf";
  ctx.beginPath();
  ctx.moveTo(x + 18, y - 6);
  ctx.lineTo(x + 70, y - 24);
  ctx.lineTo(x + 124, y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(90,60,30,.5)";
  ctx.beginPath();
  ctx.moveTo(x + 70, y - 24);
  ctx.lineTo(x + 70, y - 6);
  ctx.stroke();
  // brass lamp
  const lx = x + w - 56;
  ctx.fillStyle = "#c9a24a";
  ctx.beginPath();
  ctx.moveTo(lx - 26, y - 74);
  ctx.lineTo(lx + 26, y - 74);
  ctx.lineTo(lx + 38, y - 36);
  ctx.lineTo(lx - 38, y - 36);
  ctx.fill();
  ctx.fillStyle = "#6a4a14";
  ctx.fillRect(lx - 3, y - 36, 6, 30);
  glow(ctx, lx, y - 54, 170, "255,190,90", 0.95);
  paintStack(ctx, x + 6, y - 120, 70, 114, 404);
}

function paintForeground(ctx: Ctx): void {
  const rand = createRng(555);
  // rug
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px(0.3, "x"), px(0.9, "y"));
  ctx.lineTo(px(0.72, "x"), px(0.9, "y"));
  ctx.lineTo(px(0.8, "x"), HEIGHT);
  ctx.lineTo(px(0.2, "x"), HEIGHT);
  ctx.closePath();
  const rug = ctx.createLinearGradient(0, px(0.9, "y"), 0, HEIGHT);
  rug.addColorStop(0, "#5a1a16");
  rug.addColorStop(1, "#7a2a1e");
  ctx.fillStyle = rug;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(220,170,90,.55)";
  ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) {
    const inset = 14 + i * 22;
    ctx.beginPath();
    ctx.moveTo(px(0.3, "x") + inset * 0.5, px(0.9, "y") + inset * 0.5);
    ctx.lineTo(px(0.72, "x") - inset * 0.5, px(0.9, "y") + inset * 0.5);
    ctx.lineTo(px(0.8, "x") - inset * 1.4, HEIGHT - inset);
    ctx.lineTo(px(0.2, "x") + inset * 1.4, HEIGHT - inset);
    ctx.closePath();
    ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${200 + rand() * 40},${140 + rand() * 40},${70 + rand() * 30},${0.15 + rand() * 0.2})`;
    const dx = px(0.26, "x") + rand() * px(0.5, "x");
    const dy = px(0.92, "y") + rand() * px(0.08, "y");
    ctx.beginPath();
    ctx.moveTo(dx, dy - 9);
    ctx.lineTo(dx + 7, dy);
    ctx.lineTo(dx, dy + 9);
    ctx.lineTo(dx - 7, dy);
    ctx.fill();
  }
  ctx.restore();

  // snake plant, bottom right: stiff pointed leaves with a pale edge
  for (let i = 0; i < 9; i++) {
    const bx = px(0.93, "x") + (rand() - 0.2) * 90;
    const h = px(0.16 + rand() * 0.14, "y");
    const lean = (rand() - 0.6) * 60;
    const g = ctx.createLinearGradient(bx - 20, 0, bx + 20, 0);
    g.addColorStop(0, "#14301a");
    g.addColorStop(0.5, "#3f7a3a");
    g.addColorStop(1, "#1b3a20");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - 26, HEIGHT);
    ctx.quadraticCurveTo(bx - 20 + lean * 0.4, HEIGHT - h * 0.6, bx + lean, HEIGHT - h);
    ctx.quadraticCurveTo(bx + 20 + lean * 0.4, HEIGHT - h * 0.6, bx + 26, HEIGHT);
    ctx.fill();
    ctx.strokeStyle = "rgba(220,210,110,.55)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // book stacks on the floor, left
  paintStack(ctx, px(0.065, "x"), px(0.8, "y"), 90, px(0.16, "y"), 11);
  paintStack(ctx, px(0.205, "x"), px(0.82, "y"), 70, px(0.13, "y"), 12);
  // a vine climbing the left edge in the foreground, big leaves out of focus
  ctx.save();
  ctx.filter = "blur(2px)";
  ctx.strokeStyle = "#2d4a1e";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(px(0.035, "x"), HEIGHT * 0.86);
  ctx.bezierCurveTo(px(0.06, "x"), HEIGHT * 0.6, px(0.02, "x"), HEIGHT * 0.35, px(0.045, "x"), HEIGHT * 0.12);
  ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const lx = px(0.035, "x") + Math.sin(t * 6) * 30 + (rand() - 0.5) * 30;
    const ly = HEIGHT * (0.86 - t * 0.74);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate((rand() - 0.5) * 2);
    const g = ctx.createLinearGradient(-20, 0, 24, 0);
    g.addColorStop(0, "#5f9a2e");
    g.addColorStop(1, "#8bbd44");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26 + rand() * 12, 14 + rand() * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** God-rays: long soft beams from the window to the floor, plus a bloom around the glass. */
function paintLight(ctx: Ctx): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(22px)";
  const beams: Array<[number, number, number, number, number]> = [
    [0.57, 0.62, 0.3, 0.46, 0.34],
    [0.62, 0.68, 0.46, 0.62, 0.28],
    [0.66, 0.7, 0.6, 0.76, 0.2],
  ];
  for (const [a, b, c, d, alpha] of beams) {
    const g = ctx.createLinearGradient(px(a, "x"), px(0.3, "y"), px(c, "x"), HEIGHT);
    g.addColorStop(0, `rgba(255,236,170,${alpha})`);
    g.addColorStop(1, "rgba(255,210,130,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(px(a, "x"), px(0.3, "y"));
    ctx.lineTo(px(b, "x"), px(0.3, "y"));
    ctx.lineTo(px(d, "x"), HEIGHT);
    ctx.lineTo(px(c, "x"), HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, px(0.635, "x"), px(0.42, "y"), 520, "255,230,170", 0.35, 1.3);
}

/**
 * Paints the whole hall. Pure apart from the canvas it returns; call it once and reuse the canvas.
 * The canvas is drawn at a fixed size (1920 wide); the browser scales it to cover the viewport.
 */
export function paintHall(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available in this browser.");

  paintWallAndCeiling(ctx);
  paintWindow(ctx);
  paintStairs(ctx);

  HALL_SLOTS.forEach((slot, i) => {
    const x = px(slot.x, "x");
    const y = px(slot.y, "y");
    const w = px(slot.width, "x");
    const h = px(slot.height, "y");
    if (slot.stand) return; // floor stands are painted in the foreground
    // the closer a case is to the window, the more golden light it receives
    const light = 1 - Math.min(1, Math.abs(slot.x + slot.width / 2 - 0.64) / 0.6) * 0.55;
    paintBookcase(ctx, x, y, w, h, { seed: 1000 + i * 17, arch: slot.arch, light });
  });

  paintBalconies(ctx);
  paintIvy(ctx, px(0.01, "x"), px(0.318, "y"), px(0.42, "x"), 26, 5, 12);
  paintIvy(ctx, px(0.86, "x"), px(0.4, "y"), px(0.12, "x"), 60, 6, 13);
  paintIvy(ctx, px(0.745, "x"), px(0.5, "y"), px(0.12, "x"), 40, 7, 12);
  paintIvy(ctx, px(0.34, "x"), px(0.325, "y"), px(0.1, "x"), 30, 8, 11);

  paintChandelier(ctx, px(0.482, "x"), px(0.12, "y"), 1.15, 1);
  paintChandelier(ctx, px(0.795, "x"), px(0.07, "y"), 0.62, 0.55);

  paintFloor(ctx);
  paintDeskAndChairs(ctx);
  paintRightDesk(ctx);
  paintLight(ctx);
  paintForeground(ctx);

  // floor stands (lecterns with a few books), the last three slots
  HALL_SLOTS.forEach((slot, i) => {
    if (slot.stand) paintStack(ctx, px(slot.x, "x"), px(slot.y, "y"), px(slot.width, "x"), px(slot.height, "y"), 700 + i);
  });

  // gentle overall grade: warm highlights, cool deep shadows
  ctx.globalCompositeOperation = "soft-light";
  const grade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grade.addColorStop(0, "rgba(40,60,110,.35)");
  grade.addColorStop(0.5, "rgba(255,170,80,.25)");
  grade.addColorStop(1, "rgba(60,30,20,.4)");
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}
