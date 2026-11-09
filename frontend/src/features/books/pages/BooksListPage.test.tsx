import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import type { Paginated } from "@/api/types";
import { AuthContext, type AuthContextValue } from "@/features/auth/AuthContext";
import type { Role, User } from "@/features/auth/types";

import { listBooks, listCategories } from "../api";
import type { Book, Category } from "../types";
import { BooksListPage } from "./BooksListPage";

// Mock the HTTP layer only: filters, debounce, URL state, pagination and role gating all run for real.
vi.mock("../api");

const CATEGORY: Category = { id: 2, name: "Software Engineering", slug: "software-engineering" };

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    title: "Clean Architecture",
    authors: [{ id: 3, name: "Robert C. Martin" }],
    isbn: "9780134494166",
    publisher: "Pearson",
    publication_year: 2017,
    category: CATEGORY,
    cover_image: null,
    total_copies: 4,
    available_copies: 1,
    is_available: true,
    is_active: true,
    ...overrides,
  };
}

function pageOf<T>(results: T[], overrides: Partial<Paginated<T>> = {}): Paginated<T> {
  return {
    count: results.length,
    page: 1,
    page_size: 20,
    total_pages: 1,
    next: null,
    previous: null,
    results,
    ...overrides,
  };
}

function makeUser(role: Role): User {
  return {
    id: 1,
    email: "user@example.com",
    first_name: "Test",
    last_name: "User",
    role,
    member_number: null,
    phone: "",
    address: "",
    is_active: true,
    is_blocked: false,
    blocked_reason: "",
    blocked_at: null,
    date_joined: "2026-11-01T00:00:00Z",
  };
}

/** Exposes the current query string so tests can assert what ended up in the URL. */
function LocationProbe() {
  return <output data-testid="url-search">{useLocation().search}</output>;
}

function renderPage({ role, url = "/books" }: { role?: Role; url?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    status: role ? "authenticated" : "anonymous",
    user: role ? makeUser(role) : null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[url]}>
          <BooksListPage />
          <LocationProbe />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const lastCall = (matcher: object) =>
  expect(listBooks).toHaveBeenLastCalledWith(expect.objectContaining(matcher), expect.anything());

beforeEach(() => {
  vi.mocked(listCategories).mockResolvedValue(pageOf([CATEGORY]));
  vi.mocked(listBooks).mockResolvedValue(
    pageOf([
      makeBook(),
      makeBook({ id: 2, title: "The Pragmatic Programmer", available_copies: 0, is_available: false }),
    ]),
  );
});

describe("BooksListPage: catalogue", () => {
  it("lists the books with their availability", async () => {
    renderPage();

    expect(await screen.findByText("Clean Architecture")).toBeInTheDocument();
    expect(screen.getByText("The Pragmatic Programmer")).toBeInTheDocument();
    expect(screen.getByText("1/4 available")).toBeInTheDocument();
    expect(screen.getByText("0/4 available")).toBeInTheDocument();
    lastCall({ ordering: "title", page: 1, page_size: 20 });
  });

  it("shows an empty state with a way out when nothing matches", async () => {
    vi.mocked(listBooks).mockResolvedValue(pageOf<Book>([]));
    renderPage();

    expect(await screen.findByText("No books match your filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("shows the API's error message and recovers when the user retries", async () => {
    const user = userEvent.setup();
    vi.mocked(listBooks).mockRejectedValueOnce(
      new ApiError({ status: 500, code: "server_error", detail: "Internal server error." }),
    );
    renderPage();

    expect(await screen.findByText("Internal server error.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Clean Architecture")).toBeInTheDocument();
  });
});

describe("BooksListPage: search and pagination", () => {
  it("searches once the user pauses typing, and keeps the term in the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Clean Architecture");

    await user.type(screen.getByRole("searchbox", { name: "Search books" }), "clean");

    await waitFor(() => lastCall({ search: "clean", page: 1 }));
    // Debounce: the API never saw the half-typed "c", "cl", "cle"...
    const searches = vi.mocked(listBooks).mock.calls.map(([params]) => params.search).filter(Boolean);
    expect(searches).toEqual(["clean"]);
    expect(screen.getByTestId("url-search")).toHaveTextContent("?search=clean");
  });

  it("goes back to page 1 when the search changes", async () => {
    const user = userEvent.setup();
    renderPage({ url: "/books?page=3" });
    await screen.findByText("Clean Architecture");

    await user.type(screen.getByRole("searchbox", { name: "Search books" }), "zzz");

    await waitFor(() => lastCall({ search: "zzz", page: 1 }));
    expect(screen.getByTestId("url-search")).not.toHaveTextContent("page=");
  });

  it("moves to the next page", async () => {
    const user = userEvent.setup();
    vi.mocked(listBooks).mockImplementation(async (params) =>
      pageOf([makeBook()], { count: 45, total_pages: 3, page: params.page ?? 1 }),
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Next page" }));

    await waitFor(() => lastCall({ page: 2 }));
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByTestId("url-search")).toHaveTextContent("?page=2");
  });

  it("restores the filters from a shared link", async () => {
    renderPage({ url: "/books?category=2&available=true&ordering=-created_at&page=2&page_size=10" });
    await screen.findByText("Clean Architecture");

    lastCall({ category: 2, available: true, ordering: "-created_at", page: 2, page_size: 10 });
  });
});

describe("BooksListPage: who sees which actions", () => {
  it.each<[string, Role | undefined, boolean]>([
    ["anonymous visitor", undefined, false],
    ["MEMBER", "MEMBER", false],
    ["LIBRARIAN", "LIBRARIAN", true],
    ["ADMIN", "ADMIN", true],
  ])("%s: can add and edit books = %s", async (_label, role, canManage) => {
    renderPage({ role });
    await screen.findByText("Clean Architecture");

    expect(screen.queryByRole("button", { name: /add book/i }) !== null).toBe(canManage);
    expect(screen.queryByRole("button", { name: "Edit Clean Architecture" }) !== null).toBe(canManage);
  });

  it("offers Reserve to a member, only for a book with no copy on the shelf", async () => {
    renderPage({ role: "MEMBER" });
    await screen.findByText("Clean Architecture");

    expect(screen.getByRole("button", { name: "Reserve The Pragmatic Programmer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reserve Clean Architecture" })).not.toBeInTheDocument();
  });

  it("does not offer Reserve to staff", async () => {
    renderPage({ role: "LIBRARIAN" });
    await screen.findByText("Clean Architecture");

    expect(screen.queryByRole("button", { name: /^Reserve/ })).not.toBeInTheDocument();
  });
});
