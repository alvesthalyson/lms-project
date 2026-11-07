import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBook, getBook, listAuthors, listBooks, listCategories, updateBook } from "./api";
import type { BookListParams, BookWritePayload } from "./types";

/** Query-key factory: one place that knows the key shapes, so invalidation can target exactly what changed. */
export const bookKeys = {
  all: ["books"] as const,
  lists: () => [...bookKeys.all, "list"] as const,
  list: (params: BookListParams) => [...bookKeys.lists(), params] as const,
  details: () => [...bookKeys.all, "detail"] as const,
  detail: (id: number) => [...bookKeys.details(), id] as const,
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
