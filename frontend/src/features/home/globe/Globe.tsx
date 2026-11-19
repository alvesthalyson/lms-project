import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { useT } from "@/lib/i18n/useT";

import { between, clampLat, dragged, easeInOut, graticule, invert, linePath, project, ringPath, wrapLon, type Rotation } from "./geo";
import type { World } from "./world";

const SIZE = 400;
const C = SIZE / 2;
const RADIUS = 186;
const GRID = graticule();

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 10;
const BUTTON_STEP = 1.6;
const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface GlobeProps {
  world: World;
  /** Books per country code. Only countries with books can be chosen. */
  counts: Readonly<Record<string, number>>;
  /** Label of a country for screen readers, e.g. "Brasil: 4 livros". */
  describe: (code: string, books: number) => string;
  onPick: (code: string) => void;
  initial?: Rotation;
  /** Turn slowly until the reader touches it. */
  autoRotate?: boolean;
}

const START: Rotation = { lon: -40, lat: 15 };

/**
 * An old brass-and-parchment globe you can spin with the mouse or a finger. Countries that have books in the
 * library glow gold; the rest are dim. Choosing a gold country turns the globe to face it, then calls `onPick`.
 * It is plain SVG (no map library), so every gold country is a real button for the keyboard and screen readers.
 */
export function Globe({ world, counts, describe, onPick, initial = START, autoRotate = true }: GlobeProps) {
  const [rot, setRot] = useState<Rotation>(initial);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const { t } = useT();
  const rotRef = useRef(rot);
  rotRef.current = rot;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  // The disc is drawn `zoom` times bigger than the window it is seen through.
  const radius = RADIUS * zoom;
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const busy = useRef(false); // spinning towards a chosen country
  const touched = useRef(false);

  const reducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canAnimate = typeof requestAnimationFrame === "function" && !reducedMotion;

  // Slow idle spin.
  useEffect(() => {
    if (!autoRotate || !canAnimate) return;
    let frame = 0;
    const tick = (): void => {
      // Zooming does not stop the spin (it slows down as you zoom, so it looks the same speed), but pointing at a
      // gold country does, so it stays put under the cursor long enough to be clicked.
      if (!touched.current && !drag.current && !busy.current && !hoverRef.current) {
        setRot((r) => ({ lon: ((r.lon + 0.12 / zoomRef.current + 540) % 360) - 180, lat: r.lat }));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate, canAnimate]);

  const choose = useCallback(
    (code: string): void => {
      const country = world[code];
      touched.current = true;
      if (!country || !canAnimate) {
        onPick(code);
        return;
      }
      busy.current = true;
      const from = rotRef.current;
      const to = { lon: country.c[0], lat: country.c[1] };
      const DURATION = 650;
      let started: number | null = null; // taken from the first frame, so it works with any clock
      const step = (now: number): void => {
        started ??= now;
        const t = Math.min(1, (now - started) / DURATION);
        setRot(between(from, to, easeInOut(t)));
        if (t < 1) requestAnimationFrame(step);
        else {
          busy.current = false;
          onPick(code);
        }
      };
      requestAnimationFrame(step);
    },
    [world, canAnimate, onPick],
  );

  /** Zoom by `factor`, keeping the spot under (sx, sy) (in SVG units) where it is, like a map. */
  const zoomAt = useCallback((factor: number, sx: number, sy: number): void => {
    const oldZoom = zoomRef.current;
    const next = clampZoom(oldZoom * factor);
    if (next === oldZoom) return;
    const oldRadius = RADIUS * oldZoom;
    const anchor = invert((sx - C) / oldRadius, (sy - C) / oldRadius, rotRef.current);
    const newRadius = RADIUS * next;
    let r = rotRef.current;
    if (anchor) {
      for (let i = 0; i < 4; i++) {
        const p = project(anchor.lon, anchor.lat, r);
        r = dragged(r, sx - (C + p.x * newRadius), sy - (C + p.y * newRadius), newRadius);
      }
    }
    setZoom(next);
    setRot(r);
  }, []);

  const toSvg = useCallback((clientX: number, clientY: number): [number, number] => {
    const rect = svgRef.current?.getBoundingClientRect();
    const k = SIZE / (rect?.width || SIZE);
    return [(clientX - (rect?.left ?? 0)) * k, (clientY - (rect?.top ?? 0)) * k];
  }, []);

  // The wheel zooms. It needs a non-passive listener, otherwise the page would scroll as well.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (busy.current) return;
      const [sx, sy] = toSvg(e.clientX, e.clientY);
      const unit = e.deltaMode === 1 ? 16 : 1; // lines or pixels
      zoomAt(Math.exp(-e.deltaY * unit * 0.0016), sx, sy);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt, toSvg]);

  const centre = (factor: number): void => zoomAt(factor, C, C);
  const resetZoom = (): void => {
    setZoom(1);
  };

  // Countries without books first, so the gold ones are drawn on top.
  const order = useMemo(() => Object.keys(world).sort((a, b) => (counts[a] ? 1 : 0) - (counts[b] ? 1 : 0)), [world, counts]);

  const grid = GRID.map((line) => linePath(line, rot, C, C, radius)).join("");

  const onPointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    touched.current = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { x: e.clientX, y: e.clientY, moved: pointers.current.size > 1 ? 99 : 0 };
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Two fingers: pinch to zoom around the middle between them.
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current && dist > 0 && !busy.current) {
        const [sx, sy] = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(dist / pinch.current, sx, sy);
      }
      pinch.current = dist;
      if (drag.current) drag.current.moved = 99;
      return;
    }
    const d = drag.current;
    if (!d || busy.current) return;
    const scale = SIZE / (e.currentTarget.getBoundingClientRect().width || SIZE);
    const dx = (e.clientX - d.x) * scale;
    const dy = (e.clientY - d.y) * scale;
    d.moved += Math.abs(dx) + Math.abs(dy);
    // Follow the pointer outside the globe too, but only once it is really a drag (capturing earlier would
    // swallow the click on a country).
    if (d.moved > 6) e.currentTarget.setPointerCapture?.(e.pointerId);
    d.x = e.clientX;
    d.y = e.clientY;
    setRot((r) => dragged(r, dx, dy, RADIUS * zoomRef.current));
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>): void => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    // A click that ends a real drag must not pick a country.
    window.setTimeout(() => {
      drag.current = null;
    }, 0);
  };
  const wasDragged = (): boolean => (drag.current?.moved ?? 0) > 6;

  const onKey = (e: KeyboardEvent<SVGSVGElement>): void => {
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      centre(BUTTON_STEP);
      return;
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      centre(1 / BUTTON_STEP);
      return;
    }
    if (e.key === "0") {
      e.preventDefault();
      resetZoom();
      return;
    }
    const step = 12 / zoomRef.current;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = move[e.key];
    if (!m) return;
    e.preventDefault();
    touched.current = true;
    setRot((r) => ({ lon: wrapLon(r.lon + m[0]), lat: clampLat(r.lat + m[1]) }));
  };

  return (
    <div className="gl-globe">
      <svg
        ref={svgRef}
        className="gl-svg"
        onDoubleClick={(e) => {
          const [sx, sy] = toSvg(e.clientX, e.clientY);
          zoomAt(2, sx, sy);
        }}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="group"
        tabIndex={0}
        aria-label="Globo"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKey}
      >
        <defs>
          <radialGradient id="gl-ocean" cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#2c5a78" />
            <stop offset="55%" stopColor="#14354d" />
            <stop offset="100%" stopColor="#081a29" />
          </radialGradient>
          <radialGradient id="gl-shade" cx="35%" cy="30%" r="75%">
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
          <clipPath id="gl-window">
            <circle cx={C} cy={C} r={RADIUS} />
          </clipPath>
        </defs>
        <circle className="gl-sea" cx={C} cy={C} r={RADIUS} fill="url(#gl-ocean)" />
        <g clipPath="url(#gl-window)">
          <path className="gl-grid" d={grid} />
          {order.map((code) => {
            const country = world[code]!;
            const d = country.r.map((ring) => ringPath(ring, rot, C, C, radius)).filter(Boolean).join("");
            if (!d) return null;
            const books = counts[code] ?? 0;
            if (!books) return <path key={code} className="gl-country" d={d} />;
            return (
              <path
                key={code}
                className={`gl-country gl-country--books${hover === code ? " is-hover" : ""}`}
                d={d}
                role="button"
                tabIndex={0}
                aria-label={describe(code, books)}
                onPointerEnter={() => setHover(code)}
                onPointerLeave={() => setHover((h) => (h === code ? null : h))}
                onFocus={() => setHover(code)}
                onBlur={() => setHover((h) => (h === code ? null : h))}
                onClick={() => {
                  if (!wasDragged()) choose(code);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    choose(code);
                  }
                }}
              />
            );
          })}
        </g>
        <circle className="gl-shade" cx={C} cy={C} r={RADIUS} fill="url(#gl-shade)" pointerEvents="none" />
        <circle className="gl-rim" cx={C} cy={C} r={RADIUS} fill="none" pointerEvents="none" />
      </svg>
      <div className="gl-zoom" role="group" aria-label={t("globe.zoom")}>
        <button type="button" className="gl-zoom-btn" onClick={() => centre(BUTTON_STEP)} disabled={zoom >= MAX_ZOOM} aria-label={t("globe.zoomIn")}>
          +
        </button>
        <button type="button" className="gl-zoom-btn gl-zoom-val" onClick={resetZoom} disabled={zoom === 1} aria-label={t("globe.zoomReset")}>
          {zoom.toFixed(1).replace(/\.0$/, "")}×
        </button>
        <button type="button" className="gl-zoom-btn" onClick={() => centre(1 / BUTTON_STEP)} disabled={zoom <= MIN_ZOOM} aria-label={t("globe.zoomOut")}>
          −
        </button>
      </div>
      <p className="gl-tip" role="status" aria-live="polite">
        {hover ? describe(hover, counts[hover] ?? 0) : " "}
      </p>
    </div>
  );
}
