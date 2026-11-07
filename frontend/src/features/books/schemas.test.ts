import { describe, expect, it } from "vitest";

import { isValidIsbn, normalizeIsbn } from "./isbn";
import {
  MAX_COVER_BYTES,
  bookFormSchema,
  emptyBookFormValues,
  toBookPayload,
  valuesFromBook,
  type BookFormValues,
} from "./schemas";
import type { BookDetail } from "./types";

function validValues(overrides: Partial<BookFormValues> = {}): BookFormValues {
  return {
    ...emptyBookFormValues(),
    title: "Clean Architecture",
    isbn: "978-0-13-449416-6",
    category_id: "2",
    author_ids: [3],
    ...overrides,
  };
}

/** Field name -> messages for a values object (empty object when valid). */
function fieldErrors(values: BookFormValues): Record<string, string[] | undefined> {
  const result = bookFormSchema.safeParse(values);
  return result.success ? {} : result.error.flatten().fieldErrors;
}

describe("normalizeIsbn / isValidIsbn", () => {
  it("strips hyphens and spaces and upper-cases", () => {
    expect(normalizeIsbn("978-0-13-449416-6")).toBe("9780134494166");
    expect(normalizeIsbn(" 0 8044 2957 x ")).toBe("080442957X");
  });

  it("accepts valid ISBN-13 and ISBN-10 (including a trailing X)", () => {
    expect(isValidIsbn("9780134494166")).toBe(true);
    expect(isValidIsbn("9780135957059")).toBe(true);
    expect(isValidIsbn("0306406152")).toBe(true);
    expect(isValidIsbn("080442957X")).toBe(true);
  });

  it("rejects bad checksums, wrong lengths and misplaced X", () => {
    expect(isValidIsbn("9780134494167")).toBe(false);
    expect(isValidIsbn("0306406153")).toBe(false);
    expect(isValidIsbn("030640615X")).toBe(false);
    expect(isValidIsbn("123")).toBe(false);
    expect(isValidIsbn("97801344941666")).toBe(false);
    expect(isValidIsbn("X306406152")).toBe(false);
    expect(isValidIsbn("")).toBe(false);
  });
});

describe("bookFormSchema", () => {
  it("accepts a complete valid form, including a hyphenated ISBN", () => {
    expect(fieldErrors(validValues())).toEqual({});
  });

  it("requires title, a valid ISBN, a category and at least one author", () => {
    const errors = fieldErrors(emptyBookFormValues());
    expect(errors.title).toEqual(["Title is required"]);
    expect(errors.isbn).toEqual(["ISBN is required"]);
    expect(errors.category_id).toEqual(["Select a category"]);
    expect(errors.author_ids).toEqual(["Select at least one author"]);
  });

  it("rejects an ISBN with a bad checksum", () => {
    expect(fieldErrors(validValues({ isbn: "978-0-13-449416-7" })).isbn).toEqual([
      "Enter a valid ISBN-10 or ISBN-13.",
    ]);
  });

  it("validates the publication year (optional, 1000..current year, four digits)", () => {
    const thisYear = new Date().getFullYear();
    expect(fieldErrors(validValues({ publication_year: "" }))).toEqual({});
    expect(fieldErrors(validValues({ publication_year: "2017" }))).toEqual({});
    expect(fieldErrors(validValues({ publication_year: String(thisYear) }))).toEqual({});
    expect(fieldErrors(validValues({ publication_year: "999" })).publication_year).toHaveLength(1);
    expect(fieldErrors(validValues({ publication_year: String(thisYear + 1) })).publication_year).toHaveLength(1);
    expect(fieldErrors(validValues({ publication_year: "20x7" })).publication_year).toHaveLength(1);
  });

  it("limits initial copies to 0..500", () => {
    expect(fieldErrors(validValues({ initial_copies: "0" }))).toEqual({});
    expect(fieldErrors(validValues({ initial_copies: "500" }))).toEqual({});
    expect(fieldErrors(validValues({ initial_copies: "501" })).initial_copies).toHaveLength(1);
    expect(fieldErrors(validValues({ initial_copies: "-1" })).initial_copies).toHaveLength(1);
    expect(fieldErrors(validValues({ initial_copies: "abc" })).initial_copies).toHaveLength(1);
  });

  it("accepts an image up to 5 MB and rejects other types and bigger files", () => {
    const image = new File(["x"], "cover.png", { type: "image/png" });
    const notImage = new File(["x"], "notes.txt", { type: "text/plain" });
    const tooBig = new File([new Uint8Array(MAX_COVER_BYTES + 1)], "big.png", { type: "image/png" });

    expect(fieldErrors(validValues({ cover_image: image }))).toEqual({});
    expect(fieldErrors(validValues({ cover_image: notImage })).cover_image).toEqual(["Cover must be an image file."]);
    expect(fieldErrors(validValues({ cover_image: tooBig })).cover_image).toEqual([
      "Cover image must be 5 MB or smaller.",
    ]);
  });
});

describe("toBookPayload", () => {
  it("normalises values and sends initial_copies on create", () => {
    const payload = toBookPayload(validValues({ publication_year: "2017", initial_copies: "4" }), "create");
    expect(payload).toEqual({
      title: "Clean Architecture",
      isbn: "9780134494166",
      publisher: "",
      publication_year: 2017,
      category_id: 2,
      author_ids: [3],
      description: "",
      cover_image: null,
      initial_copies: 4,
    });
  });

  it("omits initial_copies on edit and turns an empty year into null", () => {
    const payload = toBookPayload(validValues({ publication_year: "" }), "edit");
    expect(payload.publication_year).toBeNull();
    expect("initial_copies" in payload).toBe(false);
  });

  it("treats an empty initial_copies as 0", () => {
    expect(toBookPayload(validValues({ initial_copies: "" }), "create").initial_copies).toBe(0);
  });
});

describe("valuesFromBook", () => {
  it("prefills every editable field from the detail endpoint", () => {
    const book: BookDetail = {
      id: 12,
      title: "Clean Architecture",
      authors: [
        { id: 3, name: "Robert C. Martin" },
        { id: 4, name: "Kent Beck" },
      ],
      isbn: "9780134494166",
      publisher: "Pearson",
      publication_year: 2017,
      category: { id: 2, name: "Software Engineering", slug: "software-engineering" },
      cover_image: null,
      total_copies: 4,
      available_copies: 1,
      is_available: true,
      is_active: true,
      description: "A craftsman's guide.",
      created_at: "2026-11-04T05:05:00Z",
      updated_at: "2026-11-04T05:05:00Z",
    };

    const values = valuesFromBook(book);
    expect(values.category_id).toBe("2");
    expect(values.author_ids).toEqual([3, 4]);
    expect(values.publication_year).toBe("2017");
    expect(values.description).toBe("A craftsman's guide.");
    expect(fieldErrors(values)).toEqual({}); // what the API returns must pass our own validation
  });
});
