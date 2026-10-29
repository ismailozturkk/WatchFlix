// utils/tvUpcoming.js
//
// Dizi ana ekranındaki "Yaklaşan Diziler" rafının sorgusu — SAF çekirdek (RN / axios / depo importu YOK).
// Filmlerdeki "Yaklaşan Filmler"in (utils/upcomingFilters.js) dizi karşılığı; tarih penceresi oradaki
// hazır aralıklarla (1 hafta … Tümü) AYNI hesaptan gelir (`upcomingDateRange`, yarından başlar).
//
// TMDB DAVRANIŞI (29 Eki 2026'da gerçek API ile denendi — DEĞİŞTİRMEDEN ÖNCE OKU):
//   • `/discover/tv` + `first_air_date.*` = İLK bölümü pencereye düşen YENİ diziler (1 ay: 217 sonuç,
//     3 ay+: Harry Potter, Blade Runner 2099, Neuromancer üstte). Filmlerdeki gibi bölgesel vizyon yok.
//   • `first_air_date.asc` dünya genelinde çöp (ilk sayfa popülerliği 0 olan yapımlar) → yalnız popülerlik.
//   • "Yeni sezon" için süzgeç YOK: `air_date.*` herhangi bir bölümü pencereye düşen her diziyi getirir
//     (haftalık yayındakiler dahil). Yeni sezon gerçekten istenirse dizi başına sezon sorgusu gerekir.
//   • `with_origin_country=TR` bir aylık pencerede 1 sonuç → yerel süzgeç varsayılan olamaz.
//
// `include_adult` BİLEREK yok: ayarı tek yerden utils/tmdbAdultGuard.js uygular.

import { toQueryString } from "./discoverFilters";
import { QUICK_RANGES, upcomingDateRange } from "./upcomingFilters";

export const TMDB_DISCOVER_TV = "https://api.themoviedb.org/3/discover/tv";

/** Rafın çipleri (filmlerle aynı hazır aralıklar ve etiketler). */
export const TV_UPCOMING_RANGES = QUICK_RANGES;
/** Varsayılan 3 ay: bir haftalık pencerede üst sıralar az bilinen yapımlardan oluşuyor. */
export const DEFAULT_TV_UPCOMING_RANGE = "3m";

export const normalizeTvUpcomingRange = (range) =>
  TV_UPCOMING_RANGES.includes(range) ? range : DEFAULT_TV_UPCOMING_RANGE;

/**
 * Seçimi TMDB `/discover/tv` parametrelerine çevirir (SIRA kararlı: aynı seçim = aynı sorgu).
 *
 * @param {object} args
 * @param {string} args.range     TV_UPCOMING_RANGES kimliği
 * @param {string} args.language  TMDB dil kodu ("tr-TR")
 * @param {Date}   [args.now]
 * @param {number} [args.page]
 */
export function buildTvUpcomingParams({ range, language, now = new Date(), page = 1 }) {
  const { gte, lte } = upcomingDateRange({ range: normalizeTvUpcomingRange(range) }, now);
  const params = {
    language,
    page: Math.max(1, Math.floor(Number(page)) || 1),
    include_null_first_air_dates: "false",
    "first_air_date.gte": gte,
  };
  if (lte) params["first_air_date.lte"] = lte;
  params.sort_by = "popularity.desc";
  return params;
}

export const buildTvUpcomingUrl = (args) => `${TMDB_DISCOVER_TV}?${toQueryString(buildTvUpcomingParams(args))}`;

/** Sayfadan BAĞIMSIZ sorgu imzası — önbellek anahtarı ve "seçim değişti mi?" kararı için. */
export function tvUpcomingQuerySignature(args) {
  const { page, ...rest } = buildTvUpcomingParams({ ...args, page: 1 });
  return toQueryString(rest);
}
