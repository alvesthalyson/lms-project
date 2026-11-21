import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Toaster } from "@/components/Toaster";
import { useAuth } from "@/features/auth/hooks";
import { useCategories } from "@/features/books/hooks";
import type { Category } from "@/features/books/types";
import { FilmGrain } from "@/features/library/components/FilmGrain";
import "@/features/library/library.css";
import { usePrefs } from "@/lib/i18n/store";
import { toast } from "@/lib/toast";
import * as sfx from "@/lib/sound/engine";
import { useT } from "@/lib/i18n/useT";

import { HourglassDialog } from "../components/HourglassDialog";
import { GlobeDialog } from "../globe/GlobeDialog";
import { AccountBar } from "../components/AccountBar";
import { PicksReveal, type RevealOrigin } from "../components/PicksReveal";
import { ShelfInspector, type InspectorTarget } from "../components/ShelfInspector";
import { FIRST_ROOM, HOME_ROOMS, placeCategories, shapePoints, type Hotspot, type RoomId } from "../config";
import "../home.css";

/** Position and label tilt of a hotspot, as inline style (percentages of the picture). */
function spotStyle(spot: Hotspot): CSSProperties {
  return {
    left: `${spot.left * 100}%`,
    top: `${spot.top * 100}%`,
    width: `${spot.width * 100}%`,
    height: `${spot.height * 100}%`,
    "--rot": `${spot.rotate}deg`,
    "--skew": `${spot.skewY}deg`,
  } as CSSProperties;
}

interface SpotButtonProps {
  spot: Hotspot;
  className: string;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  /** Accessible name, when the button has no visible text. */
  ariaLabel?: string;
  /** Faint breathing contour that hints that the shape is clickable (the staircase). */
  hint?: boolean;
  /** Soft breathing glow of a rectangular portal without text (the staircase down). */
  glow?: boolean;
  haspopup?: boolean;
  children?: ReactNode;
}

/**
 * A clickable place in the picture. With an outline (`shape`) only that shape is clickable and, on hover,
 * glows along its own contour; without one it is a plain rectangle.
 */
function SpotButton({ spot, className, onClick, ariaLabel, hint, glow, haspopup, children }: SpotButtonProps) {
  const points = shapePoints(spot);
  const classes = points ? `${className} hm-shaped${hint ? " hm-shaped--hint" : ""}` : className;
  return (
    <button type="button" className={classes} style={spotStyle(spot)} onClick={onClick} aria-label={ariaLabel} data-glow={glow && !points ? "" : undefined} aria-haspopup={haspopup ? "dialog" : undefined}>
      {points && (
        <svg className="hm-shaped-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
          <polygon className="hm-shaped-poly" points={points} />
        </svg>
      )}
      {children}
    </button>
  );
}

/**
 * Home: a point-and-click map of the library. The picture of the current room is the background;
 * each bookcase in it is an invisible button positioned in percentages of the picture, so it stays
 * on its bookcase at any window size. Clicking one opens that category's books in a dialog, without
 * leaving the page. The staircase is a portal to another room with more shelves.
 */
export function HomePage() {
  const { data } = useCategories();
  const categories = useMemo(() => data?.results ?? [], [data]);
  const [roomId, setRoomId] = useState<RoomId>(FIRST_ROOM);
  const [open, setOpen] = useState<InspectorTarget | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const { t, catName, lang } = useT();
  const { user } = useAuth();
  const [reveal, setReveal] = useState<RevealOrigin | null>(null);
  const closeReveal = useCallback(() => setReveal(null), []);
  const [globeOpen, setGlobeOpen] = useState(false);
  const closeGlobe = useCallback(() => setGlobeOpen(false), []);
  const [hourglassOpen, setHourglassOpen] = useState(false);
  const closeHourglass = useCallback(() => setHourglassOpen(false), []);
  // A country was chosen on the globe: close it and open the shelf with that country's books.
  const pickCountry = useCallback(
    (code: string, name: string) => {
      sfx.pickCountry();
      setGlobeOpen(false);
      setOpen({ title: name, kicker: t("globe.kicker"), query: { author_country: code, page_size: 50, ordering: "title" } });
    },
    [t],
  );

  // Room tone and a crackling fire while the Home is open (only when the reader has sound on).
  useEffect(() => {
    sfx.startAmbient();
    return () => sfx.stopAmbient();
  }, []);

  const theme = usePrefs((s) => s.theme);
  const room = HOME_ROOMS[roomId];
  const portalLabel = (to: RoomId): string => t(to === "library" ? "home.down" : "home.up");
  const base = theme === "dark" && room.backgroundDark ? room.backgroundDark : room.background;
  const inLang = theme === "dark" ? (room.backgroundDarkByLang ?? room.backgroundByLang) : room.backgroundByLang;
  const background = inLang?.[lang] ?? base; // painted plaques in the reader's language
  // Which category stands on which bookcase: by painted sign where the picture has one, else in list order.
  const { byRoom, placed } = useMemo(() => placeCategories(categories), [categories]);
  const placements = byRoom[roomId];
  const signs = room.signs === true;
  const shelfClass = signs ? "hm-shelf hm-shelf--sign" : "hm-shelf";
  const labelClass = signs ? "hm-label hm-label--painted" : "hm-label";

  const openCategory = (category: Category): void => {
    sfx.openShelf();
    setOpen({ title: catName(category), kicker: t("home.shelfKicker"), query: { category: category.id, page_size: 50, ordering: "title" } });
  };
  const openGlobe = (): void => {
    sfx.globeOpen();
    setGlobeOpen(true);
  };
  // The reader's favourites: the shelf inspector with the wish-list filter. A visitor has none, so they are told to sign in.
  const openFavorites = (): void => {
    if (!user) {
      toast.info(t("favorites.signIn"));
      return;
    }
    sfx.openShelf();
    setOpen({ title: t("favorites.title"), kicker: t("favorites.kicker"), query: { favorite: true, page_size: 50, ordering: "title" } });
  };
  const openHourglass = (): void => {
    sfx.sand();
    setHourglassOpen(true);
  };
  const goTo = (to: RoomId): void => {
    sfx.stairs();
    setRoomId(to);
  };
  // The flight starts from whatever was clicked (the painted book, or the dock pill).
  const openPicks = (event: MouseEvent<HTMLElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    setReveal({ x: (box.left + box.width / 2) / w, y: (box.top + box.height / 2) / h });
  };

  return (
    <main className={signs ? "hm-root hm-root--signs" : "hm-root"}>
      {/* The "cover" box: as large as needed to fill the screen, centred, same aspect as the picture.
          `key` restarts the fade-in when the visitor changes room. */}
      <div key={room.id} className="hm-room" style={{ backgroundImage: `url(${background})`, "--hm-aspect": room.aspect } as CSSProperties}>
        {placements.map(({ spot, category }) => (
          <SpotButton key={category.id} spot={spot} className={shelfClass} onClick={() => openCategory(category)} haspopup>
            <span className={labelClass}>{catName(category)}</span>
          </SpotButton>
        ))}

        {room.picks && (
          <SpotButton spot={room.picks} className={shelfClass} onClick={openPicks} haspopup>
            <span className={labelClass}>{t("home.picks")}</span>
          </SpotButton>
        )}

        {room.globe && (
          <SpotButton spot={room.globe} className={shelfClass} onClick={openGlobe} ariaLabel={t("globe.open")} haspopup />
        )}

        {room.favorites && (
          <SpotButton spot={room.favorites} className={shelfClass} onClick={openFavorites} ariaLabel={t("favorites.open")} haspopup />
        )}

        {room.hourglass && (
          <SpotButton spot={room.hourglass} className={shelfClass} onClick={openHourglass} ariaLabel={t("hourglass.open")} haspopup />
        )}

        {room.portals.map((portal) => (
          <SpotButton
            key={portal.id}
            spot={portal}
            className="hm-shelf hm-portal"
            onClick={() => goTo(portal.to)}
            ariaLabel={portalLabel(portal.to)}
            hint={portal.glow}
            glow={portal.glow}
          >
            {!portal.glow && <span className="hm-label">{portalLabel(portal.to)}</span>}
          </SpotButton>
        ))}

        {roomId !== FIRST_ROOM && placements.length === 0 && (
          <p className="hm-empty" role="status">
            {t("home.emptyRoom")}
          </p>
        )}
      </div>

      <div className="hm-shade" aria-hidden />
      <div className="hm-vignette" aria-hidden />
      <FilmGrain />

      {/* Categories that did not fit a bookcase (all of them on narrow screens, where the picture is cropped), plus the portals. */}
      <nav className="hm-dock" aria-label={t("home.allShelves")}>
        {categories.map((category) => (
          <button key={category.id} type="button" className="hm-pill" data-overflow={placed.has(category.id) ? undefined : ""} onClick={() => openCategory(category)}>
            {catName(category)}
          </button>
        ))}
        {room.picks && (
          <button type="button" className="hm-pill" onClick={openPicks}>
            {t("home.picks")}
          </button>
        )}
        {room.globe && (
          <button type="button" className="hm-pill" onClick={openGlobe} aria-haspopup="dialog">
            🌍 {t("globe.open")}
          </button>
        )}
        {room.favorites && (
          <button type="button" className="hm-pill" onClick={openFavorites} aria-haspopup="dialog">
            ⭐ {t("favorites.title")}
          </button>
        )}
        {room.hourglass && (
          <button type="button" className="hm-pill" onClick={openHourglass} aria-haspopup="dialog">
            ⏳ {t("hourglass.title")}
          </button>
        )}
        {room.portals.map((portal) => (
          <button key={portal.id} type="button" className="hm-pill hm-pill--portal" onClick={() => goTo(portal.to)}>
            {portalLabel(portal.to)}
          </button>
        ))}
        <Link to="/books" className="hm-pill hm-pill--ghost">
          {t("home.counter")}
        </Link>
      </nav>

      <AccountBar />

      {reveal && <PicksReveal origin={reveal} onClose={closeReveal} />}
      {open && <ShelfInspector target={open} onClose={close} />}
      {hourglassOpen && <HourglassDialog onClose={closeHourglass} />}
      {globeOpen && <GlobeDialog onClose={closeGlobe} onPick={pickCountry} />}
      {/* The Home lives outside AppLayout, so it brings its own toasts (reservation results, errors). */}
      <Toaster />
    </main>
  );
}
