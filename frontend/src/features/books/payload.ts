import type { BookWritePayload } from "./types";

/**
 * Request body for POST /books/ and PATCH /books/{id}/.
 *
 * Plain JSON normally. When a cover file is attached the body must be
 * multipart/form-data (axios sets the boundary header itself). Multipart cannot
 * express `null`, so an empty publication_year is simply left out there;
 * clearing a year therefore goes through the JSON path (no new cover chosen).
 */
export function buildBookRequestBody(payload: BookWritePayload): FormData | Record<string, unknown> {
  const { cover_image: cover, ...rest } = payload;

  if (!cover) return rest;

  const form = new FormData();
  form.append("title", rest.title);
  form.append("isbn", rest.isbn);
  form.append("publisher", rest.publisher);
  if (rest.publication_year !== null) form.append("publication_year", String(rest.publication_year));
  form.append("category_id", String(rest.category_id));
  for (const id of rest.author_ids) form.append("author_ids", String(id)); // repeated key = list
  form.append("description", rest.description);
  if (rest.initial_copies !== undefined) form.append("initial_copies", String(rest.initial_copies));
  form.append("cover_image", cover);
  return form;
}
