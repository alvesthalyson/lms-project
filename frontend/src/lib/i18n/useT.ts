import { usePrefs, translate, type Vars } from "./store";
import type { Key, Lang } from "./dictionaries";

/** `const { t } = useT(); t("shelf.empty")`. Re-renders when the language changes. */
export function useT(): { t: (key: Key, vars?: Vars) => string; lang: Lang } {
  const lang = usePrefs((s) => s.lang);
  return { t: (key, vars) => translate(lang, key, vars), lang };
}
