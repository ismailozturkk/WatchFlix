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

const LANGS = ["tr", "en", "es", "pt", "de"];

// Kanonik tür id'si → ad. profileStoryCard da bu tabloyu kullanır.
export const GENRE_LABELS = Object.freeze({
  action: { tr: "Aksiyon", en: "Action", es: "Acción", pt: "Ação", de: "Action" },
  adventure: { tr: "Macera", en: "Adventure", es: "Aventura", pt: "Aventura", de: "Abenteuer" },
  animation: { tr: "Animasyon", en: "Animation", es: "Animación", pt: "Animação", de: "Animation" },
  comedy: { tr: "Komedi", en: "Comedy", es: "Comedia", pt: "Comédia", de: "Komödie" },
  crime: { tr: "Suç", en: "Crime", es: "Crimen", pt: "Crime", de: "Krimi" },
  documentary: { tr: "Belgesel", en: "Documentary", es: "Documental", pt: "Documentário", de: "Dokumentarfilm" },
  drama: { tr: "Dram", en: "Drama", es: "Drama", pt: "Drama", de: "Drama" },
  family: { tr: "Aile", en: "Family", es: "Familia", pt: "Família", de: "Familie" },
  fantasy: { tr: "Fantastik", en: "Fantasy", es: "Fantasía", pt: "Fantasia", de: "Fantasy" },
  history: { tr: "Tarih", en: "History", es: "Historia", pt: "História", de: "Historie" },
  horror: { tr: "Korku", en: "Horror", es: "Terror", pt: "Terror", de: "Horror" },
  music: { tr: "Müzik", en: "Music", es: "Música", pt: "Música", de: "Musik" },
  mystery: { tr: "Gizem", en: "Mystery", es: "Misterio", pt: "Mistério", de: "Mystery" },
  romance: { tr: "Romantik", en: "Romance", es: "Romance", pt: "Romance", de: "Liebesfilm" },
  scifi: { tr: "Bilim Kurgu", en: "Sci-Fi", es: "Ciencia ficción", pt: "Ficção científica", de: "Sci-Fi" },
  thriller: { tr: "Gerilim", en: "Thriller", es: "Suspense", pt: "Thriller", de: "Thriller" },
  war: { tr: "Savaş", en: "War", es: "Bélica", pt: "Guerra", de: "Kriegsfilm" },
  western: { tr: "Vahşi Batı", en: "Western", es: "Western", pt: "Faroeste", de: "Western" },
  reality: { tr: "Realite", en: "Reality", es: "Reality", pt: "Reality", de: "Reality" },
  tvmovie: { tr: "TV Filmi", en: "TV Movie", es: "Película de TV", pt: "Filme para TV", de: "TV-Film" },
});

// Yalnız dizilerde olan / genreCanon'un birleştirdiği türler. Anahtarlar
// foldGenreName çıktısıdır ("Sci-Fi & Fantasy" → "sci fi fantasy").
const EXACT = [
  {
    aliases: ["action adventure", "aksiyon macera", "accion y aventura", "acao e aventura", "action abenteuer"],
    labels: { tr: "Aksiyon & Macera", en: "Action & Adventure", es: "Acción y aventura", pt: "Ação e aventura", de: "Action & Abenteuer" },
  },
  {
    aliases: [
      "sci fi fantasy", "science fiction fantasy", "bilim kurgu fantazi", "bilim kurgu fantezi", "bilim kurgu fantastik",
      "ciencia ficcion y fantasia", "ficcao cientifica e fantasia",
    ],
    labels: { tr: "Bilim Kurgu & Fantazi", en: "Sci-Fi & Fantasy", es: "Ciencia ficción y fantasía", pt: "Ficção científica e fantasia", de: "Sci-Fi & Fantasy" },
  },
  {
    aliases: ["war politics", "savas politika", "savas politik", "belica y politica", "guerra e politica", "krieg politik"],
    labels: { tr: "Savaş & Politika", en: "War & Politics", es: "Bélica y política", pt: "Guerra e política", de: "Krieg & Politik" },
  },
  {
    aliases: ["kids", "cocuk", "cocuklar", "infantil", "kinder"],
    labels: { tr: "Çocuk", en: "Kids", es: "Infantil", pt: "Infantil", de: "Kinder" },
  },
  {
    aliases: ["soap", "pembe dizi", "telenovela", "novela", "seifenoper"],
    labels: { tr: "Pembe Dizi", en: "Soap", es: "Telenovela", pt: "Novela", de: "Seifenoper" },
  },
  {
    aliases: ["talk", "talk show", "talkshow", "programa de entrevistas"],
    labels: { tr: "Talk Show", en: "Talk", es: "Programa de entrevistas", pt: "Talk show", de: "Talkshow" },
  },
  {
    aliases: ["news", "haber", "noticias", "nachrichten"],
    labels: { tr: "Haber", en: "News", es: "Noticias", pt: "Notícias", de: "Nachrichten" },
  },
];

const EXACT_LOOKUP = new Map();
for (const entry of EXACT) for (const alias of entry.aliases) EXACT_LOOKUP.set(alias, entry.labels);

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
