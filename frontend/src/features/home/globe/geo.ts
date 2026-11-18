/**
 * The maths of the globe: an orthographic projection (the Earth seen from far away, centred on a point),
 * with no map library. Coordinates are degrees; the screen has y pointing down.
 */

export interface Rotation {
  /** Longitude of the point in the middle of the globe. */
  lon: number;
  /** Latitude of the point in the middle of the globe. */
  lat: number;
}

export interface Projected {
  x: number;
  y: number;
  /** On the side that faces us. */
  visible: boolean;
}

const RAD = Math.PI / 180;
export const MAX_LAT = 80;

export function clampLat(lat: number): number {
  return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
}

/** Wrap a longitude into -180..180. */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Position on a globe of radius 1 centred at (0,0); `visible` is false on the far side. */
export function project(lon: number, lat: number, rot: Rotation): Projected {
  const dl = (lon - rot.lon) * RAD;
  const phi = lat * RAD;
  const phi0 = rot.lat * RAD;
  const cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dl);
  const x = Math.cos(phi) * Math.sin(dl);
  const y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dl);
  return { x, y: -y, visible: cosc >= 0 };
}

/** The opposite of `project`: which (lon, lat) is under a point of the unit disc; null outside the globe. */
export function invert(x: number, y: number, rot: Rotation): { lon: number; lat: number } | null {
  const yy = -y;
  const rho = Math.hypot(x, yy);
  if (rho > 1) return null;
  if (rho === 0) return { lon: rot.lon, lat: rot.lat };
  const c = Math.asin(rho);
  const phi0 = rot.lat * RAD;
  const lat = Math.asin(Math.cos(c) * Math.sin(phi0) + (yy * Math.sin(c) * Math.cos(phi0)) / rho);
  const lon = rot.lon * RAD + Math.atan2(x * Math.sin(c), rho * Math.cos(phi0) * Math.cos(c) - yy * Math.sin(phi0) * Math.sin(c));
  return { lon: wrapLon(lon / RAD), lat: lat / RAD };
}

/**
 * SVG path of a ring given as a flat [lon, lat, lon, lat, ...] list, on a globe of `radius` pixels centred at
 * (cx, cy). Points on the far side are pushed to the edge of the disc, which keeps a country that sticks over
 * the horizon in one piece. Returns null when no point of the ring faces us.
 */
export function ringPath(flat: readonly number[], rot: Rotation, cx: number, cy: number, radius: number): string | null {
  const parts: string[] = [];
  let anyVisible = false;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const p = project(flat[i]!, flat[i + 1]!, rot);
    let { x, y } = p;
    if (p.visible) anyVisible = true;
    else {
      const len = Math.hypot(x, y) || 1;
      x /= len;
      y /= len;
    }
    parts.push(`${i === 0 ? "M" : "L"}${(cx + x * radius).toFixed(1)},${(cy + y * radius).toFixed(1)}`);
  }
  return anyVisible ? `${parts.join("")}Z` : null;
}

/** Graticule line (a meridian or a parallel) as visible polyline pieces, for the grid on the globe. */
export function linePath(points: ReadonlyArray<readonly [number, number]>, rot: Rotation, cx: number, cy: number, radius: number): string {
  let d = "";
  let pen = false;
  for (const [lon, lat] of points) {
    const p = project(lon, lat, rot);
    if (!p.visible) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${(cx + p.x * radius).toFixed(1)},${(cy + p.y * radius).toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Meridians every 30° and parallels every 30°, as lists of (lon, lat). */
export function graticule(): Array<Array<[number, number]>> {
  const lines: Array<Array<[number, number]>> = [];
  for (let lon = -180; lon < 180; lon += 30) {
    const line: Array<[number, number]> = [];
    for (let lat = -90; lat <= 90; lat += 6) line.push([lon, lat]);
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const line: Array<[number, number]> = [];
    for (let lon = -180; lon <= 180; lon += 6) line.push([lon, lat]);
    lines.push(line);
  }
  return lines;
}

/** The rotation that moves the globe by a drag of (dx, dy) pixels: the surface follows the finger. */
export function dragged(rot: Rotation, dx: number, dy: number, radius: number): Rotation {
  const perPixel = 1 / radius / RAD;
  return { lon: wrapLon(rot.lon - dx * perPixel), lat: clampLat(rot.lat + dy * perPixel) };
}

/** A step between two rotations along the shortest way round (t from 0 to 1). */
export function between(from: Rotation, to: Rotation, t: number): Rotation {
  const dl = wrapLon(to.lon - from.lon);
  return { lon: wrapLon(from.lon + dl * t), lat: from.lat + (clampLat(to.lat) - from.lat) * t };
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Ray-casting test of a (lon, lat) inside a flat ring; good for the small rings of the world data. */
export function ringContains(flat: readonly number[], lon: number, lat: number): boolean {
  let inside = false;
  const n = flat.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[i * 2]!;
    const yi = flat[i * 2 + 1]!;
    const xj = flat[j * 2]!;
    const yj = flat[j * 2 + 1]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
