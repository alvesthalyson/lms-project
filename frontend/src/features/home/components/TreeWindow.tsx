import { useEffect, useRef, type CSSProperties } from "react";

import type { Category } from "@/features/books/types";
import { useT } from "@/lib/i18n/useT";

import { coreLeafPath, layout, leafPath, tilePath, veinPath, type BranchSpec, type LeafKind, type LeafSpec, type TileSpec } from "./treeGeometry";

export { leafPath, tilePath } from "./treeGeometry";

interface TreeWindowProps {
  categories: readonly Category[];
  onPick: (category: Category) => void;
  onClose: () => void;
}

/** Glass of the cells, from the middle to the edge: pale where the light comes through, deeper blue (or gold) outside. */
const GLASS: Record<LeafKind, readonly [string, string, string, string]> = {
  blue: ["#f1faff", "#7ccaff", "#2d8ae0", "#1a559e"],
  sky: ["#f2ffff", "#8ae8f0", "#2aa9d6", "#17709f"],
  gold: ["#fff6cf", "#ffd966", "#e3a62c", "#9c6a14"],
};

/** Loose cells that keep drifting down after the tree has grown. */
const FALLING = [
  { x: -140, delay: 5.2, dur: 11, size: 0.55, kind: "gold" },
  { x: 110, delay: 7.5, dur: 13, size: 0.5, kind: "sky" },
  { x: -30, delay: 10, dur: 12, size: 0.45, kind: "blue" },
  { x: 165, delay: 13, dur: 14, size: 0.55, kind: "gold" },
] as const;

/** A ring of small cells round the edge of the glass, all pointing inwards, as in the picture. */
const RIM = Array.from({ length: 28 }, (_, i) => i * (360 / 28));

function vars(delay: number, dur: number, extra: Record<string, string> = {}): CSSProperties {
  return { "--d": `${delay}s`, "--t": `${dur}s`, ...extra } as CSSProperties;
}

function flight(piece: LeafSpec | TileSpec): CSSProperties {
  return vars(piece.delay, piece.dur, { "--fx": `${piece.fx}px`, "--fy": `${piece.fy}px`, "--fr": `${piece.fr}deg` });
}

/**
 * The window's tree of life as a menu: the trunk, limbs and roots grow in front of the reader, glass cells fly in
 * tumbling and settle on the twigs, and one dark tile per category carries its name, flat. Choosing a tile hands its
 * category to `onPick`. Modal: Esc, the X button and a click outside close it.
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
  const names = categories.map((category) => catName(category));
  const { branches, leaves, tiles } = layout(names);
  const solid = branches.filter((b) => b.shape);
  const lines = branches.filter((b) => !b.shape);

  const drawCell = (leaf: LeafSpec) => (
    <g key={leaf.key} transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)})`}>
      <g className="tw-fx" style={flight(leaf)}>
        <g className="tw-fy" style={flight(leaf)}>
          <g transform={`rotate(${leaf.angle.toFixed(1)})`}>
            <path d={leafPath(leaf.halfWidth, leaf.length)} fill={`url(#tw-${leaf.kind})`} className="tw-leaf" style={{ filter: `brightness(${leaf.tone.toFixed(2)})` }} />
            <path d={coreLeafPath(leaf.halfWidth, leaf.length)} className="tw-core" />
            <path d={veinPath(leaf.length)} className="tw-vein" />
          </g>
        </g>
      </g>
    </g>
  );

  const drawTile = (tile: TileSpec) => {
    const category = categories[tile.index]!;
    const name = names[tile.index]!;
    return (
      <g key={tile.key} transform={`translate(${tile.x.toFixed(1)} ${tile.y.toFixed(1)})`}>
        <g className="tw-fx" style={flight(tile)}>
          <g className="tw-fy" style={flight(tile)}>
            <g
              className="tw-tile"
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
              <path d={tilePath(tile.w, tile.h)} fill="url(#tw-tile)" className="tw-tile-glass" />
              <path d={tilePath(tile.w - 10, tile.h - 9)} className="tw-tile-inner" />
              <text className="tw-label" style={{ fontSize: tile.size }} textAnchor="middle" dominantBaseline="central">
                {name}
              </text>
            </g>
          </g>
        </g>
      </g>
    );
  };

  const wood = (b: BranchSpec) => (
    <g key={b.key} mask={`url(#tw-m-${b.key})`}>
      <path d={b.shape!.left} className="tw-edge" />
      <path d={b.shape!.right} className="tw-edge" />
      <path d={b.shape!.fill} fill="url(#tw-wood)" />
      {b.grain.map((d, i) => (
        <path key={i} d={d} className="tw-grain" />
      ))}
    </g>
  );

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
            <radialGradient id="tw-glass" cx="0.5" cy="0.66" r="0.66">
              <stop offset="0" stopColor="#f4fbff" />
              <stop offset="0.3" stopColor="#a9dcff" />
              <stop offset="0.65" stopColor="#3f94e6" />
              <stop offset="1" stopColor="#1a4d9c" />
            </radialGradient>
            <linearGradient id="tw-wood" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#0d2a38" />
              <stop offset="1" stopColor="#1f5266" />
            </linearGradient>
            <linearGradient id="tw-tile" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2f7fd6" />
              <stop offset="1" stopColor="#123f86" />
            </linearGradient>
            <radialGradient id="tw-aura">
              <stop offset="0" stopColor="#8fd0ff" stopOpacity="0.5" />
              <stop offset="0.6" stopColor="#5aa8ff" stopOpacity="0.14" />
              <stop offset="1" stopColor="#5aa8ff" stopOpacity="0" />
            </radialGradient>
            {solid.map((b) => (
              <mask key={b.key} id={`tw-m-${b.key}`} maskUnits="userSpaceOnUse" x="-200" y="-200" width="400" height="400">
                <path d={b.d} pathLength="1" className="tw-reveal" strokeWidth={b.width + 10} style={vars(b.delay, b.dur)} />
              </mask>
            ))}
          </defs>

          <circle r="235" fill="url(#tw-aura)" className="tw-aura" />

          <g className="tw-window">
            <circle r="180" fill="url(#tw-glass)" />
            <g className="tw-rim-cells" aria-hidden>
              {RIM.map((angle) => (
                <g key={angle} transform={`rotate(${angle}) translate(0 -178)`}>
                  <path d={leafPath(7.5, 24)} transform="rotate(180)" fill="url(#tw-blue)" className="tw-leaf" />
                </g>
              ))}
            </g>
            <g className="tw-lead" aria-hidden>
              <circle r="62" />
              <circle r="122" />
              {Array.from({ length: 12 }, (_, i) => (
                <line key={i} x1="0" y1="-24" x2="0" y2="-150" transform={`rotate(${i * 30})`} />
              ))}
            </g>
            <circle r="186" className="tw-frame" />
            <circle r="180" className="tw-rim" />
          </g>

          <g className="tw-canopy">
            {leaves.map(drawCell)}
            <g className="tw-limbs" aria-hidden>
              {solid.filter((b) => b.depth === 5).map(wood)}
              {lines.map((b) => (
                <path key={`g${b.key}`} d={b.d} pathLength="1" className="tw-grow tw-gold" strokeWidth={b.width + 3} style={vars(b.delay, b.dur)} />
              ))}
              {lines.map((b) => (
                <path key={`t${b.key}`} d={b.d} pathLength="1" className="tw-grow tw-wood" strokeWidth={b.width} style={vars(b.delay, b.dur)} />
              ))}
              {solid.filter((b) => b.depth !== 5).sort((a, b) => a.depth - b.depth).map(wood)}
            </g>
            {tiles.map(drawTile)}
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
