// utils/externalRatings.js
//
// Harici puanlar (IMDb / Rotten Tomatoes / Metascore) için SAF istemci yardımcıları — RN/Firebase
// importu yok. Veriyi getiren çağrı services/externalRatings.js'te; sunucu tarafı functions/externalRatings.js.

/** 2345678 → "2,345,678" (OMDb'nin eski biçimiyle aynı; ekranda "oy" eki yanına gelir). */
export function formatImdbVotes(votes) {
  const n = Number(votes);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Kısa oy sayısı (çip için): 845 → "845", 12 300 → "12.3K", 2 345 678 → "2.3M". Geçersizde null.
 * Binlik tek ondalık, sonda ".0" atılır ("12.0K" → "12K").
 */
export function formatCompactVotes(votes) {
  const n = Number(votes);
  if (!Number.isFinite(n) || n <= 0) return null;
  const trim = (value) => String(Math.round(value * 10) / 10).replace(/\.0$/, "");
  if (n >= 999500) return `${trim(n / 1e6)}M`;
  if (n >= 1000) return `${trim(n / 1e3)}K`;
  return String(Math.trunc(n));
}

/**
 * Metascore rengi (Metacritic'in kendi eşikleri): 61–100 yeşil, 40–60 sarı, 0–39 kırmızı.
 * @returns {"green"|"yellow"|"red"|null}
 */
export function metascoreTone(score) {
  // null / "" Number()'da 0 olur: "puan yok" ile "0 puan" karışmasın.
  const n = score === null || score === "" ? NaN : Number(score);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  if (n >= 61) return "green";
  if (n >= 40) return "yellow";
  return "red";
}

/**
 * Metascore sözel değerlendirmesi (Metacritic'in aralıkları):
 * 81–100 evrensel beğeni · 61–80 genel olarak olumlu · 40–60 karışık · 20–39 genel olarak olumsuz · 0–19 aşırı hoşnutsuzluk.
 * @returns {"universalAcclaim"|"favorable"|"mixed"|"unfavorable"|"overwhelmingDislike"|null}
 */
export function metascoreVerdict(score) {
  const n = score === null || score === "" ? NaN : Number(score);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  if (n >= 81) return "universalAcclaim";
  if (n >= 61) return "favorable";
  if (n >= 40) return "mixed";
  if (n >= 20) return "unfavorable";
  return "overwhelmingDislike";
}

/**
 * Rotten Tomatoes durumu: %60 ve üstü "fresh" (kırmızı domates), altı "rotten" (yeşil leke).
 * @returns {"fresh"|"rotten"|null}
 */
export function tomatoState(percent) {
  const n = percent === null || percent === "" ? NaN : Number(percent);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n >= 60 ? "fresh" : "rotten";
}

/**
 * Dizi ana puanı: IMDb varsa o, yoksa TMDB. Eski ekran davranışıyla aynı: IMDb puanı "N/A" ise TMDB.
 * @param {{found?:boolean, imdbRating?:number|null, imdbVotes?:number|null}|null} ratings sunucu cevabı
 * @param {{vote_average?:number, vote_count?:number}} tmdb
 * @returns {{ rating: number, votes: string|number, source: "imdb"|"tmdb" }}
 */
export function pickMainRating(ratings, tmdb) {
  if (ratings?.found && Number.isFinite(ratings.imdbRating)) {
    return {
      rating: ratings.imdbRating,
      votes: formatImdbVotes(ratings.imdbVotes) ?? tmdb?.vote_count ?? 0,
      source: "imdb",
    };
  }
  return { rating: tmdb?.vote_average ?? 0, votes: tmdb?.vote_count ?? 0, source: "tmdb" };
}

/**
 * TMDB bölümlerine IMDb bölüm puanını işler (eşleşme bölüm numarasıyla). IMDb puanı yoksa TMDB puanı kalır.
 * @param {Array<{episode_number:number, vote_average:number}>} tmdbEpisodes
 * @param {Array<{episode:number, imdbRating:number|null}>|null} imdbEpisodes sunucu cevabı (`episodes`)
 */
export function mergeEpisodeRatings(tmdbEpisodes, imdbEpisodes) {
  const byEpisode = new Map(
    (Array.isArray(imdbEpisodes) ? imdbEpisodes : [])
      .filter((entry) => entry && Number.isFinite(entry.imdbRating))
      .map((entry) => [entry.episode, entry.imdbRating]),
  );
  return (Array.isArray(tmdbEpisodes) ? tmdbEpisodes : []).map((episode) => ({
    ...episode,
    vote_average: byEpisode.has(episode.episode_number) ? byEpisode.get(episode.episode_number) : episode.vote_average,
  }));
}
