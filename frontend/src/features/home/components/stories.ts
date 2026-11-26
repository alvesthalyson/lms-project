import type { Lang } from "@/lib/i18n/dictionaries";

/**
 * The tale told in the firefly forest: one for each language of the site, written the way a storyteller would say it
 * aloud (short paragraphs, a greeting, a little pause before the ending). Each one is tied to a category of the library
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
    id: "lua",
    category: "poesia",
    title: "A lua e o carvalho",
    paragraphs: [
      "Chegue mais perto, viajante, e sente-se um pouquinho. A noite é longa, e eu tenho uma história para você.",
      "Dizem que, bem no meio desta floresta, vive um carvalho muito velho. Tão velho que ninguém se lembra de quando ele era pequeno.",
      "Numa noite de lua cheia, a lua desceu até o alto dos seus galhos e perguntou: “Velho carvalho, como é que você nunca se cansa de esperar?”",
      "O carvalho riu, bem baixinho, e as folhas todas balançaram. “Eu não espero, minha amiga. Eu escuto o vento.”",
      "Porque o vento, sabe, passa a noite inteira contando histórias. Cada folha guarda uma delas, e quando amanhece, a floresta toda vira um poema sussurrado.",
      "E foi assim que a lua descobriu que esperar, às vezes, é só uma maneira bonita de ouvir.",
      "Agora fique quietinho… Está ouvindo? Ainda falta um verso nesta história. E ele é seu.",
    ],
  },
  en: {
    id: "lantern",
    category: "fantasia",
    title: "The firefly lantern",
    paragraphs: [
      "Come closer, traveller, and sit awhile. The night is long, and I have a story for you.",
      "They say every firefly in this forest was once a word. Small, shy words that slipped out of their books on a new-moon night, tired of waiting for someone to read them.",
      "At first, they were lost. They bumped into trees, they flickered, they whispered the first half of a sentence and forgot the second.",
      "Then, one evening, a little girl came walking through the woods with a lantern, and she was afraid of the dark.",
      "But the fireflies gathered around her, one by one, until her lantern shone brighter than the moon. And all the way home they spelled out the words she needed: be brave, keep walking, you are not alone.",
      "And do you know? She never stopped being brave. And the words never stopped following those who read.",
      "Now look closely… One of them has just landed on your hand. It is waiting for you to choose the ending.",
    ],
  },
  ja: {
    id: "michi",
    category: "aventura",
    title: "誰も記さなかった道",
    paragraphs: [
      "さあ、もっと近くへ。少しだけ座って、ゆっくり聞いてくださいね。今夜は、とっておきのお話をしましょう。",
      "むかしむかし、この森には、どんな地図にも載っていない道がありました。",
      "その道は、好奇心をひとにぎり持った人にだけ、そっと姿を見せるのです。",
      "ある晩、小さな男の子が、ひとりで森に迷い込みました。こわくて、足がふるえていました。",
      "すると、木々のあいだで蛍がひとつ、ふわりと光りました。もうひとつ。またひとつ。蛍は、男の子の少し先に、光の道を描いてくれたのです。",
      "男の子は、一歩、また一歩と歩きました。曲がり角のたびに新しい問いがあり、その問いの先には、いつも本が待っていました。",
      "光は、遠くへは導きません。いつだって、次の章へ連れていってくれるのです。……ほら、あなたの前にも、ひとつ灯りましたよ。",
    ],
  },
};

/** The story told in the reader's language. */
export function storyFor(lang: Lang): Story {
  return STORIES[lang];
}
