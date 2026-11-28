import type { Lang } from "./dictionaries";

/**
 * The names of the library's books in each language. The database keeps one title per book (as it was catalogued: in
 * Portuguese for the demo books, in English for most translated works), so, as with the categories, the reader sees
 * the name in their own language when it is known here. A book that is not in this table (one a librarian added, say)
 * keeps the title it was catalogued with.
 *
 * Every name of an entry also finds the entry, so the book is recognised whichever language it was catalogued in.
 * Names marked "literal" have no established edition in that language.
 */
type Names = Partial<Record<Lang, string>>;

const TITLES: readonly Names[] = [
  // the demo shelves
  { pt: "Código Limpo", en: "Clean Code", ja: "クリーンコード" },
  { pt: "O Programador Pragmático", en: "The Pragmatic Programmer", ja: "達人プログラマー" },
  { pt: "Dom Casmurro", en: "Dom Casmurro", ja: "ドン・カズムーロ" },
  { pt: "Memórias Póstumas de Brás Cubas", en: "The Posthumous Memoirs of Brás Cubas", ja: "ブラス・クーバスの死後の回想" },
  { pt: "A Hora da Estrela", en: "The Hour of the Star", ja: "星の時" },
  { pt: "O Alquimista", en: "The Alchemist", ja: "アルケミスト" },
  { pt: "Antologia Poética", en: "Poetic Anthology", ja: "詩選集" },
  { pt: "Poesias Completas", en: "Complete Poems", ja: "全詩集" },
  { pt: "Uma Breve História do Tempo", en: "A Brief History of Time", ja: "ホーキング、宇宙を語る" },
  { pt: "Cosmos", en: "Cosmos", ja: "コスモス" },
  { pt: "Sapiens", en: "Sapiens: A Brief History of Humankind", ja: "サピエンス全史" },
  { pt: "Casa-Grande & Senzala", en: "The Masters and the Slaves", ja: "大邸宅と奴隷小屋" },
  { pt: "A República", en: "The Republic", ja: "国家" },
  { pt: "Assim Falou Zaratustra", en: "Thus Spoke Zarathustra", ja: "ツァラトゥストラはこう言った" },
  { pt: "A História da Arte", en: "The Story of Art", ja: "美術の物語" },
  { pt: "Modos de Ver", en: "Ways of Seeing", ja: "イメージ――視覚とメディア" },
  // books from around the world
  { pt: "Cem Anos de Solidão", en: "One Hundred Years of Solitude", ja: "百年の孤独" },
  { pt: "Dom Quixote", en: "Don Quixote", ja: "ドン・キホーテ" },
  { pt: "Os Miseráveis", en: "Les Misérables", ja: "レ・ミゼラブル" },
  { pt: "O Pequeno Príncipe", en: "The Little Prince", ja: "星の王子さま" },
  { pt: "Crime e Castigo", en: "Crime and Punishment", ja: "罪と罰" },
  { pt: "O Hobbit", en: "The Hobbit", ja: "ホビットの冒険" },
  { pt: "1984", en: "Nineteen Eighty-Four", ja: "1984年" },
  { pt: "A Metamorfose", en: "The Metamorphosis", ja: "変身" },
  { pt: "Ficções", en: "Ficciones", ja: "伝奇集" },
  { pt: "Pedro Páramo", en: "Pedro Páramo", ja: "ペドロ・パラモ" },
  { pt: "O Mundo se Despedaça", en: "Things Fall Apart", ja: "崩れゆく絆" },
  { pt: "O Estrangeiro", en: "The Stranger", ja: "異邦人" },
  { pt: "Os Lusíadas", en: "The Lusiads", ja: "ウズ・ルジアダス" },
  { pt: "A Ilha do Tesouro", en: "Treasure Island", ja: "宝島" },
  { pt: "Sherlock Holmes: Um Estudo em Vermelho", en: "Sherlock Holmes: A Study in Scarlet", ja: "緋色の研究" },
  { pt: "Assassinato no Expresso do Oriente", en: "Murder on the Orient Express", ja: "オリエント急行の殺人" },
  { pt: "Anna Karenina", en: "Anna Karenina", ja: "アンナ・カレーニナ" },
  { pt: "A Casa dos Espíritos", en: "The House of the Spirits", ja: "精霊たちの家" },
  { pt: "O Nome da Rosa", en: "The Name of the Rose", ja: "薔薇の名前" },
  { pt: "Orgulho e Preconceito", en: "Pride and Prejudice", ja: "高慢と偏見" },
  { pt: "A Vida de Leonardo da Vinci", en: "Leonardo da Vinci", ja: "レオナルド・ダ・ヴィンチ" },
  { pt: "Mandela: Longa Caminhada até a Liberdade", en: "Long Walk to Freedom", ja: "自由への長い道" },
  { pt: "O Diário de Anne Frank", en: "The Diary of Anne Frank", ja: "アンネの日記" },
  // Brazil
  { pt: "Grande Sertão: Veredas", en: "The Devil to Pay in the Backlands", ja: "大いなるセルトン:ヴェレーダス" }, // ja: literal
  { pt: "Capitães da Areia", en: "Captains of the Sands", ja: "砂の隊長たち" },
  { pt: "Vidas Secas", en: "Barren Lives", ja: "乾いた人生" },
  { pt: "Gabriela, Cravo e Canela", en: "Gabriela, Clove and Cinnamon", ja: "ガブリエラ、丁子とシナモン" },
  { pt: "Macunaíma", en: "Macunaíma", ja: "マクナイーマ" },
  // Japan
  { pt: "Kokoro", en: "Kokoro", ja: "こころ" },
  { pt: "Norwegian Wood", en: "Norwegian Wood", ja: "ノルウェイの森" },
  { pt: "O Conto de Genji", en: "The Tale of Genji", ja: "源氏物語" },
  { pt: "Já Não Sou Humano", en: "No Longer Human", ja: "人間失格" },
  { pt: "País das Neves", en: "Snow Country", ja: "雪国" },
  { pt: "Kafka à Beira-Mar", en: "Kafka on the Shore", ja: "海辺のカフカ" },
  { pt: "Eu Sou um Gato", en: "I Am a Cat", ja: "吾輩は猫である" },
  { pt: "Rashōmon e Outros Contos", en: "Rashōmon and Other Stories", ja: "羅生門" },
  { pt: "A Moça da Loja de Conveniência", en: "Convenience Store Woman", ja: "コンビニ人間" },
  // China
  { pt: "Sonho da Câmara Vermelha", en: "Dream of the Red Chamber", ja: "紅楼夢" },
  { pt: "Viagem ao Oeste", en: "Journey to the West", ja: "西遊記" },
  { pt: "Romance dos Três Reinos", en: "Romance of the Three Kingdoms", ja: "三国志演義" },
  { pt: "A Arte da Guerra", en: "The Art of War", ja: "孫子の兵法" },
  { pt: "O Problema dos Três Corpos", en: "The Three-Body Problem", ja: "三体" },
  { pt: "Viver", en: "To Live", ja: "活きる" },
  { pt: "Sorgo Vermelho", en: "Red Sorghum", ja: "赤い高粱" },
  { pt: "À Margem da Água", en: "Water Margin", ja: "水滸伝" },
  { pt: "Tao Te Ching", en: "Tao Te Ching", ja: "老子道徳経" },
  { pt: "Os Analectos", en: "The Analects", ja: "論語" },
  // Mongolia
  { pt: "A História Secreta dos Mongóis", en: "The Secret History of the Mongols", ja: "モンゴル秘史" },
  { pt: "O Céu Azul", en: "The Blue Sky", ja: "青い空" },
  { en: "Altan Tobchi", ja: "アルタン・トブチ" },
  { pt: "Contos Populares Mongóis", en: "Mongolian Folktales", ja: "モンゴルの民話" },
  { pt: "A Égua Cinzenta", en: "The Gray Mare", ja: "灰色の牝馬" },
  { en: "Geser", ja: "ゲセル" },
  { pt: "A Epopeia de Jangar", en: "The Epic of Jangar", ja: "ジャンガル叙事詩" },
  // Sri Lanka
  { pt: "As Sete Luas de Maali Almeida", en: "The Seven Moons of Maali Almeida", ja: "マーリ・アルメイダの七つの月" }, // ja: literal
  { pt: "O Fantasma de Anil", en: "Anil's Ghost", ja: "アニルの亡霊" },
  { en: "Funny Boy", ja: "ファニー・ボーイ" },
  { pt: "O Recife", en: "Reef", ja: "リーフ" },
  { pt: "Jardins de Canela", en: "Cinnamon Gardens", ja: "シナモン・ガーデン" },
  { pt: "A Ilha dos Mil Espelhos", en: "Island of a Thousand Mirrors", ja: "千の鏡の島" }, // ja: literal
  { pt: "O Paciente Inglês", en: "The English Patient", ja: "イングリッシュ・ペイシェント" },
  // Nepal
  { en: "Palpasa Cafe", ja: "パルパサ・カフェ" },
  { pt: "Prendendo Deus em Katmandu", en: "Arresting God in Kathmandu", ja: "カトマンズで神を逮捕する" }, // ja: literal
  { pt: "O Guru do Amor", en: "The Guru of Love", ja: "愛のグル" }, // ja: literal
  { pt: "A Tutora de História", en: "The Tutor of History", ja: "歴史の家庭教師" }, // ja: literal
  { pt: "A Filha do Gurkha", en: "The Gurkha's Daughter", ja: "グルカの娘" }, // ja: literal
  { pt: "Esqueça Katmandu", en: "Forget Kathmandu", ja: "カトマンズを忘れて" }, // ja: literal
  { en: "Karnali Blues", ja: "カルナリ・ブルース" },
  { en: "Muna Madan", ja: "ムナ・マダン" },
  // Bangladesh
  { en: "Brick Lane", ja: "ブリック・レーン" },
  { pt: "Uma Era de Ouro", en: "A Golden Age", ja: "黄金時代" }, // ja: literal
  { en: "Lajja", ja: "ラッジャ" },
  { pt: "À Luz do que Sabemos", en: "In the Light of What We Know", ja: "我々の知るところに照らして" }, // ja: literal
  { pt: "O Bom Muçulmano", en: "The Good Muslim", ja: "よきムスリム" }, // ja: literal
  { pt: "O Sonho de Sultana", en: "Sultana's Dream", ja: "スルターナの夢" },
  { pt: "Árvore Sem Raízes", en: "Tree Without Roots", ja: "根のない木" }, // ja: literal
  { pt: "De Sangue e Fogo", en: "Of Blood and Fire", ja: "血と炎" }, // ja: literal
  { pt: "O Casaco Preto", en: "The Black Coat", ja: "黒いコート" }, // ja: literal
  // the Philippines
  { pt: "Noli Me Tangere", en: "Noli Me Tangere", ja: "ノリ・メ・タンヘレ" },
  { pt: "O Filibusterismo", en: "El Filibusterismo", ja: "エル・フィリブステリスモ" },
];

/** A title as a lookup key: no case, accents, spaces or punctuation (so "Pedro Páramo" and "pedro paramo" meet). */
export function titleKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const INDEX: ReadonlyMap<string, Names> = (() => {
  const index = new Map<string, Names>();
  for (const names of TITLES) {
    for (const name of Object.values(names)) index.set(titleKey(name), names);
  }
  return index;
})();

/** The entry of a catalogued title, also when the edition adds a note: "Kokoro (Tuttle Classics)", "Dom Casmurro: romance". */
function find(title: string): Names | undefined {
  const bare = title.replace(/\s*[([].*?[)\]]\s*/g, " ").trim();
  const head = bare.split(/\s*[:–—]\s+|\s+-\s+/)[0] ?? bare;
  return INDEX.get(titleKey(title)) ?? INDEX.get(titleKey(bare)) ?? INDEX.get(titleKey(head));
}

/** The title of a book in the reader's language, or the title it was catalogued with if the table does not know it. */
export function bookTitle(title: string, lang: Lang): string {
  return find(title)?.[lang] ?? title;
}
