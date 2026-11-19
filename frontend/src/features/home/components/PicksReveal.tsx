import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useBooks } from "@/features/books/hooks";
import type { Book } from "@/features/books/types";
import { useT } from "@/lib/i18n/useT";

import { hueFromTitle } from "../coverTint";
import { Stars } from "../Stars";
import { BookPanel } from "./BookPanel";

/** Where the flight starts, in fractions of the window (the clicked book on the picture). */
export interface RevealOrigin {
  x: number;
  y: number;
}

const FLYERS = 30;

/** Deterministic 0..1 noise, so a flight has the same shape in every render (and in tests). */
function rnd(i: number, salt: number): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

interface Flyer {
  kind: "page" | "book";
  style: CSSProperties;
  hue: number;
  cover: string | null;
}

/**
 * Pages and books that burst out of the open book, sweep across the whole screen and leave on the other
 * side. Positions are in vw/vh relative to the screen centre: start (o), a point on the way (m), exit (e).
 */
function makeFlyers(origin: RevealOrigin, covers: string[], round: number): Flyer[] {
  const ox = (origin.x - 0.5) * 100;
  const oy = (origin.y - 0.5) * 100;
  return Array.from({ length: FLYERS }, (_, i) => {
    const r = (n: number): number => rnd(i + round * 101, n);
    const book = i % 3 === 0;
    const side = r(1) < 0.5 ? -1 : 1;
    const style = {
      "--ox": `${ox}vw`,
      "--oy": `${oy}vh`,
      "--mx": `${(r(2) - 0.5) * 80}vw`,
      "--my": `${(r(3) - 0.5) * 70}vh`,
      "--ex": `${side * (62 + r(4) * 40)}vw`,
      "--ey": `${(r(5) - 0.5) * 120}vh`,
      "--r0": `${(r(6) - 0.5) * 120}deg`,
      "--r1": `${(r(7) - 0.5) * 900}deg`,
      "--ry": `${(r(8) - 0.5) * 360}deg`,
      "--s": `${book ? 0.9 + r(9) * 0.7 : 0.8 + r(9) * 0.9}`,
      "--dur": `${1.9 + r(10) * 0.9}s`,
      "--delay": `${r(11) * 0.85}s`,
    } as CSSProperties;
    const cover = book && covers.length > 0 ? (covers[i % covers.length] ?? null) : null;
    return { kind: book ? "book" : "page", style, hue: Math.floor(r(12) * 360), cover };
  });
}

interface PicksRevealProps {
  origin: RevealOrigin;
  onClose: () => void;
}

/**
 * "Indicação": instead of opening a shelf, pages and books fly across the screen and, when they have
 * gone, one book turns up in the middle as the recommendation. It is picked at random among the
 * available books; "Another pick" replays the flight with a different one.
 */
export function PicksReveal({ origin, onClose }: PicksRevealProps) {
  const { t, lang } = useT();
  const { data, isLoading, isError } = useBooks({ available: true, ordering: "-created_at", page_size: 40 });
  const books = useMemo(() => data?.results ?? [], [data]);
  const [round, setRound] = useState(0);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Book | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const pick: Book | undefined = useMemo(() => {
    if (books.length === 0) return undefined;
    return books.find((b) => b.id === pickedId) ?? books[Math.floor(Math.random() * books.length)];
    // The random draw is meant to happen once per round, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, pickedId, round]);

  const covers = useMemo(() => books.map((b) => b.cover_image).filter((c): c is string => !!c).slice(0, 8), [books]);
  const flyers = useMemo(() => makeFlyers(origin, covers, round), [origin, covers, round]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !detail) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose, detail]);

  const ready = !isLoading && pick !== undefined;
  useEffect(() => {
    if (ready) closeRef.current?.focus();
  }, [ready, round]);

  const another = (): void => {
    const others = books.filter((b) => b.id !== pick?.id);
    const next = others.length > 0 ? others[Math.floor(Math.random() * others.length)]! : pick;
    setPickedId(next?.id ?? null);
    setRound((n) => n + 1);
  };

  const author = pick?.authors.map((a) => a.name).join(", ") || t("book.unknownAuthor");
  const hue = pick ? hueFromTitle(pick.title) : 30;

  return (
    <div className="pk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !detail && onClose()}>
      {/* Flying pages and books: decorative only. `key` restarts every animation on a new round. */}
      <div className="pk-sky" aria-hidden key={round}>
        {ready &&
          flyers.map((f, i) => (
            <span key={i} className={`pk-flyer pk-flyer--${f.kind}`} style={f.style}>
              {f.kind === "book" ? (
                <span className="pk-flybook" style={{ "--h": f.hue } as CSSProperties}>
                  {f.cover ? <img src={f.cover} alt="" /> : null}
                </span>
              ) : (
                <span className="pk-flypage" />
              )}
            </span>
          ))}
      </div>

      <section className="pk-stage" role="dialog" aria-modal="true" aria-label={t("home.picks")}>
        <button ref={closeRef} type="button" className="hm-close pk-close" onClick={onClose} aria-label={t("picks.close")}>
          ×
        </button>

        {isLoading && <p className="hm-note" role="status">{t("shelf.loading")}</p>}
        {isError && <p className="hm-note" role="alert">{t("shelf.error")}</p>}
        {!isLoading && !isError && !pick && <p className="hm-note">{t("picks.none")}</p>}

        {ready && pick && (
          <div className="pk-hero" key={`${round}-${pick.id}`} lang={lang}>
            <div className="pk-rays" aria-hidden />
            <p className="hm-kicker pk-kicker">{t("home.picksKicker")}</p>
            <button type="button" className="pk-book" style={{ "--h": hue } as CSSProperties} onClick={() => setDetail(pick)} aria-label={`${pick.title}, ${author}`}>
              {pick.cover_image ? <img src={pick.cover_image} alt="" /> : <span className="pk-cover-title">{pick.title}</span>}
              <span className="pk-shine" aria-hidden />
            </button>
            <h2 className="pk-title">{pick.title}</h2>
            <p className="pk-author">
              {author}
              {pick.publication_year ? ` · ${pick.publication_year}` : ""}
            </p>
            <Stars value={pick.rating_avg} count={pick.rating_count} size="md" />
            <div className="pk-actions">
              <button type="button" className="hm-pill hm-pill--portal" onClick={() => setDetail(pick)}>
                {t("picks.details")}
              </button>
              <button type="button" className="hm-pill" onClick={another}>
                {t("picks.another")}
              </button>
            </div>
          </div>
        )}
      </section>

      {detail && <BookPanel book={detail} onClose={() => setDetail(null)} onOpenBook={setDetail} />}
    </div>
  );
}
