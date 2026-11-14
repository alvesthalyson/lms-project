import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBook,
  deleteReview,
  getBook,
  listAuthors,
  listBooks,
  listCategories,
  listRelated,
  listReviews,
  saveReview,
  setFavorite,
  updateBook,
} from "./api";
import type { BookListParams, BookWritePayload, ReviewPayload } from "./types";

/** Query-key factory: one place that knows the key shapes, so invalidation can target exactly what changed. */
export const bookKeys = {
  all: ["books"] as const,
  lists: () => [...bookKeys.all, "list"] as const,
  list: (params: BookListParams) => [...bookKeys.lists(), params] as const,
  details: () => [...bookKeys.all, "detail"] as const,
  detail: (id: number) => [...bookKeys.details(), id] as const,
  reviews: (id: number) => [...bookKeys.all, "reviews", id] as const,
  related: (id: number) => [...bookKeys.all, "related", id] as const,
  categories: () => ["categories"] as const,
  authors: (search: string) => ["authors", search] as const,
};

/** Catalogue page. Keeps the previous page on screen while the next one loads (no flicker). */
export function useBooks(params: BookListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: bookKeys.list(params),
    queryFn: ({ signal }) => listBooks(params, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useBook(id: number | null) {
  return useQuery({
    queryKey: bookKeys.detail(id ?? -1),
    queryFn: ({ signal }) => getBook(id as number, signal),
    enabled: id !== null,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: bookKeys.categories(),
    queryFn: ({ signal }) => listCategories(signal),
    staleTime: 5 * 60_000, // categories rarely change
  });
}

export function useAuthors(search: string) {
  return useQuery({
    queryKey: bookKeys.authors(search),
    queryFn: ({ signal }) => listAuthors(search, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

// `silent`: the create/edit modal renders errors inline, so the global toast is skipped.
export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookWritePayload) => createBook(payload),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookKeys.lists() }),
  });
}

export function useUpdateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BookWritePayload }) => updateBook(id, payload),
    meta: { silent: true },
    onSuccess: (book) => {
      queryClient.setQueryData(bookKeys.detail(book.id), book);
      return queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
    },
  });
}

export function useReviews(bookId: number | null) {
  return useQuery({
    queryKey: bookKeys.reviews(bookId ?? -1),
    queryFn: ({ signal }) => listReviews(bookId as number, signal),
    enabled: bookId !== null,
  });
}

export function useRelated(bookId: number | null) {
  return useQuery({
    queryKey: bookKeys.related(bookId ?? -1),
    queryFn: ({ signal }) => listRelated(bookId as number, signal),
    enabled: bookId !== null,
    staleTime: 60_000,
  });
}

/** After a review changes, the average on every list and detail is stale too. */
function useRefreshAfterReview(bookId: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: bookKeys.reviews(bookId) }),
      queryClient.invalidateQueries({ queryKey: bookKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: bookKeys.detail(bookId) }),
    ]);
}

export function useSaveReview(bookId: number) {
  const refresh = useRefreshAfterReview(bookId);
  return useMutation({
    mutationFn: (payload: ReviewPayload) => saveReview(bookId, payload),
    onSuccess: refresh,
  });
}

export function useDeleteReview(bookId: number) {
  const refresh = useRefreshAfterReview(bookId);
  return useMutation({
    mutationFn: (reviewId: number) => deleteReview(reviewId),
    onSuccess: refresh,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, wanted }: { bookId: number; wanted: boolean }) => setFavorite(bookId, wanted),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      return queryClient.invalidateQueries({ queryKey: bookKeys.details() });
    },
  });
}
