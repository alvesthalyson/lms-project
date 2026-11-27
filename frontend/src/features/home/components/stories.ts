import type { Lang } from "@/lib/i18n/dictionaries";

/**
 * The tale told in the firefly forest: one for each language of the site, a traditional tale of the country where it is
 * spoken (Brazil, the United States, Japan), retold the way a storyteller would say it aloud (short paragraphs, a greeting,
 * a little pause before the ending). Each one is tied to a category of the library
 * (by slug), so that its ending can lead the reader to that shelf.
 */
export interface Story {
  id: string;
  /** Slug of the category whose shelf continues the story. */
  category: string;
  title: string;
  /** One paragraph per breath of the narrator. */
  paragraphs: readonly string[];
}

export const STORIES: Record<Lang, Story> = {
  pt: {
    id: "vitoria-regia",
    category: "poesia",
    title: "A lenda da vitória-régia",
    paragraphs: [
      "Chegue mais perto, viajante, e sente-se um pouquinho. Hoje eu vou contar uma lenda muito antiga, que os povos da floresta contam desde antes de existirem livros.",
      "Dizem que a lua, a quem os indígenas chamavam de Jaci, passeava pelo céu escolhendo moças para levar com ela e transformá-las em estrelas.",
      "Numa aldeia à beira de um grande rio vivia uma jovem chamada Naiá. Noite após noite, ela olhava para o céu e sonhava em ser uma estrela, ao lado da lua.",
      "Certa noite, Naiá viu a lua refletida nas águas calmas do lago. Pensou que ela havia descido para buscá-la. Estendeu os braços, correu para a água… e o lago a abraçou para sempre.",
      "A lua, comovida, não quis deixá-la perdida no fundo do rio. Então a transformou numa estrela diferente de todas as outras: uma estrela das águas.",
      "É por isso que, até hoje, a vitória-régia abre as suas grandes flores brancas ao cair da noite, e fica rosada ao amanhecer, flutuando sobre o lago como uma estrela que aprendeu a nadar.",
      "Agora fique quietinho… Se olhar bem para a água, talvez veja uma delas. As estrelas também escrevem versos, sabe? E ainda falta um nesta história: o seu.",
    ],
  },
  en: {
    id: "appleseed",
    category: "fantasia",
    title: "Johnny Appleseed",
    paragraphs: [
      "Come closer, traveller, and sit awhile. Tonight I will tell you an old American tale, the kind folks tell around a fire.",
      "Long ago, when the land was mostly forest and the roads were mostly dreams, there walked a man called Johnny Appleseed.",
      "He wore a tin pot for a hat, no shoes on his feet, and he carried a sack full of apple seeds. Nothing else.",
      "Wherever he went, he stopped, dug a little hole, and planted a seed. People asked him, “Why plant a tree you will never sit under?” And Johnny just smiled. “Someone will,” he said. “Someone always does.”",
      "The years went by. The wanderer grew old, and the trees grew tall. Every spring the hills filled up with white blossoms, and every autumn, tired travellers found ripe apples along their way.",
      "Fruit from a stranger who had never met them, and who never asked for anything in return.",
      "That is the secret of the tale: the kindest things we do are seeds. Now look closely… There is one in your hand tonight. What will you plant?",
    ],
  },
  ja: {
    id: "momotaro",
    category: "aventura",
    title: "桃太郎",
    paragraphs: [
      "さあ、もっと近くへ。少しだけ座って、ゆっくり聞いてくださいね。今夜は、日本のとても古いお話をしましょう。",
      "むかしむかし、あるところに、おじいさんとおばあさんが住んでいました。おじいさんは山へしばかりに、おばあさんは川へせんたくに行きました。",
      "おばあさんが川で洗濯をしていると、どんぶらこ、どんぶらこと、大きな桃が流れてきました。家に持ち帰って割ってみると、中から元気な男の子が飛び出しました。桃太郎です。",
      "桃太郎はすくすくと育ち、やがて、村を困らせる鬼を退治しに行くと決めました。おばあさんは、きびだんごをこしらえて持たせてくれました。",
      "道のとちゅうで、犬と、猿と、きじに出会いました。みんな、きびだんごをひとつ分けてほしいと言います。桃太郎が分けてあげると、三匹は喜んで、仲間になりました。",
      "四人は力を合わせて鬼ヶ島へ渡り、見事に鬼たちを降参させました。そして宝物をかついで、みんなで村へ帰りました。",
      "分け合う心が、いちばん強い味方になる。……それが、このお話が昔から伝えてきたことです。さあ、あなたの旅は、どこから始まりますか。",
    ],
  },
};

/** The story told in the reader's language. */
export function storyFor(lang: Lang): Story {
  return STORIES[lang];
}
