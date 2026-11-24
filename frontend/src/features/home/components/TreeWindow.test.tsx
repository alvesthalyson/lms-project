import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/books/types";

import { TreeWindow } from "./TreeWindow";
import { H, MAX_LABELLED, W, beamPolygon, insideArch, landingTimes, layout, point } from "./treeGeometry";

function category(id: number, name: string): Category {
  return { id, name, slug: name.toLowerCase() };
}
const CATS = [category(1, "Poesia"), category(2, "Arte"), category(3, "Filosofia")];
const NAMES = ["Poesia", "Arte", "Filosofia", "História", "Ciência", "Ficção", "Programação", "Romance", "Aventura", "Biografia", "Culinária", "Religião", "Mistério", "Fantasia"];

describe("TreeWindow", () => {
  it("has one beam per category, each a button with the category's name", () => {
    render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole("button").filter((b) => !b.classList.contains("hm-close"))).toHaveLength(3);
    for (const name of ["Poesia", "Arte", "Filosofia"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("writes every name letter by letter down its beam", () => {
    const { container } = render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    const beams = [...container.querySelectorAll(".bm")];
    expect(beams).toHaveLength(3);
    const words = beams.map((beam) => [...beam.querySelectorAll(".bm-glyph")].map((g) => g.textContent).join(""));
    expect(words).toEqual(["Poesia", "Arte", "Filosofia"]);
  });

  it("shows the oak picture", () => {
    const { container } = render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelector("image")?.getAttribute("href")).toBe("/arvore-carvalho.jpg");
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
    await user.keyboard(" ");
    expect(onPick).toHaveBeenCalledTimes(3);
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

  it("says so, and offers no beams to pick, when there are no categories", () => {
    render(<TreeWindow categories={[]} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Ainda não há categorias no acervo.")).toBeInTheDocument();
    expect(document.querySelectorAll(".bm")).toHaveLength(0);
  });

  it("draws at most MAX_LABELLED beams", () => {
    const many = NAMES.map((name, i) => category(i + 1, name));
    const { container } = render(<TreeWindow categories={many} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelectorAll(".bm")).toHaveLength(MAX_LABELLED);
  });

  it("brings the scene to life: flickering lights, fireflies and falling leaves", () => {
    const { container } = render(<TreeWindow categories={CATS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelectorAll(".bm-flicker").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".bm-fly").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".bm-fall").length).toBeGreaterThanOrEqual(3);
  });
});

describe("beam geometry", () => {
  it("is the same every time, with unique keys", () => {
    const a = layout(NAMES.slice(0, 8));
    expect(layout(NAMES.slice(0, 8))).toEqual(a);
    expect(new Set(a.map((b) => b.key)).size).toBe(a.length);
  });

  it("has no beams for no names, and caps the number of beams", () => {
    expect(layout([])).toEqual([]);
    expect(layout(NAMES)).toHaveLength(MAX_LABELLED);
  });

  it("lays the beams out from left to right, in the order of the names", () => {
    const beams = layout(NAMES.slice(0, 8));
    expect(beams.map((b) => b.name)).toEqual(NAMES.slice(0, 8));
    const xs = beams.map((b) => point(b, 600 - b.y0).x); // where each one crosses the same row
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
  });

  it("makes the letters grow down the beam, and the beam widen with them", () => {
    for (const beam of layout(["Filosofia", "Arte"])) {
      const sizes = beam.glyphs.map((g) => g.size);
      for (let i = 1; i < sizes.length; i += 1) expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!);
      expect(sizes[0]!).toBeLessThan(sizes[sizes.length - 1]! / 2);
      expect(beam.halfBottom).toBeGreaterThan(beam.halfTop);
      const dists = beam.glyphs.map((g) => g.dist);
      for (let i = 1; i < dists.length; i += 1) expect(dists[i]!).toBeGreaterThan(dists[i - 1]!);
      expect(beam.length).toBeGreaterThanOrEqual(620);
    }
  });

  it.each([1, 2, 3, 5, 8, 12])("keeps every letter inside the picture's arch, for %i names", (n) => {
    for (const beam of layout(NAMES.slice(0, n))) {
      for (const glyph of beam.glyphs) {
        const p = point(beam, glyph.dist);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(W);
        expect(p.y).toBeLessThan(H);
        expect(insideArch(p.x, p.y, glyph.size * 0.5)).toBe(true);
      }
    }
  });

  it.each([2, 5, 8, 12])("never lets the letters of different beams overlap, for %i names", (n) => {
    const discs = layout(NAMES.slice(0, n)).flatMap((beam) =>
      beam.glyphs.map((g) => ({ index: beam.index, ...point(beam, g.dist), r: g.size * 0.45 })),
    );
    for (let i = 0; i < discs.length; i += 1) {
      for (let j = i + 1; j < discs.length; j += 1) {
        const a = discs[i]!;
        const b = discs[j]!;
        if (a.index !== b.index) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  it("opens the beams one after another and writes the letters in order", () => {
    const beams = layout(NAMES.slice(0, 5));
    for (let i = 1; i < beams.length; i += 1) expect(beams[i]!.delay).toBeGreaterThan(beams[i - 1]!.delay);
    for (const beam of beams) {
      expect(beam.glyphs[0]!.delay).toBeGreaterThan(beam.delay);
      for (let i = 1; i < beam.glyphs.length; i += 1) expect(beam.glyphs[i]!.delay).toBeGreaterThan(beam.glyphs[i - 1]!.delay);
    }
  });

  it("gives one time per beam, when its name is complete, for the sound", () => {
    const beams = layout(NAMES.slice(0, 8));
    const times = landingTimes(NAMES.slice(0, 8));
    expect(times).toHaveLength(8);
    times.forEach((time, i) => expect(time).toBeGreaterThan(beams[i]!.glyphs[beams[i]!.glyphs.length - 1]!.delay));
    expect(landingTimes([])).toEqual([]);
  });

  it("draws the beam as a trapezoid, wider at the bottom, and a click area a little wider still", () => {
    const [beam] = layout(["Arte"]);
    const parse = (s: string) => s.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
    const [tl, tr, br, bl] = parse(beamPolygon(beam!));
    expect(tr![0] - tl![0]).toBeLessThan(br![0] - bl![0]);
    const [wtl] = parse(beamPolygon(beam!, 14));
    expect(wtl![0]).toBeLessThan(tl![0]);
  });
});
