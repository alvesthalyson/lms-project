/** All user-facing text of the Library experience, in one place so it can be translated later. */
export const copy = {
  name: "Library",
  entrance: {
    tagline: "Toque na luz para entrar",
    hint: "✦ Um mundo inteiro cabe entre dois livros ✦",
    enterLabel: "Entrar na Library",
    switchLabel: "Acender a luz e entrar na Library",
  },
  hall: {
    subtitle: "Escolha uma estante para ver seus livros",
    hint: "✦ Passe o cursor sobre uma estante e toque para abri-la ✦",
    counterLink: "Modo balcão",
    loading: "Acendendo as lanternas…",
    error: "Não foi possível abrir o salão agora.",
    retry: "Tentar de novo",
    empty: "Ainda não há estantes nesta biblioteca.",
    shelfKicker: (n: number) => `Estante ${toRoman(n)}`,
    bookCount: (n: number) => (n === 1 ? "1 livro" : `${n} livros`),
    open: "ABRIR →",
  },
  shelf: {
    back: "← Voltar ao salão",
    loading: "Procurando na estante…",
    error: "Não foi possível carregar esta estante.",
    empty: "Esta estante está vazia por enquanto.",
    pickABook: "Escolha um livro para ver os detalhes.",
    partial: (shown: number, total: number) => `Mostrando ${shown} de ${total} livros.`,
    seeAll: "Ver todos no modo balcão",
    availability: (available: number, total: number) => `${available} DE ${total} DISPONÍVEL`,
    allOut: "TODOS EMPRESTADOS",
    year: "Ano",
    isbn: "ISBN",
    publisher: "Editora",
    reserve: "ENTRAR NA FILA DE RESERVA",
    reserving: "RESERVANDO…",
    reserved: (title: string) => `Você entrou na fila de “${title}”.`,
    signInToReserve: "ENTRE PARA RESERVAR",
    pickUpAtDesk: "Há exemplares na estante. Retire no balcão da biblioteca.",
  },
} as const;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;

/** 1 → "I". Falls back to the plain number past XII. */
export function toRoman(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}
