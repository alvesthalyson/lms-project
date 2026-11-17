import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Toaster } from "@/components/Toaster";
import { useCategories } from "@/features/books/hooks";
import type { Category } from "@/features/books/types";
import { FilmGrain } from "@/features/library/components/FilmGrain";
import "@/features/library/library.css";
import { usePrefs } from "@/lib/i18n/store";

import { AccountBar } from "../components/AccountBar";
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
  onClick: () => void;
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

  const theme = usePrefs((s) => s.theme);
  const room = HOME_ROOMS[roomId];
  const background = theme === "dark" && room.backgroundDark ? room.backgroundDark : room.background;
  // Which category stands on which bookcase: by painted sign where the picture has one, else in list order.
  const { byRoom, placed } = useMemo(() => placeCategories(categories), [categories]);
  const placements = byRoom[roomId];
  const signs = room.signs === true;
  const shelfClass = signs ? "hm-shelf hm-shelf--sign" : "hm-shelf";
  const labelClass = signs ? "hm-label hm-label--painted" : "hm-label";

  const openCategory = (category: Category): void =>
    setOpen({ title: category.name, kicker: "Catálogo da estante", query: { category: category.id, page_size: 50, ordering: "title" } });
  const openPicks = (): void =>
    setOpen({ title: "Indicação", kicker: "Indicações da casa", query: { available: true, ordering: "-created_at", page_size: 12 } });

  return (
    <main className={signs ? "hm-root hm-root--signs" : "hm-root"}>
      {/* The "cover" box: as large as needed to fill the screen, centred, same aspect as the picture.
          `key` restarts the fade-in when the visitor changes room. */}
      <div key={room.id} className="hm-room" style={{ backgroundImage: `url(${background})`, "--hm-aspect": room.aspect } as CSSProperties}>
        {placements.map(({ spot, category }) => (
          <SpotButton key={category.id} spot={spot} className={shelfClass} onClick={() => openCategory(category)} haspopup>
            <span className={labelClass}>{category.name}</span>
          </SpotButton>
        ))}

        {room.picks && (
          <SpotButton spot={room.picks} className={shelfClass} onClick={openPicks} haspopup>
            <span className={labelClass}>Indicação</span>
          </SpotButton>
        )}

        {room.portals.map((portal) => (
          <SpotButton
            key={portal.id}
            spot={portal}
            className="hm-shelf hm-portal"
            onClick={() => setRoomId(portal.to)}
            ariaLabel={portal.label}
            hint={portal.glow}
            glow={portal.glow}
          >
            {!portal.glow && <span className="hm-label">{portal.label}</span>}
          </SpotButton>
        ))}

        {roomId !== FIRST_ROOM && placements.length === 0 && (
          <p className="hm-empty" role="status">
            Ainda não há estantes nesta sala.
          </p>
        )}
      </div>

      <div className="hm-shade" aria-hidden />
      <div className="hm-vignette" aria-hidden />
      <FilmGrain />

      {/* Categories that did not fit a bookcase (all of them on narrow screens, where the picture is cropped), plus the portals. */}
      <nav className="hm-dock" aria-label="Todas as estantes">
        {categories.map((category) => (
          <button key={category.id} type="button" className="hm-pill" data-overflow={placed.has(category.id) ? undefined : ""} onClick={() => openCategory(category)}>
            {category.name}
          </button>
        ))}
        {room.picks && (
          <button type="button" className="hm-pill" onClick={openPicks}>
            Indicação
          </button>
        )}
        {room.portals.map((portal) => (
          <button key={portal.id} type="button" className="hm-pill hm-pill--portal" onClick={() => setRoomId(portal.to)}>
            {portal.label}
          </button>
        ))}
        <Link to="/books" className="hm-pill hm-pill--ghost">
          Modo balcão
        </Link>
      </nav>

      <AccountBar />

      {open && <ShelfInspector target={open} onClose={close} />}
      {/* The Home lives outside AppLayout, so it brings its own toasts (reservation results, errors). */}
      <Toaster />
    </main>
  );
}
