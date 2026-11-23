import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/books/types";

import { RoseWindow } from "./RoseWindow";
import { labelSize, landingTimes, layout, petalPath } from "./roseGeometry";

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

  it("closes with Esc, the X button and a click outside", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<RoseWindow categories={CATS} onPick={vi.fn()} onClose={onClose} />);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar a rosa" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.pointer({ keys: "[MouseLeft]", target: container.querySelector(".hm-backdrop")! });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("says so, and offers no petals to pick, when there are no categories", () => {
    render(<RoseWindow categories={[]} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Ainda não há categorias no acervo.")).toBeInTheDocument();
    expect(document.querySelectorAll(".rs-hover--pick")).toHaveLength(0);
    expect(screen.queryAllByRole("button").filter((b) => !b.classList.contains("hm-close"))).toHaveLength(0);
  });

  it("draws a flower: the labelled petals at the back, and rings of unlabelled ones up to the bud", () => {
    const { container } = render(<RoseWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelectorAll(".rs-layer").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".rs-hover--pick")).toHaveLength(3);
    expect(container.querySelectorAll(".rs-hover").length).toBeGreaterThan(20); // outer petals plus the inner rings
    expect(container.querySelectorAll(".rs-label")).toHaveLength(3);
  });
});

describe("rose geometry", () => {
  it("lays out one labelled outer petal per category, evenly around, and the same flower every time", () => {
    const a = layout(8);
    expect(layout(8)).toEqual(a);
    const outer = a.filter((p) => p.labelled);
    expect(outer).toHaveLength(8);
    expect(outer.map((p) => p.angle)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(new Set(a.map((p) => p.key)).size).toBe(a.length);
  });

  it("opens from the bud outwards: inner rings arrive before the outer ring", () => {
    const first = (layer: number) => Math.min(...layout(8).filter((p) => p.layer === layer).map((p) => p.delay));
    expect(first(4)).toBeLessThan(first(3));
    expect(first(3)).toBeLessThan(first(2));
    expect(first(1)).toBeLessThan(first(0));
  });

  it("has no outer ring when there is nothing to label, and keeps small counts wide enough", () => {
    expect(layout(0).some((p) => p.layer === 0)).toBe(false);
    expect(layout(2).filter((p) => p.labelled)).toHaveLength(2);
  });

  it("gives a landing time per labelled petal, all after the bud has formed", () => {
    const times = landingTimes(8);
    expect(times).toHaveLength(8);
    expect(Math.min(...times)).toBeGreaterThan(1.5);
    expect(Math.max(...times)).toBeLessThan(6);
  });

  it("draws a closed petal that points up, and shrinks long names", () => {
    expect(petalPath(80, 100)).toMatch(/^M .* Z$/);
    expect(petalPath(80, 100)).not.toContain("NaN");
    expect(labelSize("Arte")).toBe(15);
    expect(labelSize("Programação")).toBeLessThan(labelSize("Arte"));
    expect(labelSize("Uma categoria com um nome muito comprido")).toBeGreaterThanOrEqual(9);
  });
});
