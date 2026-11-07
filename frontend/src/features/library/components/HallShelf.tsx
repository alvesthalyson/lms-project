import { useCallback, type CSSProperties, type PointerEvent } from "react";
import { Link } from "react-router-dom";

import { useBooks } from "@/features/books/hooks";
import type { Category } from "@/features/books/types";

import type { HallSlot } from "../art/hall";
import { copy } from "../copy";

interface HallShelfProps {
  category: Category;
  slot: HallSlot;
  /** 1-based position, shown as a roman numeral. */
  position: number;
}

/**
 * A bookcase of the painted hall that is also a link: it sits exactly over its slot in the painting
 * (percentages of the painting), lights up on hover and shows a brass plaque with the category.
 */
export function HallShelf({ category, slot, position }: HallShelfProps) {
  const { data } = useBooks({ category: category.id, page_size: 1 });
  const count = data ? copy.hall.bookCount(data.count) : "…";

  const track = useCallback((event: PointerEvent<HTMLAnchorElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--hx", `${((event.clientX - box.left) / box.width) * 100}%`);
    event.currentTarget.style.setProperty("--hy", `${((event.clientY - box.top) / box.height) * 100}%`);
  }, []);

  const style: CSSProperties = {
    left: `${slot.x * 100}%`,
    top: `${slot.y * 100}%`,
    width: `${slot.width * 100}%`,
    height: `${slot.height * 100}%`,
  };

  return (
    <Link
      to={`/shelf/${category.slug}`}
      className="lib-hotspot"
      data-arch={slot.arch ? "" : undefined}
      data-stand={slot.stand ? "" : undefined}
      style={style}
      onPointerMove={track}
      aria-label={`${category.name}, ${count}`}
    >
      <span className="lib-plaque">
        <small>{copy.hall.shelfKicker(position)}</small>
        <strong>{category.name}</strong>
        <em>{count}</em>
      </span>
    </Link>
  );
}
