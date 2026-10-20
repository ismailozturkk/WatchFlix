// services/favoriteRecommendations.js
//
// "Dört favori"den ÖNERİ üretimi: TMDB'den veriyi çeker, sıralamayı
// utils/fourFavorites.js'teki saf mantığa bırakır.
//
// KAYNAKLAR (hangi favori hangi uca gider: utils/fourFavorites.recommendationSources)
//   • film/dizi favorisi → /{movie|tv}/{id}/recommendations   ("bunu sevenler şunu da sevdi")
//   • oyuncu favorisi    → /person/{id}/combined_credits      (en bilinen kurgusal işleri)
//
// ÖNBELLEK: URL başına (cachedTmdb anahtarı URL'dir — sorgu parametreleri
// URL'in İÇİNDE olmalı, axios `params`ına konursa iki dil aynı kayda düşer).
// Öneriler gün içinde oynamaz; 12 saat taze. Çevrimdışıyken eski kayıt döner.

import { cachedTmdb } from "../utils/cachedRead";
import { langOf } from "../utils/mediaFacts";
import {
  creditsToCandidates,
  recommendationSources,
  rankRecommendations,
  readProfileFavorites,
} from "../utils/fourFavorites";

const TMDB = "https://api.themoviedb.org/3";
const TTL = 12 * 60 * 60 * 1000;

const categoryOf = (type) => (type === "tv" ? "tvContent" : "movieContent");

export const tmdbHeaders = (apiKey) => ({ accept: "application/json", Authorization: apiKey });

/**
 * Önbellekli TMDB GET. Sorgu dizgisi URL'e gömülür (bkz. dosya başlığı).
 * `query`: ek sorgu parametreleri ("external_source=imdb_id"); `language`dan SONRA eklenir.
 */
export async function readTmdb(path, { apiKey, language, type = "movie", maxAge = TTL, query = "" }) {
  const { data } = await cachedTmdb(
    `${TMDB}${path}?language=${langOf(language)}${query ? `&${query}` : ""}`,
    { headers: tmdbHeaders(apiKey) },
    { maxAge, category: categoryOf(type) },
  );
  return data;
}

/**
 * Favorilere göre öneri listesi.
 *
 * @param {object} p
 * @param {object} p.favorites     normalize edilmiş ya da profil belgesi alanı
 * @param {"movie"|"tv"} p.mediaType
 * @param {Iterable<number|string>} [p.exclude] ek elenecekler (izlenenler...).
 *   Favorilerin KENDİSİ her zaman elenir.
 * @param {number} [p.limit]
 * @returns {Promise<{items:Array, sources:Array}>} `items[].becauseOf` hangi
 *   favorilerden geldiğini söyler.
 * @throws her kaynak da düşerse (ekran "bağlantını kontrol et" diyebilsin)
 */
export async function fetchFavoriteRecommendations({
  favorites,
  mediaType,
  apiKey,
  language,
  exclude = [],
  limit = 30,
}) {
  const type = mediaType === "tv" ? "tv" : "movie";
  const base = readProfileFavorites({ fourFavorites: favorites });
  const sources = recommendationSources(base, type);
  if (!apiKey || sources.length === 0) return { items: [], sources };

  const settled = await Promise.all(
    sources.map(async (source) => {
      try {
        const data = await readTmdb(source.path, { apiKey, language, type });
        return {
          ok: true,
          source,
          items:
            source.kind === "credits"
              ? creditsToCandidates(data, type)
              : Array.isArray(data?.results)
                ? data.results
                : [],
        };
      } catch (error) {
        return { ok: false, source, items: [], error };
      }
    }),
  );

  // Biri düşerse kalanlarla devam; HEPSİ düşerse hata yukarı çıkar.
  if (settled.every((entry) => !entry.ok)) throw settled[0].error;

  const own = type === "tv" ? base.shows : base.movies;
  const items = rankRecommendations(
    settled.filter((entry) => entry.ok),
    { exclude: [...own.map((item) => item.id), ...exclude], limit },
  );
  return { items, sources };
}
