import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import type { Category } from "@/features/books/types";
import { useT } from "@/lib/i18n/useT";

import { TIMES, endDelay, fireflies, lineDelay, swirl, zoomFor } from "./forestScene";
import { dayNumber, taleOfTheDay } from "./stories";

const FOREST = "/floresta-vagalumes.jpg";

export interface ForestOrigin {
  /** Centre and radius of the stained-glass window, as fractions of the room's picture (radius: of its width). */
  x: number;
  y: number;
  r: number;
}

interface ForestWindowProps {
  /** The picture of the room the reader is in: it is what the camera zooms out of. */
  picture: string;
  /** Width / height of that picture. */
  aspect: number;
  origin: ForestOrigin;
  categories: readonly Category[];
  /** The tale ends by offering the shelf of its category. */
  onOpenCategory: (category: Category) => void;
  onClose: () => void;
}

function vars(values: Record<string, string | number>): CSSProperties {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [`--${key}`, String(value)])) as CSSProperties;
}

/**
 * The window of the library, opened: the camera goes through the stained-glass tree, which turns into a swirl of
 * light, and comes out in a forest of fireflies where the tale of the day is told, a line at a time. At the end the
 * reader can continue on the shelf of the tale's category. Modal: Esc and the X button close it.
 */
export function ForestWindow({ picture, aspect, origin, categories, onOpenCategory, onClose }: ForestWindowProps) {
  const { t, lang, catName } = useT();
  const closeRef = useRef<HTMLButtonElement>(null);

  const today = useMemo(() => new Date(), []);
  const tale = taleOfTheDay(today);
  const lines = tale.lines[lang];
  // The category of the tale; if the library has no such shelf, another one, so that the tale still leads somewhere.
  const next = categories.find((category) => category.slug === tale.category) ?? (categories.length > 0 ? categories[dayNumber(today) % categories.length] : undefined);
  const zoom = useMemo(() => zoomFor({ w: window.innerWidth, h: window.innerHeight }, aspect, origin.r), [aspect, origin.r]);
  const sparks = useMemo(() => swirl(), []);
  const flies = useMemo(() => fireflies(), []);

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

  return (
    <div
      className="fw-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("forest.title")}
      style={vars({ asp: aspect, fx: origin.x, fy: origin.y, z: zoom })}
    >
      <div className="fw-forest" aria-hidden>
        <div className="fw-forest-img" style={{ backgroundImage: `url(${FOREST})` }} />
      </div>

      <div className="fw-fireflies" aria-hidden>
        {flies.map((fly) => (
          <span key={fly.id} className="fw-fly" style={{ left: `${fly.x}%`, top: `${fly.y}%`, ...vars({ s: `${fly.size}px`, d: `${fly.delay}s`, t: `${fly.dur}s`, dx: fly.dx, dy: fly.dy }) }} />
        ))}
      </div>

      <div className="fw-room" aria-hidden style={{ backgroundImage: `url(${picture})`, animationDuration: `${TIMES.zoom}s` }} />

      <div className="fw-swirl" aria-hidden>
        {sparks.map((spark) => (
          <span key={spark.id} className="fw-orbit" style={vars({ a: `${spark.angle}deg`, turns: spark.turns, d: `${spark.delay}s`, t: `${spark.dur}s` })}>
            <span className={spark.warm ? "fw-spark fw-spark--warm" : "fw-spark"} style={vars({ r: spark.radius, s: `${spark.size}px` })} />
          </span>
        ))}
      </div>
      <div className="fw-flash" aria-hidden />
      <div className="fw-vignette" aria-hidden />

      <button ref={closeRef} type="button" className="hm-close fw-close" onClick={onClose} aria-label={t("forest.close")}>
        ×
      </button>

      <div className="fw-story">
        <p className="fw-kicker">{t("forest.kicker")}</p>
        <h2 className="fw-title">{tale.title[lang]}</h2>
        <div className="fw-lines">
          {lines.map((line, i) => (
            <p key={i} className={i === lines.length - 1 ? "fw-line fw-line--last" : "fw-line"} style={vars({ d: `${lineDelay(i)}s`, ls: `${TIMES.line}s` })}>
              {line}
            </p>
          ))}
        </div>
        <div className="fw-end" style={vars({ d: `${endDelay(lines.length)}s` })}>
          {next && (
            <button type="button" className="fw-btn fw-btn--main" onClick={() => onOpenCategory(next)}>
              {t("forest.next")} {catName(next)}
            </button>
          )}
          <button type="button" className="fw-btn" onClick={onClose}>
            {t("forest.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
