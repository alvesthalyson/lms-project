import { useCallback, type PointerEvent } from "react";
import { Link } from "react-router-dom";

import { useBooks } from "@/features/books/hooks";
import type { Category } from "@/features/books/types";

import { copy } from "../copy";

const SAMPLE_SIZE = 3;

interface CategoryCardProps {
  category: Category;
  /** 1-based position, shown as a roman numeral. */
  position: number;
}

/**
 * One shelf of the hall: a frosted-glass card that links to /shelf/:slug.
 * It asks the API for the category's book count and the first few titles.
 */
export function CategoryCard({ category, position }: CategoryCardProps) {
  const { data } = useBooks({ category: category.id, page_size: SAMPLE_SIZE, ordering: "title" });

  // The specular highlight follows the pointer: the card reads as a piece of real glass.
  const trackPointer = useCallback((event: PointerEvent<HTMLAnchorElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--lx", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--ly", `${event.clientY - box.top}px`);
  }, []);

  return (
    <Link to={`/shelf/${category.slug}`} className="lib-card" onPointerMove={trackPointer} aria-label={`${category.name}${data ? `, ${copy.hall.bookCount(data.count)}` : ""}`}>
      <div className="kicker">{copy.hall.shelfKicker(position)}</div>
      <h2>{category.name}</h2>
      <div className="meta">{data ? copy.hall.bookCount(data.count) : "…"}</div>
      <div className="sample" aria-hidden>
        {data?.results.map((book) => <span key={book.id}>{book.title}</span>)}
      </div>
      <span className="go" aria-hidden>
        {copy.hall.open}
      </span>
    </Link>
  );
}
