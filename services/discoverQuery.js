// services/discoverQuery.js
//
// "Ne izlesem?" (Filtreli Keşif) için TMDB `/discover` tek sayfa okuyucusu. URL'yi saf çekirdek
// (utils/discoverFilters.js) kurar; burada yalnız ağ çağrısı ve cevabın güvenli biçime indirilmesi var.
//
// `include_adult` BURADA verilmez: ayarı tek yerden `installTmdbAdultGuard` (axios yakalayıcısı) uygular
// ve cevaptan `adult:true` kayıtları ayrıca eler (utils/tmdbAdultGuard.js).
//
// Ağ hatasında `installAxiosDataCache` daha önce aynı URL için kaydedilmiş cevabı geri verir —
// çevrimdışıyken açılan bir süzgeç son bakılan sonuçları gösterir.

import axios from "axios";
import { buildDiscoverUrl } from "../utils/discoverFilters";

/** TMDB bir aramada en çok 500 sayfa verir. */
const TMDB_MAX_PAGES = 500;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * @param {object} args  buildDiscoverUrl argümanları + `apiKey`
 * @returns {Promise<{ results: object[], totalPages: number, totalResults: number }>}
 */
export async function fetchDiscoverPage({ apiKey, ...query }) {
  const response = await axios.get(buildDiscoverUrl(query), {
    headers: { Authorization: apiKey },
    timeout: REQUEST_TIMEOUT_MS,
  });
  const data = response?.data || {};
  return {
    results: Array.isArray(data.results) ? data.results.filter((item) => item && item.id != null) : [],
    totalPages: Math.max(1, Math.min(Number(data.total_pages) || 1, TMDB_MAX_PAGES)),
    totalResults: Number(data.total_results) || 0,
  };
}
