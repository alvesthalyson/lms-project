import { useEffect, useRef, type CSSProperties } from "react";

import type { Category } from "@/features/books/types";
import { useT } from "@/lib/i18n/useT";

import { labelSize, layout, leafPath, veinPath, type LeafKind, type LeafSpec } from "./treeGeometry";

export { labelSize, leafPath } from "./treeGeometry";

interface TreeWindowProps {
  categories: readonly Category[];
  onPick: (category: Category) => void;
  onClose: () => void;
}

/** Glass of the leaves, from the base to the tip: pale where the light comes through, deeper blue or gold at the edge. */
const GLASS: Record<LeafKind, readonly [string, string, string, string]> = {
  blue: ["#f1faff", "#7ccaff", "#2d8ae0", "#1a559e"],
  sky: ["#f0fffb", "#86e6d6", "#2ba9ad", "#176f7c"],
  gold: ["#fff6cf", "#ffd966", "#e3a62c", "#9c6a14"],
};

/** Loose leaves that keep drifting down after the tree has grown. */
const FALLING = [
  { x: -140, delay: 5.2, dur: 11, size: 0.5, kind: "gold" },
  { x: 110, delay: 7.5, dur: 13, size: 0.45, kind: "sky" },
  { x: -30, delay: 10, dur: 12, size: 0.4, kind: "blue" },
  { x: 165, delay: 13, dur: 14, size: 0.5, kind: "gold" },
] as const;

function vars(delay: number, dur: number, extra: Record<string, string> = {}): CSSProperties {
  return { "--d": `${delay}s`, "--t": `${dur}s`, ...extra } as CSSProperties;
}

function flight(leaf: LeafSpec): CSSProperties {
  return vars(leaf.delay, leaf.dur, { "--fx": `${leaf.fx}px`, "--fy": `${leaf.fy}px`, "--fr": `${leaf.fr}deg` });
}

/**
 * The window's tree of life as a menu: the trunk, limbs and roots grow in front of the reader, glass leaves fly in
 * tumbling and settle on the twigs, and the larger leaves carry the categories. Choosing a leaf hands its category to
 * `onPick`. Modal: Esc, the X button and a click outside close it.
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
  const { branches, leaves } = layout(count);
  const small = leaves.filter((l) => !l.labelled);
  const named = leaves.filter((l) => l.labelled);

  const drawLeaf = (leaf: LeafSpec) => {
    const category = leaf.labelled ? categories[leaf.index] : undefined;
    const name = category ? catName(category) : "";
    const heading = ((leaf.angle % 360) + 360) % 360;
    const body = (
      <>
        <path d={leafPath(leaf.halfWidth, leaf.length)} fill={`url(#tw-${leaf.kind})`} className="tw-leaf" style={{ filter: `brightness(${leaf.tone.toFixed(2)})` }} />
        <path d={veinPath(leaf.halfWidth, leaf.length, leaf.labelled)} className="tw-vein" />
        {category && (
          <text
            className="tw-label"
            transform={`translate(0 ${-leaf.length * 0.5}) rotate(${heading > 180 ? 90 : -90})`}
            style={{ fontSize: labelSize(name) }}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {name}
          </text>
        )}
      </>
    );
    return (
      <g key={leaf.key} transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)}) rotate(${leaf.angle.toFixed(1)})`}>
        <g className="tw-fx" style={flight(leaf)}>
          <g className="tw-fy" style={flight(leaf)}>
            {category ? (
              <g
                className="tw-hover tw-hover--pick"
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
              <g className="tw-hover">{body}</g>
            )}
          </g>
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

        <svg className="tw-svg" viewBox="-200 -200 400 400" aria-hidden={count === 0}>
          <defs>
            {(Object.keys(GLASS) as LeafKind[]).map((kind) => (
              <radialGradient key={kind} id={`tw-${kind}`} cx="0.5" cy="0.78" r="0.85" fx="0.5" fy="0.9">
                <stop offset="0" stopColor={GLASS[kind][0]} />
                <stop offset="0.38" stopColor={GLASS[kind][1]} />
                <stop offset="0.75" stopColor={GLASS[kind][2]} />
                <stop offset="1" stopColor={GLASS[kind][3]} />
              </radialGradient>
            ))}
            <radialGradient id="tw-glass" cx="0.5" cy="0.62" r="0.62">
              <stop offset="0" stopColor="#b9e4ff" />
              <stop offset="0.5" stopColor="#4a9be6" />
              <stop offset="1" stopColor="#1b4f9a" />
            </radialGradient>
            <radialGradient id="tw-aura">
              <stop offset="0" stopColor="#8fd0ff" stopOpacity="0.5" />
              <stop offset="0.6" stopColor="#5aa8ff" stopOpacity="0.14" />
              <stop offset="1" stopColor="#5aa8ff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle r="235" fill="url(#tw-aura)" className="tw-aura" />

          <g className="tw-window">
            <circle r="180" fill="url(#tw-glass)" />
            <g className="tw-lead" aria-hidden>
              <circle r="62" />
              <circle r="122" />
              {Array.from({ length: 12 }, (_, i) => (
                <line key={i} x1="0" y1="-24" x2="0" y2="-178" transform={`rotate(${i * 30})`} />
              ))}
            </g>
            <circle r="186" className="tw-frame" />
            <circle r="179" className="tw-rim" />
          </g>

          <g className="tw-canopy">
            <g className="tw-limbs" aria-hidden>
              {branches.map((b) => (
                <path key={`g${b.key}`} d={b.d} pathLength="1" className="tw-grow tw-gold" strokeWidth={b.width + 3.4} style={vars(b.delay, b.dur)} />
              ))}
              {branches.map((b) => (
                <path key={`t${b.key}`} d={b.d} pathLength="1" className="tw-grow tw-wood" strokeWidth={b.width} style={vars(b.delay, b.dur)} />
              ))}
            </g>
            {small.map(drawLeaf)}
            {named.map(drawLeaf)}
          </g>

          {FALLING.map((fall, i) => (
            <g key={i} className="tw-fall" aria-hidden style={vars(fall.delay, fall.dur, { "--x": `${fall.x}px` })}>
              <path d={leafPath(11, 34)} fill={`url(#tw-${fall.kind})`} className="tw-leaf" transform={`scale(${fall.size * 1.6})`} />
            </g>
          ))}
        </svg>
      </section>
    </div>
  );
}
