import { useEffect, useRef } from "react";

import type { Category } from "@/features/books/types";
import { useT } from "@/lib/i18n/useT";

interface RoseWindowProps {
  categories: readonly Category[];
  onPick: (category: Category) => void;
  onClose: () => void;
}

/** Jewel tones of the glass, in turn around the rose. */
const GLASS = ["#c0392b", "#e08a1e", "#d9b92e", "#4f9a43", "#2f8f8a", "#3b6fb6", "#7a4fb0", "#b0457f"] as const;

const TIP = 170; // petal tip radius, in the 400x400 drawing
const BASE = 40; // where the petals leave the centre medallion
const LABEL_AT = 112;

/** One petal pointing straight up from the centre: narrow at the base, widest near the label, pointed at the tip. */
export function petalPath(count: number): string {
  const half = Math.PI / Math.max(count, 3);
  const b = BASE * Math.sin(half) * 0.92;
  const y0 = BASE * Math.cos(half);
  const hw = Math.min(70, LABEL_AT * Math.tan(half) * 0.88);
  return (
    `M ${-b} ${-y0} C ${-hw * 1.35} ${-LABEL_AT * 0.7} ${-hw * 1.1} ${-TIP + 34} 0 ${-TIP} ` +
    `C ${hw * 1.1} ${-TIP + 34} ${hw * 1.35} ${-LABEL_AT * 0.7} ${b} ${-y0} Z`
  );
}

/** Label size shrinks a little for long names so they stay inside the petal. */
export function labelSize(name: string): number {
  return Math.max(9, Math.min(16, 17 - Math.max(0, name.length - 6) * 0.75));
}

/**
 * The stained-glass rosette as a menu: a rose of glass with one petal per category. The petals bloom open one
 * after another; choosing one hands its category to `onPick`. Modal: Esc, the X button and a click outside close it.
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
  const path = petalPath(count);

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
            <radialGradient id="rs-shine" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 -60) scale(150)">
              <stop offset="0" stopColor="#fff7d6" stopOpacity="0.75" />
              <stop offset="0.55" stopColor="#fff7d6" stopOpacity="0.12" />
              <stop offset="1" stopColor="#fff7d6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle r="190" className="rs-frame" />
          <circle r="178" className="rs-pane" />

          {categories.map((category, i) => {
            const angle = (360 / count) * i;
            const name = catName(category);
            const flip = angle > 180;
            return (
              <g key={category.id} transform={`rotate(${angle})`}>
                <g
                  className="rs-bloom"
                  style={{ animationDelay: `${0.12 + i * 0.07}s` }}
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
                  <path d={path} fill={GLASS[i % GLASS.length]} className="rs-petal" />
                  <path d={path} fill="url(#rs-shine)" className="rs-glint" />
                  <text
                    className="rs-label"
                    transform={`translate(0 ${-LABEL_AT}) rotate(${flip ? 90 : -90})`}
                    style={{ fontSize: labelSize(name) }}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {name}
                  </text>
                </g>
              </g>
            );
          })}

          <circle r={BASE - 2} className="rs-heart" />
          <text className="rs-tree" textAnchor="middle" dominantBaseline="central" aria-hidden>
            🌳
          </text>
        </svg>
      </section>
    </div>
  );
}
