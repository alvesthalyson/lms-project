import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listCountries } from "@/features/books/api";

import { GlobeDialog } from "./GlobeDialog";
import type { World } from "./world";

vi.mock("@/features/books/api");

// Three small "countries" around the point the globe starts on (lon -40, lat 15): two with books, one without.
const WORLD: World = {
  BR: { c: [-45, 5], r: [[-50, 0, -40, 0, -40, 10, -50, 10]] },
  PT: { c: [-30, 20], r: [[-35, 15, -25, 15, -25, 25, -35, 25]] },
  FR: { c: [-45, 30], r: [[-50, 26, -40, 26, -40, 34, -50, 34]] },
};

function renderDialog(props: Partial<{ onClose: () => void; onPick: (code: string, name: string) => void }> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = props.onClose ?? vi.fn();
  const onPick = props.onPick ?? vi.fn();
  render(
    <QueryClientProvider client={client}>
      <GlobeDialog onClose={onClose} onPick={onPick} autoRotate={false} />
    </QueryClientProvider>,
  );
  return { onClose, onPick };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => WORLD }));
  vi.mocked(listCountries).mockResolvedValue([
    { country: "BR", books: 3 },
    { country: "PT", books: 1 },
  ]);
});

afterEach(() => vi.unstubAllGlobals());

describe("GlobeDialog", () => {
  it("lights up only the countries that have books, as buttons that say how many", async () => {
    renderDialog();

    // the gold shape on the globe and its twin in the list below
    expect(await screen.findAllByRole("button", { name: "Brasil: 3 livros" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Portugal: 1 livro" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /França/ })).not.toBeInTheDocument(); // FR is drawn, but dim
  });

  it("opens a country when its gold shape is clicked, after the globe turns to face it", async () => {
    const user = userEvent.setup();
    const { onPick } = renderDialog();

    const shape = (await screen.findAllByRole("button", { name: "Brasil: 3 livros" })).find((el) => el.tagName.toLowerCase() === "path")!;
    await user.click(shape);

    await waitFor(() => expect(onPick).toHaveBeenCalledWith("BR", "Brasil"));
  });

  it("also lists the countries as buttons, for keyboards and the ones the map does not draw", async () => {
    const user = userEvent.setup();
    const { onPick } = renderDialog();

    const list = await screen.findByRole("list", { name: "Países com livros" });
    expect(list.querySelectorAll("li")).toHaveLength(2);
    await user.click(within(list).getByRole("button", { name: /Portugal: 1 livro/ }));
    expect(onPick).toHaveBeenCalledWith("PT", "Portugal");
  });

  it("says so when no author has a country yet", async () => {
    vi.mocked(listCountries).mockResolvedValue([]);
    renderDialog();

    expect(await screen.findByText("Ainda não há livros com o país do autor cadastrado.")).toBeInTheDocument();
  });

  it("shows an error with a retry when the data cannot be loaded", async () => {
    vi.mocked(listCountries).mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir o globo.");
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("list", { name: "Países com livros" })).toBeInTheDocument();
  });

  it("closes with Esc, with the X button and with a click outside", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar o globo" }));
    await user.pointer({ keys: "[MouseLeft]", target: document.querySelector(".hm-backdrop")! });

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
