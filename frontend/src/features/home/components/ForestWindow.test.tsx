import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/books/types";
import { usePrefs } from "@/lib/i18n/store";

import { ForestWindow } from "./ForestWindow";
import { FRAMES } from "./forestScene";
import { taleOfTheDay } from "./stories";

const POETRY: Category = { id: 1, name: "Poesia", slug: "poesia" };
const FANTASY: Category = { id: 2, name: "Fantasia", slug: "fantasia" };

function show(categories: Category[], props: Partial<{ onOpenCategory: (c: Category) => void; onClose: () => void }> = {}) {
  const onOpenCategory = props.onOpenCategory ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  const view = render(<ForestWindow categories={categories} onOpenCategory={onOpenCategory} onClose={onClose} />);
  return { ...view, onOpenCategory, onClose };
}

afterEach(() => {
  usePrefs.setState({ lang: "pt" });
});

describe("ForestWindow", () => {
  it("is a dialog that holds the forest picture and, under it, every frame of the journey in order", () => {
    const { container } = show([POETRY]);
    expect(screen.getByRole("dialog", { name: "A floresta dos vaga-lumes" })).toBeInTheDocument();
    expect((container.querySelector(".fw-forest-img") as HTMLElement).style.backgroundImage).toContain("/floresta-vagalumes.jpg");
    const frames = [...container.querySelectorAll<HTMLImageElement>(".fw-frame")];
    expect(frames.map((img) => img.getAttribute("src"))).toEqual(Array.from({ length: FRAMES }, (_, i) => `/transicao/f${i + 1}.jpg`));
    const delays = frames.map((img) => Number(img.style.getPropertyValue("--d").replace("s", "")));
    for (let i = 1; i < delays.length; i += 1) expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    // the forest is above the journey, so that it can arrive out of the light
    const order = [...container.querySelector(".fw-backdrop")!.children].map((el) => el.className);
    expect(order.indexOf("fw-forest")).toBeGreaterThan(order.indexOf("fw-journey"));
  });

  it("tells the tale of the day, all its lines in order, with its title", () => {
    const tale = taleOfTheDay(new Date());
    const { container } = show([POETRY]);
    expect(screen.getByRole("heading", { name: tale.title.pt })).toBeInTheDocument();
    expect([...container.querySelectorAll(".fw-line")].map((p) => p.textContent)).toEqual([...tale.lines.pt]);
    expect(container.querySelectorAll(".fw-line--last")).toHaveLength(1);
  });

  it("tells it in the reader's language", () => {
    usePrefs.setState({ lang: "ja" });
    const tale = taleOfTheDay(new Date());
    const { container } = show([POETRY]);
    expect(screen.getByRole("heading", { name: tale.title.ja })).toBeInTheDocument();
    expect(container.querySelector(".fw-line")?.textContent).toBe(tale.lines.ja[0]);
  });

  it("ends by offering the shelf of the tale's category, and opens it", async () => {
    const cat: Category = { id: 9, name: "Outra", slug: taleOfTheDay(new Date()).category };
    const { onOpenCategory } = show([POETRY, FANTASY, cat]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Continuar a história: estante Outra" }));
    expect(onOpenCategory).toHaveBeenCalledWith(cat);
  });

  it("falls back to another shelf when the library has no shelf for the tale's category", async () => {
    const odd: Category = { id: 5, name: "Culinária", slug: "culinaria" };
    const { onOpenCategory } = show([odd]);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continuar a história: estante Culinária" }));
    expect(onOpenCategory).toHaveBeenCalledWith(odd);
  });

  it("offers no shelf when the library has no categories, but still a way back", async () => {
    const { onClose } = show([]);
    expect(screen.queryByRole("button", { name: /Continuar a história/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Voltar à biblioteca" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Esc and with the X button", async () => {
    const { onClose } = show([POETRY]);
    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar a janela" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("brings the scene to life: a swirl of sparks, a flash and fireflies", () => {
    const { container } = show([POETRY]);
    expect(container.querySelectorAll(".fw-spark").length).toBeGreaterThanOrEqual(40);
    expect(container.querySelector(".fw-flash")).not.toBeNull();
    expect(container.querySelectorAll(".fw-fly").length).toBeGreaterThanOrEqual(15);
  });
});
