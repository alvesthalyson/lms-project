import { NOOK_ASPECT, openingFor, type Opening } from "./frame";

export interface NookGeometry {
  viewport: { width: number; height: number };
  /** The carved frame, positioned in the viewport. */
  nook: { x: number; y: number; width: number; height: number };
  /** The arched opening, relative to the frame. */
  opening: Opening;
  /** Extra pixels painted around each interior layer so parallax never exposes an edge. */
  margin: number;
}

/**
 * Where everything goes for a given viewport. Pure, so it can be unit-tested.
 * The nook is 68% of the viewport height (or as wide as 92% of the viewport on tall, narrow
 * screens) and sits slightly above centre, leaving room for the title above it.
 */
export function computeNookGeometry(viewportWidth: number, viewportHeight: number): NookGeometry {
  const height = Math.min(viewportHeight * 0.68, (viewportWidth * 0.92) / NOOK_ASPECT);
  const width = height * NOOK_ASPECT;
  return {
    viewport: { width: viewportWidth, height: viewportHeight },
    nook: { x: (viewportWidth - width) / 2, y: viewportHeight * 0.2, width, height },
    opening: openingFor(width, height),
    margin: Math.max(12, width * 0.05),
  };
}

/** Pixels each interior layer moves per unit of pointer offset (back, middle, front). */
export const PARALLAX_STRENGTH = [4, 9, 18] as const;

/** Pointer position (-1..1 on each axis) to the translation of each layer. */
export function parallaxOffsets(px: number, py: number): Array<{ x: number; y: number }> {
  return PARALLAX_STRENGTH.map((k) => ({ x: -px * k, y: -py * k * 0.6 }));
}
