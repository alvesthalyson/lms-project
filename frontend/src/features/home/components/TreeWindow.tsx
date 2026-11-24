import { useEffect, useRef, type CSSProperties } from "react";

import type { Category } from "@/features/books/types";
import { useT } from "@/lib/i18n/useT";

import { H, ROTATE_DEG, W, beamPolygon, layout, type BeamSpec } from "./treeGeometry";

interface TreeWindowProps {
  categories: readonly Category[];
  onPick: (category: Category) => void;
  onClose: () => void;
}

const PICTURE = "/arvore-carvalho.jpg";

/** The lit windows and the door of the trunk, in picture pixels: they flicker like candles. */
const LIGHTS = [
  { x: 455, y: 590, r: 70, delay: 0, dur: 3.1 },
  { x: 655, y: 800, r: 60, delay: 0.8, dur: 2.7 },
  { x: 592, y: 925, r: 78, delay: 0.3, dur: 3.6 },
  { x: 372, y: 945, r: 60, delay: 1.4, dur: 2.9 },
  { x: 540, y: 1068, r: 40, delay: 0.5, dur: 2.4 },
  { x: 540, y: 1250, r: 130, delay: 0.2, dur: 4.2 },
] as const;

/** Leaves drifting down through the crown, and fireflies rising in the shade. */
const LEAVES = [
  { x: 180, delay: 3.2, dur: 11, scale: 1.1 },
  { x: 420, delay: 5.5, dur: 13, scale: 0.9 },
  { x: 660, delay: 4.1, dur: 12, scale: 1.2 },
  { x: 850, delay: 7.2, dur: 14, scale: 1 },
  { x: 300, delay: 9, dur: 12, scale: 0.8 },
] as const;
const FIREFLIES = [
  { x: 160, y: 1180, delay: 1.2, dur: 7 },
  { x: 330, y: 1320, delay: 2.6, dur: 8 },
  { x: 760, y: 1260, delay: 0.6, dur: 9 },
  { x: 880, y: 1130, delay: 3.4, dur: 7.5 },
  { x: 250, y: 1020, delay: 4.2, dur: 8.5 },
  { x: 700, y: 1040, delay: 1.9, dur: 6.5 },
  { x: 120, y: 1400, delay: 5, dur: 9 },
  { x: 930, y: 1370, delay: 2.2, dur: 8 },
] as const;

function vars(delay: number, dur: number, extra: Record<string, string> = {}): CSSProperties {
  return { "--d": `${delay}s`, "--t": `${dur}s`, ...extra } as CSSProperties;
}

/**
 * The category menu: a giant oak whose crown lets through one beam of light per category. The picture rises up the
 * trunk, the beams open one after another and the name of each category is written down its beam, the letters small
 * at the top and growing as the light widens. Choosing a beam hands its category to `onPick`. Modal: Esc, the X
 * button and a click outside close it.
 */
export function TreeWindow({ categories, onPick, onClose }: TreeWindowProps) {
  const { t, catName } = useT();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  const count = categories.length;
  const beams = layout(categories.map((category) => catName(category)));

  const drawBeam = (beam: BeamSpec) => {
    const category = categories[beam.index]!;
    const pick = (): void => onPick(category);
    return (
      <g
        key={beam.key}
        className="bm"
        role="button"
        tabIndex={0}
        aria-label={beam.name}
        transform={`translate(${beam.x0.toFixed(1)} ${beam.y0.toFixed(1)}) rotate(${ROTATE_DEG.toFixed(2)})`}
        onClick={pick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            pick();
          }
        }}
      >
        <g className="bm-open" style={vars(beam.delay, beam.dur)}>
          <polygon points={beamPolygon(beam)} className="bm-shade" filter="url(#bm-blur)" />
          <polygon points={beamPolygon(beam)} fill="url(#bm-beam)" className="bm-light" filter="url(#bm-blur)" style={vars(beam.delay + beam.dur, 4 + (beam.index % 3), { "--o": "1" })} />
        </g>
        <polygon points={beamPolygon(beam, 14)} className="bm-hit" />
        <g aria-hidden>
          {beam.glyphs.map((glyph, i) => (
            <g key={i} transform={`translate(0 ${glyph.dist.toFixed(1)}) rotate(90)`}>
              <g className="bm-ch" style={vars(glyph.delay, 0.45)}>
                <text className="bm-glyph" fontSize={glyph.size.toFixed(1)} textAnchor="middle" dominantBaseline="central">
                  {glyph.ch}
                </text>
              </g>
            </g>
          ))}
        </g>
      </g>
    );
  };

  return (
    <div className="hm-backdrop tw-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="tw-wrap" role="dialog" aria-modal="true" aria-labelledby="tw-title">
        <button ref={closeRef} type="button" className="hm-close" onClick={onClose} aria-label={t("tree.close")}>
          ×
        </button>
        <header className="tw-head">
          <p className="hm-kicker">{t("tree.kicker")}</p>
          <h2 id="tw-title">{t("tree.title")}</h2>
          <p className="gl-hint">{count === 0 ? t("tree.empty") : t("tree.hint")}</p>
        </header>

        <div className="tw-arch">
          <svg className="tw-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden={count === 0}>
            <defs>
              <linearGradient id="bm-beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff3c4" stopOpacity="0.3" />
                <stop offset="0.45" stopColor="#ffe9ac" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ffe6a0" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="bm-glow">
                <stop offset="0" stopColor="#ffb347" stopOpacity="0.75" />
                <stop offset="0.5" stopColor="#ff9a2e" stopOpacity="0.25" />
                <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="bm-vignette" cx="0.5" cy="0.5" r="0.75">
                <stop offset="0.6" stopColor="#020a04" stopOpacity="0" />
                <stop offset="1" stopColor="#020a04" stopOpacity="0.55" />
              </radialGradient>
              <filter id="bm-blur" filterUnits="userSpaceOnUse" x="-400" y="-120" width="800" height="1100">
                <feGaussianBlur stdDeviation="10" />
              </filter>
              <path id="bm-leaf" d="M0 0 C8 -9 20 -8 30 0 C20 9 8 9 0 0 Z" />
            </defs>

            <g className="bm-cam">
              <image href={PICTURE} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid slice" />
              <rect width={W} height={H} fill="url(#bm-vignette)" pointerEvents="none" />

              <g className="bm-lights" aria-hidden>
                {LIGHTS.map((light) => (
                  <circle key={`${light.x}-${light.y}`} cx={light.x} cy={light.y} r={light.r} fill="url(#bm-glow)" className="bm-flicker" style={vars(light.delay, light.dur)} />
                ))}
              </g>

              <g className="bm-fireflies" aria-hidden>
                {FIREFLIES.map((fly) => (
                  <circle key={`${fly.x}-${fly.y}`} cx={fly.x} cy={fly.y} r="3.2" className="bm-fly" style={vars(fly.delay, fly.dur)} />
                ))}
              </g>

              <g className="bm-beams">{beams.map(drawBeam)}</g>

              <g className="bm-leaves" aria-hidden>
                {LEAVES.map((leaf) => (
                  <g key={leaf.x} className="bm-fall" style={vars(leaf.delay, leaf.dur, { "--x": `${leaf.x}px` })}>
                    <use href="#bm-leaf" className="bm-leaf" transform={`scale(${leaf.scale})`} />
                  </g>
                ))}
              </g>
            </g>
          </svg>
        </div>
      </section>
    </div>
  );
}
