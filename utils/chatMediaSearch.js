// utils/chatMediaSearch.js
//
// Sohbetteki "#" araması (ChatScreen → Film & Dizi Ara sayfası) için SAF
// sıralama çekirdeği. RN / axios / i18n importu yok; jest doğrudan çalıştırır.
//
// NEDEN VAR: eski sıralama sonuçları önce popülerliğe, ARDINDAN puana göre
// diziyordu — ikinci sort birincisini ezdiği için tek oyla 10.0 alan bilinmez
// kayıtlar başa çıkıyor, aranan eser aşağıda kalıyordu. Burada sıra iki şeyin
// toplamı: başlık eşleşmesinin kalitesi (tam > başlangıç > sözcük > içerir) ve
// eserin bilinirliği (popülerlik + oy sayısı, logaritmik). Afişsiz/izsiz
// kayıtlar sona itilir, aynı eser bir kez döner.

import { foldText } from "./listSearch";

// TMDB'ye çıkmak için en az bu kadar karakter (listSearch ile aynı eşik).
export const CHAT_SEARCH_MIN_CHARS = 2;
// Yazarken her tuşta istek atılmasın; bu kadar duraksayınca aranır.
export const CHAT_SEARCH_DEBOUNCE_MS = 280;

const SUPPORTED = new Set(["movie", "tv", "person"]);

// Eşleşme kademeleri → puan. Bilinirlik log10 ölçeğinde (≈0–4) toplandığı için
// "tam eşleşme" çok bilinen bir başlangıç eşleşmesini ancak yakın bilinirlikte
// geçer: "Dune" araması 2021 Dune → Dune: Part Two → 1984 Dune → bilinmez Dune.
const TIER_BONUS = Object.freeze({ exact: 2, prefix: 1.2, words: 0.8, contains: 0.4, none: 0 });
const YEAR_BONUS = 1.1;
const NO_IMAGE_PENALTY = 1.2;

const YEAR_MAX = 2100;

/**
 * Sorgunun sonundaki yılı ayırır: "matrix 1999" → { text: "matrix", year: 1999 }.
 * Yalnız yıl yazılmışsa ("1917", "2012") yıl DEĞİL başlıktır — dokunulmaz.
 */
export function parseSearchQuery(raw) {
  const full = String(raw ?? "").replace(/\s+/g, " ").trim();
  const match = full.match(/^(.*\S)\s+\(?((?:19|20)\d{2})\)?$/);
  if (match) {
    const year = Number(match[2]);
    if (year >= 1888 && year < YEAR_MAX) {
      return { full, text: match[1].trim(), year };
    }
  }
  return { full, text: full, year: null };
}

/** Sorgu TMDB'ye gidecek kadar uzun mu (katlanmış, boşluksuz). */
export function isSearchableQuery(raw) {
  return foldText(raw).replace(/\s/g, "").length >= CHAT_SEARCH_MIN_CHARS;
}

/** Sonuç önbelleği anahtarı: kategori + katlanmış sorgu. */
export const chatSearchKey = (type, raw) => `${type || "all"}|${foldText(raw)}`;

const namesOf = (item) =>
  [item?.title, item?.name, item?.original_title, item?.original_name].filter(Boolean);

function tierFor(name, needle) {
  const hay = foldText(name);
  if (!hay || !needle) return "none";
  if (hay === needle) return "exact";
  if (hay.startsWith(needle)) return "prefix";
  const words = hay.split(" ");
  const queryWords = needle.split(" ").filter(Boolean);
  if (queryWords.every((qw) => words.some((w) => w.startsWith(qw)))) return "words";
  if (hay.includes(needle)) return "contains";
  return "none";
}

/** Bir kaydın sorguya en iyi eşleşme kademesi (tüm ad varyantları × sorgu varyantları). */
export function matchTier(item, needles) {
  let best = "none";
  for (const name of namesOf(item)) {
    for (const needle of needles) {
      const tier = tierFor(name, needle);
      if (TIER_BONUS[tier] > TIER_BONUS[best]) best = tier;
      if (best === "exact") return best;
    }
  }
  return best;
}

const yearOf = (item) => {
  const date = String(item?.release_date || item?.first_air_date || "");
  return /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
};

const imageOf = (item) => item?.poster_path || item?.profile_path || null;

/** Bilinirlik: rankFuzzyCandidates / listSearch ile aynı ağırlık, log ölçeğinde. */
const fameOf = (item) => {
  const weight = Number(item?.popularity || 0) + Number(item?.vote_count || 0) / 100;
  return Math.log10(1 + Math.max(0, weight));
};

/**
 * Ham TMDB sonuçları (search/multi, search/movie|tv|person, birden çok sayfa
 * birleşik olabilir) → sıralı, tekil, tipli liste.
 *
 * @param {Array}  rawList
 * @param {string} query        Kullanıcının yazdığı TAM metin.
 * @param {object} [opts]
 * @param {string|null} [opts.type]  Kategori aramasında TMDB media_type döndürmez → buradan.
 * @param {number} [opts.limit]
 */
export function rankChatSearchResults(rawList, query, { type = null, limit = 40 } = {}) {
  const { full, text, year } = parseSearchQuery(query);
  const needles = [...new Set([foldText(full), foldText(text)].filter(Boolean))];
  const seen = new Set();
  const scored = [];

  (Array.isArray(rawList) ? rawList : []).forEach((raw, sourceIndex) => {
    if (!raw || raw.id == null) return;
    const mediaType = raw.media_type || type || "movie";
    if (!SUPPORTED.has(mediaType)) return;
    if (!raw.title && !raw.name) return;
    const key = `${mediaType}-${raw.id}`;
    if (seen.has(key)) return;
    seen.add(key);

    const item = { ...raw, media_type: mediaType };
    let score = TIER_BONUS[matchTier(item, needles)] + fameOf(item);
    if (year && mediaType !== "person" && yearOf(item) === year) score += YEAR_BONUS;
    if (!imageOf(item)) score -= NO_IMAGE_PENALTY;
    scored.push({ item, score, sourceIndex });
  });

  // Eşitlikte TMDB'nin kendi alaka sırası korunur.
  scored.sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex);
  return scored.slice(0, Math.max(0, limit)).map(({ item }) => item);
}

/**
 * Kart altındaki kısa bilgi satırı için parçalar: yıl + tür (kişide bölüm).
 * Metin çevirisini çağıran yapar; burada yalnız karar.
 */
export function resultMeta(item) {
  const mediaType = item?.media_type || "movie";
  if (mediaType === "person") {
    return { mediaType, year: null, department: item?.known_for_department || null };
  }
  return { mediaType, year: yearOf(item), department: null };
}

/** Seçimdeki dizi/film dağılımı: { movie, tv, person } adetleri. */
export function countByType(items) {
  const counts = { movie: 0, tv: 0, person: 0 };
  (Array.isArray(items) ? items : []).forEach((it) => {
    const mt = it?.media_type;
    if (mt === "movie" || mt === "tv" || mt === "person") counts[mt] += 1;
  });
  return counts;
}
