// utils/discoverFilters.js
//
// "Ne izlesem?" (Filtreli Keşif) özelliğinin SAF çekirdeği. RN / axios / depo importu YOK
// (jest yalnız saf modülleri test edebiliyor, bkz. jest.config.js).
//
// NE YAPAR: kullanıcının seçtiği süzgeçleri (tür, dönem, puan, süre, dil, "platformlarımda",
// "izlediklerimi gizle", sıralama) TMDB `/discover` parametrelerine çevirir; süzgeç durumunu
// doğrular; hazır ve kayıtlı süzgeçleri yönetir; "izlediklerimi gizle" kararını verir.
//
// NEDEN AYRI: Film/Dizi ana ekranındaki raflar yalnız tür bazlı keşfediyordu. Burası, AI
// kotası (Free: günde 3) harcamadan "bu akşam 2 saate sığan, 7+ puanlı, platformlarımda bir
// şey" sorusunu yanıtlar.
//
// TÜRLER ELLE LİSTELENİR (ağdan `/genre/list` çekilmez): TMDB tür kimlikleri sabittir, liste
// çevrimdışı ve ilk karede hazır olur, etiketler üç dilli kopya tablosundadır
// (screens/shared/discoverFiltersCopy.js). Film ve Dizi türleri FARKLI kimlik kümeleridir
// (ör. Dizi'de "Aksiyon & Macera" tek tür); tür değiştirirken `convertFiltersForType` eşler.
//
// DEĞİŞTİRİRSEN: __tests__/discoverFilters.test.js her seçeneğin URL'e çıktığını ve
// kopya tablosunda üç dilde etiketi olduğunu kilitler.

import { DEFAULT_MEDIA_TYPE, MEDIA_TYPES } from "./discoverMedia";

export const TMDB_DISCOVER_BASE = "https://api.themoviedb.org/3/discover";

/** "Ne izlesem?" ekranının rota adı (App.js). Ana ekrandaki keşfet düğmesi bunu açar. */
export const DISCOVER_FILTERS_ROUTE = "DiscoverFilters";

/* ------------------------------------------------------------------ */
/* Seçenek kümeleri                                                    */
/* ------------------------------------------------------------------ */

export const ERAS = Object.freeze(["any", "last1", "last5", "d2020", "d2010", "d2000", "d1990", "classic"]);
/** 0 = süzgeç yok. */
export const RATINGS = Object.freeze([0, 6, 7, 8]);
export const RUNTIMES = Object.freeze(["any", "short", "medium", "long"]);
export const LANGUAGES = Object.freeze(["any", "tr", "en", "es", "pt", "fr", "de", "it", "ko", "ja", "hi"]);
export const SORTS = Object.freeze(["popular", "rating", "newest"]);

/** Tür seçimi sınırı (VE mantığı: çok tür seçmek sonucu hızla daraltır). */
export const MAX_GENRES = 4;

/**
 * Süre bantları. Film için toplam süre, Dizi için BÖLÜM süresi (TMDB `with_runtime`).
 *   short  : en çok    medium : en çok    long : en az
 */
export const RUNTIME_LIMITS = Object.freeze({
  movie: Object.freeze({ short: { lte: 90 }, medium: { lte: 120 }, long: { gte: 150 } }),
  tv: Object.freeze({ short: { lte: 30 }, medium: { lte: 45 }, long: { gte: 60 } }),
});

/** Kopya tablosunda etiketi olması gereken tür kimlikleri (TMDB'nin sabit kimlikleri). */
export const GENRES = Object.freeze({
  movie: Object.freeze([28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37]),
  tv: Object.freeze([10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10764, 10765, 10768, 37]),
});

/** Filmden Diziye / Diziden Filme geçerken eşdeğer türler. Eşi olmayan tür düşer. */
const GENRE_BRIDGE = Object.freeze({
  "movie>tv": { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768 },
  "tv>movie": { 10759: 28, 10765: 878, 10768: 10752, 10762: 10751 },
});

export const DEFAULT_FILTERS = Object.freeze({
  genres: Object.freeze([]),
  era: "any",
  minRating: 0,
  runtime: "any",
  language: "any",
  onMyPlatforms: false,
  hideWatched: false,
  sort: "popular",
});

/** Etkin sayılan süzgeç anahtarları, çip satırındaki sıra. (Sıralama bir süzgeç değil.) */
export const FILTER_KEYS = Object.freeze([
  "genres",
  "era",
  "minRating",
  "runtime",
  "language",
  "onMyPlatforms",
  "hideWatched",
]);

const mediaOf = (mediaType) => (MEDIA_TYPES.includes(mediaType) ? mediaType : DEFAULT_MEDIA_TYPE);

/* ------------------------------------------------------------------ */
/* Doğrulama                                                           */
/* ------------------------------------------------------------------ */

/**
 * Depodan / rota parametresinden / yedekten gelen ham değeri güvenli süzgece çevirir.
 * Bozuk, eksik veya eski kayıt asla hata vermez; geçersiz alan varsayılana düşer.
 * Türler kanonik sırada (artan) ve yalnız o medya türünün geçerli kimlikleri olur —
 * aynı küme = aynı JSON, gereksiz yazım olmaz.
 */
export function normalizeFilters(raw, mediaType = DEFAULT_MEDIA_TYPE) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const allowed = new Set(GENRES[mediaOf(mediaType)]);
  const genres = [
    ...new Set(
      (Array.isArray(source.genres) ? source.genres : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && allowed.has(id)),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, MAX_GENRES);
  const minRating = Number(source.minRating);
  return {
    genres,
    era: ERAS.includes(source.era) ? source.era : DEFAULT_FILTERS.era,
    minRating: RATINGS.includes(minRating) ? minRating : DEFAULT_FILTERS.minRating,
    runtime: RUNTIMES.includes(source.runtime) ? source.runtime : DEFAULT_FILTERS.runtime,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_FILTERS.language,
    onMyPlatforms: source.onMyPlatforms === true,
    hideWatched: source.hideWatched === true,
    sort: SORTS.includes(source.sort) ? source.sort : DEFAULT_FILTERS.sort,
  };
}

/** Süzgecin kararlı parmak izi (eşitlik / kayıt tekrarı / istek anahtarı). */
export const filtersSignature = (filters, mediaType) => JSON.stringify(normalizeFilters(filters, mediaType));

export const sameFilters = (a, b, mediaType) => filtersSignature(a, mediaType) === filtersSignature(b, mediaType);

/** Etkin süzgeç anahtarları (FILTER_KEYS sırasıyla). */
export function activeFilterKeys(filters) {
  const f = filters || DEFAULT_FILTERS;
  return FILTER_KEYS.filter((key) => {
    if (key === "genres") return Array.isArray(f.genres) && f.genres.length > 0;
    if (key === "minRating") return f.minRating > 0;
    if (key === "onMyPlatforms" || key === "hideWatched") return f[key] === true;
    return f[key] !== DEFAULT_FILTERS[key];
  });
}

/** "Filtreler (n)" rozeti. Sıralama sayılmaz. */
export const countActiveFilters = (filters) => activeFilterKeys(filters).length;

/** Varsayılandan farklı bir şey (süzgeç ya da sıralama) var mı — "Sıfırla" / "Kaydet" için. */
export const isCustomized = (filters, mediaType) =>
  !sameFilters(filters, DEFAULT_FILTERS, mediaType);

/** Tek bir alanı değiştirir; sonuç her zaman normalize. */
export const setFilter = (filters, key, value, mediaType) =>
  normalizeFilters({ ...normalizeFilters(filters, mediaType), [key]: value }, mediaType);

/** Bir türü aç/kapat (sınıra çarpınca YENİ seçim sessizce reddedilir). */
export function toggleGenre(filters, genreId, mediaType) {
  const current = normalizeFilters(filters, mediaType);
  const id = Number(genreId);
  if (current.genres.includes(id)) {
    return { ...current, genres: current.genres.filter((g) => g !== id) };
  }
  if (current.genres.length >= MAX_GENRES) return current;
  return normalizeFilters({ ...current, genres: [...current.genres, id] }, mediaType);
}

/** Film ↔ Dizi geçişi: eşi olan türler taşınır, öbürleri düşer; kalan alanlar korunur. */
export function convertFiltersForType(filters, from, to) {
  const source = normalizeFilters(filters, from);
  const fromType = mediaOf(from);
  const toType = mediaOf(to);
  if (fromType === toType) return source;
  const bridge = GENRE_BRIDGE[`${fromType}>${toType}`] || {};
  const target = new Set(GENRES[toType]);
  const genres = source.genres
    .map((id) => (target.has(id) ? id : bridge[id]))
    .filter((id) => id != null);
  return normalizeFilters({ ...source, genres }, toType);
}

/* ------------------------------------------------------------------ */
/* TMDB isteği                                                         */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, "0");
/** Yerel takvim günü (toISOString UTC kaydırır; gece yarısı civarı bir gün şaşardı). */
export const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const yearsAgo = (now, years) => {
  const d = new Date(now.getTime());
  d.setFullYear(d.getFullYear() - years);
  return d;
};

/** Dönem → { gte?, lte? } (üst sınır bugünle kırpılır — çıkmamış yapım "ne izlesem"e girmez). */
export function eraRange(era, now = new Date()) {
  const today = isoDate(now);
  let range = {};
  switch (era) {
    case "last1":
      range = { gte: isoDate(yearsAgo(now, 1)) };
      break;
    case "last5":
      range = { gte: isoDate(yearsAgo(now, 5)) };
      break;
    case "d2020":
      range = { gte: "2020-01-01", lte: "2029-12-31" };
      break;
    case "d2010":
      range = { gte: "2010-01-01", lte: "2019-12-31" };
      break;
    case "d2000":
      range = { gte: "2000-01-01", lte: "2009-12-31" };
      break;
    case "d1990":
      range = { gte: "1990-01-01", lte: "1999-12-31" };
      break;
    case "classic":
      range = { lte: "1989-12-31" };
      break;
    default:
      range = {};
  }
  if (!range.lte || range.lte > today) range = { ...range, lte: today };
  return range;
}

/** Oy sayısı tabanları: az oyu olan yapımın ortalaması gürültüdür. */
const VOTE_FLOOR = Object.freeze({
  movie: { rated: 100, ranked: 300, newest: 10 },
  tv: { rated: 50, ranked: 150, newest: 3 },
});

/**
 * Süzgeci TMDB `/discover` parametrelerine çevirir (SIRA kararlı: aynı süzgeç = aynı sorgu).
 *
 * `include_adult` BİLEREK yok: ayarı tek yerden `utils/tmdbAdultGuard.js` uygular.
 *
 * @param {object} args
 * @param {"movie"|"tv"} args.mediaType
 * @param {object} args.filters
 * @param {string} args.language       TMDB dil kodu ("tr-TR")
 * @param {string} args.region         TMDB bölgesi ("TR") — platform süzgeci için
 * @param {number[]} [args.providerIds] Kullanıcının platform üyelikleri
 * @param {Date} [args.now]
 * @param {number} [args.page]
 */
export function buildDiscoverParams({
  mediaType,
  filters,
  language,
  region,
  providerIds = [],
  now = new Date(),
  page = 1,
}) {
  const type = mediaOf(mediaType);
  const f = normalizeFilters(filters, type);
  const isTv = type === "tv";
  const floor = VOTE_FLOOR[type];
  const params = { language, page: Math.max(1, Math.floor(Number(page)) || 1) };

  params.sort_by =
    f.sort === "rating"
      ? "vote_average.desc"
      : f.sort === "newest"
        ? isTv
          ? "first_air_date.desc"
          : "primary_release_date.desc"
        : "popularity.desc";

  if (f.genres.length > 0) params.with_genres = f.genres.join(",");

  const dateKey = isTv ? "first_air_date" : "primary_release_date";
  const range = eraRange(f.era, now);
  if (range.gte) params[`${dateKey}.gte`] = range.gte;
  if (range.lte) params[`${dateKey}.lte`] = range.lte;

  if (f.minRating > 0) params["vote_average.gte"] = f.minRating;
  let minVotes = f.minRating > 0 ? floor.rated : 0;
  if (f.sort === "rating") minVotes = Math.max(minVotes, floor.ranked);
  if (f.sort === "newest") minVotes = Math.max(minVotes, floor.newest);
  if (minVotes > 0) params["vote_count.gte"] = minVotes;

  const limit = f.runtime === "any" ? null : RUNTIME_LIMITS[type][f.runtime];
  if (limit?.gte) params["with_runtime.gte"] = limit.gte;
  if (limit?.lte) params["with_runtime.lte"] = limit.lte;

  if (f.language !== "any") params.with_original_language = f.language;

  const ids = [...new Set((providerIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (f.onMyPlatforms && ids.length > 0 && region) {
    params.watch_region = region;
    params.with_watch_providers = ids.join("|");
    params.with_watch_monetization_types = "flatrate";
  }
  return params;
}

export const toQueryString = (params) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");

export function buildDiscoverUrl(args) {
  const type = mediaOf(args?.mediaType);
  return `${TMDB_DISCOVER_BASE}/${type}?${toQueryString(buildDiscoverParams(args))}`;
}

/**
 * Sayfadan BAĞIMSIZ istek imzası: süzgeç değişince akış baştan başlar, yalnız sayfa
 * değişince devam eder. Eski isteğin geç gelen cevabını atmak için de kullanılır.
 */
export function discoverSignature(args) {
  const { page, ...rest } = buildDiscoverParams({ ...args, page: 1 });
  return `${mediaOf(args?.mediaType)}|${toQueryString(rest)}`;
}

/** "Platformlarımda" açık ama hiç platform seçilmemiş: ekran uyarıp süzgeci yok sayar. */
export const needsPlatformSetup = (filters, providerIds = []) =>
  filters?.onMyPlatforms === true && (providerIds || []).length === 0;

/* ------------------------------------------------------------------ */
/* Sonuç işleme                                                        */
/* ------------------------------------------------------------------ */

/**
 * Kütüphanede "izlendi" olanları eler. Durum dizini yoksa AYNI diziyi döner (kimlik korunur).
 * Dizilerde "izlendi" = izleme geçmişine girmiş dizi (en az bir bölüm); bilerek geniş tutuldu:
 * yarım bıraktığın dizi "keşfet" listesinde yeniden önüne çıkmasın.
 */
export function applyHideWatched(items, statusIndex, mediaType) {
  const bucket = statusIndex?.[mediaOf(mediaType)];
  if (!Array.isArray(items) || !bucket) return items;
  const kept = items.filter((item) => !bucket[item?.id]?.isWatched);
  return kept.length === items.length ? items : kept;
}

/** Yeni sayfayı mevcut listeye ekler; kimliksiz ve tekrar eden kayıtlar atılır. */
export function mergePages(previous, incoming) {
  const seen = new Set((previous || []).map((item) => item?.id));
  const added = [];
  for (const item of incoming || []) {
    if (!item || item.id == null || seen.has(item.id)) continue;
    seen.add(item.id);
    added.push(item);
  }
  return added.length === 0 ? previous || [] : [...(previous || []), ...added];
}

/** İlk yüklemede görünür sonuç sayısı bu hedefe ulaşana dek sonraki sayfa çekilir. */
export const MIN_VISIBLE_RESULTS = 18;
/** Tek seferde (kullanıcı kaydırmadan) çekilecek en çok sayfa. */
export const MAX_AUTOFILL_PAGES = 5;

/**
 * "İzlediklerimi gizle" bir sayfayı tamamen boşaltabilir; ekran o zaman kaydırılamaz hâle gelir
 * ve kullanıcı sonraki sayfayı hiç tetikleyemez. Bu karar, o durumu kendiliğinden doldurur.
 */
export function shouldFetchMore({
  visibleCount,
  page,
  totalPages,
  pagesFetched,
  target = MIN_VISIBLE_RESULTS,
  maxPages = MAX_AUTOFILL_PAGES,
}) {
  return page < totalPages && visibleCount < target && pagesFetched < maxPages;
}

/** "Şaşırt beni" önerisinde tercih edilen en düşük TMDB ortalaması (yetersizse tüm havuz kullanılır). */
export const SURPRISE_PREFERRED_RATING = 6;

/**
 * "Şaşırt beni": afişi olan adaylardan birini seçer. `pick(n)` → [0, n).
 * Süzgeç boşken sorgu herkese açık popüler listedir; düşük puanlı bir yapım "sürpriz" olarak
 * hayal kırıklığı yaratmasın diye ortalaması yeterli olanlar tercih edilir. Hiçbiri yoksa (ör. oyları
 * az yeni yapımlar) tüm afişli havuzdan seçilir — öneri boş dönmez.
 */
export function pickSurprise(items, pick) {
  const posters = (items || []).filter((item) => item && item.id != null && item.poster_path);
  if (posters.length === 0) return null;
  const rated = posters.filter((item) => Number(item.vote_average) >= SURPRISE_PREFERRED_RATING);
  const pool = rated.length > 0 ? rated : posters;
  const index = pick(pool.length);
  return pool[Number.isInteger(index) && index >= 0 && index < pool.length ? index : 0];
}

/** "Şaşırt beni" rastgele sayfası: ilk `window` sayfa içinden (popülerlik düşünce kalite düşer). */
export const SURPRISE_PAGE_WINDOW = 8;
export const surprisePageLimit = (totalPages) =>
  Math.max(1, Math.min(Number(totalPages) || 1, SURPRISE_PAGE_WINDOW));

/* ------------------------------------------------------------------ */
/* Hazır süzgeçler                                                     */
/* ------------------------------------------------------------------ */

/**
 * Ana ekrandaki "Ne izlesem?" kartının tek dokunuşluk süzgeçleri.
 * `usePlatforms`: kullanıcının platformu varsa "Platformlarımda" da açılır.
 */
export const QUICK_PRESETS = Object.freeze([
  { id: "tonight", icon: "moon-outline", usePlatforms: true, filters: { runtime: "medium", minRating: 7 } },
  { id: "topRated", icon: "star-outline", filters: { minRating: 7, sort: "rating" } },
  { id: "fresh", icon: "sparkles-outline", filters: { era: "last1", minRating: 7 } },
  { id: "quick", icon: "flash-outline", filters: { runtime: "short", minRating: 6 } },
  { id: "classics", icon: "film-outline", filters: { era: "classic", minRating: 8, sort: "rating" } },
  { id: "family", icon: "people-outline", filters: { genres: [10751], minRating: 6 } },
]);

export const quickPresetIds = () => QUICK_PRESETS.map((preset) => preset.id);

/** Hazır süzgeci medya türüne ve kullanıcının platform durumuna göre çözer; bilinmeyen id → null. */
export function resolveQuickPreset(id, mediaType, { hasProviders = false } = {}) {
  const preset = QUICK_PRESETS.find((item) => item.id === id);
  if (!preset) return null;
  return normalizeFilters(
    { ...preset.filters, onMyPlatforms: preset.usePlatforms === true && hasProviders },
    mediaType,
  );
}

/**
 * Filtre ekranı açılırken hangi süzgecin kullanılacağı. Öncelik: hazır süzgeç → kayıtlı süzgeç →
 * rota parametresindeki süzgeç → son kullanılan. Hepsi hedef medya türüne göre normalize edilir;
 * kayıtlı süzgeç başka bir medya türünden geliyorsa eşlenir.
 *
 * @param {{presetId?:string, savedId?:string, filters?:object}} params  rota parametreleri
 * @param {"movie"|"tv"} mediaType
 * @param {{presets?:object[], hasProviders?:boolean, last?:object}} [context]
 */
export function resolveInitialFilters(params, mediaType, { presets = [], hasProviders = false, last } = {}) {
  const type = mediaOf(mediaType);
  if (params?.presetId) {
    const quick = resolveQuickPreset(params.presetId, type, { hasProviders });
    if (quick) return quick;
  }
  if (params?.savedId) {
    const saved = (presets || []).find((item) => item?.id === params.savedId);
    if (saved) return convertFiltersForType(saved.filters, saved.mediaType, type);
  }
  if (params?.filters) return normalizeFilters(params.filters, type);
  return normalizeFilters(last, type);
}

/* ------------------------------------------------------------------ */
/* Kayıtlı süzgeçler                                                   */
/* ------------------------------------------------------------------ */

export const MAX_SAVED_PRESETS = 8;
export const MAX_PRESET_NAME = 40;

const cleanName = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PRESET_NAME);

/**
 * Depodan okunan ham kayıtlı süzgeç listesini güvenli biçime çevirir: geçersiz öğeler, tekrar eden
 * kimlikler ve aynı süzgeçleri taşıyan kopyalar atılır, sınır uygulanır, sıra korunur.
 * @returns {{id:string,name:string,mediaType:"movie"|"tv",filters:object}[]}
 */
export function normalizePresets(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set();
  const signatures = new Set();
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const name = cleanName(entry.name);
    if (!id || !name || ids.has(id)) continue;
    if (!MEDIA_TYPES.includes(entry.mediaType)) continue;
    const filters = normalizeFilters(entry.filters, entry.mediaType);
    const signature = `${entry.mediaType}|${JSON.stringify(filters)}`;
    if (signatures.has(signature)) continue;
    ids.add(id);
    signatures.add(signature);
    out.push({ id, name, mediaType: entry.mediaType, filters });
    if (out.length >= MAX_SAVED_PRESETS) break;
  }
  return out;
}

/** Yeni kayıt kimliği (saat ve rastgelelik dışarıdan: test edilebilir). */
export const makePresetId = (now = Date.now(), random = Math.random) =>
  `p_${Math.floor(now).toString(36)}_${Math.floor(random() * 1e6).toString(36)}`;

/**
 * Süzgeci kayıtlı listeye ekler. Aynı medya türü + aynı süzgeç zaten kayıtlıysa ESKİSİ yerine
 * en başa taşınır (kopya olmaz, adı yenilenir); sınır aşılırsa en eski silinir.
 */
export function addPreset(list, preset) {
  const current = normalizePresets(list);
  const [entry] = normalizePresets([preset]);
  if (!entry) return current;
  const signature = `${entry.mediaType}|${JSON.stringify(entry.filters)}`;
  const rest = current.filter(
    (item) => `${item.mediaType}|${JSON.stringify(item.filters)}` !== signature && item.id !== entry.id,
  );
  return [entry, ...rest].slice(0, MAX_SAVED_PRESETS);
}

export const removePreset = (list, id) => normalizePresets(list).filter((item) => item.id !== id);

/* ------------------------------------------------------------------ */
/* Son kullanılan süzgeç (medya türü başına)                           */
/* ------------------------------------------------------------------ */

export function normalizeLastFilters(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    movie: normalizeFilters(source.movie, "movie"),
    tv: normalizeFilters(source.tv, "tv"),
  };
}

/** Depoya yazılacak biçim: hiçbir şey özelleştirilmediyse null (anahtar silinir). */
export function toStoredLastFilters(last) {
  const normalized = normalizeLastFilters(last);
  const custom = MEDIA_TYPES.some((type) => isCustomized(normalized[type], type));
  return custom ? normalized : null;
}

/* ------------------------------------------------------------------ */
/* Çip / ad üretimi                                                    */
/* ------------------------------------------------------------------ */

/**
 * Etkin süzgeçlerin okunur kısa metinleri (çip satırı ve kayıtlı süzgeç adı için).
 * `copy`: { genres:{id:ad}, eras:{id:ad}, ratingChip(n), runtimes:{movie:{…},tv:{…}}, languages:{id:ad},
 *           onMyPlatforms, hideWatched }
 * @returns {{key:string, label:string, value?:any}[]}
 */
export function describeFilters(filters, mediaType, copy) {
  const type = mediaOf(mediaType);
  const f = normalizeFilters(filters, type);
  const chips = [];
  for (const key of activeFilterKeys(f)) {
    if (key === "genres") {
      f.genres.forEach((id) => chips.push({ key: "genres", value: id, label: copy.genres?.[id] ?? String(id) }));
    } else if (key === "era") {
      chips.push({ key, label: copy.eras?.[f.era] ?? f.era });
    } else if (key === "minRating") {
      chips.push({ key, label: copy.ratingChip ? copy.ratingChip(f.minRating) : `${f.minRating}+` });
    } else if (key === "runtime") {
      chips.push({ key, label: copy.runtimes?.[type]?.[f.runtime] ?? f.runtime });
    } else if (key === "language") {
      chips.push({ key, label: copy.languages?.[f.language] ?? f.language });
    } else if (key === "onMyPlatforms") {
      chips.push({ key, label: copy.onMyPlatforms });
    } else if (key === "hideWatched") {
      chips.push({ key, label: copy.hideWatched });
    }
  }
  return chips;
}

/** Kayıtlı süzgeç için otomatik ad: ilk üç çip birleştirilir, sınırı aşarsa kısaltılır. */
export function presetNameFor(filters, mediaType, copy, fallback = "") {
  const parts = describeFilters(filters, mediaType, copy).map((chip) => chip.label);
  const joined = parts.slice(0, 3).join(" · ") || fallback;
  if (joined.length <= MAX_PRESET_NAME) return joined;
  return `${joined.slice(0, MAX_PRESET_NAME - 1).trimEnd()}…`;
}
