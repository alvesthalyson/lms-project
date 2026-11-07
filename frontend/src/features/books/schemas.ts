import { z } from "zod";

import { isValidIsbn, normalizeIsbn } from "./isbn";
import type { BookDetail, BookWritePayload } from "./types";

export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const MAX_INITIAL_COPIES = 500;

const MIN_YEAR = 1000;

/**
 * Form schema for the create/edit modal. Number-like fields are kept as strings
 * (that is what inputs produce) and converted by `toBookPayload`, so the schema's
 * input and output types are identical and react-hook-form's typing stays simple.
 * Limits mirror the backend (ISBN checksum, year range, 5 MB cover, up to 500 copies).
 */
export const bookFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255, "Title must be 255 characters or fewer"),
  isbn: z
    .string()
    .trim()
    .min(1, "ISBN is required")
    // An empty field already says "ISBN is required"; do not add a second, misleading message on top of it.
    .refine((value) => value.trim() === "" || isValidIsbn(normalizeIsbn(value)), "Enter a valid ISBN-10 or ISBN-13."),
  publisher: z.string().trim().max(255, "Publisher must be 255 characters or fewer"),
  publication_year: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d{4}$/.test(value) && Number(value) >= MIN_YEAR && Number(value) <= new Date().getFullYear()),
      () => ({ message: `Enter a year between ${MIN_YEAR} and ${new Date().getFullYear()}.` }),
    ),
  category_id: z.string().min(1, "Select a category"),
  author_ids: z.array(z.number()).min(1, "Select at least one author"),
  description: z.string().trim(),
  cover_image: z
    .custom<File | null>()
    .refine((file) => !file || file.type.startsWith("image/"), "Cover must be an image file.")
    .refine((file) => !file || file.size <= MAX_COVER_BYTES, "Cover image must be 5 MB or smaller."),
  initial_copies: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d+$/.test(value) && Number(value) <= MAX_INITIAL_COPIES),
      `Enter a whole number between 0 and ${MAX_INITIAL_COPIES}.`,
    ),
});

export type BookFormValues = z.infer<typeof bookFormSchema>;

/** Field names of the form, used to route API field errors onto inputs. */
export const BOOK_FORM_FIELDS = [
  "title",
  "isbn",
  "publisher",
  "publication_year",
  "category_id",
  "author_ids",
  "description",
  "cover_image",
  "initial_copies",
] as const satisfies ReadonlyArray<keyof BookFormValues>;

export function emptyBookFormValues(): BookFormValues {
  return {
    title: "",
    isbn: "",
    publisher: "",
    publication_year: "",
    category_id: "",
    author_ids: [],
    description: "",
    cover_image: null,
    initial_copies: "1",
  };
}

/** Prefill the edit form from the detail endpoint (the list rows do not carry `description`). */
export function valuesFromBook(book: BookDetail): BookFormValues {
  return {
    title: book.title,
    isbn: book.isbn,
    publisher: book.publisher,
    publication_year: book.publication_year === null ? "" : String(book.publication_year),
    category_id: String(book.category.id),
    author_ids: book.authors.map((author) => author.id),
    description: book.description,
    cover_image: null,
    initial_copies: "0",
  };
}

/** Convert validated form values into the API payload. `initial_copies` is sent on create only. */
export function toBookPayload(values: BookFormValues, mode: "create" | "edit"): BookWritePayload {
  const payload: BookWritePayload = {
    title: values.title.trim(),
    isbn: normalizeIsbn(values.isbn),
    publisher: values.publisher.trim(),
    publication_year: values.publication_year.trim() === "" ? null : Number(values.publication_year),
    category_id: Number(values.category_id),
    author_ids: values.author_ids,
    description: values.description.trim(),
    cover_image: values.cover_image,
  };
  if (mode === "create") {
    payload.initial_copies = values.initial_copies.trim() === "" ? 0 : Number(values.initial_copies);
  }
  return payload;
}
