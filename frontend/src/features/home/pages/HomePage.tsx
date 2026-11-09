import { useCallback, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { Toaster } from "@/components/Toaster";
import { useCategories } from "@/features/books/hooks";
import type { Category } from "@/features/books/types";
import { FilmGrain } from "@/features/library/components/FilmGrain";
import "@/features/library/library.css";

import { AccountBar } from "../components/AccountBar";
import { ShelfInspector, type InspectorTarget } from "../components/ShelfInspector";
import { FIRST_ROOM, firstCategoryIndex, HOME_ROOMS, TOTAL_SHELVES, type Hotspot, type RoomId } from "../config";
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

/**
 * Home: a point-and-click map of the library. The picture of the current room is the background;
 * each bookcase in it is an invisible button positioned in percentages of the picture, so it stays
 * on its bookcase at any window size. Clicking one opens that category's books in a dialog, without
 * leaving the page. The staircase is a portal to another room with more shelves.
 */
export function HomePage() {
  const { data } = useCategories();
  const categories = data?.results ?? [];
  const [roomId, setRoomId] = useState<RoomId>(FIRST_ROOM);
  const [open, setOpen] = useState<InspectorTarget | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const room = HOME_ROOMS[roomId];
  const first = firstCategoryIndex(roomId);
  const placed = categories.slice(first, first + room.shelves.length);

  const openCategory = (category: Category): void =>
    setOpen({ title: category.name, kicker: "Catálogo da estante", query: { category: category.id, page_size: 50, ordering: "title" } });
  const openPicks = (): void =>
    setOpen({ title: "Indicação", kicker: "Indicações da casa", query: { available: true, ordering: "-created_at", page_size: 12 } });

  return (
    <main className="hm-root">
      {/* The "cover" box: as large as needed to fill the screen, centred, same aspect as the picture.
          `key` restarts the fade-in when the visitor changes room. */}
      <div key={room.id} className="hm-room" style={{ backgroundImage: `url(${room.background})`, "--hm-aspect": room.aspect } as CSSProperties}>
        {placed.map((category, i) => {
          const spot = room.shelves[i];
          if (!spot) return null;
          return (
            <button key={category.id} type="button" className="hm-shelf" style={spotStyle(spot)} onClick={() => openCategory(category)} aria-haspopup="dialog">
              <span className="hm-label">{category.name}</span>
            </button>
          );
        })}

        {room.picks && (
          <button type="button" className="hm-shelf" style={spotStyle(room.picks)} onClick={openPicks} aria-haspopup="dialog">
            <span className="hm-label">Indicação</span>
          </button>
        )}

        {room.portals.map((portal) => (
          <button
            key={portal.id}
            type="button"
            className="hm-shelf hm-portal"
            data-glow={portal.glow ? "" : undefined}
            style={spotStyle(portal)}
            onClick={() => setRoomId(portal.to)}
            aria-label={portal.label}
          >
            {!portal.glow && <span className="hm-label">{portal.label}</span>}
          </button>
        ))}

        {roomId !== FIRST_ROOM && placed.length === 0 && (
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
        {categories.map((category, i) => (
          <button key={category.id} type="button" className="hm-pill" data-overflow={i >= TOTAL_SHELVES ? "" : undefined} onClick={() => openCategory(category)}>
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
