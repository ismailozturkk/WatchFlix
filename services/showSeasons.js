// services/showSeasons.js
//
// "Diziyi / sezonu izlendi işaretle" için TMDB'den bölüm verisini çeken TEK yer.
//
// Bu çekme eskiden üç ekranda ayrı ayrı yazılmıştı (TvShowsDetails,
// MediaQuickActionsSheet, listQuickAdd) ve sapmıştı: ikisi sezonları sırayla
// çekip BİR sezon düşerse işi iptal ediyor, üçüncüsü 4'lü paralel çekip
// düşen sezonu sessizce atlıyor ve eksik diziyi "tamamen izlendi" yazıyordu.
// Karar: EKSİK VERİYLE YAZMA. Yarım sezon listesiyle işaretlenen dizi,
// kullanıcıya "izlendi" gösterir ama bölüm sayacı/süre/tamamlama hesabı yanlış
// kalır; "tekrar dene" demek her zaman daha doğru.

import axios from "axios";

import {
  LIBRARY_ERROR,
  LibraryError,
  classifyLibraryError,
  episodeFromTmdb,
  mapConcurrentStrict,
  watchableSeasonsOf,
} from "../utils/libraryCore";
import { langOf } from "../utils/mediaFacts";

const TMDB = "https://api.themoviedb.org/3";
// TMDB hız sınırına takılmadan uzun dizilerde (20+ sezon) süreyi kısaltır.
const SEASON_CONCURRENCY = 4;

const requestOptions = (apiKey, language) => ({
  params: { language: langOf(language) },
  headers: { accept: "application/json", Authorization: apiKey },
});

/** Ağ hatasını "çevrimdışı", diğerlerini "sezon bilgisi eksik" olarak sınıflar. */
function seasonFetchError(error) {
  const { code } = classifyLibraryError(error);
  return new LibraryError(
    code === LIBRARY_ERROR.OFFLINE ? LIBRARY_ERROR.OFFLINE : LIBRARY_ERROR.SEASONS_INCOMPLETE,
    "Sezon bilgisi alınamadı",
    { cause: error },
  );
}

/** Tek sezonun bölümleri (servisin beklediği şekle çevrilmiş). */
export async function fetchSeasonEpisodes({ showId, seasonNumber, apiKey, language }) {
  try {
    const { data } = await axios.get(
      `${TMDB}/tv/${showId}/season/${seasonNumber}`,
      requestOptions(apiKey, language),
    );
    return (data?.episodes || []).map(episodeFromTmdb);
  } catch (error) {
    throw seasonFetchError(error);
  }
}

/**
 * Dizinin işaretlenebilir TÜM sezonları (özel bölümler / boş sezonlar hariç).
 * Bir sezon bile alınamazsa HİÇBİR sonuç dönmez, hata fırlatır (bkz. dosya başlığı).
 *
 * @returns {Promise<Array<{seasonNumber, seasonPosterPath, seasonEpisodes, episodes}>>}
 */
export async function fetchShowSeasons({ details, apiKey, language }) {
  const seasons = watchableSeasonsOf(details);
  if (seasons.length === 0) return [];
  try {
    const fetched = await mapConcurrentStrict(seasons, SEASON_CONCURRENCY, async (season) => {
      const { data } = await axios.get(
        `${TMDB}/tv/${details.id}/season/${season.season_number}`,
        requestOptions(apiKey, language),
      );
      return {
        seasonNumber: season.season_number,
        seasonPosterPath: season.poster_path || null,
        seasonEpisodes: season.episode_count,
        episodes: (data?.episodes || []).map(episodeFromTmdb),
      };
    });
    return fetched.filter((season) => season.episodes.length > 0);
  } catch (error) {
    throw seasonFetchError(error);
  }
}
