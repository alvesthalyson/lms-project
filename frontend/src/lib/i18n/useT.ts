import { usePrefs, translate, type Vars } from "./store";
import { bookTitle } from "./bookTitles";
import { DICTIONARIES, type Key, type Lang } from "./dictionaries";

/** `const { t } = useT(); t("shelf.empty")`. Re-renders when the language changes. */
export function useT(): { t: (key: Key, vars?: Vars) => string; lang: Lang; catName: (category: { name: string; slug: string }) => string; bookName: (book: { title: string }) => string } {
  const lang = usePrefs((s) => s.lang);
  return {
    t: (key, vars) => translate(lang, key, vars),
    lang,
    // Categories live in the database in Portuguese; known ones (by slug) are shown in the reader's language.
    catName: (category) => {
      const key = `cat.${category.slug}`;
      return key in DICTIONARIES[lang] ? translate(lang, key as Key) : category.name;
    },
    // Likewise the titles: the catalogue keeps one, and the reader sees the book's name in their language when it is known.
    bookName: (book) => bookTitle(book.title, lang),
  };
}
