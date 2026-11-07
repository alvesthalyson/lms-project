import { lerp, hash2, valueNoise } from "./random";

/** A canvas plus its 2D context, already scaled for the device pixel ratio. */
export interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function devicePixelRatioCapped(): number {
  return Math.min(2, window.devicePixelRatio || 1);
}

/** Create a canvas of CSS size (width x height), backed at device resolution. Draw in CSS pixels. */
export function createSurface(width: number, height: number): Surface {
  const dpr = devicePixelRatioCapped();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available in this browser.");
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

/** Dark walnut: long grain, growth rings, pores. Raw pixels (1:1), meant to be scaled with drawImage. */
export function createWoodTexture(width: number, height: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available in this browser.");
  const image = ctx.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const warp = valueNoise(x * 0.008, y * 0.004, seed + 4) * 5;
      const grain =
        valueNoise(x * 0.05, y * 0.004, seed) * 0.55 +
        valueNoise(x * 0.22, y * 0.012, seed + 2) * 0.3 +
        valueNoise(x * 1.1, y * 0.06, seed + 3) * 0.15;
      const ring = Math.sin((x * 0.035 + warp) * Math.PI * 2) * 0.5 + 0.5;
      let t = Math.pow(grain * 0.6 + ring * 0.4, 1.25);
      if (hash2(x, y, seed + 9) < 0.035) t *= 0.55; // pores
      const i = (y * width + x) * 4;
      data[i] = lerp(34, 120, t);
      data[i + 1] = lerp(18, 70, t);
      data[i + 2] = lerp(9, 36, t);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Soft warm light: a bright core fading to nothing. */
export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(255,252,230,${alpha})`);
  g.addColorStop(0.22, `rgba(255,220,130,${alpha * 0.75})`);
  g.addColorStop(0.6, `rgba(255,170,60,${alpha * 0.22})`);
  g.addColorStop(1, "rgba(255,160,50,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Film-grain tile as a data URL (random noise, 8-bit grey). */
export function createGrainTile(size: number, alpha = 255): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.random() * 255;
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = alpha;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}
