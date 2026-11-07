export interface Author {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

/** Row in GET /books/ (BookListSerializer). Note: no `description`. */
export interface Book {
  id: number;
  title: string;
  authors: Author[];
  isbn: string;
  publisher: string;
  publication_year: number | null;
  category: Category;
  cover_image: string | null;
  total_copies: number;
  available_copies: number;
  is_available: boolean;
  is_active: boolean;
}

/** GET /books/{id}/ and the response of create/update (BookDetailSerializer). */
export interface BookDetail extends Book {
  description: string;
  created_at: string;
  updated_at: string;
}

export type BookOrdering = "title" | "-created_at" | "publication_year" | "available_copies";

/** Query parameters of GET /books/ (docs/API.md 4.3). */
export interface BookListParams {
  search?: string;
  category?: number;
  available?: boolean;
  ordering?: BookOrdering;
  page?: number;
  page_size?: number;
}

/** Body of POST /books/ and PATCH /books/{id}/. */
export interface BookWritePayload {
  title: string;
  isbn: string;
  publisher: string;
  publication_year: number | null;
  category_id: number;
  author_ids: number[];
  description: string;
  /** Sent as multipart only when a file is chosen. Omitted otherwise (the server keeps the current cover). */
  cover_image?: File | null;
  /** Create only. */
  initial_copies?: number;
}
