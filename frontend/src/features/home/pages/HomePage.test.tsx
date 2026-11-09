import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "@/api/types";
import { AuthContext, type AuthContextValue } from "@/features/auth/AuthContext";
import type { Role, User } from "@/features/auth/types";
import { listBooks, listCategories } from "@/features/books/api";
import type { Book, Category } from "@/features/books/types";
import { createReservation } from "@/features/reservations/api";

import { HomePage } from "./HomePage";

// Only the HTTP layer is mocked: the shelves, the dialog, the account bar and the reserve button run for real.
vi.mock("@/features/books/api");
vi.mock("@/features/reservations/api");

const POETRY: Category = { id: 3, name: "Poesia", slug: "poesia" };

function makeUser(role: Role): User {
  return {
    id: 1,
    email: "ana@example.com",
    first_name: "Ana",
    last_name: "Silva",
    role,
    member_number: role === "MEMBER" ? "M-000001" : null,
    phone: "",
    address: "",
    is_active: true,
    is_blocked: false,
    blocked_reason: "",
    blocked_at: null,
    date_joined: "2026-11-01T00:00:00Z",
  };
}

function book(overrides: Partial<Book>): Book {
  return {
    id: 1,
    title: "Antologia Poética",
    authors: [{ id: 3, name: "Carlos Drummond" }],
    isbn: "9788535914054",
    publisher: "",
    publication_year: 1962,
    category: POETRY,
    cover_image: null,
    total_copies: 2,
    available_copies: 2,
    is_available: true,
    is_active: true,
    ...overrides,
  };
}

function pageOf<T>(results: T[]): Paginated<T> {
  return { count: results.length, page: 1, page_size: 20, total_pages: 1, next: null, previous: null, results };
}

function renderHome(role?: Role) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    status: role ? "authenticated" : "anonymous",
    user: role ? makeUser(role) : null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return auth;
}

async function openPoetry() {
  const user = userEvent.setup();
  const [shelf] = await screen.findAllByRole("button", { name: "Poesia" });
  await user.click(shelf!);
  return { user, dialog: await screen.findByRole("dialog") };
}

beforeEach(() => {
  vi.mocked(listCategories).mockResolvedValue(pageOf([POETRY]));
  vi.mocked(listBooks).mockResolvedValue(
    pageOf([
      book({}),
      book({ id: 2, title: "Poesias Completas", total_copies: 1, available_copies: 0, is_available: false }),
    ]),
  );
});

describe("HomePage: account bar", () => {
  it("offers sign in and sign up to a visitor", async () => {
    renderHome();

    expect(await screen.findByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("link", { name: "Painel" })).not.toBeInTheDocument();
  });

  it("gives a member shortcuts to their own pages", async () => {
    renderHome("MEMBER");

    expect(await screen.findByText("Olá, Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meus empréstimos" })).toHaveAttribute("href", "/loans");
    expect(screen.getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/reservations");
    expect(screen.getByRole("link", { name: "Multas" })).toHaveAttribute("href", "/fines");
    expect(screen.queryByRole("link", { name: "Painel" })).not.toBeInTheDocument();
  });

  it("gives staff the dashboard link, and signing out works", async () => {
    const user = userEvent.setup();
    const auth = renderHome("LIBRARIAN");

    expect(await screen.findByRole("link", { name: "Painel" })).toHaveAttribute("href", "/dashboard");
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(auth.logout).toHaveBeenCalled();
  });
});

describe("HomePage: reserving from a shelf", () => {
  it("lists the shelf's books and offers Reservar only on the one with no free copy", async () => {
    renderHome("MEMBER");
    const { dialog } = await openPoetry();

    expect(await within(dialog).findByText("Antologia Poética")).toBeInTheDocument();
    expect(within(dialog).getByText("2 de 2 disponíveis")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /^Reservar/ })).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "Reservar Poesias Completas" })).toBeInTheDocument();
  });

  it("reserves the book for the signed-in member", async () => {
    vi.mocked(createReservation).mockResolvedValue({
      id: 9,
      member: { id: 1, email: "ana@example.com", full_name: "Ana Silva", member_number: "M-000001" },
      book: { id: 2, title: "Poesias Completas", isbn: "9789722036818", cover_image: null },
      status: "PENDING",
      queue_position: 1,
      notified_at: null,
      expires_at: null,
      loan_id: null,
      created_at: "2026-11-09T00:00:00Z",
    });
    renderHome("MEMBER");
    const { user, dialog } = await openPoetry();

    await user.click(await within(dialog).findByRole("button", { name: "Reservar Poesias Completas" }));

    await waitFor(() => expect(createReservation).toHaveBeenCalledWith({ book_id: 2 }));
    expect(await screen.findByText(/você é o nº 1 da fila/)).toBeInTheDocument();
  });

  it("sends a visitor to sign in instead of reserving", async () => {
    renderHome();
    const { dialog } = await openPoetry();

    const link = await within(dialog).findByRole("link", { name: "Entrar para reservar Poesias Completas" });
    expect(link).toHaveAttribute("href", "/login");
    expect(within(dialog).queryByRole("button", { name: /^Reservar/ })).not.toBeInTheDocument();
  });

  it("staff do not get the button (they reserve for a member at the desk)", async () => {
    renderHome("LIBRARIAN");
    const { dialog } = await openPoetry();

    await within(dialog).findByText("Poesias Completas");
    expect(within(dialog).queryByRole("button", { name: /^Reservar/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /Entrar para reservar/ })).not.toBeInTheDocument();
  });
});
