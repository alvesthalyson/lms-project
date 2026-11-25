import type { Lang } from "@/lib/i18n/dictionaries";

/**
 * The tales told in the window's firefly forest, one line at a time. Each one is tied to a category of the library
 * (by slug), so that its ending can lead the reader to that shelf.
 */
export interface Tale {
  id: string;
  /** Slug of the category whose shelf continues the story. */
  category: string;
  title: Record<Lang, string>;
  lines: Record<Lang, readonly string[]>;
}

export const TALES: readonly Tale[] = [
  {
    id: "lanterna",
    category: "fantasia",
    title: { pt: "A lanterna dos vaga-lumes", en: "The firefly lantern", ja: "蛍のランタン" },
    lines: {
      pt: [
        "Dizem que cada vaga-lume já foi uma palavra.",
        "Palavras que fugiram dos livros numa noite de lua nova, cansadas de esperar que alguém as lesse.",
        "Desde então elas vivem entre as árvores, acendendo e apagando, tentando formar frases.",
        "Quem fica quieto o bastante consegue ouvi-las sussurrar o começo de mil histórias.",
        "Esta noite, uma delas pousou na sua mão — e espera você escolher o final.",
      ],
      en: [
        "They say every firefly was once a word.",
        "Words that slipped out of their books on a new-moon night, tired of waiting for someone to read them.",
        "Ever since, they have lived among the trees, flickering on and off, trying to form sentences.",
        "Whoever stays quiet enough can hear them whisper the beginnings of a thousand stories.",
        "Tonight, one of them landed in your hand — and it is waiting for you to choose the ending.",
      ],
      ja: [
        "蛍はみんな、もとは言葉だったと言われています。",
        "新月の夜、誰かに読まれるのを待ちくたびれて、本から抜け出した言葉たちです。",
        "それからは木々のあいだで、ついたり消えたりしながら、文をつくろうとしています。",
        "じっと静かにしていれば、千の物語の書き出しをささやく声が聞こえます。",
        "今夜、そのひとつがあなたの手に止まりました。結末を選ぶのを待っています。",
      ],
    },
  },
  {
    id: "caminho",
    category: "aventura",
    title: { pt: "O caminho que ninguém marcou", en: "The path no one marked", ja: "誰も記さなかった道" },
    lines: {
      pt: [
        "Há um caminho na floresta que não aparece em nenhum mapa.",
        "Ele só existe para quem chega com a mão cheia de curiosidade.",
        "Os vaga-lumes o desenham passo a passo, sempre um pouco à frente de você.",
        "Cada curva guarda uma pergunta, e cada pergunta guarda uma estante inteira.",
        "Siga a luz: ela nunca leva para longe — apenas para o próximo capítulo.",
      ],
      en: [
        "There is a path in the forest that appears on no map.",
        "It exists only for those who arrive with a handful of curiosity.",
        "The fireflies draw it step by step, always a little ahead of you.",
        "Every bend holds a question, and every question holds a whole shelf.",
        "Follow the light: it never leads far away — only to the next chapter.",
      ],
      ja: [
        "森には、どんな地図にも載っていない道があります。",
        "好奇心をひとにぎり持ってきた人にだけ、その道は現れます。",
        "蛍が一歩ずつ、あなたの少し先に道を描いてくれます。",
        "どの曲がり角にも問いがあり、どの問いにも本棚がひとつ隠れています。",
        "光についていきましょう。遠くへではなく、次の章へ導いてくれます。",
      ],
    },
  },
  {
    id: "lua",
    category: "poesia",
    title: { pt: "A lua e o carvalho", en: "The moon and the oak", ja: "月と樫の木" },
    lines: {
      pt: [
        "A lua perguntou ao velho carvalho por que ele nunca se cansava de esperar.",
        "— Eu não espero, respondeu ele. Eu leio o vento.",
        "Cada folha é um verso que o vento ditou e a noite guardou.",
        "Quando a madrugada chega, a floresta inteira vira um poema em voz baixa.",
        "Escute: ainda falta um verso, e ele é o seu.",
      ],
      en: [
        "The moon asked the old oak why it never tired of waiting.",
        "“I don't wait,” it answered. “I read the wind.”",
        "Every leaf is a verse the wind dictated and the night kept.",
        "When dawn comes, the whole forest turns into a poem spoken softly.",
        "Listen: one verse is still missing, and it is yours.",
      ],
      ja: [
        "月は古い樫の木にたずねました。どうして待つのに飽きないの、と。",
        "「待ってなんかいないよ」と木は答えました。「風を読んでいるんだ」",
        "葉の一枚一枚は、風が語り、夜が預かった詩の一行です。",
        "夜明けが来ると、森じゅうが小さな声の詩になります。",
        "耳をすませて。あと一行だけ足りません。それはあなたの一行です。",
      ],
    },
  },
  {
    id: "nevoa",
    category: "misterio",
    title: { pt: "A pegada na névoa", en: "The footprint in the mist", ja: "霧の中の足あと" },
    lines: {
      pt: [
        "Alguém passou por aqui antes de você: há uma pegada fresca no musgo.",
        "A névoa guarda o resto do segredo, e os vaga-lumes fingem não saber de nada.",
        "Uma luz azul pisca duas vezes entre os troncos, como quem chama.",
        "Todo mistério começa assim: com um detalhe pequeno que não se explica.",
        "Dê mais um passo. A resposta está numa estante, esperando para ser encontrada.",
      ],
      en: [
        "Someone passed here before you: there is a fresh footprint in the moss.",
        "The mist keeps the rest of the secret, and the fireflies pretend to know nothing.",
        "A blue light blinks twice among the trunks, as if calling.",
        "Every mystery begins like this: with a small detail that cannot be explained.",
        "Take one more step. The answer is on a shelf, waiting to be found.",
      ],
      ja: [
        "あなたの前に誰かが通りました。苔に新しい足あとがあります。",
        "霧は秘密の続きを隠し、蛍は知らないふりをしています。",
        "木々のあいだで青い光が二度またたきました。呼んでいるようです。",
        "謎はいつも、説明のつかない小さな手がかりから始まります。",
        "もう一歩進んでみましょう。答えは本棚で見つけられるのを待っています。",
      ],
    },
  },
];

/** Whole days since the epoch, by the reader's own calendar: it changes at their midnight. */
export function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** The tale of the day: the same all day, the next one tomorrow. */
export function taleOfTheDay(date: Date = new Date()): Tale {
  return TALES[dayNumber(date) % TALES.length]!;
}
