import { useEffect, useRef, type CSSProperties } from "react";

import type { Category } from "@/features/books/types";
import { useT } from "@/lib/i18n/useT";

import { labelSize, layout, petalPath, veinPaths, type PetalSpec } from "./roseGeometry";

export { labelSize, petalPath } from "./roseGeometry";

interface RoseWindowProps {
  categories: readonly Category[];
  onPick: (category: Category) => void;
  onClose: () => void;
}

/** Fills of the rings, base to rim: darker and richer towards the heart of the flower, paler on the outer petals. */
const FILLS: readonly (readonly [string, string, string, string])[] = [
  ["#45050f", "#86112a", "#bd2845", "#e07a8c"],
  ["#560919", "#8f1630", "#bb2b47", "#dd6479"],
  ["#470815", "#7f122b", "#ab2640", "#cc566c"],
  ["#3d0712", "#7e1128", "#aa2640", "#c94f66"],
  ["#2c050d", "#5f0c1e", "#8f1a33", "#a8344d"],
];

/** Loose petals that keep drifting down after the flower has opened. */
const FALLING = [
  { x: -150, delay: 4.2, dur: 11, size: 0.2 },
  { x: 120, delay: 6.5, dur: 13, size: 0.17 },
  { x: -40, delay: 9, dur: 12, size: 0.15 },
  { x: 175, delay: 12, dur: 14, size: 0.18 },
];

function flight(petal: PetalSpec): CSSProperties {
  return { "--d": `${petal.delay}s`, "--t": `${petal.dur}s`, "--fx": `${petal.fx}px`, "--fy": `${petal.fy}px`, "--fr": `${petal.fr}deg` } as CSSProperties;
}

/**
 * The window's rose as a menu: a flower of velvet petals that assembles itself in front of the reader (loose petals fly
 * in, tumbling, and settle one ring after another, the bud first), with one outer petal per category. Choosing a petal
 * hands its category to `onPick`. Modal: Esc, the X button and a click outside close it.
 */
export function RoseWindow({ categories, onPick, onClose }: RoseWindowProps) {
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
  const petals = layout(count);
  const layers = [0, 1, 2, 3, 4].map((layer) => petals.filter((p) => p.layer === layer));
  const heart = petalPath(44, 36);

  const drawPetal = (petal: PetalSpec) => {
    const category = petal.labelled ? categories[petal.index] : undefined;
    const name = category ? catName(category) : "";
    const flip = petal.angle > 180;
    const body = (
      <g transform={`translate(0 ${-petal.baseR}) rotate(${petal.tilt.toFixed(1)})`}>
        <path d={petalPath(petal.width, petal.length)} fill={`url(#rs-g${petal.layer})`} className="rs-petal" style={{ filter: `brightness(${petal.tone.toFixed(2)})` }} />
        <path d={veinPaths(petal.width, petal.length).join(" ")} className="rs-veins" />
        <path d={petalPath(petal.width, petal.length)} fill="url(#rs-shade)" className="rs-shade" />
        <path d={petalPath(petal.width, petal.length)} fill="none" stroke="url(#rs-rim)" className="rs-rim" />
        <ellipse cx="0" cy={-petal.length * 0.86} rx={petal.width * 0.3} ry={petal.length * 0.1} fill="url(#rs-sheen)" className="rs-sheen" />
        {category && (
          <text
            className="rs-label"
            transform={`translate(0 ${-petal.length * 0.79}) rotate(${flip ? 90 : -90})`}
            style={{ fontSize: labelSize(name) }}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {name}
          </text>
        )}
      </g>
    );
    return (
      <g key={petal.key} transform={`rotate(${petal.angle.toFixed(1)})`}>
        <g className="rs-fx" style={flight(petal)}>
          <g className="rs-fy" style={flight(petal)}>
            {category ? (
              <g
                className="rs-hover rs-hover--pick"
                role="button"
                tabIndex={0}
                aria-label={name}
                onClick={() => onPick(category)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPick(category);
                  }
                }}
              >
                {body}
              </g>
            ) : (
              <g className="rs-hover">{body}</g>
            )}
          </g>
        </g>
      </g>
    );
  };

  return (
    <div className="hm-backdrop rs-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rs-wrap" role="dialog" aria-modal="true" aria-labelledby="rs-title">
        <button ref={closeRef} type="button" className="hm-close" onClick={onClose} aria-label={t("rose.close")}>
          ×
        </button>
        <header className="rs-head">
          <p className="hm-kicker">{t("rose.kicker")}</p>
          <h2 id="rs-title">{t("rose.title")}</h2>
          <p className="gl-hint">{count === 0 ? t("rose.empty") : t("rose.hint")}</p>
        </header>

        <svg className="rs-svg" viewBox="-200 -200 400 400" aria-hidden={count === 0}>
          <defs>
            {FILLS.map((stops, layer) => (
              <radialGradient key={layer} id={`rs-g${layer}`} cx="0.5" cy="1" r="1.05" fx="0.5" fy="1">
                <stop offset="0" stopColor={stops[0]} />
                <stop offset="0.4" stopColor={stops[1]} />
                <stop offset="0.78" stopColor={stops[2]} />
                <stop offset="1" stopColor={stops[3]} />
              </radialGradient>
            ))}
            <linearGradient id="rs-shade" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#1a0006" stopOpacity="0.62" />
              <stop offset="0.5" stopColor="#1a0006" stopOpacity="0.12" />
              <stop offset="1" stopColor="#1a0006" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="rs-rim" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0.55" stopColor="#ffd9e0" stopOpacity="0" />
              <stop offset="1" stopColor="#ffd9e0" stopOpacity="0.7" />
            </linearGradient>
            <radialGradient id="rs-sheen">
              <stop offset="0" stopColor="#fff0f2" stopOpacity="0.5" />
              <stop offset="1" stopColor="#fff0f2" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rs-aura">
              <stop offset="0" stopColor="#ffd28a" stopOpacity="0.5" />
              <stop offset="0.6" stopColor="#ffb25a" stopOpacity="0.14" />
              <stop offset="1" stopColor="#ffb25a" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle r="230" fill="url(#rs-aura)" className="rs-aura" />

          <g className="rs-flower">
            {layers.map((layer, i) => (
              <g key={i} className={`rs-layer rs-layer--${i}`}>
                {layer.map(drawPetal)}
              </g>
            ))}
            <g className="rs-layer rs-layer--5" aria-hidden>
              <path d={heart} fill="url(#rs-g4)" className="rs-petal" transform="rotate(18)" />
              <path d="M 0 0 m -3 0 a 3 3 0 1 1 6 0 a 6 6 0 1 1 -12 0 a 9 9 0 1 1 18 0" className="rs-swirl" />
            </g>
          </g>

          {FALLING.map((fall, i) => (
            <g key={i} className="rs-fall" aria-hidden style={{ "--x": `${fall.x}px`, "--d": `${fall.delay}s`, "--t": `${fall.dur}s` } as CSSProperties}>
              <path d={petalPath(90, 110)} fill="url(#rs-g0)" className="rs-petal" transform={`scale(${fall.size})`} />
            </g>
          ))}
        </svg>
      </section>
    </div>
  );
}
