import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAuth } from "@/features/auth/hooks";
import { isStaff } from "@/features/auth/access";
import {
  useBook,
  useDeleteReview,
  useRelated,
  useReviews,
  useSaveReview,
  useToggleFavorite,
} from "@/features/books/hooks";
import type { Book, Review } from "@/features/books/types";
import { toast } from "@/lib/toast";

import { sampleCoverTint, tintStyle } from "../coverTint";
import { Stars } from "../Stars";
import { ReserveAction } from "./ReserveAction";

const REASON: Record<string, string> = {
  readers: "Quem leu este também leu",
  author: "Do mesmo autor",
  category: "Da mesma estante",
};

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="bp-picker" role="radiogroup" aria-label="Sua nota">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
          data-on={n <= value}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ bookId, mine }: { bookId: number; mine: Review | undefined }) {
  const save = useSaveReview(bookId);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? "");
  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
  }, [mine?.id, mine?.rating, mine?.comment]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (rating < 1) return;
    save.mutate(
      { rating, comment: comment.trim() },
      { onSuccess: () => toast.success(mine ? "Avaliação atualizada." : "Obrigado pela avaliação!") },
    );
  };

  return (
    <form className="bp-form" onSubmit={submit}>
      <StarPicker value={rating} onChange={setRating} />
      <label className="bp-sr" htmlFor={`bp-comment-${bookId}`}>
        Comentário
      </label>
      <textarea
        id={`bp-comment-${bookId}`}
        value={comment}
        maxLength={2000}
        rows={2}
        placeholder="O que você achou? (opcional)"
        onChange={(e) => setComment(e.target.value)}
      />
      <button type="submit" className="bp-btn" disabled={rating < 1 || save.isPending}>
        {mine ? "Atualizar avaliação" : "Avaliar"}
      </button>
    </form>
  );
}

interface BookPanelProps {
  book: Book;
  onClose: () => void;
  onOpenBook: (book: Book) => void;
}

/**
 * Side panel of one book: a 3D hero, the description, availability, reserve, wish list, reviews and
 * "read next". The glow behind the hero takes the colour of the cover. Esc / X / outside click close it.
 */
export function BookPanel({ book: initial, onClose, onOpenBook }: BookPanelProps) {
  const { user } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);
  const detail = useBook(initial.id);
  const reviews = useReviews(initial.id);
  const related = useRelated(initial.id);
  const favorite = useToggleFavorite();
  const removeReview = useDeleteReview(initial.id);
  const [tint, setTint] = useState<string | null>(null);

  // The list row can be stale after a review or a wish-list change; the detail query is the fresh one.
  const book: Book = detail.data ?? initial;
  const description = detail.data?.description ?? "";

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      opener?.focus();
    };
  }, [onClose]);
  useEffect(() => closeRef.current?.focus(), [initial.id]);

  useEffect(() => {
    let alive = true;
    setTint(null);
    if (book.cover_image) void sampleCoverTint(book.cover_image).then((t) => alive && setTint(t));
    return () => {
      alive = false;
    };
  }, [book.cover_image]);

  const author = book.authors.map((a) => a.name).join(", ") || "Autor desconhecido";
  const list = reviews.data?.results ?? [];
  const mine = list.find((r) => r.is_mine);

  return (
    <div className="bp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="bp" role="dialog" aria-modal="true" aria-labelledby="bp-title" style={tintStyle(book.title, tint)}>
        <button ref={closeRef} type="button" className="hm-close" onClick={onClose} aria-label="Fechar livro">
          ×
        </button>

        <div className="bp-hero" aria-hidden>
          <div className="bp-book">
            <span className="b3d-front">
              {book.cover_image ? <img src={book.cover_image} alt="" /> : <span className="b3d-name">{book.title}</span>}
            </span>
            <span className="b3d-spine">{book.title}</span>
            <span className="b3d-pages" />
          </div>
        </div>

        <div className="bp-body">
          <p className="hm-kicker">{book.category.name}</p>
          <h2 id="bp-title">{book.title}</h2>
          <p className="bp-author">{author}</p>
          <p className="bp-meta">
            {[book.publication_year, book.pages ? `${book.pages} páginas` : null, book.publisher || null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <Stars value={book.rating_avg} count={book.rating_count} size="md" />

          <p className="bp-stock" data-available={book.is_available}>
            {book.is_available ? `${book.available_copies} de ${book.total_copies} disponíveis` : "Emprestado no momento"}
          </p>

          <div className="bp-actions">
            <ReserveAction book={book} className="bp-btn" />
            {user && (
              <button
                type="button"
                className="bp-btn bp-btn--ghost"
                aria-pressed={book.is_favorite}
                disabled={favorite.isPending}
                onClick={() => favorite.mutate({ bookId: book.id, wanted: !book.is_favorite })}
              >
                {book.is_favorite ? "♥ Na minha lista" : "♡ Quero ler"}
              </button>
            )}
          </div>

          {description && <p className="bp-desc">{description}</p>}

          <h3>Avaliações</h3>
          {reviews.isLoading && <p className="bp-note">Carregando…</p>}
          {!reviews.isLoading && list.length === 0 && <p className="bp-note">Ninguém avaliou ainda.</p>}
          <ul className="bp-reviews">
            {list.map((r) => (
              <li key={r.id}>
                <Stars value={r.rating} />
                <strong>{r.reviewer}</strong>
                {r.comment && <p>{r.comment}</p>}
                {(r.is_mine || isStaff(user)) && (
                  <button
                    type="button"
                    className="hm-link"
                    aria-label={`Apagar avaliação de ${r.reviewer}`}
                    disabled={removeReview.isPending}
                    onClick={() => removeReview.mutate(r.id)}
                  >
                    Apagar
                  </button>
                )}
              </li>
            ))}
          </ul>
          {user ? (
            <ReviewForm bookId={book.id} mine={mine} />
          ) : (
            <p className="bp-note">Entre na sua conta para avaliar e guardar na sua lista.</p>
          )}

          {(related.data?.length ?? 0) > 0 && (
            <>
              <h3>Para ler em seguida</h3>
              <ul className="bp-related">
                {related.data!.map(({ book: next, reason }) => (
                  <li key={next.id}>
                    <button type="button" onClick={() => onOpenBook(next)} aria-label={`Abrir ${next.title}`}>
                      <strong>{next.title}</strong>
                      <small>{REASON[reason]}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
