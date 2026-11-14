import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks";
import type { Book } from "@/features/books/types";
import { useReserveBook } from "@/features/reservations/hooks";
import { toast } from "@/lib/toast";

/**
 * Reserve button for a title with no free copy (the API refuses anything else). Members get the button,
 * visitors a "sign in" link; staff reserve for a member at the loan desk, so they get nothing.
 */
export function ReserveAction({ book, className = "hm-reserve" }: { book: Book; className?: string }) {
  const { user } = useAuth();
  const reserve = useReserveBook();
  if (book.is_available || book.total_copies === 0) return null;

  if (!user) {
    return (
      <Link to="/login" state={{ from: { pathname: "/" } }} className={className} aria-label={`Entrar para reservar ${book.title}`}>
        Entrar para reservar
      </Link>
    );
  }
  if (user.role !== "MEMBER") return null;

  return (
    <button
      type="button"
      className={className}
      aria-label={`Reservar ${book.title}`}
      disabled={reserve.isPending}
      onClick={() =>
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
        )
      }
    >
      Reservar
    </button>
  );
}
