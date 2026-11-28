import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { Category } from "@/features/books/types";
import { usePrefs } from "@/lib/i18n/store";
import * as sfx from "@/lib/sound/engine";
import { useT } from "@/lib/i18n/useT";

import { FOREST, POSTER, TIMES, VIDEO, VIDEO_SECONDS, endDelay, fireflies, paragraphAt, paragraphTimes, scrollKeyframes, scrollSeconds } from "./forestScene";
import { loadManifest, manifestMatches, narrate, type Manifest } from "./narration";
import { storyFor } from "./stories";

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
  const boxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The film carries its own soundtrack; it is heard only when the reader has sound on.
  const sound = usePrefs((s) => s.sound);
  const setSound = usePrefs((s) => s.setSound);
  const liveAt = useRef(0);
  // Leaving the screen (another tab, another app, closing the page) silences the story; coming back picks it up again.
  const [away, setAway] = useState(() => typeof document !== "undefined" && document.visibilityState === "hidden");
  useEffect(() => {
    const check = (): void => setAway(document.visibilityState === "hidden");
    const leave = (): void => setAway(true);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", check);
    };
  }, []);
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

  const story = storyFor(lang);
  // The recorded narration, if it has been generated: it sets how long the text takes to rise.
  const [recorded, setRecorded] = useState<{ lang: string; manifest: Manifest } | null>(null);
  useEffect(() => {
    let current = true;
    void loadManifest(lang).then((manifest) => {
      if (current && manifest && manifestMatches(manifest, story.paragraphs)) setRecorded({ lang, manifest });
    });
    return () => {
      current = false;
    };
  }, [lang, story]);
  const manifest = recorded?.lang === lang ? recorded.manifest : null;
  const seconds = scrollSeconds(story.paragraphs, lang, manifest);
  const times = useMemo(() => paragraphTimes(story.paragraphs, lang, manifest), [story, lang, manifest]);

  // The text rises in step with the voice: each paragraph is at the reading line while it is being told.
  useEffect(() => {
    const box = boxRef.current;
    const scroll = scrollRef.current;
    if (!live || !box || !scroll || typeof scroll.animate !== "function") return undefined;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (liveAt.current === 0) liveAt.current = Date.now();
    let animation: Animation | undefined;
    const build = (): void => {
      animation?.cancel();
      const boxes = Array.from(scroll.querySelectorAll<HTMLElement>(".fw-line")).map((line) => ({ top: line.offsetTop, height: line.offsetHeight }));
      const keyframes = scrollKeyframes(boxes, times, box.clientHeight, seconds);
      if (keyframes.length === 0) return;
      // The animation is anchored to the moment the forest went live, so rebuilding it (the window was resized) keeps its place.
      const elapsed = (Date.now() - liveAt.current) / 1000;
      animation = scroll.animate(keyframes, { duration: seconds * 1000, delay: (TIMES.scrollStart - elapsed) * 1000, fill: "both", easing: "linear" });
    };
    build();
    window.addEventListener("resize", build);
    return () => {
      window.removeEventListener("resize", build);
      animation?.cancel();
    };
  }, [live, times, seconds]);
  // The category of the story; if the library has no such shelf, the first one, so that the story still leads somewhere.
  const next = categories.find((category) => category.slug === story.category) ?? categories[0];
  // The narrator begins when the forest is live, and only for a reader who has sound on.
  useEffect(() => {
    if (live && liveAt.current === 0) liveAt.current = Date.now();
  }, [live]);
  // The sound can be turned on halfway through: the narrator then joins in where the text is, not from the start.
  useEffect(() => {
    if (!live || !sound || away) return undefined;
    const elapsed = (Date.now() - liveAt.current) / 1000;
    const from = paragraphAt(story.paragraphs, lang, elapsed, manifest);
    // At the very start the voice waits for the text to begin to rise; later it joins in at once.
    const delay = from === 0 ? Math.max(0, TIMES.scrollStart - elapsed) * 1000 : 0;
    return narrate(story.paragraphs, lang, { from, delay, manifest });
  }, [live, sound, away, story, lang, manifest]);
  // Under the narrator, a soft melody hums from the moment the story begins.
  useEffect(() => {
    if (!live || !sound || away) return undefined;
    return sfx.lullaby();
  }, [live, sound, away]);
  // The film's own sound follows the same switch, and starts if the browser had held it back.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !sound;
    if (away) video.pause?.();
    else if (!live && !video.ended && video.paused) void video.play?.()?.catch?.(() => undefined);
  }, [sound, live, away]);
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

      <button type="button" className={sound ? "fw-btn fw-sound" : "fw-btn fw-sound fw-sound--off"} onClick={() => setSound(!sound)} aria-pressed={sound}>
        <span aria-hidden>{sound ? "🔊" : "🔇"}</span> {t(sound ? "forest.soundOff" : "forest.soundOn")}
      </button>

      {!live && (
        <button type="button" className="fw-btn fw-skip" onClick={skip}>
          {t("forest.skip")}
        </button>
      )}

      <div className="fw-head">
        <p className="fw-kicker">{t("forest.kicker")}</p>
        <h2 className="fw-title">{story.title}</h2>
      </div>

      <div className="fw-story">
        <div ref={boxRef} className="fw-lines" style={vars({ d: `${TIMES.scrollStart}s`, ls: `${seconds}s` })}>
          <div ref={scrollRef} className="fw-scroll">
            {story.paragraphs.map((paragraph, i) => (
              <p key={i} className="fw-line">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
        <div className="fw-end" style={vars({ d: `${endDelay(story.paragraphs, lang, manifest)}s` })}>
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
