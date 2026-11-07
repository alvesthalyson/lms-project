import { describe, expect, it } from "vitest";

import { DEFAULT_BOOK_FILTERS, parseBookFilters, toListParams, toSearchParams, type BookFilters } from "./filters";

describe("parseBookFilters", () => {
  it("returns the defaults for an empty query string", () => {
    expect(parseBookFilters(new URLSearchParams(""))).toEqual(DEFAULT_BOOK_FILTERS);
  });

  it("reads every supported parameter", () => {
    const filters = parseBookFilters(
      new URLSearchParams("search=clean&category=2&available=true&ordering=-created_at&page=3&page_size=50"),
    );
    expect(filters).toEqual({
      search: "clean",
      category: 2,
      availableOnly: true,
      ordering: "-created_at",
      page: 3,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid values instead of throwing or forwarding them", () => {
    const filters = parseBookFilters(
      new URLSearchParams("category=abc&available=yes&ordering=hacked&page=-4&page_size=1000"),
    );
    expect(filters.category).toBeNull();
    expect(filters.availableOnly).toBe(false);
    expect(filters.ordering).toBe("title");
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(20);
  });

  it("treats page=0 and a decimal page as invalid", () => {
    expect(parseBookFilters(new URLSearchParams("page=0")).page).toBe(1);
    expect(parseBookFilters(new URLSearchParams("page=2.5")).page).toBe(1);
  });
});

describe("toSearchParams", () => {
  it("writes nothing for the default filters (short, shareable URLs)", () => {
    expect(toSearchParams(DEFAULT_BOOK_FILTERS).toString()).toBe("");
  });

  it("round-trips non-default filters", () => {
    const filters: BookFilters = {
      search: "clean arch",
      category: 2,
      availableOnly: true,
      ordering: "publication_year",
      page: 2,
      pageSize: 10,
    };
    expect(parseBookFilters(toSearchParams(filters))).toEqual(filters);
  });

  it("drops a whitespace-only search", () => {
    expect(toSearchParams({ ...DEFAULT_BOOK_FILTERS, search: "   " }).has("search")).toBe(false);
  });
});

describe("toListParams", () => {
  it("maps filters to the API's query parameters and omits empty ones", () => {
    expect(toListParams(DEFAULT_BOOK_FILTERS)).toEqual({
      search: undefined,
      category: undefined,
      available: undefined,
      ordering: "title",
      page: 1,
      page_size: 20,
    });
  });

  it("trims the search and sends available=true only when the box is checked", () => {
    const params = toListParams({ ...DEFAULT_BOOK_FILTERS, search: "  clean ", category: 2, availableOnly: true, page: 3 });
    expect(params.search).toBe("clean");
    expect(params.category).toBe(2);
    expect(params.available).toBe(true);
    expect(params.page).toBe(3);
  });
});
