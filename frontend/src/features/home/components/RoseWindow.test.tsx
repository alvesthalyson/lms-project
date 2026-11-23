import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/books/types";

import { RoseWindow, labelSize, petalPath } from "./RoseWindow";

function category(id: number, name: string): Category {
  return { id, name, slug: name.toLowerCase() };
}
const CATS = [category(1, "Poesia"), category(2, "Arte"), category(3, "Filosofia")];

describe("RoseWindow", () => {
  it("has one petal per category, each a button with the category's name", () => {
    render(<RoseWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole("button").filter((b) => !b.classList.contains("hm-close"))).toHaveLength(3);
    for (const name of ["Poesia", "Arte", "Filosofia"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("picks a category by click and by keyboard", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<RoseWindow categories={CATS} onPick={onPick} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Arte" }));
    expect(onPick).toHaveBeenLastCalledWith(CATS[1]);
    screen.getByRole("button", { name: "Filosofia" }).focus();
    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenLastCalledWith(CATS[2]);
  });

  it("closes with Esc, the X button and a click outside and a click outside", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<RoseWindow categories={CATS} onPick={vi.fn()} onClose={onClose} />);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar a rosa" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.pointer({ keys: "[MouseLeft]", target: container.querySelector(".hm-backdrop")! });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("says so, and draws no petals, when there are no categories", () => {
    render(<RoseWindow categories={[]} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Ainda não há categorias no acervo.")).toBeInTheDocument();
    expect(document.querySelectorAll(".rs-petal")).toHaveLength(0);
  });

  it("draws a closed petal that points up, and shrinks long names", () => {
    expect(petalPath(8)).toMatch(/^M .* Z$/);
    expect(petalPath(1)).not.toContain("NaN");
    expect(labelSize("Arte")).toBe(16);
    expect(labelSize("Programação")).toBeLessThan(labelSize("Arte"));
    expect(labelSize("Uma categoria com um nome muito comprido")).toBeGreaterThanOrEqual(9);
  });
});
