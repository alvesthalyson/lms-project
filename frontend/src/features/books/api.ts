import { apiClient } from "@/api/client";
import type { Paginated } from "@/api/types";

import { buildBookRequestBody } from "./payload";
import type {
  Author,
  Book,
  BookDetail,
  BookListParams,
  BookWritePayload,
  Category,
  RelatedBook,
  Review,
  ReviewPayload,
} from "./types";

export async function listBooks(params: BookListParams, signal?: AbortSignal): Promise<Paginated<Book>> {
  const { data } = await apiClient.get<Paginated<Book>>("/books/", { params, signal });
  return data;
}

export async function getBook(id: number, signal?: AbortSignal): Promise<BookDetail> {
  const { data } = await apiClient.get<BookDetail>(`/books/${id}/`, { signal });
  return data;
}

export async function createBook(payload: BookWritePayload): Promise<BookDetail> {
  const { data } = await apiClient.post<BookDetail>("/books/", buildBookRequestBody(payload));
  return data;
}

export async function updateBook(id: number, payload: BookWritePayload): Promise<BookDetail> {
  const { data } = await apiClient.patch<BookDetail>(`/books/${id}/`, buildBookRequestBody(payload));
  return data;
}

export async function listCategories(signal?: AbortSignal): Promise<Paginated<Category>> {
  const { data } = await apiClient.get<Paginated<Category>>("/categories/", {
    params: { page_size: 100, ordering: "name" },
    signal,
  });
  return data;
}

export async function listAuthors(search: string, signal?: AbortSignal): Promise<Paginated<Author>> {
  const { data } = await apiClient.get<Paginated<Author>>("/authors/", {
    params: { page_size: 100, ordering: "name", search: search.trim() || undefined },
    signal,
  });
  return data;
}

export async function listReviews(bookId: number, signal?: AbortSignal): Promise<Paginated<Review>> {
  const { data } = await apiClient.get<Paginated<Review>>(`/books/${bookId}/reviews/`, {
    params: { page_size: 50 },
    signal,
  });
  return data;
}

/** One review per reader and book: posting again replaces it. */
export async function saveReview(bookId: number, payload: ReviewPayload): Promise<Review> {
  const { data } = await apiClient.post<Review>(`/books/${bookId}/reviews/`, payload);
  return data;
}

export async function deleteReview(reviewId: number): Promise<void> {
  await apiClient.delete(`/reviews/${reviewId}/`);
}

export async function setFavorite(bookId: number, wanted: boolean): Promise<boolean> {
  const { data } = wanted
    ? await apiClient.put<{ is_favorite: boolean }>(`/books/${bookId}/favorite/`)
    : await apiClient.delete<{ is_favorite: boolean }>(`/books/${bookId}/favorite/`);
  return data.is_favorite;
}

export async function listRelated(bookId: number, signal?: AbortSignal): Promise<RelatedBook[]> {
  const { data } = await apiClient.get<RelatedBook[]>(`/books/${bookId}/related/`, { signal });
  return data;
}
