// utils/posterChoices.js
//
// ÖZEL AFİŞ SEÇİMİ — saf çekirdek (React ve Firebase import etmez; Jest'te doğrudan
// test edilir: __tests__/posterChoices.test.js).
//
// Kullanıcı bir film/dizi için TMDB'deki alternatif afişlerden ve arka planlardan
// birini seçer. Görsel SAKLANMAZ: yalnız TMDB yolu ("/abc.jpg") saklanır, görsel yine
// TMDB CDN'inden gelir.
//
//   PosterChoices/{uid} = {
//     id: "all",
//     choices:   { "movie_603": "/x.jpg", "tv_1399": "/y.jpg" },   // afişler
//     backdrops: { "movie_603": "/b.jpg" },                         // arka planlar
//     updatedAt,
//   }
//
// TEK belge: arkadaş profili seçimleri TEK okumayla alır (alt koleksiyonda seçim
// başına bir okuma olurdu). Kural tarafı (firestore.rules PosterChoices) listelerle
// aynı görünürlüğü uygular ve her haritayı MAX_POSTER_CHOICES ile sınırlar.
// Bellekte iki harita birlikte "seçim kümesi" olarak taşınır: { posters, backdrops }.
//
// Seçim ÇİZİM anında uygulanır (context/PosterChoicesContext): kütüphane/liste
// kayıtlarındaki afiş kopyalarına yazılmaz, değişiklik her yere anında yansır.

/** Yerel-öncelikli alanda belgenin tek anahtarı (services/userData/domains.js). */
export const POSTER_CHOICES_DOC_KEY = "all";

/** Harita başına seçim tavanı — firestore.rules `choices`/`backdrops` `size()` sınırıyla AYNI. */
export const MAX_POSTER_CHOICES = 500;

export const EMPTY_POSTER_CHOICES = Object.freeze({});

/** Seçim türleri: harita adı (bellek) ve belge alanı. */
export const CHOICE_KIND = Object.freeze({ POSTER: "poster", BACKDROP: "backdrop" });
const SET_KEY = Object.freeze({ poster: "posters", backdrop: "backdrops" });

export const EMPTY_CHOICE_SET = Object.freeze({
  posters: EMPTY_POSTER_CHOICES,
  backdrops: EMPTY_POSTER_CHOICES,
});

// TMDB görsel yolu: "/" + harf/rakam/_/- + uzantı. Arkadaşın belgesinden gelen değer
// de bu süzgeçten geçer (belge istemciden yazılır; kural değerleri tek tek denetleyemez).
const PATH_RE = /^\/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp|svg)$/i;
const KEY_RE = /^(movie|tv)_\d{1,10}$/;

/** "movie" | "tv" | null — çağrı yerlerindeki farklı tür adlarını tek biçime indirir. */
export function normalizePosterType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "movie" || t === "film") return "movie";
  if (t === "tv" || t === "show" || t === "tvshow" || t === "series") return "tv";
  return null;
}

/** Seçim haritası anahtarı ("movie_603"); tür ya da kimlik geçersizse null. */
export function posterChoiceKey(type, id) {
  const kind = normalizePosterType(type);
  const num = Number(id);
  if (!kind || !Number.isInteger(num) || num <= 0) return null;
  return `${kind}_${num}`;
}

export function isValidPosterPath(path) {
  return typeof path === "string" && PATH_RE.test(path);
}

/**
 * Ham haritayı (yerel kopya ya da arkadaşın belgesi) süzer: geçersiz anahtar/yol
 * atılır, en çok MAX_POSTER_CHOICES girdi kalır. Sonuç donmuş düz nesne.
 */
export function sanitizePosterChoices(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_POSTER_CHOICES;
  const out = {};
  let count = 0;
  for (const [key, path] of Object.entries(raw)) {
    if (count >= MAX_POSTER_CHOICES) break;
    if (!KEY_RE.test(key) || !isValidPosterPath(path)) continue;
    out[key] = path;
    count += 1;
  }
  return count === 0 ? EMPTY_POSTER_CHOICES : Object.freeze(out);
}

/** Belgeden (yerel kopya / Firestore verisi) AFİŞ seçim haritası. */
export function choicesFromDoc(doc) {
  return sanitizePosterChoices(doc?.choices);
}

/** Belgeden seçim kümesi { posters, backdrops } (ikisi de boşsa EMPTY_CHOICE_SET). */
export function choiceSetFromDoc(doc) {
  const posters = sanitizePosterChoices(doc?.choices);
  const backdrops = sanitizePosterChoices(doc?.backdrops);
  if (posters === EMPTY_POSTER_CHOICES && backdrops === EMPTY_POSTER_CHOICES) return EMPTY_CHOICE_SET;
  return Object.freeze({ posters, backdrops });
}

/** Kümeden bir türün haritası ("poster" | "backdrop"). */
export function choicesOfKind(set, kind = CHOICE_KIND.POSTER) {
  return set?.[SET_KEY[kind]] || EMPTY_POSTER_CHOICES;
}

/**
 * Kümede bir türün haritasını değiştirir (`withPosterChoice` sonucuyla). `null`
 * (geçersiz/tavan) ya da değişmemiş harita gelirse aynısını döndürür → çağıran
 * `next === set` ile "yazma yok" anlar.
 */
export function withChoiceSetKind(set, kind, nextMap) {
  const base = set || EMPTY_CHOICE_SET;
  const key = SET_KEY[kind];
  if (!key || !nextMap || nextMap === base[key]) return base;
  return Object.freeze({ ...base, [key]: nextMap });
}

/** Çizilecek yol: seçim varsa o, yoksa `fallback` (çağıranın TMDB yolu). */
export function resolvePosterPath(choices, type, id, fallback = null) {
  if (!choices || choices === EMPTY_POSTER_CHOICES) return fallback;
  const key = posterChoiceKey(type, id);
  return (key && choices[key]) || fallback;
}

export function posterChoiceCount(choices) {
  return choices ? Object.keys(choices).length : 0;
}

/**
 * Yeni harita (afiş ya da arka plan haritası — kural aynı): `path` verilirse seçer,
 * null/boşsa seçimi kaldırır.
 * Geçersiz girişte ya da tavan doluyken (yeni anahtar) `null` döner — çağıran
 * yazmaz. Değişiklik yoksa aynı nesne döner.
 */
export function withPosterChoice(choices, type, id, path) {
  const key = posterChoiceKey(type, id);
  if (!key) return null;
  const base = choices || EMPTY_POSTER_CHOICES;
  if (!path) {
    if (!(key in base)) return base;
    const next = { ...base };
    delete next[key];
    return Object.freeze(next);
  }
  if (!isValidPosterPath(path)) return null;
  if (base[key] === path) return base;
  if (!(key in base) && posterChoiceCount(base) >= MAX_POSTER_CHOICES) return null;
  return Object.freeze({ ...base, [key]: path });
}

/** Alana yazılacak tam belge, seçim kümesinden (her yazım tam `set`, idempotent). */
export function buildPosterChoicesDoc(set, now = Date.now()) {
  return {
    id: POSTER_CHOICES_DOC_KEY,
    choices: { ...(set?.posters || {}) },
    backdrops: { ...(set?.backdrops || {}) },
    updatedAt: now,
  };
}

/**
 * Galeride gösterim sırası: seçili afiş EN BAŞTA (açılınca ilk o görünsün), geri
 * kalanı TMDB sırasında. Seçili yol listede yoksa (TMDB kaldırmış olabilir) başa eklenir.
 */
export function orderGalleryForChoice(images, chosenPath) {
  const list = Array.isArray(images) ? images : [];
  if (!chosenPath) return list;
  const index = list.findIndex((img) => img?.file_path === chosenPath);
  if (index === 0) return list;
  if (index < 0) return [{ file_path: chosenPath }, ...list];
  return [list[index], ...list.slice(0, index), ...list.slice(index + 1)];
}
