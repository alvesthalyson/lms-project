import { useEffect, useState, type CSSProperties } from "react";

import type { Book } from "@/features/books/types";

import { sampleCoverTint, tintStyle } from "../coverTint";
import { Stars } from "../Stars";

const PER_SHELF = 6;

/** One slanted 3D book. The cover colour tints its glow once the image has been sampled. */
function Book3D({ book, index, onOpen }: { book: Book; index: number; onOpen: (book: Book) => void }) {
  const [tint, setTint] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (book.cover_image) void sampleCoverTint(book.cover_image).then((t) => alive && setTint(t));
    return () => {
      alive = false;
    };
  }, [book.cover_image]);

  const author = book.authors.map((a) => a.name).join(", ") || "Autor desconhecido";
  return (
    <li className="sh-slot" style={{ "--i": index } as CSSProperties}>
      <button
        type="button"
        className="b3d"
        style={tintStyle(book.title, tint)}
        onClick={() => onOpen(book)}
        aria-label={`${book.title}, ${author}`}
        data-available={book.is_available}
      >
        <span className="b3d-body" aria-hidden>
          <span className="b3d-front">
            {book.cover_image ? <img src={book.cover_image} alt="" loading="lazy" /> : <span className="b3d-name">{book.title}</span>}
          </span>
          <span className="b3d-spine">{book.title}</span>
          <span className="b3d-pages" />
        </span>
        <span className="sh-peek" aria-hidden>
          <strong>{book.title}</strong>
          <span>{author}</span>
          <Stars value={book.rating_avg} count={book.rating_count} />
          <em data-available={book.is_available}>{book.is_available ? `${book.available_copies} disponíveis` : "Emprestado"}</em>
        </span>
      </button>
    </li>
  );
}

/** Books standing on wooden shelves, six to a board, each leaning slightly. Click opens the book panel. */
export function Shelf3D({ books, onOpen }: { books: Book[]; onOpen: (book: Book) => void }) {
  const rows: Book[][] = [];
  for (let i = 0; i < books.length; i += PER_SHELF) rows.push(books.slice(i, i + PER_SHELF));
  return (
    <div className="sh-case">
      {rows.map((row, r) => (
        <ul className="sh-row" key={r}>
          {row.map((book, i) => (
            <Book3D key={book.id} book={book} index={i} onOpen={onOpen} />
          ))}
        </ul>
      ))}
    </div>
  );
}
