import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { toApiError } from "@/api/errors";
import { Pagination } from "@/components/Pagination";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isStaff } from "@/features/auth/access";
import { useAuth } from "@/features/auth/hooks";
import { useReserveBook } from "@/features/reservations/hooks";
import { toast } from "@/lib/toast";

import { BookFiltersBar } from "../components/BookFiltersBar";
import { BookFormModal, type BookModalState } from "../components/BookFormModal";
import { BookTable } from "../components/BookTable";
import {
  DEFAULT_BOOK_FILTERS,
  PAGE_SIZES,
  parseBookFilters,
  toListParams,
  toSearchParams,
  type BookFilters,
} from "../filters";
import { useBooks, useCategories } from "../hooks";
import type { Book } from "../types";

/**
 * The public catalogue. All filter state lives in the URL (?search=&category=&available=&ordering=&page=&page_size=),
 * so a filtered view can be shared or reached with the back button. LIBRARIAN+ can add/edit; MEMBERs can reserve.
 */
export function BooksListPage() {
  const { user } = useAuth();
  const canManage = isStaff(user);
  const canReserve = user?.role === "MEMBER";

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseBookFilters(searchParams), [searchParams]);

  const booksQuery = useBooks(toListParams(filters));
  const categoriesQuery = useCategories();
  const reserve = useReserveBook();

  const [modal, setModal] = useState<BookModalState | null>(null);

  /** Merge a patch into the filters and write the URL. Changing anything but the page returns to page 1. */
  const updateFilters = useCallback(
    (patch: Partial<BookFilters>, options?: { replace?: boolean }) => {
      const next = { ...filters, ...patch };
      if (!("page" in patch)) next.page = 1;
      setSearchParams(toSearchParams(next), { replace: options?.replace });
    },
    [filters, setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(toSearchParams({ ...DEFAULT_BOOK_FILTERS, pageSize: filters.pageSize }));
  }, [filters.pageSize, setSearchParams]);

  function handleReserve(book: Book) {
    reserve.mutate(
      { book_id: book.id },
      {
        onSuccess: (reservation) =>
          toast.success(
            reservation.queue_position
              ? `Reserved "${book.title}". You are number ${reservation.queue_position} in the queue.`
              : `Reserved "${book.title}".`,
          ),
      },
    );
  }

  const error = booksQuery.isError ? toApiError(booksQuery.error) : null;
  const data = booksQuery.data;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Books</h1>
        {canManage && (
          <Button onClick={() => setModal({ mode: "create" })}>
            <Plus className="h-4 w-4" aria-hidden />
            Add book
          </Button>
        )}
      </div>

      <BookFiltersBar
        filters={filters}
        categories={categoriesQuery.data?.results ?? []}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      {booksQuery.isPending ? (
        <div className="space-y-2" aria-label="Loading books" role="status">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[4.5rem] w-full" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive" className="flex items-center justify-between gap-3">
          <span>{error.detail}</span>
          <div className="flex gap-2">
            {error.status === 404 && filters.page > 1 && (
              <Button size="sm" variant="outline" onClick={() => updateFilters({ page: 1 })}>
                Go to first page
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void booksQuery.refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : data && data.results.length === 0 ? (
        <div className="rounded-md border border-dashed py-12 text-center">
          <p className="font-medium">No books match your filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search or clear the filters.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : data ? (
        <>
          <BookTable
            books={data.results}
            canManage={canManage}
            canReserve={canReserve}
            reservingId={reserve.isPending ? (reserve.variables?.book_id ?? null) : null}
            stale={booksQuery.isPlaceholderData}
            onEdit={(book) => setModal({ mode: "edit", bookId: book.id })}
            onReserve={handleReserve}
          />
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            count={data.count}
            pageSize={filters.pageSize}
            pageSizeOptions={PAGE_SIZES}
            disabled={booksQuery.isPlaceholderData}
            onPageChange={(page) => updateFilters({ page })}
            onPageSizeChange={(pageSize) => updateFilters({ pageSize, page: 1 })}
          />
        </>
      ) : null}

      {modal && <BookFormModal state={modal} onClose={() => setModal(null)} />}
    </section>
  );
}
