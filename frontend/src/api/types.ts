/** Page-number pagination envelope used by every list endpoint (see docs/API.md 1.6). */
export interface Paginated<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Body of every non-2xx response (see docs/API.md 1.5). */
export interface ApiErrorBody {
  detail: string;
  code: string;
  field_errors: Record<string, string[]>;
}
