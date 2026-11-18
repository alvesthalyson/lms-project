import { usePrefs, translate, type Vars } from "./store";
import { DICTIONARIES, type Key, type Lang } from "./dictionaries";

/** `const { t } = useT(); t("shelf.empty")`. Re-renders when the language changes. */
export function useT(): { t: (key: Key, vars?: Vars) => string; lang: Lang; catName: (category: { name: string; slug: string }) => string } {
  const lang = usePrefs((s) => s.lang);
  return {
    t: (key, vars) => translate(lang, key, vars),
    lang,
    // Categories live in the database in Portuguese; known ones (by slug) are shown in the reader's language.
    catName: (category) => {
      const key = `cat.${category.slug}`;
      return key in DICTIONARIES[lang] ? translate(lang, key as Key) : category.name;
    },
  };
}
