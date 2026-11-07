import { describe, expect, it } from "vitest";

import { buildBookRequestBody } from "./payload";
import type { BookWritePayload } from "./types";

const base: BookWritePayload = {
  title: "Clean Architecture",
  isbn: "9780134494166",
  publisher: "Pearson",
  publication_year: 2017,
  category_id: 2,
  author_ids: [3, 4],
  description: "A craftsman's guide.",
  cover_image: null,
  initial_copies: 4,
};

describe("buildBookRequestBody", () => {
  it("sends plain JSON without cover_image when no file is chosen", () => {
    const body = buildBookRequestBody(base);
    expect(body instanceof FormData).toBe(false);
    expect(body).toEqual({
      title: "Clean Architecture",
      isbn: "9780134494166",
      publisher: "Pearson",
      publication_year: 2017,
      category_id: 2,
      author_ids: [3, 4],
      description: "A craftsman's guide.",
      initial_copies: 4,
    });
  });

  it("keeps publication_year: null in JSON so a year can be cleared", () => {
    const body = buildBookRequestBody({ ...base, publication_year: null }) as Record<string, unknown>;
    expect(body.publication_year).toBeNull();
  });

  it("switches to multipart when a cover file is attached, repeating author_ids", () => {
    const file = new File(["x"], "cover.png", { type: "image/png" });
    const body = buildBookRequestBody({ ...base, cover_image: file });

    expect(body instanceof FormData).toBe(true);
    const form = body as FormData;
    expect(form.get("title")).toBe("Clean Architecture");
    expect(form.getAll("author_ids")).toEqual(["3", "4"]);
    expect(form.get("category_id")).toBe("2");
    expect(form.get("initial_copies")).toBe("4");
    expect(form.get("cover_image") instanceof File).toBe(true);
  });

  it("leaves out an empty year and an absent initial_copies in multipart", () => {
    const file = new File(["x"], "cover.png", { type: "image/png" });
    const withoutCopies: BookWritePayload = { ...base, publication_year: null, cover_image: file };
    delete withoutCopies.initial_copies;

    const form = buildBookRequestBody(withoutCopies) as FormData;
    expect(form.has("publication_year")).toBe(false);
    expect(form.has("initial_copies")).toBe(false);
  });
});
