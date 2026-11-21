import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "@/api/types";
import { AuthContext, type AuthContextValue } from "@/features/auth/AuthContext";
import type { Role, User } from "@/features/auth/types";
import { listBooks, listCategories, listCountries } from "@/features/books/api";
import type { Book, Category } from "@/features/books/types";
import { listLoans } from "@/features/loans/api";
import type { Loan } from "@/features/loans/types";
import { createReservation } from "@/features/reservations/api";
import { usePrefs } from "@/lib/i18n/store";

import { HomePage } from "./HomePage";

// Only the HTTP layer is mocked: the shelves, the dialog, the account bar and the reserve button run for real.
vi.mock("@/features/books/api");
vi.mock("@/features/reservations/api");
vi.mock("@/features/loans/api");

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
    pages: null,
    rating_avg: null,
    rating_count: 0,
    is_favorite: false,
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
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Lista" })); // the accessible catalogue view
  return { user, dialog };
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

describe("HomePage: the globe", () => {
  it("opens from the armillary sphere upstairs and shows the shelf of the chosen country", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ JP: { c: [138, 36], r: [[130, 31, 142, 31, 142, 41, 130, 41]] } }) }));
    vi.mocked(listCountries).mockResolvedValue([{ country: "JP", books: 2 }]);
    const user = userEvent.setup();
    renderHome();

    expect(screen.queryByRole("button", { name: "Abrir o globo" })).not.toBeInTheDocument(); // not on the ground floor
    await user.click((await screen.findAllByRole("button", { name: "Subir ao segundo andar" }))[0]!);
    await user.click((await screen.findAllByRole("button", { name: /Abrir o globo/ }))[0]!);

    await user.click(await screen.findByRole("button", { name: /Lista de países/ }));
    await user.click(await screen.findByRole("button", { name: /Japão: 2 livros/ }));

    expect(await screen.findByRole("heading", { name: "Japão" })).toBeInTheDocument();
    await waitFor(() => expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({ author_country: "JP" }), expect.anything()));
    vi.unstubAllGlobals();
  });
});

describe("HomePage: language", () => {
  it("shows the category names and the Indicação label in the chosen language", async () => {
    usePrefs.setState({ lang: "en" });
    try {
      renderHome();
      expect((await screen.findAllByRole("button", { name: "Poetry" })).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "Recommendation" }).length).toBeGreaterThan(0);
      expect(screen.getByRole("link", { name: "Counter mode" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Poesia" })).not.toBeInTheDocument();

      // upstairs the painted plaques come in the same language (the default theme is the night picture)
      const user = userEvent.setup();
      await user.click((await screen.findAllByRole("button", { name: "Go up to the second floor" }))[0]!);
      expect(document.querySelector(".hm-room")).toHaveStyle({ backgroundImage: 'url("/sala-2-noite-en.jpg")' });
    } finally {
      usePrefs.setState({ lang: "pt" });
    }
  });
});

describe("HomePage: Indicação", () => {
  it("shows a recommended book in the middle of the screen instead of a shelf, and can pick another", async () => {
    const user = userEvent.setup();
    renderHome();

    const [picks] = await screen.findAllByRole("button", { name: "Indicação" });
    await user.click(picks!);

    const stage = await screen.findByRole("dialog", { name: "Indicação" });
    expect(await within(stage).findByRole("heading", { level: 2 })).toHaveTextContent(/Antologia Poética|Poesias Completas/);
    expect(within(stage).getByText("Indicações da casa")).toBeInTheDocument();
    expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({ available: true }), expect.anything());

    await user.click(within(stage).getByRole("button", { name: "Outra indicação" }));
    expect(await within(stage).findByRole("heading", { level: 2 })).toBeInTheDocument();

    await user.click(within(stage).getByRole("button", { name: "Fechar indicação" }));
    expect(screen.queryByRole("dialog", { name: "Indicação" })).not.toBeInTheDocument();
  });

  it("says so when there is nothing to recommend", async () => {
    vi.mocked(listBooks).mockResolvedValue(pageOf([]));
    const user = userEvent.setup();
    renderHome();

    const [picks] = await screen.findAllByRole("button", { name: "Indicação" });
    await user.click(picks!);
    expect(await screen.findByText("Ainda não há livros disponíveis para indicar.")).toBeInTheDocument();
  });
});

describe("HomePage: sound", () => {
  it("is off until the reader turns it on with the speaker button, and remembers the choice", async () => {
    const { usePrefs } = await import("@/lib/i18n/store");
    usePrefs.setState({ sound: false });
    const user = userEvent.setup();
    renderHome();

    const on = await screen.findByRole("button", { name: "Ligar o som" });
    await user.click(on);
    expect(await screen.findByRole("button", { name: "Desligar o som" })).toBeInTheDocument();
    expect(usePrefs.getState().sound).toBe(true);
    expect(window.localStorage.getItem("lms.sound")).toBe("on");

    await user.click(screen.getByRole("button", { name: "Desligar o som" }));
    expect(usePrefs.getState().sound).toBe(false);
    expect(window.localStorage.getItem("lms.sound")).toBe("off");
  });
});

describe("HomePage: the hourglass", () => {
  function loan(id: number, title: string, due: string, status: Loan["status"], overdueDays = 0): Loan {
    return {
      id,
      member: { id: 1, email: "ana@example.com", full_name: "Ana Silva", member_number: "M-000001" },
      copy: { id, barcode: `B${id}` },
      book: { id: id + 100, title, isbn: "9788535914054", cover_image: null },
      loaned_at: "2026-11-01T00:00:00Z",
      due_date: due,
      returned_at: null,
      status,
      days_overdue: overdueDays,
      renewal_count: 0,
    };
  }
  function isoIn(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  beforeEach(() => {
    vi.mocked(listBooks).mockResolvedValue(pageOf<Book>([]));
    vi.mocked(listCategories).mockResolvedValue(pageOf<Category>([POETRY]));
    vi.mocked(listCountries).mockResolvedValue([]);
  });

  async function upstairs() {
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: "Subir ao segundo andar" }))[0]!);
    return user;
  }

  it("shows a signed-in reader's loans, the late ones first, with the days left", async () => {
    vi.mocked(listLoans).mockImplementation(async (params) =>
      pageOf(
        params.status === "overdue"
          ? [loan(1, "Dom Casmurro", isoIn(-3), "overdue", 3)]
          : [loan(2, "Vidas Secas", isoIn(1), "active"), loan(3, "A Hora da Estrela", isoIn(9), "active")],
      ),
    );
    renderHome("MEMBER");
    const user = await upstairs();
    await user.click((await screen.findAllByRole("button", { name: "Abrir a ampulheta: meus empréstimos" }))[0]!);

    const dialog = await screen.findByRole("dialog", { name: "Seus empréstimos" });
    expect(await within(dialog).findByText("Dom Casmurro")).toBeInTheDocument();
    expect(within(dialog).getByText("3 dias de atraso")).toBeInTheDocument();
    expect(within(dialog).getByText("Vence amanhã")).toBeInTheDocument();
    expect(within(dialog).getByText("Vence em 9 dias")).toBeInTheDocument();
    const titles = within(dialog).getAllByRole("listitem").map((li) => li.querySelector(".hg-book")?.textContent);
    expect(titles).toEqual(["Dom Casmurro", "Vidas Secas", "A Hora da Estrela"]);
    expect(listLoans).toHaveBeenCalledWith(expect.objectContaining({ member: 1, status: "overdue" }), expect.anything());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says so when the reader has nothing on loan", async () => {
    vi.mocked(listLoans).mockResolvedValue(pageOf<Loan>([]));
    renderHome("MEMBER");
    const user = await upstairs();
    await user.click((await screen.findAllByRole("button", { name: "Abrir a ampulheta: meus empréstimos" }))[0]!);
    expect(await screen.findByText("Você não tem livros emprestados. A ampulheta está livre.")).toBeInTheDocument();
  });

  it("asks a visitor to sign in, without calling the loans API", async () => {
    renderHome();
    const user = await upstairs();
    await user.click((await screen.findAllByRole("button", { name: "Abrir a ampulheta: meus empréstimos" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Seus empréstimos" });
    expect(within(dialog).getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(listLoans).not.toHaveBeenCalled();
  });
});

describe("HomePage: the book of favourites", () => {
  async function upstairs() {
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: "Subir ao segundo andar" }))[0]!);
    return user;
  }

  it("opens the reader's wish list as a shelf", async () => {
    renderHome("MEMBER");
    const user = await upstairs();
    await user.click((await screen.findAllByRole("button", { name: "Abrir o livro dos favoritos" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Meus favoritos" })).toBeInTheDocument();
    await waitFor(() => expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({ favorite: true }), expect.anything()));
  });

  it("tells a visitor to sign in instead of opening an empty shelf", async () => {
    renderHome();
    const user = await upstairs();
    await user.click((await screen.findAllByRole("button", { name: "Abrir o livro dos favoritos" }))[0]!);
    expect(await screen.findByText("Entre na sua conta para ver seus livros favoritos.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(listBooks).not.toHaveBeenCalledWith(expect.objectContaining({ favorite: true }), expect.anything());
  });
});
