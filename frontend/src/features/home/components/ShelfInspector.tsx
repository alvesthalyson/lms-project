import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { useBooks } from "@/features/books/hooks";
import type { BookListParams } from "@/features/books/types";

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
