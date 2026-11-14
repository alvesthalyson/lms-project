import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "@/api/types";
import { AuthContext, type AuthContextValue } from "@/features/auth/AuthContext";
import type { User } from "@/features/auth/types";
import { getBook, listBooks, listCategories, listRelated, listReviews, saveReview, setFavorite } from "@/features/books/api";
import type { Book, BookDetail, Category } from "@/features/books/types";

import { hueFromTitle } from "../coverTint";
import { HomePage } from "./HomePage";

vi.mock("@/features/books/api");
vi.mock("@/features/reservations/api");

const POETRY: Category = { id: 3, name: "Poesia", slug: "poesia" };

const member: User = {
  id: 1, email: "ana@example.com", first_name: "Ana", last_name: "Silva", role: "MEMBER", member_number: "M-000001",
  phone: "", address: "", is_active: true, is_blocked: false, blocked_reason: "", blocked_at: null, date_joined: "2026-11-01T00:00:00Z",
};

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 1, title: "Antologia Poética", authors: [{ id: 3, name: "Carlos Drummond" }], isbn: "9788535914054", publisher: "",
    publication_year: 1962, category: POETRY, cover_image: null, total_copies: 2, available_copies: 2, is_available: true,
    is_active: true, pages: 120, rating_avg: 4, rating_count: 2, is_favorite: false, ...overrides,
  };
}

const page = <T,>(results: T[]): Paginated<T> => ({ count: results.length, page: 1, page_size: 20, total_pages: 1, next: null, previous: null, results });

function renderHome(user: User | null, initialUrl = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    status: user ? "authenticated" : "anonymous", user, login: vi.fn(), register: vi.fn(), logout: vi.fn().mockResolvedValue(undefined),
  };
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[initialUrl]}>
          <HomePage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

async function openShelf() {
  const u = userEvent.setup();
  const [shelf] = await screen.findAllByRole("button", { name: "Poesia" });
  await u.click(shelf!);
  return { u, dialog: await screen.findByRole("dialog") };
}

beforeEach(() => {
  vi.mocked(listCategories).mockResolvedValue(page([POETRY]));
  vi.mocked(listBooks).mockResolvedValue(page([book(), book({ id: 2, title: "Poesias Completas", rating_avg: null, rating_count: 0 })]));
  vi.mocked(getBook).mockImplementation(async (id) => ({ ...book({ id }), description: "Versos de uma vida.", created_at: "", updated_at: "" }) as BookDetail);
  vi.mocked(listReviews).mockResolvedValue(page([{ id: 5, reviewer: "Bia S.", rating: 4, comment: "Lindo", created_at: "2026-11-10T00:00:00Z", is_mine: false }]));
  vi.mocked(listRelated).mockResolvedValue([{ reason: "author", book: book({ id: 7, title: "Sentimento do Mundo" }) }]);
});

describe("3D shelf", () => {
  it("stands the shelf's books up as buttons, shelf view first", async () => {
    renderHome(null);
    const { dialog } = await openShelf();

    expect(await within(dialog).findByRole("button", { name: /Antologia Poética, Carlos Drummond/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Estante" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the list view from the URL", async () => {
    renderHome(null, "/?vista=lista");
    const { dialog } = await openShelf();

    expect(await within(dialog).findByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");
  });

  it("searches the shelf, and the / key focuses the search box", async () => {
    renderHome(null);
    const { u, dialog } = await openShelf();
    await within(dialog).findByRole("button", { name: /Antologia/ });

    await u.keyboard("/");
    expect(within(dialog).getByRole("searchbox", { name: "Buscar nesta estante" })).toHaveFocus();
    await u.keyboard("poesias");
    await waitFor(() => expect(listBooks).toHaveBeenLastCalledWith(expect.objectContaining({ search: "poesias" }), expect.anything()));
  });

  it("the R key opens a book from the shelf", async () => {
    renderHome(null);
    const { u, dialog } = await openShelf();
    await within(dialog).findByRole("button", { name: /Antologia/ });

    await u.keyboard("r");
    expect(await screen.findByRole("heading", { name: /Antologia Poética|Poesias Completas/ })).toBeInTheDocument();
  });
});

describe("book panel", () => {
  async function openAntologia(user: User | null) {
    renderHome(user);
    const { u, dialog } = await openShelf();
    await u.click(await within(dialog).findByRole("button", { name: /Antologia Poética, Carlos Drummond/ }));
    const panel = (await screen.findAllByRole("dialog")).at(-1)!;
    return { u, panel };
  }

  it("shows description, rating, reviews and related books", async () => {
    const { panel } = await openAntologia(null);

    expect(await within(panel).findByText("Versos de uma vida.")).toBeInTheDocument();
    expect(within(panel).getByRole("img", { name: /Nota 4,0 de 5/ })).toBeInTheDocument();
    expect(await within(panel).findByText("Lindo")).toBeInTheDocument();
    expect(await within(panel).findByRole("button", { name: "Abrir Sentimento do Mundo" })).toBeInTheDocument();
    expect(within(panel).getByText(/Entre na sua conta para avaliar/)).toBeInTheDocument();
  });

  it("opens a related book in the same panel", async () => {
    const { u, panel } = await openAntologia(null);

    await u.click(await within(panel).findByRole("button", { name: "Abrir Sentimento do Mundo" }));
    expect(await screen.findByRole("heading", { name: "Sentimento do Mundo" })).toBeInTheDocument();
  });

  it("lets a signed-in member add the book to the wish list", async () => {
    vi.mocked(setFavorite).mockResolvedValue(true);
    const { u, panel } = await openAntologia(member);

    await u.click(await within(panel).findByRole("button", { name: /Quero ler/ }));
    await waitFor(() => expect(setFavorite).toHaveBeenCalledWith(1, true));
  });

  it("posts a review with the chosen stars", async () => {
    vi.mocked(saveReview).mockResolvedValue({ id: 9, reviewer: "Ana S.", rating: 5, comment: "Amei", created_at: "", is_mine: true });
    const { u, panel } = await openAntologia(member);

    const submit = await within(panel).findByRole("button", { name: "Avaliar" });
    expect(submit).toBeDisabled(); // no stars yet
    await u.click(within(panel).getByRole("radio", { name: "5 estrelas" }));
    await u.type(within(panel).getByLabelText("Comentário"), "Amei");
    await u.click(submit);

    await waitFor(() => expect(saveReview).toHaveBeenCalledWith(1, { rating: 5, comment: "Amei" }));
  });

  it("Esc closes only the panel, not the shelf behind it", async () => {
    const { u, panel } = await openAntologia(null);
    await within(panel).findByText("Versos de uma vida.");

    await u.keyboard("{Escape}");
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(screen.getByRole("heading", { name: "Poesia" })).toBeInTheDocument();
  });
});

describe("cover tint fallback", () => {
  it("gives a title a stable hue", () => {
    expect(hueFromTitle("Kokoro")).toBe(hueFromTitle("Kokoro"));
    expect(hueFromTitle("Kokoro")).not.toBe(hueFromTitle("Noli Me Tangere"));
    expect(hueFromTitle("Kokoro")).toBeGreaterThanOrEqual(0);
    expect(hueFromTitle("Kokoro")).toBeLessThan(360);
  });
});
