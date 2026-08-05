// services/listQuickAdd.js
//
// Liste ekranındaki GLOBAL ARAMA'nın taşıma katmanı: TMDB'de ara, seçilen eseri
// AÇIK OLAN listeye yaz. Karar mantığı yok — hangi tipin kabul edildiği ve
// sonucun nasıl normalleştiği utils/listSearch.js'te (saf, test edilebilir).
//
// NEDEN AYRI DOSYA: "listeye ekle" tek bir işlem değil, listenin modeline göre
// DÖRT ayrı yazma yolu:
//
//   favorites / watchList   → Lists/{uid}/{liste}/{type_id}        (addToList)
//   watchedMovies           → izleme OLAYI ekler                   (markMovieWatch)
//   watchedTv               → tüm sezon/bölümleri işaretler        (markShow)
//   özel (kullanıcı listesi) → kök dokümandaki dizi                (addToCustomRootList)
//
// Bu dallanma ekranda dursaydı ListsScreen'in içinde dördüncü bir Firestore
// yazma bloğu daha olurdu; ekran yalnız "ekle" diyor, hangi yolun doğru olduğu
// burada biliniyor.
//
// SÜRE/BÖLÜM OLGULARI: TMDB arama sonucu hafiftir (süre YOK). Liste öğesi ise
// `minutes` / `totalMinutes` okuyor (ListsScreen süre rozeti + süreye göre
// sıralama, profil toplam dakika). Bu yüzden yazmadan ÖNCE detay çekilir
// (tmdbFacts, cache'li). Detay gelmezse ekleme yine yapılır — süresiz bir öğe,
// hiç eklenmemiş bir öğeden iyidir.

import axios from "axios";

import { searchMediaWithFuzzyFallback } from "./fuzzyMediaSearch";
import { fetchMediaFacts } from "./tmdbFacts";
import { mapWithConcurrency } from "./upNextService";
import {
  addToCustomRootList,
  addToList,
  markMovieWatch,
  PREDEFINED_MOVIE_LISTS,
} from "./listItemsService";
import { markShow } from "./watchedTvService";
import { cachedTmdb } from "../utils/cachedRead";
import { resolveGenreIds } from "../utils/discoveryPersonalization";
import { applyFacts, langOf, todayListDate } from "../utils/mediaFacts";
import { mediaToListItem } from "../utils/listShare";
import {
  listAcceptedTypes,
  mergeRankedGroups,
  toCandidates,
} from "../utils/listSearch";

const TMDB = "https://api.themoviedb.org/3";
const SUGGESTION_TTL = 6 * 60 * 60 * 1000; // popüler listesi gün içinde oynamaz
const GENRE_CATALOG_TTL = 30 * 24 * 60 * 60 * 1000; // TMDB tür tablosu neredeyse hiç değişmez

const categoryOf = (type) => (type === "tv" ? "tvContent" : "movieContent");

/**
 * Açık listeye eklenebilecek eserleri TMDB'de arar.
 *
 * Karışık listelerde film ve dizi araması PARALEL gider ve tek sıralamada
 * birleşir (mergeRankedGroups). `search/multi` yerine iki ayrı uç nokta
 * kullanılıyor çünkü fuzzy düzeltme (MovieSearch/TvShowSearch ile aynı servis)
 * yalnız tek tipli aramada çalışıyor — "intersteller" yazan kullanıcı sonuç
 * görmeli.
 *
 * @returns {Promise<Array>} utils/listSearch aday nesneleri
 */
export async function searchForList({
  listName,
  query,
  apiKey,
  language,
  adultContent = false,
  limit = 40,
}) {
  const text = String(query || "").trim();
  if (!text || !apiKey) return [];
  const types = listAcceptedTypes(listName);

  const settled = await Promise.all(
    types.map(async (type) => {
      try {
        const { results } = await searchMediaWithFuzzyFallback({
          mediaType: type,
          query: text,
          language: langOf(language),
          adultContent,
          API_KEY: apiKey,
        });
        return {
          ok: true,
          items: toCandidates(results, {
            fallbackType: type,
            acceptedTypes: [type],
            limit,
          }),
        };
      } catch (error) {
        return { ok: false, error };
      }
    }),
  );

  // Bir tip düşerse diğerinin sonuçları yine gösterilir; HEPSİ düşerse hata
  // yukarı çıkar — ekran "sonuç yok" değil "bağlantını kontrol et" demeli.
  const failed = settled.filter((entry) => !entry.ok);
  if (failed.length === settled.length) throw failed[0].error;

  return mergeRankedGroups(
    settled.filter((entry) => entry.ok).map((entry) => entry.items),
    { limit },
  );
}

/**
 * Liste öğelerindeki tür ADLARINI bu medya tipinin TMDB tür ID'lerine çevirir.
 *
 * NEDEN AD→ID: liste öğeleri türü yerelleştirilmiş ad olarak saklıyor
 * (utils/listShare.mediaToListItem), discover ise id istiyor. Tablo HEM tr-TR
 * HEM en-US çekilir çünkü öğeler, o an hangi dil açıksa o dilde kaydedilmiş
 * olabilir — Türkçe kaydedilmiş "Aksiyon", arayüz İngilizceyken de çözülmeli.
 *
 * Film ve dizi tür ID'leri AYRI evrenlerdir (film 28 "Aksiyon", dizi 10759
 * "Aksiyon & Macera"). Tablo tipe göre çekildiği için karışık listelerde o tipte
 * karşılığı olmayan adlar sessizce elenir — resolveGenreIds zaten filtreliyor.
 */
async function resolveListGenreIds({ type, genreNames, apiKey }) {
  if (!genreNames?.length) return [];
  const catalogs = await Promise.all(
    ["tr-TR", "en-US"].map(async (locale) => {
      try {
        const { data } = await cachedTmdb(
          `${TMDB}/genre/${type}/list?language=${locale}`,
          { headers: { accept: "application/json", Authorization: apiKey } },
          { maxAge: GENRE_CATALOG_TTL, category: categoryOf(type) },
        );
        return data?.genres || [];
      } catch {
        return [];
      }
    }),
  );
  return resolveGenreIds(genreNames, ...catalogs);
}

/**
 * Sorgu yokken gösterilen öneriler. Cache'li: aynı gün içinde ekrana her
 * girişte ağa çıkılmaz, çevrimdışıyken de dolu gelir.
 *
 * ÖNCELİK SIRASI:
 *   1. `genreNames` verilmişse (listede en çok geçen 3 tür, bkz.
 *      utils/listSearch.topListGenres) discover ile O TÜRLERDEN öner.
 *   2. Tür çözülemez, discover patlar ya da BOŞ dönerse popülere düş.
 *
 * Boş sonuçta da düşülmesi bilinçli: nadir bir tür üçlüsü + yüksek oy eşiği
 * hiç sonuç vermeyebilir ve kullanıcıya boş öneri paneli göstermektense genel
 * popülerler daha iyidir.
 */
export async function fetchSuggestionsForList({
  listName,
  apiKey,
  language,
  genreNames = [],
  limit = 20,
}) {
  if (!apiKey) return [];
  const types = listAcceptedTypes(listName);
  const wantedGenres = [
    ...new Set(
      (Array.isArray(genreNames) ? genreNames : [])
        .map((name) => String(name ?? "").trim())
        .filter((name) => name && name !== "-"),
    ),
  ].slice(0, 3);

  const groups = await Promise.all(
    types.map(async (type) => {
      const headers = { accept: "application/json", Authorization: apiKey };
      const readList = async (url) => {
        const { data } = await cachedTmdb(url, { headers }, {
          maxAge: SUGGESTION_TTL,
          category: categoryOf(type),
        });
        return toCandidates(data?.results, {
          fallbackType: type,
          acceptedTypes: [type],
          limit,
        });
      };

      if (wantedGenres.length) {
        try {
          const ids = await resolveListGenreIds({
            type,
            genreNames: wantedGenres,
            apiKey,
          });
          if (ids.length) {
            // vote_count eşiği DiscoveryMediaRail ile aynı (300): tür başına
            // çöp sonuç yerine gerçekten bilinen yapımlar gelsin.
            const byGenre = await readList(
              `${TMDB}/discover/${type}?language=${langOf(language)}&page=1` +
                `&include_adult=false&sort_by=popularity.desc&vote_count.gte=300` +
                `&with_genres=${ids.join("|")}`,
            );
            if (byGenre.length) return byGenre;
          }
        } catch {
          // Popülere düşülecek.
        }
      }

      try {
        return await readList(
          `${TMDB}/${type}/popular?language=${langOf(language)}&page=1`,
        );
      } catch {
        return [];
      }
    }),
  );

  return mergeRankedGroups(groups, { limit });
}

/**
 * Aday eseri (arama sonucu) profil listesi öğesine çevirir; süre/tür olgularını
 * yazmadan önce tamamlar.
 */
async function buildListItem({ media, apiKey, language, genreMap, dateAdded }) {
  let enriched = media;
  try {
    const facts = await fetchMediaFacts({
      apiKey,
      id: media.id,
      mediaType: media.type,
      language,
    });
    if (facts) enriched = applyFacts(media, facts);
  } catch {
    // Olgu çekilemedi — öğe süresiz eklenir (bkz. dosya başlığı).
  }
  return mediaToListItem(enriched, { dateAdded, genreMap });
}

/**
 * Diziyi komple izlendi işaretlemek için tüm sezonların bölümlerini çeker.
 * TvShowsDetails.addShowToFirestore ile AYNI kurallar: 0. sezon (özel bölümler)
 * ve boş sezonlar atlanır.
 */
async function fetchSeasonsForShow({ showId, details, apiKey, language }) {
  const seasons = (details?.seasons || []).filter(
    (season) => season?.season_number && season?.episode_count > 0,
  );
  if (seasons.length === 0) return [];

  const fetched = await mapWithConcurrency(seasons, 4, async (season) => {
    const { data } = await axios.get(
      `${TMDB}/tv/${showId}/season/${season.season_number}`,
      {
        params: { language: langOf(language) },
        headers: { accept: "application/json", Authorization: apiKey },
      },
    );
    return {
      seasonNumber: season.season_number,
      seasonPosterPath: season.poster_path || null,
      seasonEpisodes: season.episode_count,
      episodes: (data?.episodes || []).map((episode) => ({
        episodeNumber: episode.episode_number,
        episodePosterPath: episode.still_path || null,
        episodeName: episode.name || "Unknown",
        episodeRatings: parseFloat(episode.vote_average?.toFixed(1)) || 0,
        episodeMinutes: episode.runtime || 0,
      })),
    };
  });

  // mapWithConcurrency hatalı isteği null'a çevirir; yarım kalan sezon listesi
  // yine yazılır — kullanıcı eksik sezonu bölüm ekranından tamamlayabilir.
  return fetched.filter((season) => season && season.episodes.length > 0);
}

/**
 * Seçilen eseri açık olan listeye ekler.
 *
 * @param {object}   p
 * @param {string}   p.uid
 * @param {string}   p.listName   route param (öntanımlı anahtar ya da özel liste adı)
 * @param {object}   p.media      utils/listSearch aday nesnesi
 * @param {string}   p.apiKey     TMDB Authorization başlığı
 * @param {string}   p.language
 * @param {object}   [p.genreMap] tür id → ad (utils/genreLabels.buildGenreMap)
 * @param {string}   [p.watchDate] "YYYY-MM-DD" — izlenenler listelerinde ZORUNLU
 * @returns {Promise<{status:"added"|"duplicate"|"empty-show", item:object|null}>}
 * @throws Firestore/ağ hatasında (çağıran ekran toast gösterir)
 */
export async function addMediaToList({
  uid,
  listName,
  media,
  apiKey,
  language,
  genreMap = null,
  watchDate = null,
}) {
  if (!uid || !listName || media?.id == null) {
    throw new Error("addMediaToList: eksik parametre");
  }

  const type = media.type === "tv" ? "tv" : "movie";
  const dateAdded = watchDate || todayListDate();

  // ── İzlenen diziler: liste üyeliği değil, tüm bölümlerin izleme kaydı ──────
  if (listName === "watchedTv") {
    const { data: details } = await axios.get(`${TMDB}/tv/${media.id}`, {
      params: { language: langOf(language) },
      headers: { accept: "application/json", Authorization: apiKey },
    });
    const seasons = await fetchSeasonsForShow({
      showId: media.id,
      details,
      apiKey,
      language,
    });
    if (seasons.length === 0) return { status: "empty-show", item: null };

    await markShow(
      uid,
      {
        id: details.id,
        name: details.name || media.title,
        showEpisodeCount: details.number_of_episodes || 0,
        showSeasonCount: details.number_of_seasons || 0,
        imagePath: details.poster_path || media.poster_path || null,
        genres: (details.genres || []).map((genre) => genre?.name).filter(Boolean),
      },
      seasons,
      dateAdded,
    );
    return { status: "added", item: null };
  }

  const item = await buildListItem({
    media: { ...media, type, media_type: type },
    apiKey,
    language,
    genreMap,
    dateAdded,
  });
  if (!item) throw new Error("addMediaToList: öğe oluşturulamadı");

  // ── İzlenen filmler: her ekleme bir izleme olayı (tekrar izleme desteklenir) ─
  if (listName === "watchedMovies") {
    await markMovieWatch(uid, { ...item, type: "movie" }, dateAdded);
    return { status: "added", item };
  }

  // ── Favoriler / İzlenecekler: öğe başına doküman (idempotent) ──────────────
  if (PREDEFINED_MOVIE_LISTS.includes(listName)) {
    await addToList(uid, listName, item);
    return { status: "added", item };
  }

  // ── Özel liste: kök dokümandaki dizi ───────────────────────────────────────
  const added = await addToCustomRootList(uid, listName, item);
  return { status: added ? "added" : "duplicate", item };
}
