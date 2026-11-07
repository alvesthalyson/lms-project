import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks";
import { useBook } from "@/features/books/hooks";
import type { Book } from "@/features/books/types";
import { useReserveBook } from "@/features/reservations/hooks";
import { toast } from "@/lib/toast";

import { copy } from "../copy";

/** The parchment-like panel with the chosen book's details and the one action that makes sense for it. */
export function BookDetail({ book }: { book: Book }) {
  const { user } = useAuth();
  const detail = useBook(book.id); // the list rows have no description; load it for the selected book
  const reserve = useReserveBook();
  const out = book.available_copies === 0;
  const authors = book.authors.map((a) => a.name).join(", ");

  const handleReserve = (): void => {
    reserve.mutate({ book_id: book.id }, { onSuccess: () => toast.success(copy.shelf.reserved(book.title)) });
  };

  return (
    <article className="lib-panel lib-detail" aria-live="polite">
      <h2>{book.title}</h2>
      {authors && <div className="by">{authors}</div>}
      {detail.data?.description && <p>{detail.data.description}</p>}
      <dl>
        {book.publication_year !== null && (
          <>
            <dt>{copy.shelf.year}</dt>
            <dd>{book.publication_year}</dd>
          </>
        )}
        <dt>{copy.shelf.isbn}</dt>
        <dd>{book.isbn}</dd>
        {book.publisher && (
          <>
            <dt>{copy.shelf.publisher}</dt>
            <dd>{book.publisher}</dd>
          </>
        )}
      </dl>

      <p>
        <span className={`lib-pill ${out ? "no" : "ok"}`}>
          {out ? copy.shelf.allOut : copy.shelf.availability(book.available_copies, book.total_copies)}
        </span>
      </p>

      {/* Borrowing is done at the desk by staff; members can queue for a title that is out. */}
      {out ? (
        user ? (
          <button type="button" className="lib-cta" onClick={handleReserve} disabled={reserve.isPending}>
            {reserve.isPending ? copy.shelf.reserving : copy.shelf.reserve}
          </button>
        ) : (
          <Link to="/login" className="lib-cta" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            {copy.shelf.signInToReserve}
          </Link>
        )
      ) : (
        <p>{copy.shelf.pickUpAtDesk}</p>
      )}
    </article>
  );
}
