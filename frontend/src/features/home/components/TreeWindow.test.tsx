import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/books/types";

import { TreeWindow } from "./TreeWindow";
import { MAX_LABELLED, labelSize, landingTimes, layout, leafPath, tilePath } from "./treeGeometry";

function category(id: number, name: string): Category {
  return { id, name, slug: name.toLowerCase() };
}
const CATS = [category(1, "Poesia"), category(2, "Arte"), category(3, "Filosofia")];
const NAMES = ["Poesia", "Arte", "Filosofia", "História", "Ciência", "Ficção", "Programação", "Romance", "Aventura", "Biografia", "Culinária", "Religião", "Mistério", "Fantasia", "Economia", "Direito", "Medicina", "Música", "Esportes", "Viagens", "Infantil", "Poemas", "Teatro", "Humor"];

describe("TreeWindow", () => {
  it("has one tile per category, each a button with the category's name", () => {
    render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole("button").filter((b) => !b.classList.contains("hm-close"))).toHaveLength(3);
    for (const name of ["Poesia", "Arte", "Filosofia"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("writes each name flat across its tile, so that it can be read", () => {
    const { container } = render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    const labels = [...container.querySelectorAll(".tw-label")];
    expect(labels.map((l) => l.textContent)).toEqual(["Poesia", "Arte", "Filosofia"]);
    for (const label of labels) expect(label.getAttribute("transform")).toBeNull(); // never turned or tilted
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

  it("says so, and offers no tiles to pick, when there are no categories", () => {
    render(<TreeWindow categories={[]} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Ainda não há categorias no acervo.")).toBeInTheDocument();
    expect(document.querySelectorAll(".tw-tile")).toHaveLength(0);
  });

  it("draws the tree: solid limbs revealed from the base, thin twigs, a crown of glass cells, and the tiles on top", () => {
    const { container } = render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelectorAll("mask .tw-reveal").length).toBeGreaterThanOrEqual(15); // trunk, limbs, branches, roots
    expect(container.querySelectorAll(".tw-edge").length).toBeGreaterThanOrEqual(30); // two gold edges on each
    expect(container.querySelectorAll(".tw-wood.tw-grow").length).toBeGreaterThan(30); // the twigs
    expect(container.querySelectorAll(".tw-leaf").length).toBeGreaterThan(60);
    expect(container.querySelectorAll(".tw-tile")).toHaveLength(3);
  });
});

describe("tree geometry", () => {
  it("is the same tree every time, with unique keys", () => {
    const a = layout(NAMES.slice(0, 8));
    expect(layout(NAMES.slice(0, 8))).toEqual(a);
    for (const list of [a.branches, a.leaves, a.tiles]) expect(new Set(list.map((x) => x.key)).size).toBe(list.length);
  });

  it("places one tile per category, in reading order: top to bottom, then left to right", () => {
    const { tiles } = layout(NAMES.slice(0, 8));
    expect(tiles.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const rows = tiles.map((t) => Math.round(t.y / 36));
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
  });

  it("never lets two names overlap (up to eight of them) and always keeps them inside the round window", () => {
    for (const n of [1, 3, 8]) {
      const { tiles } = layout(NAMES.slice(0, n));
      for (let i = 0; i < tiles.length; i++)
        for (let j = i + 1; j < tiles.length; j++) {
          const a = tiles[i]!;
          const b = tiles[j]!;
          const apartX = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
          const apartY = Math.abs(a.y - b.y) - (a.h + b.h) / 2;
          expect(apartX >= 0 || apartY >= 0).toBe(true);
        }
    }
    for (const n of [0, 3, 8, 14, 20, 40]) {
      for (const t of layout(NAMES.slice(0, n)).tiles) expect(Math.hypot(Math.abs(t.x) + t.w / 2, Math.abs(t.y) + t.h / 2)).toBeLessThanOrEqual(172);
    }
  });

  it("makes the tile as wide as its name needs, and the writing smaller when there are many names", () => {
    const { tiles } = layout(["Arte", "Programação"]);
    expect(tiles[1]!.w).toBeGreaterThan(tiles[0]!.w);
    expect(labelSize(8)).toBe(12);
    expect(labelSize(14)).toBe(11);
    expect(labelSize(20)).toBe(10);
  });

  it("grows from the trunk outwards: trunk, limbs, branches and twigs start in that order, then the roots exist", () => {
    const { branches } = layout(NAMES.slice(0, 8));
    const first = (depth: number) => Math.min(...branches.filter((b) => b.depth === depth).map((b) => b.delay));
    for (let depth = 0; depth < 4; depth++) expect(first(depth)).toBeLessThan(first(depth + 1));
    expect(branches.filter((b) => b.depth === 5)).toHaveLength(6);
    expect(branches.filter((b) => b.shape).every((b) => /^M .* Z$/.test(b.shape!.fill) && !b.shape!.fill.includes("NaN"))).toBe(true);
  });

  it("tapers the trunk, wide at the root and narrower where it forks", () => {
    const trunk = layout([]).branches.find((b) => b.depth === 0)!;
    expect(trunk.shape).toBeDefined();
    expect(trunk.width).toBeGreaterThan(36);
    expect(layout([]).tiles).toHaveLength(0);
  });

  it("caps the named tiles at the number that fits, and gives each a landing time after the branches have grown", () => {
    expect(layout(NAMES).tiles).toHaveLength(MAX_LABELLED);
    const times = landingTimes(NAMES.slice(0, 8));
    expect(times).toHaveLength(8);
    expect(Math.min(...times)).toBeGreaterThan(2.5);
    expect(Math.max(...times)).toBeLessThan(7);
  });

  it("draws closed shapes", () => {
    for (const d of [leafPath(10, 30), tilePath(80, 28)]) {
      expect(d).toMatch(/^M .* Z$/);
      expect(d).not.toContain("NaN");
    }
  });
});
