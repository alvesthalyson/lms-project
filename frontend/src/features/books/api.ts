import { apiClient } from "@/api/client";
import type { Paginated } from "@/api/types";

import { buildBookRequestBody } from "./payload";
import type { Author, Book, BookDetail, BookListParams, BookWritePayload, Category } from "./types";

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
