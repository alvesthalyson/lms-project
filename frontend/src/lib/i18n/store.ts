import { create } from "zustand";

import { restoreSoundEnabled, setSoundEnabled } from "@/lib/sound/engine";

import { DICTIONARIES, LANGUAGES, type Key, type Lang } from "./dictionaries";

export type Theme = "dark" | "light";

const LANG_KEY = "lms.lang";
const THEME_KEY = "lms.theme";
const SOUND_KEY = "lms.sound";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private window, blocked storage
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* the choice just will not survive a reload */
  }
}

/** Portuguese unless the reader picked another language before. */
export function initialLang(): Lang {
  const saved = read(LANG_KEY);
  return LANGUAGES.find((l) => l === saved) ?? "pt";
}

/** Dark (the cinematic look) unless the reader picked light before. */
export function initialTheme(): Theme {
  return read(THEME_KEY) === "light" ? "light" : "dark";
}

/** Silent unless the reader turned sound on before. */
export function initialSound(): boolean {
  return read(SOUND_KEY) === "on";
}

function applyToDocument(lang: Lang, theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang === "pt" ? "pt-BR" : lang;
  document.documentElement.dataset.theme = theme;
}

interface PrefsState {
  lang: Lang;
  theme: Theme;
  sound: boolean;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  setSound: (on: boolean) => void;
}

export const usePrefs = create<PrefsState>()((set, get) => ({
  lang: initialLang(),
  theme: initialTheme(),
  sound: initialSound(),
  setLang: (lang) => {
    write(LANG_KEY, lang);
    set({ lang });
    applyToDocument(lang, get().theme);
  },
  setTheme: (theme) => {
    write(THEME_KEY, theme);
    set({ theme });
    applyToDocument(get().lang, theme);
  },
  setSound: (on) => {
    write(SOUND_KEY, on ? "on" : "off");
    set({ sound: on });
    setSoundEnabled(on); // called from the click, which is what lets the browser start audio
  },
}));

// A reader who left sound on gets it back; the browser wakes the audio on their first click.
if (initialSound()) restoreSoundEnabled();

export type Vars = Record<string, string | number>;

/** Look a key up in the language, filling `{name}` placeholders. Falls back to Portuguese. */
export function translate(lang: Lang, key: Key, vars?: Vars): string {
  const text = DICTIONARIES[lang][key] ?? DICTIONARIES.pt[key];
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}

/** For code outside React (toasts). */
export function tr(key: Key, vars?: Vars): string {
  return translate(usePrefs.getState().lang, key, vars);
}

export function syncDocumentWithPrefs(): void {
  const { lang, theme } = usePrefs.getState();
  applyToDocument(lang, theme);
}
