import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks";
import { useBooks } from "@/features/books/hooks";
import type { Book, BookListParams } from "@/features/books/types";
import { useReserveBook } from "@/features/reservations/hooks";
import { toast } from "@/lib/toast";

/** What the inspection window shows: a title and the query that lists its books. */
export interface InspectorTarget {
  title: string;
  kicker: string;
  query: BookListParams;
}

interface ShelfInspectorProps {
  target: InspectorTarget;
  onClose: () => void;
}

/**
 * The "inspection window": a glass panel centred on the screen with an old-catalogue list of the
 * category's books. It is a modal dialog: Esc, the X button and a click outside all close it, and
 * focus moves to the close button when it opens and returns to the shelf that opened it.
 */
export function ShelfInspector({ target, onClose }: ShelfInspectorProps) {
  const { data, isLoading, isError, refetch } = useBooks(target.query);
  const { user } = useAuth();
  const reserve = useReserveBook();
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

  // Only a title with no free copy can be reserved (the API refuses it otherwise). Staff reserve on behalf
  // of a member from the loan desk, so the button is for members and, with a "sign in" link, for visitors.
  const canReserve = (book: Book): boolean => !book.is_available && book.total_copies > 0;
  const handleReserve = (book: Book): void =>
    reserve.mutate(
      { book_id: book.id },
      {
        onSuccess: (reservation) =>
          toast.success(
            reservation.queue_position
              ? `Reserva feita: você é o nº ${reservation.queue_position} da fila para “${book.title}”.`
              : `Reserva feita: “${book.title}”.`,
          ),
      },
    );

  const books = data?.results ?? [];
  const total = data?.count ?? 0;

  return (
    <div className="hm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="hm-panel" role="dialog" aria-modal="true" aria-labelledby="hm-panel-title">
        <button ref={closeRef} type="button" className="hm-close" onClick={onClose} aria-label="Voltar à sala">
          ×
        </button>
        <div className="hm-catalogue">
          <header>
            <p className="hm-kicker">{target.kicker}</p>
            <h2 id="hm-panel-title">{target.title}</h2>
            <p className="hm-count">{isLoading ? "…" : total === 1 ? "1 livro" : `${total} livros`}</p>
          </header>

          {isLoading && <p className="hm-note" role="status">Procurando na estante…</p>}
          {isError && (
            <p className="hm-note" role="alert">
              Não foi possível abrir esta estante.{" "}
              <button type="button" className="hm-link" onClick={() => void refetch()}>
                Tentar de novo
              </button>
            </p>
          )}
          {!isLoading && !isError && books.length === 0 && <p className="hm-note">Esta estante está vazia por enquanto.</p>}

          {books.length > 0 && (
            <ul className="hm-books">
              {books.map((book) => (
                <li key={book.id}>
                  <span className="hm-title">{book.title}</span>
                  <span className="hm-author">
                    {book.authors.map((a) => a.name).join(", ") || "Autor desconhecido"}
                    {book.publication_year ? ` · ${book.publication_year}` : ""}
                  </span>
                  <span className="hm-leader" aria-hidden />
                  <span className="hm-stock" data-available={book.is_available}>
                    {book.is_available ? `${book.available_copies} de ${book.total_copies} disponíveis` : "Emprestado"}
                  </span>
                  {canReserve(book) &&
                    (user?.role === "MEMBER" ? (
                      <button
                        type="button"
                        className="hm-reserve"
                        aria-label={`Reservar ${book.title}`}
                        disabled={reserve.isPending}
                        onClick={() => handleReserve(book)}
                      >
                        Reservar
                      </button>
                    ) : !user ? (
                      <Link to="/login" state={{ from: { pathname: "/" } }} className="hm-reserve" aria-label={`Entrar para reservar ${book.title}`}>
                        Entrar para reservar
                      </Link>
                    ) : null)}
                </li>
              ))}
            </ul>
          )}

          <footer>
            {total > books.length && <span>Mostrando {books.length} de {total}. </span>}
            <Link to="/books" className="hm-link">Ver o catálogo completo</Link>
          </footer>
        </div>
      </section>
    </div>
  );
}
