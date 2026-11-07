import type { BookListParams, BookOrdering } from "./types";

export const BOOK_ORDERINGS: ReadonlyArray<{ value: BookOrdering; label: string }> = [
  { value: "title", label: "Title (A–Z)" },
  { value: "-created_at", label: "Newest first" },
  { value: "publication_year", label: "Publication year" },
  { value: "available_copies", label: "Fewest copies available" },
];

export const PAGE_SIZES: readonly number[] = [10, 20, 50];

/** UI-side filter state. It lives in the URL query string, so links and the back button work. */
export interface BookFilters {
  search: string;
  category: number | null;
  availableOnly: boolean;
  ordering: BookOrdering;
  page: number;
  pageSize: number;
}

export const DEFAULT_BOOK_FILTERS: BookFilters = {
  search: "",
  category: null,
  availableOnly: false,
  ordering: "title",
  page: 1,
  pageSize: 20,
};

function parsePositiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}

function isOrdering(value: string | null): value is BookOrdering {
  return BOOK_ORDERINGS.some((option) => option.value === value);
}

/** Read filters from the URL; anything missing or invalid falls back to the default. */
export function parseBookFilters(params: URLSearchParams): BookFilters {
  const ordering = params.get("ordering");
  const pageSize = parsePositiveInt(params.get("page_size"));

  return {
    search: params.get("search") ?? "",
    category: parsePositiveInt(params.get("category")),
    availableOnly: params.get("available") === "true",
    ordering: isOrdering(ordering) ? ordering : DEFAULT_BOOK_FILTERS.ordering,
    page: parsePositiveInt(params.get("page")) ?? 1,
    pageSize: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_BOOK_FILTERS.pageSize,
  };
}

/** Write filters to the URL, leaving out defaults so shared links stay short. */
export function toSearchParams(filters: BookFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.trim() !== "") params.set("search", filters.search);
  if (filters.category !== null) params.set("category", String(filters.category));
  if (filters.availableOnly) params.set("available", "true");
  if (filters.ordering !== DEFAULT_BOOK_FILTERS.ordering) params.set("ordering", filters.ordering);
  if (filters.page !== 1) params.set("page", String(filters.page));
  if (filters.pageSize !== DEFAULT_BOOK_FILTERS.pageSize) params.set("page_size", String(filters.pageSize));
  return params;
}

/** Translate filter state into API query parameters (docs/API.md 4.3). */
export function toListParams(filters: BookFilters): BookListParams {
  return {
    search: filters.search.trim() || undefined,
    category: filters.category ?? undefined,
    available: filters.availableOnly || undefined,
    ordering: filters.ordering,
    page: filters.page,
    page_size: filters.pageSize,
  };
}
