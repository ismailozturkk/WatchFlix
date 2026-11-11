// utils/sensitiveContent.js
//
// "Hassas İçerikler" — eski tek "Yetişkin içeriği" anahtarının genişlemiş hâli.
// Dört kategori, her biri ayrı açılıp kapanır; HEPSİ varsayılan KAPALI
// (yani içerik gizli):
//
//   adult — TMDB `adult:true` kayıtlar (eski ayar, Keys.adultContent)
//   drugs — uyuşturucu / madde kullanımı / kartel
//   gore  — kan, vahşet, işkence, splatter
//   war   — savaş türü (film: 10752 "War", dizi: 10768 "War & Politics")
//
// NASIL SÜZÜLÜYOR (iki katman, utils/tmdbAdultGuard.js uygular):
//   1) İSTEK — `/discover` uçlarına `without_keywords` (TMDB anahtar kelime
//      kimlikleri) ve `without_genres` eklenir. En isabetli katman bu: TMDB'nin
//      kendi etiketleriyle sunucuda süzülür.
//   2) CEVAP — trending/popular/search gibi parametre almayan uçlar için dönen
//      kayıtlar yerelde elenir: `adult` bayrağı, `genre_ids` ve özet/başlıkta
//      geçen kelimeler (beş dilde). Kelime eşleşmesi SEZGİSEL — liste
//      cevaplarında anahtar kelime gelmiyor, her kayıt için ayrı istek atmak
//      da TMDB kotasını eritirdi. Bir kısım içerik gözden kaçabilir; Ayarlar
//      ekranındaki not bunu söylüyor.
//
// YAŞ KAPISI: 18 altı hesapta dört kategori de kilitli (bkz. utils/ageGate.js).

import { Keys, get } from "../services/storage";
import { adultContentAllowed, isAgeRestricted } from "./ageGate";

export const SENSITIVE_CATEGORIES = Object.freeze(["adult", "drugs", "gore", "war"]);

export const SENSITIVE_STORAGE_KEYS = Object.freeze({
  adult: "adultContent",
  drugs: "sensitiveDrugs",
  gore: "sensitiveGore",
  war: "sensitiveWar",
});

/** TMDB anahtar kelime kimlikleri (search/keyword ile doğrulandı, 11 Kas 2026). */
export const SENSITIVE_KEYWORD_IDS = Object.freeze({
  drugs: [
    251961, // drug
    726, // drug abuse
    1803, // drug addiction
    2231, // drug dealer
    10175, // drug cartel
    2149, // drug trafficking
    11494, // drug use
    41352, // drug overdose
    2150, // cocaine
    10764, // crack cocaine
    2671, // heroin
  ],
  gore: [
    10292, // gore
    381001, // extreme gore
    344603, // splatter
    193698, // torture porn
    157444, // dismemberment
    13006, // torture
  ],
});

export const WAR_GENRE_IDS = Object.freeze({ movie: 10752, tv: 10768 });

// Özet/başlık kelime kalıpları — tr, en, es, pt, de. Kelime sınırı yerine
// harf olmayan karakter kullanılıyor: JS'in \b'si Türkçe harfleri (ş, ı, ü…)
// kelime karakteri saymıyor.
const L = "a-zA-ZçğıöşüÇĞİÖŞÜáéíóúâêôãõñàäß";
const kelime = (govdeler) =>
  new RegExp(`(^|[^${L}])(${govdeler.join("|")})`, "i");

const TEXT_PATTERNS = {
  drugs: kelime([
    // en
    "drugs?(?![${L}])",
    "narcotics?",
    "cocaine",
    "heroin",
    "meth(amphetamine)?(?![${L}])",
    "cartels?(?![${L}])",
    "overdos",
    // tr
    "uyuşturucu",
    "kokain",
    "eroin",
    "kartel",
    "madde bağımlı",
    "torbacı",
    // es / pt
    "drogas?(?![${L}])",
    "narcotrafic",
    "narcotráfic",
    "cocaína",
    "heroína",
    "cártel",
    "traficante",
    // de
    "drogen",
    "kokain",
    "rauschgift",
    "kartell",
  ].map((s) => s.replaceAll("${L}", L))),
  gore: kelime([
    // en
    "gore(?![${L}])",
    "gory",
    "gruesome",
    "splatter",
    "dismember",
    "tortur",
    "massacre",
    "bloodbath",
    "slasher",
    "mutilat",
    // tr
    "kanlı",
    "vahşet",
    "vahşi(ce)? cinayet",
    "işkence",
    "katliam",
    "parçalanmış",
    // es / pt
    "sangrient",
    "sangrent",
    "tortura",
    "masacre",
    "massacre",
    "carnicería",
    "chacina",
    // de
    "blutig",
    "folter",
    "massaker",
    "gemetzel",
    "verstümmel",
  ].map((s) => s.replaceAll("${L}", L))),
};

/** Kategori ŞU AN gösterilebilir mi? Yaş kısıtı hepsini kapatır. */
export function sensitiveAllowed(category) {
  if (category === "adult") return adultContentAllowed();
  const storageKey = SENSITIVE_STORAGE_KEYS[category];
  if (!storageKey) return false;
  return get(Keys[storageKey]) === true && !isAgeRestricted();
}

/** Gizlenmesi gereken kategoriler. */
export function hiddenSensitiveCategories() {
  return SENSITIVE_CATEGORIES.filter((category) => !sensitiveAllowed(category));
}

/**
 * İzin verilen kategorilerin sıralı imzası: "" (hepsi gizli — varsayılan),
 * "adult", "adult,war"… Önbellek kapsamı ve efekt bağımlılığı olarak
 * kullanılır.
 *
 * @param {Record<string, boolean>} allowedMap
 */
export function contentFilterKeyOf(allowedMap) {
  return SENSITIVE_CATEGORIES.filter((category) => allowedMap?.[category] === true).join(",");
}

/** İmzadan gizli kategori kümesi. */
export function hiddenFromFilterKey(filterKey) {
  const allowed = new Set(
    typeof filterKey === "string" && filterKey ? filterKey.split(",") : [],
  );
  return SENSITIVE_CATEGORIES.filter((category) => !allowed.has(category));
}

const genreIdsOf = (item) => {
  if (Array.isArray(item?.genre_ids)) return item.genre_ids;
  if (Array.isArray(item?.genres)) return item.genres.map((g) => g?.id);
  return [];
};

// Videolar, anahtar kelimeler, yorumlar da `results` dizisinde gelir; onları
// süzmemek için yalnız film/dizi kaydına benzeyenler incelenir.
const looksLikeMedia = (item) =>
  item &&
  typeof item === "object" &&
  (Array.isArray(item.genre_ids) || typeof item.overview === "string");

/**
 * Kayıt gizlenmeli mi?
 *
 * @param {object} item TMDB film/dizi/kişi kaydı
 * @param {string[]} hidden gizli kategoriler
 */
export function isSensitiveItem(item, hidden) {
  if (!item || !Array.isArray(hidden) || hidden.length === 0) return false;
  if (hidden.includes("adult") && item.adult === true) return true;
  if (!looksLikeMedia(item)) return false;

  if (hidden.includes("war")) {
    const genres = genreIdsOf(item);
    if (genres.includes(WAR_GENRE_IDS.movie) || genres.includes(WAR_GENRE_IDS.tv)) {
      return true;
    }
  }

  const textCategories = hidden.filter((c) => TEXT_PATTERNS[c]);
  if (textCategories.length === 0) return false;
  const text = [item.title, item.name, item.original_title, item.original_name, item.overview]
    .filter((v) => typeof v === "string" && v)
    .join(" \n ");
  if (!text) return false;
  return textCategories.some((c) => TEXT_PATTERNS[c].test(text));
}

/**
 * Listeden gizli kategorideki kayıtları eler. Süzülecek bir şey yoksa AYNI
 * diziyi döner (kimlik korunur).
 */
export function dropSensitiveItems(list, hidden) {
  if (!Array.isArray(list) || !Array.isArray(hidden) || hidden.length === 0) return list;
  return list.some((item) => isSensitiveItem(item, hidden))
    ? list.filter((item) => !isSensitiveItem(item, hidden))
    : list;
}

const mergeIdList = (existing, ids) => {
  const prev =
    typeof existing === "string" || typeof existing === "number"
      ? String(existing).split(/[,|]/).map((s) => s.trim()).filter(Boolean)
      : [];
  return [...new Set([...prev, ...ids.map(String)])].join(",");
};

/**
 * `/discover` isteğine eklenecek süzgeç parametreleri. Mevcut değerlerle
 * birleştirilir (çağrı yerinin kendi `without_genres`'i kaybolmasın).
 *
 * @param {string} url
 * @param {object} params mevcut params
 * @param {string[]} hidden gizli kategoriler
 * @returns {object|null} eklenecek/güncellenecek alanlar ya da null
 */
export function discoverExclusionParams(url, params, hidden) {
  if (!/\/discover\/(movie|tv)/.test(url || "") || !hidden?.length) return null;
  const isTv = /\/discover\/tv/.test(url);
  const out = {};

  const keywordIds = hidden.flatMap((c) => SENSITIVE_KEYWORD_IDS[c] || []);
  if (keywordIds.length) {
    out.without_keywords = mergeIdList(params?.without_keywords, keywordIds);
  }
  if (hidden.includes("war")) {
    out.without_genres = mergeIdList(params?.without_genres, [
      isTv ? WAR_GENRE_IDS.tv : WAR_GENRE_IDS.movie,
    ]);
  }
  return Object.keys(out).length ? out : null;
}
