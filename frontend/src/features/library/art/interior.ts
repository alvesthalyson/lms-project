/**
 * The tiny library inside the nook, painted as three depth layers (back, middle, front).
 * The entrance moves each layer by a different amount when the pointer moves, which is
 * what gives the little room its sense of depth.
 *
 * All coordinates are fractions of the opening's width (w) and height (h).
 */
import { createSurface, glowDot } from "./canvas";
import { createRng, shade } from "./random";

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;
const BOOK_COLOURS = ["#7a3a1e", "#5a2a14", "#8a5a26", "#3a4a2a", "#6a1f1f", "#a47a38", "#4a3a22", "#7a5a3a", "#2f3a4a"] as const;

/** Rows of tiny leather books on shelves. `light` scales the brightness (1 = fully lit). */
function shelfBooks(ctx: Ctx, x: number, y: number, w: number, h: number, rows: number, rand: () => number, light: number): void {
  const rowHeight = h / rows;
  ctx.fillStyle = "rgba(18,7,2,.6)";
  ctx.fillRect(x, y, w, h);
  for (let row = 0; row < rows; row++) {
    const baseline = y + (row + 1) * rowHeight;
    let bx = x + w * 0.025;
    while (bx < x + w * 0.965) {
      const bw = w * (0.02 + rand() * 0.03);
      const bh = rowHeight * (0.55 + rand() * 0.38);
      const colour = BOOK_COLOURS[Math.floor(rand() * BOOK_COLOURS.length)] ?? BOOK_COLOURS[0];
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, shade(colour, 0.5 * light));
      g.addColorStop(0.4, shade(colour, 1.2 * light));
      g.addColorStop(1, shade(colour, 0.45 * light));
      ctx.fillStyle = g;
      ctx.fillRect(bx, baseline - bh, bw, bh);
      ctx.fillStyle = "rgba(244,206,120,.55)";
      ctx.fillRect(bx, baseline - bh * 0.88, bw, 1);
      ctx.fillRect(bx, baseline - bh * 0.14, bw, 1);
      bx += bw + 0.4;
    }
    ctx.fillStyle = "#2c1608";
    ctx.fillRect(x, baseline, w, rowHeight * 0.08);
    ctx.fillStyle = "rgba(255,205,125,.32)";
    ctx.fillRect(x, baseline, w, 1);
  }
  ctx.fillStyle = "#2c1608";
  ctx.fillRect(x - 2, y, 4, h);
  ctx.fillRect(x + w - 2, y, 4, h);
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
}

/** BACK: wall, upper bookcases, the glowing arched window, pilasters and a panelled door. */
function paintBack(ctx: Ctx, w: number, h: number, m: number): void {
  const rand = createRng(11);
  const wall = ctx.createRadialGradient(w * 0.5, h * 0.34, 8, w * 0.5, h * 0.42, h * 0.78);
  wall.addColorStop(0, "#ffe9b0");
  wall.addColorStop(0.22, "#f2b858");
  wall.addColorStop(0.5, "#a9611f");
  wall.addColorStop(0.82, "#3a1a08");
  wall.addColorStop(1, "#120802");
  ctx.fillStyle = wall;
  ctx.fillRect(-m, -m, w + 2 * m, h + 2 * m);
  for (let x = -m; x < w + m; x += w * 0.05) {
    ctx.fillStyle = "rgba(60,25,5,.13)";
    ctx.fillRect(x, -m, w * 0.012, h + 2 * m);
  }
  shelfBooks(ctx, -w * 0.02, h * 0.05, w * 0.35, h * 0.4, 7, rand, 1);
  shelfBooks(ctx, w * 0.67, h * 0.05, w * 0.35, h * 0.4, 7, rand, 1);

  const halo = ctx.createRadialGradient(w * 0.5, h * 0.13, 2, w * 0.5, h * 0.13, w * 0.34);
  halo.addColorStop(0, "rgba(255,252,228,1)");
  halo.addColorStop(0.4, "rgba(255,224,150,.85)");
  halo.addColorStop(1, "rgba(255,200,100,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(w * 0.1, -m, w * 0.8, h * 0.34);

  const wx = w * 0.37;
  const ww = w * 0.26;
  const archPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(wx, h * 0.36);
    ctx.lineTo(wx, h * 0.12);
    ctx.quadraticCurveTo(wx, h * 0.02, w * 0.5, 0);
    ctx.quadraticCurveTo(wx + ww, h * 0.02, wx + ww, h * 0.12);
    ctx.lineTo(wx + ww, h * 0.36);
    ctx.closePath();
  };
  ctx.save();
  archPath();
  ctx.clip();
  const glass = ctx.createLinearGradient(0, 0, 0, h * 0.36);
  glass.addColorStop(0, "#fffbe8");
  glass.addColorStop(1, "#ffd488");
  ctx.fillStyle = glass;
  ctx.fillRect(wx, 0, ww, h * 0.36);
  ctx.strokeStyle = "rgba(60,28,6,.85)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.5, h * 0.36);
  for (const f of [0.1, 0.2, 0.29]) {
    ctx.moveTo(wx, h * f);
    ctx.lineTo(wx + ww, h * f);
  }
  ctx.stroke();
  ctx.restore();
  archPath();
  ctx.strokeStyle = "#3a1c08";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(240,190,90,.8)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  for (const px of [w * 0.335, w * 0.625]) {
    const pilaster = ctx.createLinearGradient(px, 0, px + w * 0.04, 0);
    pilaster.addColorStop(0, "#1c0c04");
    pilaster.addColorStop(0.5, "#8a5a22");
    pilaster.addColorStop(1, "#1c0c04");
    ctx.fillStyle = pilaster;
    ctx.fillRect(px, -m, w * 0.04, h * 0.82);
    ctx.fillStyle = "rgba(240,200,110,.7)";
    for (let f = 0.02; f < 0.8; f += 0.1) ctx.fillRect(px, h * f, w * 0.04, 1.5);
  }
  const door = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.82);
  door.addColorStop(0, "#5a3212");
  door.addColorStop(1, "#241006");
  ctx.fillStyle = door;
  ctx.fillRect(w * 0.375, h * 0.5, w * 0.25, h * 0.32);
  ctx.strokeStyle = "rgba(232,184,90,.75)";
  ctx.lineWidth = 1.6;
  ctx.strokeRect(w * 0.39, h * 0.52, w * 0.22, h * 0.12);
  ctx.strokeRect(w * 0.39, h * 0.66, w * 0.22, h * 0.14);
  const spill = ctx.createRadialGradient(w * 0.5, h * 0.4, 2, w * 0.5, h * 0.4, w * 0.3);
  spill.addColorStop(0, "rgba(255,230,160,.35)");
  spill.addColorStop(1, "rgba(255,200,100,0)");
  ctx.fillStyle = spill;
  ctx.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.5);
}

function paintChandelier(ctx: Ctx, w: number, h: number, m: number, rand: () => number): void {
  const cx = w * 0.5;
  const cy = h * 0.165;
  ctx.strokeStyle = "#6a4a18";
  ctx.lineWidth = 2;
  for (let y = -m; y < cy - h * 0.045; y += 8) {
    ellipse(ctx, cx, y + 4, 2.2, 4);
    ctx.stroke();
  }
  glowDot(ctx, cx, cy, w * 0.62, 0.55);
  ctx.strokeStyle = "#c9962e";
  ctx.lineWidth = 3;
  ellipse(ctx, cx, cy, w * 0.2, h * 0.02);
  ctx.stroke();
  ctx.fillStyle = "#8a5c1a";
  ctx.fillRect(cx - 5, cy - h * 0.05, 10, h * 0.05);
  for (let k = -3; k <= 3; k++) {
    const bx = cx + k * w * 0.062;
    const by = cy + Math.abs(k) * h * 0.004;
    ctx.strokeStyle = "#b8862c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + k * w * 0.02, cy);
    ctx.quadraticCurveTo(bx, cy - h * 0.03, bx, by - h * 0.014);
    ctx.stroke();
    ctx.fillStyle = "#f6e6b8";
    ctx.fillRect(bx - 2.5, by - h * 0.03, 5, h * 0.016);
    glowDot(ctx, bx, by - h * 0.034, w * 0.07, 0.95);
  }
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    const dx = cx + Math.cos(a) * w * 0.2;
    const dy = cy + Math.sin(a) * h * 0.02;
    const length = h * (0.02 + rand() * 0.03);
    ctx.strokeStyle = "rgba(255,236,190,.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx, dy + length);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,248,225,.95)";
    ellipse(ctx, dx, dy + length + 2, 1.8, 3.2);
    ctx.fill();
    if (i % 4 === 0) glowDot(ctx, dx, dy + length + 2, 9, 0.6);
  }
}

function paintBalcony(ctx: Ctx, w: number, h: number, x0: number, x1: number): void {
  const y = h * 0.43;
  const rail = ctx.createLinearGradient(0, y, 0, y + h * 0.014);
  rail.addColorStop(0, "#d9a24a");
  rail.addColorStop(1, "#4a2a0e");
  ctx.fillStyle = rail;
  ctx.fillRect(x0, y, x1 - x0, h * 0.014);
  ctx.fillStyle = "#2c1608";
  ctx.fillRect(x0, y + h * 0.078, x1 - x0, h * 0.016);
  ctx.fillStyle = "rgba(255,200,120,.35)";
  ctx.fillRect(x0, y + h * 0.078, x1 - x0, 1);
  for (let bx = x0 + 4; bx < x1; bx += w * 0.034) {
    const spindle = ctx.createLinearGradient(bx - 5, 0, bx + 5, 0);
    spindle.addColorStop(0, "#2a1406");
    spindle.addColorStop(0.45, "#c28a38");
    spindle.addColorStop(1, "#2a1406");
    ctx.fillStyle = spindle;
    ctx.fillRect(bx - 2, y + h * 0.014, 4, h * 0.064);
    ellipse(ctx, bx, y + h * 0.034, 5, h * 0.012);
    ctx.fill();
    ellipse(ctx, bx, y + h * 0.062, 4, h * 0.008);
    ctx.fill();
  }
}

/** MID: chandelier, balconies, lower shelves with plants, armchair, desk with lamp. */
function paintMid(ctx: Ctx, w: number, h: number, m: number): void {
  const rand = createRng(23);
  paintChandelier(ctx, w, h, m, rand);
  paintBalcony(ctx, w, h, -m, w * 0.37);
  paintBalcony(ctx, w, h, w * 0.63, w + m);

  shelfBooks(ctx, -w * 0.02, h * 0.565, w * 0.36, h * 0.23, 3, rand, 0.95);
  ctx.fillStyle = "#2a1406";
  ctx.fillRect(-w * 0.02, h * 0.545, w * 0.38, h * 0.02);
  ctx.strokeStyle = "rgba(232,184,90,.7)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(w * (0.01 + i * 0.03), h * 0.553, w * 0.012, 0, Math.PI);
    ctx.stroke();
  }

  // red plant and yellow flowers
  ctx.fillStyle = "#f2ead8";
  ctx.fillRect(w * 0.13, h * 0.52, w * 0.07, h * 0.03);
  ctx.fillStyle = "#c9c0ac";
  ctx.fillRect(w * 0.13, h * 0.545, w * 0.07, h * 0.005);
  for (let i = 0; i < 11; i++) {
    const a = -1.15 + i * 0.23;
    ctx.strokeStyle = i % 2 ? "#d6281c" : "#a81610";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.165, h * 0.522);
    ctx.lineTo(w * 0.165 + Math.sin(a) * w * 0.07, h * 0.522 - Math.cos(a) * h * 0.04);
    ctx.stroke();
  }
  ctx.fillStyle = "#4a6aa8";
  ellipse(ctx, w * 0.27, h * 0.545, w * 0.022, h * 0.014);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const fx = w * 0.26 + i * w * 0.01;
    const fy = h * 0.5 - rand() * h * 0.02;
    ctx.strokeStyle = "#3a6a2a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.27, h * 0.54);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.fillStyle = "#f4c400";
    ctx.beginPath();
    ctx.arc(fx, fy, 4.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#7a4a00";
    ctx.beginPath();
    ctx.arc(fx, fy, 1.7, 0, TAU);
    ctx.fill();
  }

  // armchair with a carved back
  const chair = ctx.createLinearGradient(w * 0.52, 0, w * 0.74, 0);
  chair.addColorStop(0, "#241006");
  chair.addColorStop(0.5, "#6a3c18");
  chair.addColorStop(1, "#1c0c04");
  ctx.fillStyle = chair;
  ctx.beginPath();
  ctx.moveTo(w * 0.54, h * 0.78);
  ctx.lineTo(w * 0.54, h * 0.62);
  ctx.quadraticCurveTo(w * 0.55, h * 0.54, w * 0.63, h * 0.54);
  ctx.quadraticCurveTo(w * 0.72, h * 0.54, w * 0.72, h * 0.62);
  ctx.lineTo(w * 0.72, h * 0.78);
  ctx.fill();
  ctx.fillStyle = "rgba(210,150,60,.35)";
  ellipse(ctx, w * 0.63, h * 0.63, w * 0.06, h * 0.05);
  ctx.fill();
  ctx.strokeStyle = "rgba(240,190,90,.8)";
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {
    ellipse(ctx, w * 0.63, h * 0.63, w * 0.03 + k * w * 0.012, h * 0.026 + k * h * 0.012);
    ctx.stroke();
  }

  // desk, lamp, papers, open book
  const top = ctx.createLinearGradient(0, h * 0.73, 0, h * 0.76);
  top.addColorStop(0, "#e0a850");
  top.addColorStop(1, "#5a3010");
  ctx.fillStyle = top;
  ctx.fillRect(w * 0.3, h * 0.73, w * 0.58, h * 0.022);
  ctx.fillStyle = "#2a1406";
  ctx.fillRect(w * 0.32, h * 0.752, w * 0.54, h * 0.03);
  ctx.fillStyle = "rgba(232,184,90,.5)";
  for (let i = 0; i < 9; i++) ctx.fillRect(w * 0.34 + i * w * 0.06, h * 0.76, w * 0.035, 2);
  ctx.fillStyle = "#1c0c04";
  ctx.fillRect(w * 0.33, h * 0.78, w * 0.02, h * 0.12);
  ctx.fillRect(w * 0.83, h * 0.78, w * 0.02, h * 0.12);
  glowDot(ctx, w * 0.43, h * 0.7, w * 0.2, 0.8);
  ctx.fillStyle = "#b8862c";
  ctx.fillRect(w * 0.427, h * 0.705, 4, h * 0.025);
  ctx.fillStyle = "#2f7a4a";
  ctx.beginPath();
  ctx.moveTo(w * 0.395, h * 0.7);
  ctx.lineTo(w * 0.465, h * 0.7);
  ctx.lineTo(w * 0.45, h * 0.675);
  ctx.lineTo(w * 0.41, h * 0.675);
  ctx.fill();
  ctx.fillStyle = "rgba(255,250,200,.9)";
  ctx.fillRect(w * 0.41, h * 0.698, w * 0.04, 3);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgb(${236 - i * 4},${222 - i * 5},${186 - i * 6})`;
    ctx.fillRect(w * 0.72 - (i % 3) * 2, h * 0.727 - i * h * 0.0055, w * 0.12, h * 0.006);
  }
  ctx.fillStyle = "#efe0b6";
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.73);
  ctx.lineTo(w * 0.56, h * 0.718);
  ctx.lineTo(w * 0.62, h * 0.73);
  ctx.lineTo(w * 0.56, h * 0.734);
  ctx.fill();
}

/** FRONT: floor, rug, telescope on a tripod, a book stand, a stack of books, soft bokeh, vignette. */
function paintFront(ctx: Ctx, w: number, h: number, m: number): void {
  const rand = createRng(37);
  const floor = ctx.createLinearGradient(0, h * 0.82, 0, h + m);
  floor.addColorStop(0, "#f0b256");
  floor.addColorStop(0.35, "#b8702a");
  floor.addColorStop(1, "#3a1a08");
  ctx.fillStyle = floor;
  ctx.fillRect(-m, h * 0.82, w + 2 * m, h * 0.2 + m);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = "rgba(40,16,4,.4)";
    ctx.fillRect(-m, h * 0.82 + i * i * h * 0.0008 + i * h * 0.006, w + 2 * m, 1.3);
  }
  ctx.save();
  ctx.translate(w * 0.5, h * 0.915);
  ctx.scale(1, 0.22);
  const rug = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.36);
  rug.addColorStop(0, "#a2331f");
  rug.addColorStop(0.8, "#6a1a10");
  rug.addColorStop(1, "#d2a040");
  ctx.fillStyle = rug;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.36, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(240,200,110,.7)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.3, 0, TAU);
  ctx.stroke();
  ctx.restore();
  glowDot(ctx, w * 0.5, h * 0.9, w * 0.55, 0.3);

  // telescope on a tripod
  ctx.strokeStyle = "#2a1406";
  ctx.lineWidth = w * 0.013;
  ctx.lineCap = "round";
  const legs: ReadonlyArray<readonly [number, number, number, number]> = [
    [0.2, 0.78, 0.04, h + m * 0.8],
    [0.2, 0.78, 0.2, h + m * 0.8],
    [0.2, 0.78, 0.36, h * 0.99],
  ];
  for (const [ax, ay, bx, by] of legs) {
    ctx.beginPath();
    ctx.moveTo(w * ax, h * ay);
    ctx.lineTo(w * bx, by);
    ctx.stroke();
  }
  const tube = ctx.createLinearGradient(0, h * 0.6, 0, h * 0.8);
  tube.addColorStop(0, "#f2d078");
  tube.addColorStop(0.5, "#a8741e");
  tube.addColorStop(1, "#4a2e0a");
  ctx.strokeStyle = tube;
  ctx.lineWidth = w * 0.05;
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.79);
  ctx.lineTo(w * 0.05, h * 0.61);
  ctx.stroke();
  ctx.strokeStyle = "#e8c060";
  ctx.lineWidth = w * 0.058;
  ctx.beginPath();
  ctx.moveTo(w * 0.055, h * 0.615);
  ctx.lineTo(w * 0.045, h * 0.605);
  ctx.stroke();

  // ornate stand with an open book
  ctx.fillStyle = "#1a0b04";
  ctx.fillRect(w * 0.84, h * 0.84, w * 0.03, h * 0.18);
  ctx.fillRect(w * 0.96, h * 0.84, w * 0.03, h * 0.18);
  ctx.fillRect(w * 0.82, h * 0.82, w * 0.2, h * 0.025);
  ctx.fillStyle = "#efe0b6";
  ctx.beginPath();
  ctx.moveTo(w * 0.84, h * 0.82);
  ctx.lineTo(w * 0.92, h * 0.795);
  ctx.lineTo(w * 0.92, h * 0.825);
  ctx.lineTo(w * 0.84, h * 0.835);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.92, h * 0.795);
  ctx.lineTo(w, h * 0.81);
  ctx.lineTo(w, h * 0.835);
  ctx.lineTo(w * 0.92, h * 0.825);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,60,30,.45)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.85, h * (0.808 + i * 0.004));
    ctx.lineTo(w * 0.915, h * (0.795 + i * 0.005));
    ctx.stroke();
  }
  const stack: ReadonlyArray<readonly [string, number]> = [
    ["#5a2a14", 0],
    ["#2f4a2a", -0.014],
    ["#7a1f1f", -0.028],
    ["#3a3a52", -0.04],
  ];
  stack.forEach(([colour, dy], i) => {
    ctx.fillStyle = colour;
    ctx.fillRect(w * (0.88 + i * 0.01), h * (0.77 + dy), w * 0.14, h * 0.013);
    ctx.fillStyle = "rgba(240,200,110,.7)";
    ctx.fillRect(w * (0.88 + i * 0.01), h * (0.77 + dy) + 2, w * 0.14, 1.2);
  });

  // out-of-focus specks of light close to the lens
  for (let i = 0; i < 5; i++) {
    const bx = rand() * w;
    const by = h * (0.55 + rand() * 0.4);
    const radius = 10 + rand() * 22;
    ctx.save();
    ctx.filter = "blur(7px)";
    ctx.fillStyle = `rgba(255,214,130,${0.12 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.28, w * 0.5, h * 0.5, h * 0.82);
  vignette.addColorStop(0, "rgba(8,3,0,0)");
  vignette.addColorStop(1, "rgba(8,3,0,.7)");
  ctx.fillStyle = vignette;
  ctx.fillRect(-m, -m, w + 2 * m, h + 2 * m);
}

export type InteriorLayers = readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];

/**
 * Paint the three layers. Each canvas is (w + 2m) x (h + 2m) CSS pixels so that it can slide by
 * up to `m` pixels without ever showing its edge inside the opening.
 */
export function paintInterior(w: number, h: number, m: number): InteriorLayers {
  const make = (paint: (ctx: Ctx, w: number, h: number, m: number) => void): HTMLCanvasElement => {
    const { canvas, ctx } = createSurface(w + 2 * m, h + 2 * m);
    ctx.translate(m, m);
    paint(ctx, w, h, m);
    return canvas;
  };
  return [make(paintBack), make(paintMid), make(paintFront)];
}
