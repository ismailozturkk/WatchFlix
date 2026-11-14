// utils/genreDisplay.js
//
// Saklı tür ADINI ekranda kullanıcının diline çevirir.
//
// Uygulama türü id olarak değil, ekleme anındaki TMDB dilinde AD olarak saklar
// (bkz. utils/genreCanon.js başlığı). Türkçe eklenen bir dizi İngilizce
// arayüzde "Bilim Kurgu & Fantazi" diye görünüyordu. Saklı veri değişmez;
// çeviri yalnız gösterimde (ve gösterim için yapılan sayımlarda) yapılır, böylece
// "Dram" ve "Drama" da tek satırda birleşir.
//
// Bileşik dizi türleri (Aksiyon & Macera, Bilim Kurgu & Fantazi…) ve
// genreCanon'un başka kovaya kattığı türler (Çocuk→Aile, Pembe Dizi→Dram…)
// önce kendi tablosundan çözülür; gösterimde bilgi kaybolmasın.
//
// SAF MODÜL: React/alias importu yok, jest kapsamında.

import { copyLanguage } from "./appLanguages";
import { foldGenreName, kanonikTur } from "./genreCanon";

const LANGS = ["tr", "en", "es", "pt", "de", "it", "fr", "ja"];

// Kanonik tür id'si → ad. profileStoryCard da bu tabloyu kullanır.
export const GENRE_LABELS = Object.freeze({
  action: { tr: "Aksiyon", en: "Action", es: "Acción", pt: "Ação", de: "Action" , it: "Azione", fr: "Action", ja: "アクション"},
  adventure: { tr: "Macera", en: "Adventure", es: "Aventura", pt: "Aventura", de: "Abenteuer" , it: "Avventura", fr: "Aventure", ja: "アドベンチャー"},
  animation: { tr: "Animasyon", en: "Animation", es: "Animación", pt: "Animação", de: "Animation" , it: "Animazione", fr: "Animation", ja: "アニメーション"},
  comedy: { tr: "Komedi", en: "Comedy", es: "Comedia", pt: "Comédia", de: "Komödie" , it: "Commedia", fr: "Comédie", ja: "コメディ"},
  crime: { tr: "Suç", en: "Crime", es: "Crimen", pt: "Crime", de: "Krimi" , it: "Crimine", fr: "Crime", ja: "犯罪"},
  documentary: { tr: "Belgesel", en: "Documentary", es: "Documental", pt: "Documentário", de: "Dokumentarfilm" , it: "Documentario", fr: "Documentaire", ja: "ドキュメンタリー"},
  drama: { tr: "Dram", en: "Drama", es: "Drama", pt: "Drama", de: "Drama" , it: "Dramma", fr: "Drame", ja: "ドラマ"},
  family: { tr: "Aile", en: "Family", es: "Familia", pt: "Família", de: "Familie" , it: "Famiglia", fr: "Familial", ja: "ファミリー"},
  fantasy: { tr: "Fantastik", en: "Fantasy", es: "Fantasía", pt: "Fantasia", de: "Fantasy" , it: "Fantasy", fr: "Fantastique", ja: "ファンタジー"},
  history: { tr: "Tarih", en: "History", es: "Historia", pt: "História", de: "Historie" , it: "Storia", fr: "Histoire", ja: "歴史"},
  horror: { tr: "Korku", en: "Horror", es: "Terror", pt: "Terror", de: "Horror" , it: "Orrore", fr: "Horreur", ja: "ホラー"},
  music: { tr: "Müzik", en: "Music", es: "Música", pt: "Música", de: "Musik" , it: "Musica", fr: "Musique", ja: "音楽"},
  mystery: { tr: "Gizem", en: "Mystery", es: "Misterio", pt: "Mistério", de: "Mystery" , it: "Mistero", fr: "Mystère", ja: "ミステリー"},
  romance: { tr: "Romantik", en: "Romance", es: "Romance", pt: "Romance", de: "Liebesfilm" , it: "Romantico", fr: "Romance", ja: "ロマンス"},
  scifi: { tr: "Bilim Kurgu", en: "Sci-Fi", es: "Ciencia ficción", pt: "Ficção científica", de: "Sci-Fi" , it: "Fantascienza", fr: "Science-fiction", ja: "SF"},
  thriller: { tr: "Gerilim", en: "Thriller", es: "Suspense", pt: "Thriller", de: "Thriller" , it: "Thriller", fr: "Thriller", ja: "スリラー"},
  war: { tr: "Savaş", en: "War", es: "Bélica", pt: "Guerra", de: "Kriegsfilm" , it: "Guerra", fr: "Guerre", ja: "戦争"},
  western: { tr: "Vahşi Batı", en: "Western", es: "Western", pt: "Faroeste", de: "Western" , it: "Western", fr: "Western", ja: "西部劇"},
  reality: { tr: "Realite", en: "Reality", es: "Reality", pt: "Reality", de: "Reality" , it: "Reality", fr: "Téléréalité", ja: "リアリティ"},
  tvmovie: { tr: "TV Filmi", en: "TV Movie", es: "Película de TV", pt: "Filme para TV", de: "TV-Film" , it: "Film TV", fr: "Téléfilm", ja: "テレビ映画"},
});

// Yalnız dizilerde olan / genreCanon'un birleştirdiği türler. Anahtarlar
// foldGenreName çıktısıdır ("Sci-Fi & Fantasy" → "sci fi fantasy").
const EXACT = [
  {
    aliases: ["action adventure", "aksiyon macera", "accion y aventura", "acao e aventura", "action abenteuer", "azione e avventura", "action et aventure", "アクション&アドベンチャー"],
    labels: { tr: "Aksiyon & Macera", en: "Action & Adventure", es: "Acción y aventura", pt: "Ação e aventura", de: "Action & Abenteuer" , it: "Azione e avventura", fr: "Action & Aventure", ja: "アクション&アドベンチャー"},
  },
  {
    aliases: [
      "sci fi fantasy", "science fiction fantasy", "bilim kurgu fantazi", "bilim kurgu fantezi", "bilim kurgu fantastik",
      "ciencia ficcion y fantasia", "ficcao cientifica e fantasia", "fantascienza e fantasy",
      "SF&ファンタジー", "SF & ファンタジー",
    ],
    labels: { tr: "Bilim Kurgu & Fantazi", en: "Sci-Fi & Fantasy", es: "Ciencia ficción y fantasía", pt: "Ficção científica e fantasia", de: "Sci-Fi & Fantasy" , it: "Fantascienza e fantasy", fr: "Science-Fiction & Fantastique", ja: "SF&ファンタジー"},
  },
  {
    aliases: ["war politics", "savas politika", "savas politik", "belica y politica", "guerra e politica", "krieg politik", "戦争&政治", "戦争 & 政治"],
    labels: { tr: "Savaş & Politika", en: "War & Politics", es: "Bélica y política", pt: "Guerra e política", de: "Krieg & Politik" , it: "Guerra e politica", fr: "Guerre & Politique", ja: "戦争&政治"},
  },
  {
    aliases: ["kids", "cocuk", "cocuklar", "infantil", "kinder", "キッズ"],
    labels: { tr: "Çocuk", en: "Kids", es: "Infantil", pt: "Infantil", de: "Kinder" , it: "Bambini", fr: "Enfants", ja: "キッズ"},
  },
  {
    aliases: ["soap", "pembe dizi", "telenovela", "novela", "seifenoper", "ソープ"],
    labels: { tr: "Pembe Dizi", en: "Soap", es: "Telenovela", pt: "Novela", de: "Seifenoper" , it: "Soap", fr: "Feuilleton", ja: "ソープ"},
  },
  {
    aliases: ["talk", "talk show", "talkshow", "programa de entrevistas", "トーク", "トークショー"],
    labels: { tr: "Talk Show", en: "Talk", es: "Programa de entrevistas", pt: "Talk show", de: "Talkshow" , it: "Talk show", fr: "Talk-show", ja: "トーク"},
  },
  {
    aliases: ["news", "haber", "noticias", "nachrichten", "ニュース"],
    labels: { tr: "Haber", en: "News", es: "Noticias", pt: "Notícias", de: "Nachrichten" , it: "Notizie", fr: "Actualités", ja: "ニュース"},
  },
];

const EXACT_LOOKUP = new Map();
for (const entry of EXACT) for (const alias of entry.aliases) EXACT_LOOKUP.set(foldGenreName(alias), entry.labels);

/**
 * Saklı tür adını `language` diline çevirir. Tanınmayan ad olduğu gibi döner.
 * @param {string} name
 * @param {string} language uygulama dili (tr/en/es/pt/de)
 * @returns {string}
 */
export function localizeGenreName(name, language = "tr") {
  if (typeof name !== "string" || !name.trim()) return name;
  const lang = copyLanguage(language, LANGS);
  const exact = EXACT_LOOKUP.get(foldGenreName(name));
  if (exact) return exact[lang];
  const id = kanonikTur(name);
  return GENRE_LABELS[id]?.[lang] || name;
}

/** Ad listesini çevirir; çeviriden sonra aynı ada düşenler tekilleşir. */
export function localizeGenreList(names, language = "tr") {
  const out = [];
  for (const name of Array.isArray(names) ? names : []) {
    const label = localizeGenreName(name, language);
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
