import { useCallback, useEffect, useMemo, useRef } from "react";

import { useCountries } from "@/features/books/hooks";
import { useT } from "@/lib/i18n/useT";

import { Globe } from "./Globe";
import { countryName, flagOf, useWorld } from "./world";

interface GlobeDialogProps {
  onClose: () => void;
  /** A country was chosen: the Home closes the globe and opens that country's shelf. */
  onPick: (code: string, name: string) => void;
  /** Turn on its own when idle (off in tests). */
  autoRotate?: boolean;
}

/**
 * "Literary journey": a globe you spin, with the countries that have books glowing gold. Choosing one
 * opens the shelf with the books by authors of that country. Below the globe the same countries are listed
 * as buttons, which also covers keyboards, small countries and the ones the map does not draw.
 * Modal dialog: Esc, the X button and a click outside close it.
 */
export function GlobeDialog({ onClose, onPick, autoRotate = true }: GlobeDialogProps) {
  const { t, lang } = useT();
  const world = useWorld();
  const countries = useCountries();
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

  const rows = useMemo(() => countries.data ?? [], [countries.data]);
  const counts = useMemo(() => Object.fromEntries(rows.map((r) => [r.country, r.books])), [rows]);
  const describe = useCallback(
    (code: string, books: number): string =>
      books === 1 ? t("globe.countryOne", { country: countryName(code, lang) }) : t("globe.countryMany", { country: countryName(code, lang), n: books }),
    [t, lang],
  );
  const pick = useCallback((code: string): void => onPick(code, countryName(code, lang)), [onPick, lang]);

  const failed = world.isError || countries.isError;
  const loading = !failed && (world.isLoading || countries.isLoading);

  return (
    <div className="hm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="hm-panel gl-panel" role="dialog" aria-modal="true" aria-labelledby="gl-title">
        <button ref={closeRef} type="button" className="hm-close" onClick={onClose} aria-label={t("globe.close")}>
          ×
        </button>
        <div className="gl-body">
          <header>
            <p className="hm-kicker">{t("globe.kicker")}</p>
            <h2 id="gl-title">{t("globe.title")}</h2>
            <p className="gl-hint">{t("globe.hint")}</p>
          </header>

          {loading && (
            <p className="gl-status" role="status">
              {t("globe.loading")}
            </p>
          )}
          {failed && (
            <p className="gl-status" role="alert">
              {t("globe.error")}{" "}
              <button type="button" className="hm-pill" onClick={() => { void world.refetch(); void countries.refetch(); }}>
                {t("shelf.retry")}
              </button>
            </p>
          )}
          {!loading && !failed && rows.length === 0 && <p className="gl-status">{t("globe.empty")}</p>}

          {world.data && !failed && rows.length > 0 && <Globe world={world.data} counts={counts} describe={describe} onPick={pick} autoRotate={autoRotate} />}

          {rows.length > 0 && (
            <ul className="gl-chips" aria-label={t("globe.list")}>
              {rows.map((r) => (
                <li key={r.country}>
                  <button type="button" className="hm-pill gl-chip" onClick={() => pick(r.country)}>
                    <span aria-hidden>{flagOf(r.country)}</span> {describe(r.country, r.books)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
