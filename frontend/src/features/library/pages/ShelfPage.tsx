import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { useBooks, useCategories } from "@/features/books/hooks";
import type { Book } from "@/features/books/types";

import { BookDetail } from "../components/BookDetail";
import { copy } from "../copy";

/** Largest shelf we render in one go. Longer shelves link to the full catalogue with its own pagination. */
const SHELF_PAGE_SIZE = 50;
const SPINE_COLOURS = ["#8a3a30", "#2f6a6a", "#4f7a3a", "#a07a38", "#3a4a7a", "#7a4a77", "#b0562e", "#6a5a3a"] as const;

function spineColour(bookId: number): string {
  return SPINE_COLOURS[bookId % SPINE_COLOURS.length] ?? SPINE_COLOURS[0];
}

/** /shelf/:slug — only the books of the chosen category. */
export function ShelfPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const categories = useCategories();
  const category = useMemo(() => categories.data?.results.find((c) => c.slug === slug), [categories.data, slug]);
  const books = useBooks(
    { category: category?.id, page_size: SHELF_PAGE_SIZE, ordering: "title" },
    { enabled: category !== undefined }, // without a category the API would return the whole catalogue
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected: Book | undefined = books.data?.results.find((b) => b.id === selectedId);

  // Esc goes back to the hall, like closing a book.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") navigate("/hall");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // Unknown slug: once the categories are known and none matches, go back to the hall.
  if (categories.isSuccess && !category) return <Navigate to="/hall" replace />;

  const loading = categories.isLoading || (category !== undefined && books.isLoading);
  const failed = categories.isError || books.isError;
  const list = books.data?.results ?? [];

  return (
    <section className="lib-shelf" aria-labelledby="shelf-title">
      <div className="lib-bar">
        <Link to="/hall" className="lib-back">
          {copy.shelf.back}
        </Link>
        <h1 id="shelf-title">{category?.name ?? ""}</h1>
        <span className="spacer" />
      </div>

      <div className="lib-shelf-wrap">
        <div className="lib-panel">
          {loading && <p className="lib-empty" role="status">{copy.shelf.loading}</p>}
          {failed && (
            <p className="lib-empty" role="alert">
              {copy.shelf.error}
            </p>
          )}
          {!loading && !failed && list.length === 0 && <p className="lib-empty">{copy.shelf.empty}</p>}

          {list.length > 0 && (
            <ul className="lib-books" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {list.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    className={`lib-book${book.available_copies === 0 ? " is-out" : ""}`}
                    style={{ "--c": spineColour(book.id), width: "100%" } as CSSProperties}
                    aria-pressed={book.id === selectedId}
                    onClick={() => setSelectedId(book.id)}
                  >
                    <h3>{book.title}</h3>
                    <p>{book.authors.map((a) => a.name).join(", ")}</p>
                    <span className={`lib-pill ${book.available_copies === 0 ? "no" : "ok"}`}>
                      {book.available_copies === 0 ? copy.shelf.allOut : copy.shelf.availability(book.available_copies, book.total_copies)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {books.data && books.data.count > list.length && (
            <p style={{ marginTop: 16, fontStyle: "italic" }}>
              {copy.shelf.partial(list.length, books.data.count)}{" "}
              <Link to={`/books?category=${category?.id ?? ""}`} style={{ textDecoration: "underline" }}>
                {copy.shelf.seeAll}
              </Link>
            </p>
          )}
        </div>

        {selected ? <BookDetail book={selected} /> : <div className="lib-panel lib-empty">{copy.shelf.pickABook}</div>}
      </div>
    </section>
  );
}
