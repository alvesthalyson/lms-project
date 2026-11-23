import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/books/types";

import { TreeWindow } from "./TreeWindow";
import { MAX_LABELLED, labelSize, landingTimes, layout, leafPath } from "./treeGeometry";

function category(id: number, name: string): Category {
  return { id, name, slug: name.toLowerCase() };
}
const CATS = [category(1, "Poesia"), category(2, "Arte"), category(3, "Filosofia")];

describe("TreeWindow", () => {
  it("has one leaf per category, each a button with the category's name", () => {
    render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole("button").filter((b) => !b.classList.contains("hm-close"))).toHaveLength(3);
    for (const name of ["Poesia", "Arte", "Filosofia"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("picks a category by click and by keyboard", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<TreeWindow categories={CATS} onPick={onPick} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Arte" }));
    expect(onPick).toHaveBeenLastCalledWith(CATS[1]);
    screen.getByRole("button", { name: "Filosofia" }).focus();
    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenLastCalledWith(CATS[2]);
  });

  it("closes with Esc, the X button and a click outside", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={onClose} />);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar a árvore" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.pointer({ keys: "[MouseLeft]", target: container.querySelector(".hm-backdrop")! });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("says so, and offers no leaves to pick, when there are no categories", () => {
    render(<TreeWindow categories={[]} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Ainda não há categorias no acervo.")).toBeInTheDocument();
    expect(document.querySelectorAll(".tw-hover--pick")).toHaveLength(0);
  });

  it("draws a tree: limbs with gold leading, small glass leaves, and a labelled leaf per category", () => {
    const { container } = render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelectorAll(".tw-wood").length).toBeGreaterThan(30);
    expect(container.querySelectorAll(".tw-gold")).toHaveLength(container.querySelectorAll(".tw-wood").length);
    expect(container.querySelectorAll(".tw-hover").length).toBeGreaterThan(30); // small leaves and the three named ones
    expect(container.querySelectorAll(".tw-hover--pick")).toHaveLength(3);
    expect(container.querySelectorAll(".tw-label")).toHaveLength(3);
  });
});

describe("tree geometry", () => {
  it("lays out one labelled leaf per category, in order left to right, and the same tree every time", () => {
    const a = layout(8);
    expect(layout(8)).toEqual(a);
    const named = a.leaves.filter((l) => l.labelled);
    expect(named.map((l) => l.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const xs = named.map((l) => l.x);
    expect(xs).toEqual([...xs].sort((p, q) => p - q)); // the names run left to right across the crown
    expect(new Set(a.leaves.map((l) => l.key)).size).toBe(a.leaves.length);
    expect(new Set(a.branches.map((b) => b.key)).size).toBe(a.branches.length);
  });

  it("grows from the trunk outwards: trunk, limbs, branches and twigs start in that order", () => {
    const { branches } = layout(8);
    const first = (depth: number) => Math.min(...branches.filter((b) => b.depth === depth).map((b) => b.delay));
    for (let depth = 0; depth < 4; depth++) expect(first(depth)).toBeLessThan(first(depth + 1));
    expect(branches.some((b) => b.depth === 5)).toBe(true); // the roots
  });

  it("keeps the whole tree inside the round window, whatever the number of categories", () => {
    for (const n of [0, 3, 8, 14, 24, 40]) {
      for (const leaf of layout(n).leaves) {
        const tip = { x: leaf.x + Math.sin((leaf.angle * Math.PI) / 180) * leaf.length, y: leaf.y - Math.cos((leaf.angle * Math.PI) / 180) * leaf.length };
        expect(Math.hypot(leaf.x, leaf.y)).toBeLessThan(165);
        expect(Math.hypot(tip.x, tip.y)).toBeLessThan(185);
      }
    }
  });

  it("caps the named leaves, and has none to name when there are no categories", () => {
    expect(layout(0).leaves.some((l) => l.labelled)).toBe(false);
    expect(layout(100).leaves.filter((l) => l.labelled)).toHaveLength(MAX_LABELLED);
  });

  it("gives a landing time per named leaf, all after the branches have grown", () => {
    const times = landingTimes(8);
    expect(times).toHaveLength(8);
    expect(Math.min(...times)).toBeGreaterThan(2.5);
    expect(Math.max(...times)).toBeLessThan(6);
  });

  it("draws a closed leaf that points up, and shrinks long names", () => {
    expect(leafPath(20, 52)).toMatch(/^M .* Z$/);
    expect(leafPath(20, 52)).not.toContain("NaN");
    expect(labelSize("Arte")).toBe(14);
    expect(labelSize("Programação")).toBeLessThan(labelSize("Arte"));
    expect(labelSize("Uma categoria com um nome muito comprido")).toBeGreaterThanOrEqual(9);
  });
});
