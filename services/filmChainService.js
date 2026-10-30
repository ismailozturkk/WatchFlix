// services/filmChainService.js
//
// Film Zinciri'nin TMDB okumaları: bir oyuncunun filmleri (`/person/{id}/movie_credits`) ve bir filmin kadrosu
// (`/movie/{id}/credits`). Süzme kuralı utils/filmChainRules.js'te — bulmaca üreticisiyle ORTAK (par tutsun diye).
//
// ÖNBELLEK: services/favoriteRecommendations.readTmdb (URL başına; dil URL'in içinde). Filmografi ve kadro gün içinde
// oynamaz → 7 gün taze; çevrimdışıyken eski kayıt döner. Aynı zinciri geri alıp yeniden kurmak ağa gitmez.

import { readTmdb } from "./favoriteRecommendations";
import { chainCastOf, chainFilmsOf } from "../utils/filmChainRules";

const TTL = 7 * 24 * 60 * 60 * 1000;

/** @returns {Promise<Array<{id,title,year,posterPath,character,popularity}>>} */
export async function fetchChainFilms({ apiKey, language, personId }) {
  const data = await readTmdb(`/person/${personId}/movie_credits`, { apiKey, language, type: "movie", maxAge: TTL });
  return chainFilmsOf(data);
}

/** @returns {Promise<Array<{id,name,profilePath,character,order}>>} */
export async function fetchChainCast({ apiKey, language, movieId }) {
  const data = await readTmdb(`/movie/${movieId}/credits`, { apiKey, language, type: "movie", maxAge: TTL });
  return chainCastOf(data);
}
