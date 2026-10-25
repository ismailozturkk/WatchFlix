// utils/upcomingFilters.js
//
// Film ana ekranındaki "Yaklaşan Filmler" rafının süzgeci — SAF çekirdek (RN / axios / depo importu
// YOK; jest yalnız saf modülleri test edebiliyor).
//
// NE YAPAR: tarih penceresi (hazır aralık · takvim ayı · özel aralık), gösterim (tüm dünya / bölgede
// sinemada / bölgede dijitalde), tür, özgün dil ve sıralama seçimini TMDB `/discover/movie`
// parametrelerine çevirir; depodan gelen ham kaydı doğrular.
//
// TMDB DAVRANIŞI (24 Eki 2026'da gerçek API ile denendi — DEĞİŞTİRMEDEN ÖNCE OKU):
//   • `region` + `primary_release_date` bölgeye göre SÜZMEZ (TR, 30 gün: 1.567 sonuç = dünya geneli).
//     Bölgedeki vizyon için `release_date.*` + `with_release_type` + `region` gerekir (TR sinema,
//     30 gün: 23 sonuç — gerçek vizyon takvimi). `/movie/upcoming` da bunu yapar.
//   • Dünya genelinde tarihe göre sıralama (`primary_release_date.asc`) işe yaramaz: ilk sayfalar
//     popülerliği 0 olan binlerce yapım. Bu yüzden "Tarihe göre" YALNIZ bölgesel gösterimde geçerli;
//     "Tüm dünya" seçiliyken `normalizeUpcomingFilters` sıralamayı "Popüler"e indirir, sayfada
//     "Tarihe göre"ye basmak gösterimi "Sinemada"ya geçirir (`setUpcomingFilter`).
//   • Bölgesel gösterimde eski filmlerin yeniden vizyonları da gelir (ör. 2019 yapımı); bunları
//     `primary_release_date.gte` tabanı (başlangıçtan REISSUE_FLOOR_YEARS önce) eler.
//   • `release_date.asc` bölgesel tarihe göre sıralar (doğrulandı).
//   • `region` gönderilince sonuçtaki `release_date` alanı BÖLGESEL tarihe döner (gönderilmezse ilk
//     çıkış tarihi). "Tüm dünya" ilk çıkış tarihine göre süzdüğü için orada `region` YAZILMAZ: yoksa
//     "Aralık" seçiliyken kartta "1 Oca 2027" görünüyordu (eski rafta da "Bu hafta"da 69 gün kaldı
//     yazan kartlar buydu). Bölgesel gösterimde pencere de kart da bölgesel tarih — tutarlı.
//   • Tür süzgeci VEYA mantığıyla (`|`) çalışır: yaklaşan film havuzu küçük; "VE" hızla boşaltır.
//
// `include_adult` BİLEREK yok: ayarı tek yerden utils/tmdbAdultGuard.js uygular.
//
// DEĞİŞTİRİRSEN: __tests__/upcomingFilters.test.js her seçeneğin URL'e çıktığını kilitler; metinler
// utils/upcomingFiltersCopy.js'te (beş dil).

import { GENRES, LANGUAGES, isoDate, toQueryString } from "./discoverFilters";

export const TMDB_DISCOVER_MOVIE = "https://api.themoviedb.org/3/discover/movie";

/* ------------------------------------------------------------------ */
/* Seçenek kümeleri                                                    */
/* ------------------------------------------------------------------ */

/** Hazır aralıklar ("önümüzdeki …"). "all" = üst sınır yok. */
export const QUICK_RANGES = Object.freeze(["7d", "1m", "3m", "6m", "1y", "all"]);
/** Aralık türleri: hazır aralık kimliği | takvim ayı | özel aralık. */
export const RANGE_KINDS = Object.freeze([...QUICK_RANGES, "calendarMonth", "custom"]);
export const SCOPES = Object.freeze(["all", "cinema", "digital"]);
export const UPCOMING_SORTS = Object.freeze(["popular", "soonest"]);
export const UPCOMING_GENRES = GENRES.movie;
export const UPCOMING_LANGUAGES = LANGUAGES;

/** Ay seçicide gösterilen ay sayısı (başlangıç ayı dahil). */
export const MONTH_WINDOW = 12;
/** Özel aralığın en uzak bitişi: bugünden bu kadar yıl sonra. */
export const CUSTOM_MAX_YEARS = 5;
/** Bölgesel gösterimde yeniden vizyonları elemek için ilk çıkış tabanı. */
export const REISSUE_FLOOR_YEARS = 2;

/** TMDB çıkış türleri: 2 sınırlı vizyon, 3 vizyon, 4 dijital. */
const RELEASE_TYPES = Object.freeze({ cinema: "2|3", digital: "4" });

export const DEFAULT_UPCOMING_FILTERS = Object.freeze({
  range: "7d",
  month: null,
  from: null,
  to: null,
  scope: "all",
  genres: Object.freeze([]),
  language: "any",
  sort: "popular",
});

/** "Filtreler · n" rozetine giren anahtarlar. Tarih rafın çip satırında zaten görünür, sayılmaz. */
export const UPCOMING_FILTER_KEYS = Object.freeze(["scope", "genres", "language", "sort"]);

/* ------------------------------------------------------------------ */
/* Takvim yardımcıları (YEREL gün; toISOString UTC kaydırır)           */
/* ------------------------------------------------------------------ */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date, days) => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const addMonths = (date, months) => {
  const d = startOfDay(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

/** "2026-11-05" → yerel Date; geçersiz (ör. 2026-02-30) → null. */
export function parseIsoDay(value) {
  const match = ISO_DAY.exec(String(value ?? ""));
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

const monthKeyOf = (date) => isoDate(date).slice(0, 7);

/** "2026-11" → { first: "2026-11-01", last: "2026-11-30" }; geçersiz → null. */
export function monthBounds(month) {
  const match = ISO_MONTH.exec(String(month ?? ""));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) return null;
  return { first: isoDate(new Date(y, m - 1, 1)), last: isoDate(new Date(y, m, 0)) };
}

/**
 * "Yaklaşan" YARINDAN başlar (bugün çıkanlar "Vizyondakiler" rafında). Özel aralığın sınırları da bu.
 * @returns {{ minIso: string, maxIso: string }}
 */
export function upcomingBounds(now = new Date()) {
  const today = startOfDay(now);
  const max = new Date(today.getTime());
  max.setFullYear(max.getFullYear() + CUSTOM_MAX_YEARS);
  return { minIso: isoDate(addDays(today, 1)), maxIso: isoDate(max) };
}

/** Ay seçicinin ayları: başlangıç gününün (yarın) ayından itibaren `count` ay, "YYYY-MM". */
export function upcomingMonths(now = new Date(), count = MONTH_WINDOW) {
  const start = parseIsoDay(upcomingBounds(now).minIso);
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(monthKeyOf(new Date(start.getFullYear(), start.getMonth() + i, 1)));
  return out;
}

/* ------------------------------------------------------------------ */
/* Doğrulama                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_RANGE_FIELDS = Object.freeze({ range: DEFAULT_UPCOMING_FILTERS.range, month: null, from: null, to: null });

/** Aralık alanlarını doğrular. Geçmişte kalmış ay / aralık varsayılana düşer, taşan uç kırpılır. */
function normalizeRange(source, now) {
  const range = RANGE_KINDS.includes(source.range) ? source.range : DEFAULT_UPCOMING_FILTERS.range;
  if (QUICK_RANGES.includes(range)) return { range, month: null, from: null, to: null };

  if (range === "calendarMonth") {
    const month = typeof source.month === "string" ? source.month : "";
    return upcomingMonths(now).includes(month) ? { range, month, from: null, to: null } : { ...DEFAULT_RANGE_FIELDS };
  }

  // custom
  const { minIso, maxIso } = upcomingBounds(now);
  const fromDate = parseIsoDay(source.from);
  const toDate = parseIsoDay(source.to);
  if (!toDate) return { ...DEFAULT_RANGE_FIELDS };
  let from = fromDate ? isoDate(fromDate) : minIso;
  let to = isoDate(toDate);
  if (from > to) [from, to] = [to, from];
  if (to < minIso) return { ...DEFAULT_RANGE_FIELDS };
  if (from < minIso) from = minIso;
  if (to > maxIso) to = maxIso;
  if (from > maxIso) return { ...DEFAULT_RANGE_FIELDS };
  return { range, month: null, from, to };
}

/**
 * Depodan / taslaktan gelen ham değeri güvenli süzgece çevirir. Bozuk, eksik veya eski kayıt asla hata
 * vermez; geçersiz alan varsayılana düşer. Türler kanonik sırada (artan) — aynı küme = aynı JSON.
 */
export function normalizeUpcomingFilters(raw, now = new Date()) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const allowed = new Set(UPCOMING_GENRES);
  const genres = [
    ...new Set(
      (Array.isArray(source.genres) ? source.genres : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && allowed.has(id)),
    ),
  ].sort((a, b) => a - b);
  const scope = SCOPES.includes(source.scope) ? source.scope : DEFAULT_UPCOMING_FILTERS.scope;
  let sort = UPCOMING_SORTS.includes(source.sort) ? source.sort : DEFAULT_UPCOMING_FILTERS.sort;
  // Dünya genelinde tarih sıralaması anlamsız (bkz. dosya başı): popülere iner.
  if (sort === "soonest" && scope === "all") sort = "popular";
  return {
    ...normalizeRange(source, now),
    scope,
    genres,
    language: UPCOMING_LANGUAGES.includes(source.language) ? source.language : DEFAULT_UPCOMING_FILTERS.language,
    sort,
  };
}

export const upcomingFiltersSignature = (filters, now) => JSON.stringify(normalizeUpcomingFilters(filters, now));

export const sameUpcomingFilters = (a, b, now) => upcomingFiltersSignature(a, now) === upcomingFiltersSignature(b, now);

/** Rozet için etkin anahtarlar (UPCOMING_FILTER_KEYS sırasıyla). */
export function activeUpcomingKeys(filters) {
  const f = filters || DEFAULT_UPCOMING_FILTERS;
  return UPCOMING_FILTER_KEYS.filter((key) =>
    key === "genres" ? Array.isArray(f.genres) && f.genres.length > 0 : f[key] !== DEFAULT_UPCOMING_FILTERS[key],
  );
}

export const countActiveUpcomingFilters = (filters) => activeUpcomingKeys(filters).length;

/** Varsayılandan (tarih dahil) farklı bir şey var mı — "Sıfırla" için. */
export const isUpcomingCustomized = (filters, now) => !sameUpcomingFilters(filters, DEFAULT_UPCOMING_FILTERS, now);

/** Depoya yazılacak biçim: varsayılansa null (anahtar silinir). */
export function toStoredUpcomingFilters(filters, now = new Date()) {
  const normalized = normalizeUpcomingFilters(filters, now);
  return isUpcomingCustomized(normalized, now) ? normalized : null;
}

/* ------------------------------------------------------------------ */
/* Değişiklik yardımcıları (sonuç her zaman normalize)                 */
/* ------------------------------------------------------------------ */

/**
 * Tek alanı değiştirir. "Tarihe göre" sıralama dünya genelinde çalışmadığı için o seçim gösterimi
 * "Sinemada"ya geçirir; gösterim "Tüm dünya"ya dönünce sıralama normalize ile "Popüler"e iner.
 */
export function setUpcomingFilter(filters, key, value, now = new Date()) {
  const current = normalizeUpcomingFilters(filters, now);
  const next = { ...current, [key]: value };
  if (key === "sort" && value === "soonest" && current.scope === "all") next.scope = "cinema";
  return normalizeUpcomingFilters(next, now);
}

export const setUpcomingRange = (filters, range, now = new Date()) =>
  normalizeUpcomingFilters({ ...normalizeUpcomingFilters(filters, now), range, month: null, from: null, to: null }, now);

export const setUpcomingMonth = (filters, month, now = new Date()) =>
  normalizeUpcomingFilters({ ...normalizeUpcomingFilters(filters, now), range: "calendarMonth", month }, now);

export const setUpcomingCustomRange = (filters, { from, to }, now = new Date()) =>
  normalizeUpcomingFilters({ ...normalizeUpcomingFilters(filters, now), range: "custom", month: null, from, to }, now);

export function toggleUpcomingGenre(filters, genreId, now = new Date()) {
  const current = normalizeUpcomingFilters(filters, now);
  const id = Number(genreId);
  const genres = current.genres.includes(id) ? current.genres.filter((g) => g !== id) : [...current.genres, id];
  return normalizeUpcomingFilters({ ...current, genres }, now);
}

/* ------------------------------------------------------------------ */
/* Tarih penceresi + TMDB isteği                                       */
/* ------------------------------------------------------------------ */

/**
 * Seçimin tarih penceresi. `lte` null = üst sınır yok ("Tümü").
 * @returns {{ gte: string, lte: string|null }}
 */
export function upcomingDateRange(filters, now = new Date()) {
  const f = normalizeUpcomingFilters(filters, now);
  const { minIso } = upcomingBounds(now);
  const start = parseIsoDay(minIso);
  switch (f.range) {
    case "7d":
      return { gte: minIso, lte: isoDate(addDays(start, 7)) };
    case "1m":
      return { gte: minIso, lte: isoDate(addMonths(start, 1)) };
    case "3m":
      return { gte: minIso, lte: isoDate(addMonths(start, 3)) };
    case "6m":
      return { gte: minIso, lte: isoDate(addMonths(start, 6)) };
    case "1y":
      return { gte: minIso, lte: isoDate(addMonths(start, 12)) };
    case "calendarMonth": {
      const bounds = monthBounds(f.month);
      return { gte: bounds.first > minIso ? bounds.first : minIso, lte: bounds.last };
    }
    case "custom":
      return { gte: f.from, lte: f.to };
    default:
      return { gte: minIso, lte: null };
  }
}

/**
 * Süzgeci TMDB `/discover/movie` parametrelerine çevirir (SIRA kararlı: aynı süzgeç = aynı sorgu).
 *
 * @param {object} args
 * @param {object} args.filters
 * @param {string} args.language  TMDB dil kodu ("tr-TR")
 * @param {string} args.region    TMDB bölgesi ("TR") — bölgesel gösterim için şart
 * @param {Date}   [args.now]
 * @param {number} [args.page]
 */
export function buildUpcomingParams({ filters, language, region, now = new Date(), page = 1 }) {
  const f = normalizeUpcomingFilters(filters, now);
  const { gte, lte } = upcomingDateRange(f, now);
  // Bölge yoksa bölgesel gösterim yapılamaz: dünya geneline (ve popüler sıralamaya) düşülür.
  const regional = f.scope !== "all" && Boolean(region);
  const params = {
    include_video: "false",
    language,
    page: Math.max(1, Math.floor(Number(page)) || 1),
  };

  if (regional) {
    // `region` yalnız burada: kartın tarihi de bölgesel olsun (bkz. dosya başı).
    params.region = region;
    params["release_date.gte"] = gte;
    if (lte) params["release_date.lte"] = lte;
    params.with_release_type = RELEASE_TYPES[f.scope];
    const floor = parseIsoDay(gte);
    floor.setFullYear(floor.getFullYear() - REISSUE_FLOOR_YEARS);
    params["primary_release_date.gte"] = isoDate(floor);
  } else {
    params["primary_release_date.gte"] = gte;
    if (lte) params["primary_release_date.lte"] = lte;
  }

  params.sort_by = regional && f.sort === "soonest" ? "release_date.asc" : "popularity.desc";
  if (f.genres.length > 0) params.with_genres = f.genres.join("|");
  if (f.language !== "any") params.with_original_language = f.language;
  return params;
}

export const buildUpcomingUrl = (args) => `${TMDB_DISCOVER_MOVIE}?${toQueryString(buildUpcomingParams(args))}`;

/** Sayfadan BAĞIMSIZ sorgu imzası — önbellek anahtarı ve "süzgeç değişti mi?" kararı için. */
export function upcomingQuerySignature(args) {
  const { page, ...rest } = buildUpcomingParams({ ...args, page: 1 });
  return toQueryString(rest);
}
