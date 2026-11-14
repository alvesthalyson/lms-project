import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useBooks } from "@/features/books/hooks";
import type { Book, BookListParams } from "@/features/books/types";

import { BookPanel } from "./BookPanel";
import { ReserveAction } from "./ReserveAction";
import { Shelf3D } from "./Shelf3D";

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

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * The "inspection window": a glass panel with the category's books standing on a slanted 3D shelf (or,
 * as the accessible alternative, the old-catalogue list). Clicking a book opens its side panel.
 * Shortcuts: `/` searches, `R` picks a book for you. The view and the search live in the URL
 * (?vista=lista&q=...), so a reload or a shared link comes back the same.
 * It is a modal dialog: Esc, the X button and a click outside close it, and focus returns to the shelf.
 */
export function ShelfInspector({ target, onClose }: ShelfInspectorProps) {
  const [params, setParams] = useSearchParams();
  const view = params.get("vista") === "lista" ? "lista" : "estante";
  const q = params.get("q") ?? "";
  const [draft, setDraft] = useState(q);
  const [selected, setSelected] = useState<Book | null>(null);
  const { data, isLoading, isError, refetch } = useBooks({ ...target.query, search: q || undefined });
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const booksRef = useRef<Book[]>([]);
  booksRef.current = data?.results ?? [];

  const setParam = (key: string, value: string | null): void =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  // Debounce typing into the URL-backed search.
  useEffect(() => {
    if (draft === q) return;
    const timer = window.setTimeout(() => setParam("q", draft.trim() || null), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, q]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") return onClose();
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key.toLowerCase() === "r" && booksRef.current.length > 0) {
        const pool = booksRef.current;
        setSelected(pool[Math.floor(Math.random() * pool.length)]!);
      }
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

          <div className="hm-toolbar">
            <input
              ref={searchRef}
              type="search"
              className="hm-search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Buscar nesta estante  ( / )"
              aria-label="Buscar nesta estante"
            />
            <div className="hm-views" role="group" aria-label="Modo de exibição">
              {(["estante", "lista"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setParam("vista", v === "lista" ? "lista" : null)}>
                  {v === "estante" ? "Estante" : "Lista"}
                </button>
              ))}
            </div>
            <button type="button" className="hm-surprise" disabled={books.length === 0} onClick={() => setSelected(books[Math.floor(Math.random() * books.length)]!)}>
              Surpreenda-me (R)
            </button>
          </div>

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

          {books.length > 0 && view === "estante" && <Shelf3D books={books} onOpen={setSelected} />}
          {books.length > 0 && view === "lista" && (
            <ul className="hm-books">
              {books.map((book) => (
                <li key={book.id}>
                  <button type="button" className="hm-title hm-title--btn" onClick={() => setSelected(book)}>{book.title}</button>
                  <span className="hm-author">
                    {book.authors.map((a) => a.name).join(", ") || "Autor desconhecido"}
                    {book.publication_year ? ` · ${book.publication_year}` : ""}
                  </span>
                  <span className="hm-leader" aria-hidden />
                  <span className="hm-stock" data-available={book.is_available}>
                    {book.is_available ? `${book.available_copies} de ${book.total_copies} disponíveis` : "Emprestado"}
                  </span>
                  <ReserveAction book={book} />
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
      {selected && <BookPanel book={selected} onClose={() => setSelected(null)} onOpenBook={setSelected} />}
    </div>
  );
}
