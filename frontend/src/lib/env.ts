const DEFAULT_API_URL = "http://localhost:8000/api/v1";

export const env = {
  /** API base URL without a trailing slash. Set VITE_API_URL in .env. */
  apiUrl: (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, ""),
} as const;
