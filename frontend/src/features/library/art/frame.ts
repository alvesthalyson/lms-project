/**
 * The carved walnut frame of the nook: pointed arch, pierced filigree that glows because
 * light shines through it, and an engraved panel at the bottom.
 */
import { devicePixelRatioCapped } from "./canvas";

const TAU = Math.PI * 2;

/** Geometry of the arched opening, in CSS pixels relative to the frame. */
export interface Opening {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Proportions measured from the reference: the opening inside the frame. */
export const NOOK_ASPECT = 0.424;
export const OPENING_RATIOS = { x: 0.153, y: 0.052, width: 0.714, height: 0.844 } as const;

export function openingFor(nookWidth: number, nookHeight: number): Opening {
  return {
    x: OPENING_RATIOS.x * nookWidth,
    y: OPENING_RATIOS.y * nookHeight,
    width: OPENING_RATIOS.width * nookWidth,
    height: OPENING_RATIOS.height * nookHeight,
  };
}

/** SVG path of the pointed (ogee-tipped) arch. Used for canvas Path2D and for CSS clip-path. */
export function archPathData({ x, y, width: w, height: h }: Opening): string {
  return [
    `M${x},${y + h}`,
    `L${x},${y + 0.3 * h}`,
    `C${x},${y + 0.14 * h} ${x + 0.3 * w},${y + 0.09 * h} ${x + 0.46 * w},${y + 0.03 * h}`,
    `Q${x + 0.5 * w},${y - 0.006 * h} ${x + 0.54 * w},${y + 0.03 * h}`,
    `C${x + 0.7 * w},${y + 0.09 * h} ${x + w},${y + 0.14 * h} ${x + w},${y + 0.3 * h}`,
    `L${x + w},${y + h} Z`,
  ].join(" ");
}

type Ctx = CanvasRenderingContext2D;

function swirl(ctx: Ctx, cx: number, cy: number, direction: 1 | -1, scale: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(direction * scale, scale);
  ctx.shadowColor = "rgba(255,200,90,.95)";
  ctx.shadowBlur = 22;
  ctx.strokeStyle = "#ffe9a8";
  ctx.fillStyle = "#fff0c0";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  const spirals: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 0, 14, 2.4],
    [22, -12, 9, 2.0],
    [-18, 14, 7, 1.8],
  ];
  for (const [ax, ay, r0, turns] of spirals) {
    ctx.beginPath();
    for (let a = 0; a < turns * TAU; a += 0.12) {
      const r = r0 * (1 - (a / (turns * TAU)) * 0.85);
      const px = ax + Math.cos(a * direction + 1) * r;
      const py = ay + Math.sin(a + 1) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-30, 26);
  ctx.quadraticCurveTo(0, 6, 34, -22);
  ctx.stroke();
  const leaves: ReadonlyArray<readonly [number, number, number]> = [
    [10, -6, 0.3],
    [-12, 8, 2.4],
    [26, -18, 0.9],
    [-26, 20, 3.2],
    [4, 14, 1.6],
  ];
  for (const [lx, ly, rotation] of leaves) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  const dots: ReadonlyArray<readonly [number, number]> = [
    [-34, -10],
    [36, 10],
    [0, -30],
    [18, 24],
  ];
  for (const [dx, dy] of dots) {
    ctx.beginPath();
    ctx.arc(dx, dy, 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Paint the frame onto `canvas` (already sized nookWidth x nookHeight at device resolution).
 * The arched opening is punched out, so whatever sits behind the canvas shows through.
 */
export function paintFrame(canvas: HTMLCanvasElement, nookWidth: number, nookHeight: number, opening: Opening, wood: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = devicePixelRatioCapped();
  const nw = nookWidth;
  const nh = nookHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, nw, nh);
  ctx.drawImage(wood, 0, 0, wood.width, wood.height, 0, 0, nw, nh);

  const sides = ctx.createLinearGradient(0, 0, nw, 0);
  sides.addColorStop(0, "rgba(0,0,0,.6)");
  sides.addColorStop(0.12, "rgba(0,0,0,.1)");
  sides.addColorStop(0.88, "rgba(0,0,0,.1)");
  sides.addColorStop(1, "rgba(0,0,0,.6)");
  ctx.fillStyle = sides;
  ctx.fillRect(0, 0, nw, nh);
  ctx.fillStyle = "rgba(10,4,0,.35)";
  ctx.fillRect(0, 0, nw, nh);

  // warm light from the room grazing the wood around the opening
  const light = ctx.createRadialGradient(nw * 0.5, nh * 0.42, nw * 0.1, nw * 0.5, nh * 0.42, nw * 0.75);
  light.addColorStop(0, "rgba(255,176,70,.5)");
  light.addColorStop(1, "rgba(255,176,70,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, nw, nh);
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = "rgba(255,214,150,.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, nw - 2, nh - 2);
  ctx.strokeStyle = "rgba(0,0,0,.7)";
  ctx.lineWidth = 3;
  ctx.strokeRect(2.5, 2.5, nw - 5, nh - 5);

  const scale = (nw / 490) * 1.9;
  swirl(ctx, nw * 0.2, nh * 0.085, 1, scale);
  swirl(ctx, nw * 0.8, nh * 0.085, -1, scale);

  // punch the arch. The fill must be opaque: destination-out removes pixels in proportion to alpha.
  const arch = new Path2D(archPathData(opening));
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  ctx.fill(arch);
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,.8)";
  ctx.lineWidth = 7;
  ctx.stroke(arch);
  ctx.strokeStyle = "rgba(255,206,130,.7)";
  ctx.lineWidth = 1.6;
  ctx.stroke(arch);
  ctx.restore();

  // engraved arabesque on the bottom panel
  const bottom = opening.y + opening.height;
  const py = bottom + (nh - bottom) * 0.12;
  const ph = nh - py - nh * 0.014;
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(nw * 0.04, py, nw * 0.92, ph);
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.lineWidth = 1.6;
  ctx.strokeRect(nw * 0.04, py, nw * 0.92, ph);
  const passes: ReadonlyArray<readonly [number, string]> = [
    [1, "rgba(0,0,0,.65)"],
    [0, "rgba(214,160,86,.6)"],
  ];
  for (const [offset, colour] of passes) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.3;
    for (let side = 0; side < 2; side++) {
      for (const wave of [Math.sin, Math.cos]) {
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.02) {
          const px = nw * (side ? 0.56 : 0.08) + t * nw * 0.36;
          const y = py + ph / 2 + wave(t * 14 + side) * ph * 0.2 + offset;
          if (t === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
      }
    }
  }
}
