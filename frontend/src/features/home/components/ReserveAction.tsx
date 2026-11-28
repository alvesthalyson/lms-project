import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks";
import type { Book } from "@/features/books/types";
import { useReserveBook } from "@/features/reservations/hooks";
import { useT } from "@/lib/i18n/useT";
import { toast } from "@/lib/toast";

/**
 * Reserve button for a title with no free copy (the API refuses anything else). Members get the button,
 * visitors a "sign in" link; staff reserve for a member at the loan desk, so they get nothing.
 */
export function ReserveAction({ book, className = "hm-reserve" }: { book: Book; className?: string }) {
  const { user } = useAuth();
  const reserve = useReserveBook();
  const { t, bookName } = useT();
  const title = bookName(book);
  if (book.is_available || book.total_copies === 0) return null;

  if (!user) {
    return (
      <Link to="/login" state={{ from: { pathname: "/" } }} className={className} aria-label={t("reserve.signInAria", { title })}>
        {t("reserve.signIn")}
      </Link>
    );
  }
  if (user.role !== "MEMBER") return null;

  return (
    <button
      type="button"
      className={className}
      aria-label={t("reserve.aria", { title })}
      disabled={reserve.isPending}
      onClick={() =>
        reserve.mutate(
          { book_id: book.id },
          {
            onSuccess: (reservation) =>
              toast.success(
                reservation.queue_position
                  ? t("reserve.doneQueue", { pos: reservation.queue_position, title })
                  : t("reserve.done", { title }),
              ),
          },
        )
      }
    >
      {t("reserve.button")}
    </button>
  );
}
