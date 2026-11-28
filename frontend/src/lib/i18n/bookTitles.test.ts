import { describe, expect, it } from "vitest";

import { bookTitle, titleKey } from "./bookTitles";

describe("bookTitle", () => {
  it("shows a book in the language of the reader, whichever language it was catalogued in", () => {
    expect(bookTitle("Dom Quixote", "en")).toBe("Don Quixote");
    expect(bookTitle("Dom Quixote", "ja")).toBe("ドン・キホーテ");
    expect(bookTitle("Dom Quixote", "pt")).toBe("Dom Quixote");
    expect(bookTitle("Norwegian Wood", "ja")).toBe("ノルウェイの森");
    expect(bookTitle("Kafka on the Shore", "pt")).toBe("Kafka à Beira-Mar");
    expect(bookTitle("The Tale of Genji", "en")).toBe("The Tale of Genji");
    expect(bookTitle("源氏物語", "en")).toBe("The Tale of Genji"); // a Japanese catalogue entry finds its entry too
  });

  it("recognises the title through case, accents, punctuation and a note from the edition", () => {
    expect(titleKey("Pedro Páramo")).toBe(titleKey("pedro paramo"));
    expect(bookTitle("CÓDIGO LIMPO", "en")).toBe("Clean Code");
    expect(bookTitle("Kokoro (Tuttle Classics)", "ja")).toBe("こころ");
    expect(bookTitle("Cosmos: A Personal Voyage", "pt")).toBe("Cosmos");
    expect(bookTitle("Sherlock Holmes: Um Estudo em Vermelho", "en")).toBe("Sherlock Holmes: A Study in Scarlet"); // the whole title wins over its head
  });

  it("leaves alone a book it does not know, and a language it has no name for", () => {
    expect(bookTitle("Um Livro Qualquer", "en")).toBe("Um Livro Qualquer");
    expect(bookTitle("Altan Tobchi", "pt")).toBe("Altan Tobchi"); // no Portuguese name: the catalogued one stays
    expect(bookTitle("", "ja")).toBe("");
  });
});
