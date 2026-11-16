import { beforeEach, describe, expect, it } from "vitest";

import { DICTIONARIES, LANGUAGES } from "./dictionaries";
import { initialLang, translate, tr, usePrefs } from "./store";

/** Node 25+ ships its own `localStorage`, which clashes with jsdom's: use a plain in-memory one. */
function installMemoryStorage(): void {
  const data = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, String(value)),
      removeItem: (key: string) => void data.delete(key),
      clear: () => data.clear(),
    },
  });
}

beforeEach(() => {
  installMemoryStorage();
  usePrefs.setState({ lang: "pt", theme: "dark" });
});

describe("dictionaries", () => {
  it("define every key in every language, with the same placeholders", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const lang of LANGUAGES) {
      expect(Object.keys(DICTIONARIES[lang]).sort()).toEqual(Object.keys(DICTIONARIES.pt).sort());
      for (const [key, text] of Object.entries(DICTIONARIES[lang])) {
        expect(text, `${lang}:${key}`).not.toBe("");
        expect(placeholders(text), `${lang}:${key}`).toBe(placeholders((DICTIONARIES.pt as Record<string, string>)[key]!));
      }
    }
  });
});

describe("translate", () => {
  it("fills placeholders and leaves unknown ones alone", () => {
    expect(translate("en", "account.hello", { name: "Ana" })).toBe("Hello, Ana");
    expect(translate("ja", "shelf.countMany", { n: 3 })).toBe("3冊");
    expect(translate("pt", "account.hello")).toBe("Olá, {name}");
  });
});

describe("preferences", () => {
  it("default to Portuguese and the dark theme", () => {
    expect(initialLang()).toBe("pt");
    expect(usePrefs.getState().theme).toBe("dark");
  });

  it("remember the language and apply it to the page", () => {
    usePrefs.getState().setLang("ja");
    expect(initialLang()).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
    expect(tr("account.signOut")).toBe("ログアウト");
  });

  it("switch theme on <html>", () => {
    usePrefs.getState().setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
