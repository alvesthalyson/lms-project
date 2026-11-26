import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { Category } from "@/features/books/types";
import { usePrefs } from "@/lib/i18n/store";
import { useT } from "@/lib/i18n/useT";

import { FOREST, POSTER, TIMES, VIDEO, VIDEO_SECONDS, endDelay, fireflies, lineDelay } from "./forestScene";
import { dayNumber, taleOfTheDay } from "./stories";

interface ForestWindowProps {
  categories: readonly Category[];
  /** The tale ends by offering the shelf of its category. */
  onOpenCategory: (category: Category) => void;
  onClose: () => void;
}

function vars(values: Record<string, string | number>): CSSProperties {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [`--${key}`, String(value)])) as CSSProperties;
}

/**
 * The window of the library, opened: a short film takes the camera up to the stained-glass tree, which turns into a
 * swirl of light, and comes out in a forest of fireflies. When the film ends (or if it cannot play) the same forest
 * goes live and the tale of the day is told there, a line at a time. At the end the reader can continue on the shelf
 * of the tale's category. Modal: Esc and the X button close it.
 */
export function ForestWindow({ categories, onOpenCategory, onClose }: ForestWindowProps) {
  const { t, lang, catName } = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // The film carries its own soundtrack; it is heard only when the reader has sound on.
  const sound = usePrefs((s) => s.sound);
  // Live: the film is over, the forest breathes and the tale begins. Whoever asks for less motion skips the film.
  const [live, setLive] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const goLive = useCallback(() => setLive(true), []);
  // Skipping cuts the film's sound at once; the picture fades out into the forest.
  const skip = useCallback(() => {
    videoRef.current?.pause();
    setLive(true);
  }, []);
  useEffect(() => {
    // If the film stalls or never plays, the forest goes live anyway a little after it should have ended.
    const id = window.setTimeout(goLive, (VIDEO_SECONDS + 3) * 1000);
    return () => window.clearTimeout(id);
  }, [goLive]);

  const today = useMemo(() => new Date(), []);
  const tale = taleOfTheDay(today);
  const lines = tale.lines[lang];
  // The category of the tale; if the library has no such shelf, another one, so that the tale still leads somewhere.
  const next = categories.find((category) => category.slug === tale.category) ?? (categories.length > 0 ? categories[dayNumber(today) % categories.length] : undefined);
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
      className={live ? "fw-backdrop fw--live" : "fw-backdrop"}
      role="dialog"
      aria-modal="true"
      aria-label={t("forest.title")}
    >
      <div className="fw-forest" aria-hidden>
        <div className="fw-forest-img" style={{ backgroundImage: `url(${FOREST})` }} />
      </div>

      <div className="fw-fireflies" aria-hidden>
        {flies.map((fly) => (
          <span key={fly.id} className="fw-fly" style={{ left: `${fly.x}%`, top: `${fly.y}%`, ...vars({ s: `${fly.size}px`, d: `${fly.delay}s`, t: `${fly.dur}s`, dx: fly.dx, dy: fly.dy }) }} />
        ))}
      </div>

      <video ref={videoRef} className="fw-video" src={VIDEO} poster={POSTER} muted={!sound} playsInline autoPlay preload="auto" aria-hidden tabIndex={-1} onEnded={goLive} onError={goLive} />
      <div className="fw-vignette" aria-hidden />

      <button ref={closeRef} type="button" className="hm-close fw-close" onClick={onClose} aria-label={t("forest.close")}>
        ×
      </button>

      {!live && (
        <button type="button" className="fw-btn fw-skip" onClick={skip}>
          {t("forest.skip")}
        </button>
      )}

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
