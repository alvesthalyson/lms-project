/**
 * The dark shelf the nook sits on: spines of real-looking books, a board above and a board
 * below, and warm light from the nook spilling over all of it.
 */
import { createSurface } from "./canvas";
import { createRng, shade } from "./random";

const TITLES = ["CSS", "JAVASCRIPT", "ATLAS", "HISTÓRIA", "POESIA", "O'REILLY", "PYTHON", "CLÁSSICOS", "ARTE", "DJANGO", "FILOSOFIA", "CIÊNCIA"] as const;
const SPINES = ["#10222c", "#0e2a2e", "#1b2430", "#0d1417", "#26262a", "#142e3a", "#191919", "#33281e", "#0f1a2a", "#1f3a44"] as const;

export interface RoomGeometry {
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  /** Where the nook sits. */
  nookX: number;
  nookY: number;
  nookWidth: number;
  nookHeight: number;
}

/** Returns a canvas covering the whole viewport. `wood` is a dark wood texture for the boards. */
export function paintRoom(g: RoomGeometry, wood: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, ctx } = createSurface(g.width, g.height);
  const rand = createRng(99);
  const W = g.width;
  const H = g.height;
  const topBoard = g.nookY - H * 0.012;
  const bottomBoard = g.nookY + g.nookHeight + H * 0.012;
  const centreX = g.nookX + g.nookWidth / 2;

  ctx.fillStyle = "#040302";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(wood, 0, 0, wood.width, wood.height, 0, 0, W, topBoard);
  ctx.fillStyle = "rgba(0,0,0,.6)";
  ctx.fillRect(0, 0, W, topBoard);
  ctx.drawImage(wood, 0, 0, wood.width, wood.height, 0, bottomBoard, W, H - bottomBoard);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(0, bottomBoard, W, H - bottomBoard);

  const paintBook = (bx: number, bw: number, bh: number): void => {
    const by = bottomBoard - bh;
    const colour = SPINES[Math.floor(rand() * SPINES.length)] ?? SPINES[0];
    const body = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    body.addColorStop(0, shade(colour, 0.55));
    body.addColorStop(0.3, shade(colour, 1.25));
    body.addColorStop(0.7, shade(colour, 0.9));
    body.addColorStop(1, shade(colour, 0.45));
    ctx.fillStyle = body;
    ctx.fillRect(bx, by, bw, bh);
    for (let i = 0; i < bw * bh * 0.05; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.05})`;
      ctx.fillRect(bx + rand() * bw, by + rand() * bh, 1, 1);
    }
    if (rand() < 0.6) {
      const atTop = rand() < 0.5;
      const ly = atTop ? by + bh * 0.04 : by + bh * 0.7;
      const lh = bh * (atTop ? 0.2 : 0.24);
      ctx.fillStyle = rand() < 0.5 ? "#ebe6d8" : "#d6cfbc";
      ctx.fillRect(bx, ly, bw, lh);
      ctx.fillStyle = "rgba(0,0,0,.4)";
      ctx.fillRect(bx, ly, bw * 0.14, lh);
      ctx.fillStyle = "rgba(20,20,20,.55)";
      for (let q = 1; q < 5; q++) ctx.fillRect(bx + bw * 0.25, ly + (lh * q) / 5.4, bw * 0.6 * (0.5 + rand() * 0.5), Math.max(1, lh * 0.03));
    }
    ctx.fillStyle = "rgba(230,200,140,.4)";
    ctx.fillRect(bx, by + bh * 0.3, bw, 1.4);
    ctx.fillRect(bx, by + bh * 0.34, bw, 1);
    ctx.save();
    ctx.translate(bx + bw * 0.5, by + bh * 0.64);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `600 ${Math.min(bw * 0.4, 26)}px 'Playfair Display',Georgia,serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(235,230,215,.82)";
    ctx.fillText(TITLES[Math.floor(rand() * TITLES.length)] ?? "", 0, 0);
    ctx.restore();
    const lit = Math.max(0, 1 - Math.abs(bx + bw / 2 - centreX) / (W * 0.3));
    ctx.fillStyle = `rgba(255,165,60,${0.34 * lit * lit})`;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(bx + bw - 1.2, by, 1.2, bh);
  };

  const k = H / 900;
  let x = g.nookX - 8;
  while (x > -60) {
    const bw = (34 + rand() * 58) * k;
    x -= bw;
    paintBook(x, bw, H * (0.34 + rand() * 0.22));
  }
  x = g.nookX + g.nookWidth + 8;
  while (x < W + 60) {
    const bw = (34 + rand() * 58) * k;
    paintBook(x, bw, H * (0.34 + rand() * 0.22));
    x += bw;
  }

  const gap = ctx.createLinearGradient(0, topBoard, 0, topBoard + H * 0.12);
  gap.addColorStop(0, "rgba(0,0,0,.85)");
  gap.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gap;
  ctx.fillRect(0, topBoard, W, H * 0.12);

  // warm light spilling on the top and bottom boards
  ctx.globalCompositeOperation = "screen";
  ctx.save();
  ctx.translate(centreX, topBoard * 0.6);
  ctx.scale(2.8, 1);
  const upper = ctx.createRadialGradient(0, 0, 0, 0, 0, topBoard * 0.95);
  upper.addColorStop(0, "rgba(255,206,100,.95)");
  upper.addColorStop(0.5, "rgba(255,160,50,.38)");
  upper.addColorStop(1, "rgba(255,140,40,0)");
  ctx.fillStyle = upper;
  ctx.fillRect(-W, -topBoard, W * 2, topBoard * 2);
  ctx.restore();
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.filter = "blur(10px)";
    ctx.fillStyle = `rgba(255,214,120,${0.1 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(centreX + (rand() - 0.5) * g.nookWidth * 2.4, topBoard * (0.25 + rand() * 0.55), g.nookWidth * (0.1 + rand() * 0.22), topBoard * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(centreX, bottomBoard + (H - bottomBoard) * 0.3);
  ctx.scale(2.4, 0.62);
  const lower = ctx.createRadialGradient(0, 0, 0, 0, 0, g.nookWidth * 0.95);
  lower.addColorStop(0, "rgba(255,222,140,1)");
  lower.addColorStop(0.45, "rgba(255,170,60,.5)");
  lower.addColorStop(1, "rgba(255,150,40,0)");
  ctx.fillStyle = lower;
  ctx.fillRect(-W, -g.nookWidth, W * 2, g.nookWidth * 2);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}
