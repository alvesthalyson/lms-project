import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/books/types";
import { usePrefs } from "@/lib/i18n/store";

import { ForestWindow } from "./ForestWindow";
import { POSTER, VIDEO, VIDEO_SECONDS } from "./forestScene";
import { STORIES } from "./stories";

const POETRY: Category = { id: 1, name: "Poesia", slug: "poesia" };
const FANTASY: Category = { id: 2, name: "Fantasia", slug: "fantasia" };

function show(categories: Category[], props: Partial<{ onOpenCategory: (c: Category) => void; onClose: () => void }> = {}) {
  const onOpenCategory = props.onOpenCategory ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  const view = render(<ForestWindow categories={categories} onOpenCategory={onOpenCategory} onClose={onClose} />);
  return { ...view, onOpenCategory, onClose };
}

afterEach(() => {
  vi.useRealTimers();
  usePrefs.setState({ lang: "pt", sound: false });
  vi.unstubAllGlobals();
});

describe("ForestWindow", () => {
  it("is a dialog that holds the forest picture, with the film of the journey over it", () => {
    const { container } = show([POETRY]);
    expect(screen.getByRole("dialog", { name: "A floresta dos vaga-lumes" })).toBeInTheDocument();
    expect((container.querySelector(".fw-forest-img") as HTMLElement).style.backgroundImage).toContain("/floresta-vagalumes.jpg");
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe(VIDEO);
    expect(video.getAttribute("poster")).toBe(POSTER);
    expect(video.muted).toBe(true);
    expect(video.hasAttribute("autoplay")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    // the film is above the forest, so that it can fade out into it
    const order = [...container.querySelector(".fw-backdrop")!.children].map((el) => el.className);
    expect(order.indexOf("fw-video")).toBeGreaterThan(order.indexOf("fw-forest"));
  });

  it("goes live when the film ends, when it fails to play, and after a while if it stalls", () => {
    vi.useFakeTimers();
    const first = show([POETRY]);
    const backdrop = () => first.container.querySelector(".fw-backdrop")!;
    expect(backdrop().classList.contains("fw--live")).toBe(false);
    fireEvent.ended(first.container.querySelector("video")!);
    expect(backdrop().classList.contains("fw--live")).toBe(true);
    first.unmount();

    const second = show([POETRY]);
    fireEvent.error(second.container.querySelector("video")!);
    expect(second.container.querySelector(".fw-backdrop")!.classList.contains("fw--live")).toBe(true);
    second.unmount();

    const third = show([POETRY]);
    expect(third.container.querySelector(".fw-backdrop")!.classList.contains("fw--live")).toBe(false);
    act(() => void vi.advanceTimersByTime((VIDEO_SECONDS + 3) * 1000 + 50));
    expect(third.container.querySelector(".fw-backdrop")!.classList.contains("fw--live")).toBe(true);
  });

  it("skips the film for whoever asks for less motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(), onchange: null }));
    const { container } = show([POETRY]);
    expect(container.querySelector(".fw-backdrop")!.classList.contains("fw--live")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("plays the film's own sound only when the reader has sound on", () => {
    const off = show([POETRY]);
    expect(off.container.querySelector("video")!.muted).toBe(true);
    off.unmount();
    usePrefs.setState({ sound: true });
    const on = show([POETRY]);
    expect(on.container.querySelector("video")!.muted).toBe(false);
  });

  it("has its own sound switch, since the Home's is hidden behind the window", async () => {
    const { container } = show([POETRY]);
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /Ligar o som e a narração/ }));
    expect(usePrefs.getState().sound).toBe(true);
    expect(video.muted).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /Desligar o som/ }));
    expect(usePrefs.getState().sound).toBe(false);
    expect(video.muted).toBe(true);
  });

  it("offers a button to skip the film, which goes live at once and then goes away", async () => {
    const { container } = show([POETRY]);
    const video = container.querySelector("video")!;
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
    expect(container.querySelector(".fw--live")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Pular animação" }));
    expect(pause).toHaveBeenCalled();
    expect(container.querySelector(".fw--live")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Pular animação" })).toBeNull();
  });

  it("has no skip button when the film is skipped by reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }));
    show([POETRY]);
    vi.unstubAllGlobals();
    expect(screen.queryByRole("button", { name: "Pular animação" })).toBeNull();
  });

  it("tells the story of the language, its paragraphs in order, under its title", () => {
    const { container } = show([POETRY]);
    expect(screen.getByRole("heading", { name: STORIES.pt.title })).toBeInTheDocument();
    expect([...container.querySelectorAll(".fw-scroll .fw-line")].map((p) => p.textContent)).toEqual([...STORIES.pt.paragraphs]);
  });

  it("tells a different story in English and in Japanese", () => {
    for (const lang of ["en", "ja"] as const) {
      usePrefs.setState({ lang });
      const { container, unmount } = show([POETRY]);
      expect(screen.getByRole("heading", { name: STORIES[lang].title })).toBeInTheDocument();
      expect(container.querySelector(".fw-line")?.textContent).toBe(STORIES[lang].paragraphs[0]);
      unmount();
    }
  });

  it("makes the text rise for as long as the narrator needs, and the ending comes after it", () => {
    const { container } = show([POETRY]);
    const lines = container.querySelector(".fw-lines") as HTMLElement;
    const end = container.querySelector(".fw-end") as HTMLElement;
    const seconds = parseFloat(lines.style.getPropertyValue("--ls"));
    expect(seconds).toBeGreaterThan(20);
    expect(parseFloat(end.style.getPropertyValue("--d"))).toBeGreaterThan(parseFloat(lines.style.getPropertyValue("--d")) + seconds);
  });

  it("narrates the story aloud, in the language, once the forest is live and only with sound on", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    class Utterance {
      lang = "";
      rate = 1;
      pitch = 1;
      voice: unknown = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("speechSynthesis", { speak, cancel, getVoices: () => [{ name: "Voz", lang: "pt-BR" }], addEventListener: vi.fn(), removeEventListener: vi.fn() });

    const quiet = show([POETRY]);
    fireEvent.ended(quiet.container.querySelector("video")!);
    expect(speak).not.toHaveBeenCalled();
    quiet.unmount();

    usePrefs.setState({ sound: true });
    const loud = show([POETRY]);
    expect(speak).not.toHaveBeenCalled(); // the film is still playing
    fireEvent.ended(loud.container.querySelector("video")!);
    expect(speak).toHaveBeenCalledTimes(STORIES.pt.paragraphs.length);
    expect((speak.mock.calls[0]![0] as Utterance).text).toBe(STORIES.pt.paragraphs[0]);
    expect((speak.mock.calls[0]![0] as Utterance).lang).toBe("pt-BR");
    cancel.mockClear();
    loud.unmount();
    expect(cancel).toHaveBeenCalled(); // closing the window silences the narrator
  });

  it("does not break in a browser without speech", () => {
    usePrefs.setState({ sound: true });
    const { container } = show([POETRY]);
    expect(() => fireEvent.ended(container.querySelector("video")!)).not.toThrow();
  });

  it("ends by offering the shelf of the story's category, and opens it", async () => {
    const cat: Category = { id: 9, name: "Outra", slug: STORIES.pt.category };
    const { onOpenCategory } = show([POETRY, FANTASY, cat]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Continuar a história: estante Outra" }));
    expect(onOpenCategory).toHaveBeenCalledWith(cat);
  });

  it("falls back to another shelf when the library has no shelf for the story's category", async () => {
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

  it("fills the forest with fireflies", () => {
    const { container } = show([POETRY]);
    expect(container.querySelectorAll(".fw-fly").length).toBeGreaterThanOrEqual(15);
  });
});
