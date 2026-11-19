import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import type { Paginated } from "@/api/types";
import { useToastStore } from "@/lib/toast";

import { importBook, listCategories, lookupBooks } from "../api";
import type { BookCandidate, BookDetail } from "../types";
import { ImportBookDialog } from "./ImportBookDialog";

// Only the HTTP layer is mocked; the dialog, its two steps and the react-query hooks run for real.
vi.mock("../api");

const CODE = { id: 5, name: "Programação", slug: "programacao" };
const POETRY = { id: 6, name: "Poesia", slug: "poesia" };

const CLEAN_CODE: BookCandidate = {
  isbn: "9780132350884",
  title: "Clean Code",
  authors: ["Robert C. Martin"],
  publisher: "Prentice Hall",
  publication_year: 2008,
  pages: 464,
  cover_url: "https://covers.openlibrary.org/b/id/123-L.jpg",
  subjects: ["Computer programming"],
  in_catalogue: null,
  suggested_category_id: CODE.id,
};
const OWNED: BookCandidate = { ...CLEAN_CODE, isbn: "9780134494166", title: "Clean Architecture", in_catalogue: 9, suggested_category_id: null };

function pageOf<T>(results: T[]): Paginated<T> {
  return { count: results.length, page: 1, page_size: 100, total_pages: 1, next: null, previous: null, results };
}

function renderDialog(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ImportBookDialog onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  vi.mocked(listCategories).mockResolvedValue(pageOf([CODE, POETRY]));
  // The country list comes from the Home globe's data file.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ US: { c: [0, 0], r: [] }, BR: { c: [0, 0], r: [] } }) }),
  );
});

describe("ImportBookDialog", () => {
  it("searches, picks an edition with the suggested category and imports it", async () => {
    vi.mocked(lookupBooks).mockResolvedValue([CLEAN_CODE, OWNED]);
    vi.mocked(importBook).mockResolvedValue({ id: 1, title: "Clean Code" } as BookDetail);
    const user = userEvent.setup();
    const onClose = renderDialog();

    await user.type(screen.getByLabelText("Search text"), "clean code");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(lookupBooks).toHaveBeenCalledWith("title", "clean code");
    const list = await screen.findByRole("list", { name: "Search results" });
    expect(within(list).getByText("Already in the catalogue")).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: "Choose Clean Architecture" })).not.toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: "Choose Clean Code" }));
    await waitFor(() => expect(screen.getByLabelText("Category")).toHaveValue(String(CODE.id))); // preselected from the subjects
    await waitFor(() => expect(screen.getByRole("option", { name: /United States/ })).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("Author's country"), "US");
    await user.clear(screen.getByLabelText("Copies"));
    await user.type(screen.getByLabelText("Copies"), "3");
    await user.click(screen.getByRole("button", { name: "Add to catalogue" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(importBook).toHaveBeenCalledWith({
      isbn: "9780132350884",
      title: "Clean Code",
      author_names: ["Robert C. Martin"],
      publisher: "Prentice Hall",
      publication_year: 2008,
      pages: 464,
      cover_url: CLEAN_CODE.cover_url,
      category_id: CODE.id,
      copies: 3,
      author_country: "US",
    });
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('"Clean Code" was added.');
  });

  it("searches by ISBN when asked to", async () => {
    vi.mocked(lookupBooks).mockResolvedValue([]);
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(screen.getByLabelText("Search by"), "isbn");
    await user.type(screen.getByLabelText("Search text"), "0132350882");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(lookupBooks).toHaveBeenCalledWith("isbn", "0132350882");
    expect(await screen.findByText(/Nothing found/)).toBeInTheDocument();
  });

  it("explains when Open Library is down and lets the librarian try again", async () => {
    vi.mocked(lookupBooks)
      .mockRejectedValueOnce(new ApiError({ status: 503, code: "lookup_unavailable", detail: "The online book catalogue is not answering right now." }))
      .mockResolvedValueOnce([CLEAN_CODE]);
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Search text"), "clean");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText(/not answering right now/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Choose Clean Code" })).toBeInTheDocument();
  });

  it("keeps the dialog open and shows the server's reason when the import is refused", async () => {
    vi.mocked(lookupBooks).mockResolvedValue([CLEAN_CODE]);
    vi.mocked(importBook).mockRejectedValue(
      new ApiError({ status: 400, code: "validation_error", detail: "One or more fields are invalid.", fieldErrors: { isbn: ["A book with this ISBN already exists."] } }),
    );
    const user = userEvent.setup();
    const onClose = renderDialog();

    await user.type(screen.getByLabelText("Search text"), "clean");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Choose Clean Code" }));
    await user.click(await screen.findByRole("button", { name: "Add to catalogue" }));

    expect(await screen.findByText("A book with this ISBN already exists.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("will not import until a category is chosen", async () => {
    vi.mocked(lookupBooks).mockResolvedValue([{ ...CLEAN_CODE, suggested_category_id: null }]);
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Search text"), "clean");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Choose Clean Code" }));

    expect(await screen.findByRole("button", { name: "Add to catalogue" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Category"), String(POETRY.id));
    expect(screen.getByRole("button", { name: "Add to catalogue" })).toBeEnabled();
  });
});
