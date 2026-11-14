import type { CSSProperties } from "react";

/** A stable hue (0-359) from a title, so a book with no cover still gets its own colour. */
export function hueFromTitle(title: string): number {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 360;
}

/** Fallback tint when the cover cannot be sampled. */
export function fallbackTint(title: string): string {
  return `hsl(${hueFromTitle(title)} 55% 38%)`;
}

const cache = new Map<string, Promise<string | null>>();

/**
 * Average colour of a cover, for the glow behind the book. Reads a 16x16 thumbnail through a canvas.
 * Resolves null whenever that is not possible (no canvas, the host sends no CORS headers, a broken
 * image): callers then use {@link fallbackTint}. Results are cached per URL.
 */
export function sampleCoverTint(url: string): Promise<string | null> {
  const hit = cache.get(url);
  if (hit) return hit;
  const promise = new Promise<string | null>((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 16;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if ((data[i + 3] ?? 0) < 200) continue;
          r += data[i] ?? 0;
          g += data[i + 1] ?? 0;
          b += data[i + 2] ?? 0;
          n += 1;
        }
        resolve(n ? `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})` : null);
      } catch {
        resolve(null); // tainted canvas
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cache.set(url, promise);
  return promise;
}

/** Inline CSS variables used by the 3D book and the panel glow. */
export function tintStyle(title: string, tint?: string | null): CSSProperties {
  return { "--hue": hueFromTitle(title), "--tint": tint ?? fallbackTint(title) } as CSSProperties;
}
