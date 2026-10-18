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
