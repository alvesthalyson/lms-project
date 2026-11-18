import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { between, clampLat, dragged, easeInOut, graticule, linePath, ringPath, wrapLon, type Rotation } from "./geo";
import type { World } from "./world";

const SIZE = 400;
const C = SIZE / 2;
const RADIUS = 186;
const GRID = graticule();

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
  const rotRef = useRef(rot);
  rotRef.current = rot;
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
      if (!touched.current && !drag.current && !busy.current) {
        setRot((r) => ({ lon: ((r.lon + 0.12 + 540) % 360) - 180, lat: r.lat }));
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

  // Countries without books first, so the gold ones are drawn on top.
  const order = useMemo(() => Object.keys(world).sort((a, b) => (counts[a] ? 1 : 0) - (counts[b] ? 1 : 0)), [world, counts]);

  const grid = GRID.map((line) => linePath(line, rot, C, C, RADIUS)).join("");

  const onPointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    touched.current = true;
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
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
    setRot((r) => dragged(r, dx, dy, RADIUS));
  };
  const onPointerUp = (): void => {
    // A click that ends a real drag must not pick a country.
    window.setTimeout(() => {
      drag.current = null;
    }, 0);
  };
  const wasDragged = (): boolean => (drag.current?.moved ?? 0) > 6;

  const onKey = (e: KeyboardEvent<SVGSVGElement>): void => {
    const step = 12;
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
        className="gl-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="group"
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
        </defs>
        <circle className="gl-sea" cx={C} cy={C} r={RADIUS} fill="url(#gl-ocean)" />
        <path className="gl-grid" d={grid} />
        {order.map((code) => {
          const country = world[code]!;
          const d = country.r.map((ring) => ringPath(ring, rot, C, C, RADIUS)).filter(Boolean).join("");
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
        <circle className="gl-shade" cx={C} cy={C} r={RADIUS} fill="url(#gl-shade)" pointerEvents="none" />
        <circle className="gl-rim" cx={C} cy={C} r={RADIUS} fill="none" pointerEvents="none" />
      </svg>
      <p className="gl-tip" role="status" aria-live="polite">
        {hover ? describe(hover, counts[hover] ?? 0) : " "}
      </p>
    </div>
  );
}
