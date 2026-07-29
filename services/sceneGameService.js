// services/sceneGameService.js
//
// Sahne Tahmin Oyunu — Optimize Edilmiş TMDB API servisi
// Popüler başlıkları rastgele sayfalardan çeker, zorlaştırılmış sahne görselleri alır,
// türe göre akıllı şıklar üretir ve Firebase işlemlerini yönetir.

import axios from "axios";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { computeLevel, validateSessionResult } from "../utils/gameScoring";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { cachedRead } from "../utils/cachedRead";

// ── Cache ────────────────────────────────────────────────────────────────────
// Bellek ici cache: ayni oturumda tekrar tekrar API istegi yapmayi onler.
const titleCache = new Map(); // sourceKey -> items[]

// Diske kalici cache (Part 18.3): uygulamanin mevcut cachedRead/cacheStore
// altyapisi ile ayri bir "game" namespace'i kullanilir. Anahtar semasi:
//   game:scene:pool:<source>:<lang>:v2
// Havuz cesitliligi tasarimin parcasi oldugundan TTL ile "dondurulmaz"; bu
// cache yalnizca cevrimdisi/hata aninda son basarili havuza dusmek icindir
// (Part 18.4). Online iken her zaman taze sayfalar cekilir.
const GAME_CACHE_NS = "game";
const poolCacheKey = (source, language) => `scene:pool:${source}:${language}:v2`;

const HEADERS = (apiKey) => ({
  accept: "application/json",
  Authorization: apiKey,
});

// ── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

// Rastgele sayı üretici (min ve max dahil)
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// TMDB'den dizi/film çekerken rastgele sayfaları hedefleriz (1 ile 50 arası)
// API limitleri veya "popular" olmayan listeler için sayfa sayısı daha düşük tutulabilir.
const getRandomPages = (count, maxPage) => {
  const pages = new Set();
  while (pages.size < count) {
    pages.add(randomInt(1, maxPage));
  }
  return Array.from(pages);
};

// ── Normalize Medya Modeli (Part 10.2) ───────────────────────────────────────
// Popülerliği bantlara ayırır; "benzer popülerlik" karşılaştırması için kullanılır.
const popularityBandOf = (popularity) => {
  const p = Number(popularity) || 0;
  if (p >= 200) return 4;
  if (p >= 80) return 3;
  if (p >= 30) return 2;
  if (p >= 10) return 1;
  return 0;
};

export const mediaKeyOf = (type, id) => `${type}_${id}`;

/**
 * Ham TMDB veya liste kaydını oyun için tek tip medya modeline dönüştürür.
 * UI'nin beklediği id/type/title/posterPath/backdropPath alanları korunur;
 * ek olarak mediaKey, originalTitle, year, popularityBand ve sourceIds eklenir.
 */
function normalizeMediaItem(raw, sourceId) {
  const type =
    raw.type ||
    raw.media_type ||
    (raw.first_air_date || raw.firstAirDate ? "tv" : "movie");
  const localizedTitle = raw.title || raw.name || raw.localizedTitle || "";
  const originalTitle =
    raw.original_title || raw.original_name || raw.originalTitle || localizedTitle;
  // Part 22.1: TMDB localized title bos ise originalTitle fallback kullanilir;
  // boylece UI'da gosterilen baslik (title) hicbir zaman bos kalmaz.
  const displayTitle = localizedTitle || originalTitle;
  const year = String(
    raw.year ||
      raw.release_date ||
      raw.first_air_date ||
      raw.releaseDate ||
      raw.firstAirDate ||
      "",
  ).slice(0, 4);
  const genreIds =
    raw.genreIds || raw.genre_ids || (raw.genres ? raw.genres.map((g) => g.id) : []) || [];
  const popularity = Number(raw.popularity) || 0;
  return {
    mediaKey: mediaKeyOf(type, raw.id),
    id: raw.id,
    type,
    mediaType: type,
    title: displayTitle,
    localizedTitle,
    originalTitle,
    year,
    genreIds,
    popularity,
    popularityBand: popularityBandOf(popularity),
    posterPath: raw.posterPath || raw.poster_path || raw.imagePath || null,
    backdropPath: raw.backdropPath || raw.backdrop_path || null,
    sourceIds: sourceId ? [sourceId] : [],
  };
}

// ── TMDB API Helpers ─────────────────────────────────────────────────────────

/**
 * Belirtilen kaynaktan rastgele 3 sayfa çekerek geniş bir havuz oluşturur.
 */
export async function fetchTitlePool(apiKey, language = "tr", source = "popular") {
  const cacheKey = `${source}_${language}`;
  
  // Cache'de yeterince eleman varsa doğrudan onu kullan (oyun süresince cache şişerse temizlenebilir)
  if (titleCache.has(cacheKey) && titleCache.get(cacheKey).length > 20) {
    return titleCache.get(cacheKey);
  }

  const lang = language === "tr" ? "tr-TR" : "en-US";
  
  // Çoğu TMDB endpoint'inde ilk 500 sayfa kullanılabilir.
  // "trending" veya popüler listelerde 1 ile 50 arası sayfalar güvenlidir.
  const pagesToFetch = getRandomPages(3, 50);

  let url;
  switch (source) {
    case "trending":
      url = "https://api.themoviedb.org/3/trending/all/week";
      break;
    case "top_rated_movie":
      url = "https://api.themoviedb.org/3/movie/top_rated";
      break;
    case "top_rated_tv":
      url = "https://api.themoviedb.org/3/tv/top_rated";
      break;
    case "popular_movie":
      url = "https://api.themoviedb.org/3/movie/popular";
      break;
    case "popular_tv":
      url = "https://api.themoviedb.org/3/tv/popular";
      break;
    default: // "popular" — karışık trending
      url = "https://api.themoviedb.org/3/trending/all/week";
      break;
  }

  // Part 18.3: TMDB istegi cachedRead uzerinden yapilir. Online iken her
  // zaman taze sayfalar cekilir (cesitlilik tasarimin parcasi oldugu icin
  // TTL ile dondurulmez); cachedRead burada sadece "cevrimdisi/hata aninda
  // son bilinen havuza dus" rolunu ustlenir (Part 18.4). Basarili sonuc
  // ayrica diske yazilir ki internet kesilince antrenman modu mumkun olsun.
  const fetchFresh = async () => {
    const all = [];
    const requests = pagesToFetch.map((page) =>
      axios.get(url, { params: { language: lang, page }, headers: HEADERS(apiKey) })
    );
    const responses = await Promise.allSettled(requests);
    responses.forEach((res) => {
      if (res.status === "fulfilled" && res.value.data?.results) {
        res.value.data.results.forEach((r) => {
          // 10.1 adim 3: gorseli (backdrop) olmayan kayitlar elenir.
          if (!r.backdrop_path) return;
          all.push(normalizeMediaItem(r, source));
        });
      }
    });
    if (all.length === 0) {
      throw Object.assign(new Error("TMDB title pool fetch returned no items"), {
        code: "empty_pool_fetch",
      });
    }

    // Benzersiz olanları filtrele ve eskilerle birleştir (bellek ici cache).
    const existing = titleCache.get(cacheKey) || [];
    const merged = [...existing, ...all];
    const seen = new Set();
    const unique = merged.filter((item) => {
      const key = `${item.type}_${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    titleCache.set(cacheKey, unique);
    return unique;
  };

  try {
    // forceRefresh: true -> online iken her zaman taze sayfalar cekilir
    // (havuz cesitliligi tasarimin parcasidir, TTL ile dondurulmaz). maxAge
    // burada sadece poolMaxAge(...) ile uyumlu kalsin diye tutulur; gercek
    // davranis cevrimdisi/hata durumunda son basarili sonuca dusmektir
    // (Part 18.4 cevrimdisi davranis).
    const { data } = await cachedRead(
      GAME_CACHE_NS,
      poolCacheKey(source, language),
      fetchFresh,
      { forceRefresh: true, fallbackToCache: true },
    );
    if (Array.isArray(data) && data.length > 0) {
      titleCache.set(cacheKey, data);
      return data;
    }
  } catch (error) {
    if (__DEV__) console.warn("fetchTitlePool error", error);
  }

  // cachedRead disk cache'inde de veri yoksa (ilk kez cevrimdisi acilis vb.)
  // bellek ici cache varsa onu kullan, yoksa bos dondur.
  return titleCache.get(cacheKey) || [];
}

/**
 * Kullanıcının izleme listesinden başlık havuzu oluşturur (normalize edilmiş).
 * Görseli olmayan kayıtlar elenir (Part 10.1 adım 3).
 */
export function buildWatchlistPool(watchList, sourceId) {
  if (!Array.isArray(watchList) || watchList.length === 0) return [];
  return watchList
    .filter((item) => item.imagePath || item.posterPath || item.backdropPath)
    .map((item) => normalizeMediaItem(item, sourceId));
}

/**
 * Detayları çekip `append_to_response=images` kullanarak backdrops resimlerini getirir.
 * Zorluğa göre sahne tanınırlığını ayarlar (Part 9):
 *   - easy  : en tanınır kareler (TMDB sıralamasında baştakiler).
 *   - normal: ana veya ikincil sahne.
 *   - hard  : daha az bilinen, sondaki sahneler.
 * TMDB backdrop listesi kabaca oy/popülerliğe göre sıralı olduğundan index
 * büyüdükçe sahne daha az tanınır olur.
 */
export async function getDetailedSceneImage(apiKey, item, language = "tr", difficulty = "normal") {
  try {
    const res = await axios.get(
      `https://api.themoviedb.org/3/${item.type}/${item.id}`,
      {
        params: {
          append_to_response: "images",
          include_image_language: "null", // Yazısız orjinal arka planları getirir
        },
        headers: HEADERS(apiKey),
      }
    );

    const backdrops = res.data?.images?.backdrops || [];

    if (backdrops.length > 0) {
      // Kalite kontrolü (Part 10.4): yeterli genişlik, yazısız (logo/başlık
      // içermeyen, iso_639_1 === null) ve ~16:9 en-boy oranı tercih edilir.
      // Aşırı karanlık/boş görsel tespiti istemcide metadata ile güvenilir
      // yapılamadığından bu fazda uygulanmadı.
      const isQuality = (b) =>
        b.width >= 1280 &&
        b.iso_639_1 === null &&
        b.aspect_ratio >= 1.6 &&
        b.aspect_ratio <= 2.0;
      const validBackdrops = backdrops.filter(isQuality);

      const pool = validBackdrops.length > 0 ? validBackdrops : backdrops;

      // Birden fazla görsel varsa zorluğa göre tanınırlık aralığı seçilir.
      if (pool.length > 1) {
        const last = pool.length - 1;
        let minIndex;
        let maxIndex;
        if (difficulty === "easy") {
          minIndex = 0;
          maxIndex = Math.min(2, last);
        } else if (difficulty === "hard") {
          minIndex = Math.min(3, last);
          maxIndex = last;
        } else {
          minIndex = Math.min(1, last);
          maxIndex = last;
        }
        const randomIndex = randomInt(minIndex, maxIndex);
        const mainImage = pool[randomIndex].file_path;
        // Diğer resimleri ipucu (hint) olarak ayır
        const hints = pool.filter((_, idx) => idx !== randomIndex).map(b => b.file_path);

        // Çok fazla resmi sınırla (maks 5 ipucu)
        return { mainImage, hints: hints.slice(0, 5) };
      }
      return { mainImage: pool[0].file_path, hints: [] };
    }
  } catch (error) {
    // API hatası olursa varsayılan backdrop döneriz
  }
  return { mainImage: item.backdropPath, hints: [] };
}

// ── Akıllı Soru Üretimi ──────────────────────────────────────────────────────

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const sharesGenre = (item, correctGenres) => {
  if (!item.genreIds) return false;
  // Anime (Animasyon ID 16) özel kontrolü: Anime soruluyorsa anime gelme ihtimalini artır
  if (correctGenres.has(16) && item.genreIds.includes(16)) return true;
  return item.genreIds.some((gId) => correctGenres.has(gId));
};

// Franchise / dil varyantı tespiti için başlık normalizasyonu (Part 10.3).
const TITLE_STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "le", "la", "les", "el", "los", "der", "die", "das", "il",
]);

const normalizeTitle = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Aynı serinin (franchise) ilk anlamlı kelimesi; "Harry Potter ..." → "harry".
const franchiseKey = (t) => {
  const words = normalizeTitle(t).split(" ").filter((w) => w && !TITLE_STOPWORDS.has(w));
  return words[0] && words[0].length >= 4 ? words[0] : null;
};

/**
 * Zorluğa göre yanlış şıkları seçer (Part 9 + 10.3 sinyalleri):
 *   - Aynı mediaType tercih edilir (film sorusuna film şıkları).
 *   - Aynı isim (dil varyantı) ve aynı franchise şıklar elenir.
 *   - easy  : daha farklı türlerden (ayırt etmesi kolay).
 *   - normal: benzer türlerden.
 *   - hard  : aynı tür + yakın yıl + benzer popülerlik bandı (en zorlayıcı).
 * Şıklar benzersiz görünen başlıklara sahip olur; havuz küçükse kural gevşetilir.
 */
function getSmartOptions(pool, correctItem, count = 3, difficulty = "normal") {
  const correctGenres = new Set(correctItem.genreIds || []);
  const correctNorm = normalizeTitle(correctItem.title);
  const correctFranchise = franchiseKey(correctItem.title);

  const otherItems = pool.filter(
    (item) => item.id !== correctItem.id || item.type !== correctItem.type,
  );

  // Aynı isim (dil varyantı) ve aynı franchise yapımları doğru cevaba karşı ele.
  const baseAll = otherItems.filter((item) => {
    const norm = normalizeTitle(item.title);
    if (!norm || norm === correctNorm) return false;
    if (correctFranchise && franchiseKey(item.title) === correctFranchise) return false;
    return true;
  });

  // Aynı mediaType tercih edilir; yeterli değilse karışık havuza düşülür.
  const sameType = baseAll.filter((item) => item.type === correctItem.type);
  const typed = sameType.length >= count ? sameType : baseAll;

  let candidates;
  if (difficulty === "easy") {
    const different = typed.filter((item) => !sharesGenre(item, correctGenres));
    candidates = shuffle(different.length >= count ? different : typed);
  } else if (difficulty === "hard") {
    const sameGenre = typed.filter((item) => sharesGenre(item, correctGenres));
    const base = sameGenre.length >= count ? sameGenre : typed;
    const correctYear = parseInt(correctItem.year, 10) || null;
    const correctPop = Number(correctItem.popularity) || 0;
    const correctBand = correctItem.popularityBand ?? popularityBandOf(correctPop);
    const closeness = (item) => {
      const year = parseInt(item.year, 10) || null;
      const yearDiff = correctYear && year ? Math.abs(correctYear - year) : 18;
      const bandDiff = Math.abs((item.popularityBand ?? popularityBandOf(item.popularity)) - correctBand);
      const popDiff = Math.abs((Number(item.popularity) || 0) - correctPop) / (correctPop + 1);
      return yearDiff + bandDiff * 4 + popDiff * 6; // küçük = daha benzer = daha zor
    };
    candidates = shuffle(
      [...base].sort((a, b) => closeness(a) - closeness(b)).slice(0, Math.max(count * 3, count)),
    );
  } else {
    candidates = shuffle(typed.filter((item) => sharesGenre(item, correctGenres)));
  }

  // Başlıkları benzersiz tutarak seç (aynı isim/franchise tekrar etmesin).
  const chosen = [];
  const usedNorms = new Set([correctNorm]);
  const usedFranchises = new Set(correctFranchise ? [correctFranchise] : []);
  const tryAdd = (item) => {
    if (chosen.some((o) => o.id === item.id && o.type === item.type)) return;
    const norm = normalizeTitle(item.title);
    const fk = franchiseKey(item.title);
    if (usedNorms.has(norm)) return;
    if (fk && usedFranchises.has(fk)) return;
    chosen.push(item);
    usedNorms.add(norm);
    if (fk) usedFranchises.add(fk);
  };

  for (const item of candidates) {
    if (chosen.length >= count) break;
    tryAdd(item);
  }
  // Yetersizse benzersizlik koruyarak tüm uygun havuzdan tamamla.
  if (chosen.length < count) {
    for (const item of shuffle(baseAll)) {
      if (chosen.length >= count) break;
      tryAdd(item);
    }
  }
  // Hâlâ yetersizse (çok küçük havuz) benzersizlik kuralını gevşet.
  if (chosen.length < count) {
    for (const item of shuffle(otherItems)) {
      if (chosen.length >= count) break;
      if (!chosen.some((o) => o.id === item.id && o.type === item.type)) chosen.push(item);
    }
  }

  return chosen.slice(0, count);
}

// Aynı isimli şıklar varsa yıl bilgisi göster (Part 10.3).
function disambiguateOptionTitles(options) {
  const counts = new Map();
  for (const o of options) {
    const norm = normalizeTitle(o.title);
    counts.set(norm, (counts.get(norm) || 0) + 1);
  }
  for (const o of options) {
    if (counts.get(normalizeTitle(o.title)) > 1 && o.year) {
      o.title = `${o.title} (${o.year})`;
    }
  }
}

/**
 * Havuzdan benzersiz, akıllı ve optimize edilmiş bir soru üretir.
 * @param {number} optionCount Toplam şık sayısı (zorluğa göre 3 veya 4).
 * @returns {Promise<Object|null>} question = { correctItem, imagePath, options[], correctIndex }
 */
export async function generateQuestion(
  pool,
  apiKey,
  language = "tr",
  usedIds = new Set(),
  round = 1,
  optionCount = 4,
  difficulty = "normal",
) {
  // Şık sayısı kadar (en az 3) başlık gerekir.
  const totalOptions = Math.max(3, Math.min(Number(optionCount) || 4, 4));
  const wrongNeeded = totalOptions - 1;
  if (!pool || pool.length < totalOptions) return null;

  // Daha önce kullanılmamış başlıkları filtrele
  const available = pool.filter((item) => !usedIds.has(`${item.type}_${item.id}`));
  // Yalnizca dogru cevap yeni olmak zorunda. Yanlis secenekler tum havuzdan
  // uretildigi icin son dort kayda gelince oyunu erken bitirme.
  if (available.length < 1) return null;

  // Doğru cevabı seç (rastgele)
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  let correctItem = null;
  let imagePath = null;
  let hints = [];

  // Uygun bir resim bulana kadar dene (çok beklememek için max 3 deneme)
  for (let i = 0; i < Math.min(3, shuffled.length); i++) {
    const candidate = shuffled[i];
    const fetchedImageObj = await getDetailedSceneImage(apiKey, candidate, language, difficulty);
    if (fetchedImageObj && fetchedImageObj.mainImage) {
      correctItem = candidate;
      imagePath = fetchedImageObj.mainImage;
      hints = fetchedImageObj.hints;
      break;
    }
  }

  // Eğer detaylı resim bulunamazsa fallback olarak backdrop_path olan ilkini al
  if (!correctItem) {
    correctItem = shuffled.find(c => c.backdropPath);
    if (!correctItem) return null;
    imagePath = correctItem.backdropPath;
    hints = [];
  }

  // Akıllı şıkları getir (zorluğa göre)
  const wrongOptions = getSmartOptions(pool, correctItem, wrongNeeded, difficulty);
  if (wrongOptions.length < wrongNeeded) return null;

  // Şıkları klonla (cache'deki havuz nesnelerini bozmadan başlık ayarlamak için)
  // ve karıştır; aynı isimli şıklarda yıl bilgisini göster (Part 10.3).
  const options = shuffle([correctItem, ...wrongOptions].map((o) => ({ ...o })));
  disambiguateOptionTitles(options);
  const correctIndex = options.findIndex(
    (o) => o.id === correctItem.id && o.type === correctItem.type,
  );

  return {
    correctItem: options[correctIndex],
    imagePath,
    hints,
    options,
    correctIndex,
  };
}

// ── Firebase Skor & Geçmiş ──────────────────────────────────────────────────

const GAME_DOC_PATH = "SceneGame";
const GAME_HISTORY_DOC_PATH = "SceneGameHistory";
const MAX_QUESTION_HISTORY = 500;
const MAX_RECENT_SESSION_IDS = 100;

// ── Part 16 - Firestore Veri Modeli (additive yeni model) ───────────────────
// Eski SceneGame/{uid} ve SceneGameHistory/{uid} belgeleri DEGISMEDEN, ayni
// transaction icinde yeni alt koleksiyonlara da yazilir:
//   Users/{uid}/gameProfile/summary
//   Users/{uid}/gameStats/{gameId}
//   Users/{uid}/gameSessions/{sessionId}
//   GameLeaderboards/{boardId}/entries/{uid}
// Lazy migration: yeni belge yoksa ve eski SceneGame belgesi varsa, ayni
// transaction icinde eski alanlardan turetilerek bir kez olusturulur (flag
// alani yerine "exists()" kontrolu ile — Notes/Reminders idiomu ile ayni).
const SCENE_GAME_ID = "scene";
const SCHEMA_VERSION = 1;

const gameProfileRef = (uid) => doc(db, "Users", uid, "gameProfile", "summary");
const gameStatsRef = (uid, gameId) => doc(db, "Users", uid, "gameStats", gameId);
const gameSessionsCol = (uid) => collection(db, "Users", uid, "gameSessions");

// boardId basitlestirilmis tutuldu (Part 16.4 dokumaninda onerilen tarih
// sezonlu/gunluk varyantlar Part 14.4 - sezon sistemi - kapsamindadir, bu
// fazda BILEREK uygulanmadi). Mod+zorluk kombinasyonu stabil bir boardId
// uretir; kisisel kaynak oturumlari (mevcut davranista oldugu gibi) hicbir
// boardId'ye yazilmaz.
const leaderboardBoardId = (modeId, difficultyId) =>
  `${SCENE_GAME_ID}_${modeId || "classic"}_${difficultyId || "normal"}`;
const leaderboardEntryRef = (boardId, uid) =>
  doc(db, "GameLeaderboards", boardId, "entries", uid);

/**
 * Eski SceneGame belgesinin alanlarindan yeni gameProfile/summary ve
 * gameStats/{gameId} belgelerini turetir (lazy migration). Sadece var olan
 * eski alanlar okunur; alan adlari saveGameScore'daki gercek isimlerle
 * birebir eslesir (totalXp, level, totalPlayed, totalCorrect, totalWrong,
 * bestScore, bestScoresByMode, bestStreak, totalJokersUsed, lastPlayedAt).
 */
function deriveProfileFromOldDoc(oldData, now) {
  const totalXp = Number(oldData?.totalXp) || 0;
  return {
    totalXp,
    level: Number(oldData?.level) || computeLevel(totalXp).level,
    weeklyStreak: Number(oldData?.weeklyStreak) || 0,
    lastPlayedAt: oldData?.lastPlayedAt || now,
    totalSessions: Number(oldData?.totalPlayed) || 0,
    totalCorrect: Number(oldData?.totalCorrect) || 0,
    totalWrong: Number(oldData?.totalWrong) || 0,
    achievementsCount: Number(oldData?.achievementsCount) || 0,
    schemaVersion: SCHEMA_VERSION,
  };
}

function deriveStatsFromOldDoc(oldData, now) {
  return {
    bestScoresByMode:
      oldData?.bestScoresByMode && typeof oldData.bestScoresByMode === "object"
        ? oldData.bestScoresByMode
        : {},
    bestStreak: Number(oldData?.bestStreak) || 0,
    totalSessions: Number(oldData?.totalPlayed) || 0,
    totalQuestions:
      (Number(oldData?.totalCorrect) || 0) + (Number(oldData?.totalWrong) || 0),
    totalCorrect: Number(oldData?.totalCorrect) || 0,
    totalWrong: Number(oldData?.totalWrong) || 0,
    totalAnswerTimeMs: 0, // eski belgede yok; yeni oturumlardan birikecek.
    jokerUsage: Number(oldData?.totalJokersUsed) || 0,
    sourceStats: {},
    difficultyStats: {},
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  };
}

const normalizeHistoryScope = (scope) =>
  String(scope || "popular")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);

export async function loadGameData(uid) {
  try {
    const ref = doc(db, GAME_DOC_PATH, uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    return null;
  } catch {
    return null;
  }
}

/**
 * Part 16 dual-read: yeni Users/{uid}/gameProfile/summary belgesini tercih
 * eder; yoksa eski SceneGame/{uid} belgesinden ayni sekli (shape) uretir.
 * Hicbir yazim yapmaz (migration sadece saveGameScore icindeki transaction'da
 * olur); bu fonksiyon salt okunur bir fallback'tir.
 */
export async function loadGameProfile(uid) {
  try {
    const snap = await getDoc(gameProfileRef(uid));
    if (snap.exists()) return snap.data();
  } catch {
    // yeni belge okunamadi (kurallar henuz deploy edilmemis olabilir) — eski belgeye dus.
  }
  const oldData = await loadGameData(uid);
  if (!oldData) return null;
  return deriveProfileFromOldDoc(oldData, oldData.updatedAt || new Date().toISOString());
}

/**
 * Part 16 dual-read: yeni Users/{uid}/gameStats/{gameId} belgesini tercih
 * eder; yoksa eski SceneGame/{uid} belgesinden ayni sekli uretir.
 */
export async function loadGameStats(uid, gameId = SCENE_GAME_ID) {
  try {
    const snap = await getDoc(gameStatsRef(uid, gameId));
    if (snap.exists()) return snap.data();
  } catch {
    // yeni belge okunamadi — eski belgeye dus.
  }
  const oldData = await loadGameData(uid);
  if (!oldData) return null;
  return deriveStatsFromOldDoc(oldData, oldData.updatedAt || new Date().toISOString());
}

export async function saveGameScore(uid, gameData) {
  try {
    // Skor guvenligi (Part 17.3): backend olmadigi icin liderlik "dogrulanmamis"
    // kabul edilir; bariz imkansiz/bozuk degerler transaction'a girmeden elenir.
    const validation = validateSessionResult({
      score: Number(gameData.score) || 0,
      totalCorrect: Number(gameData.totalCorrect) || 0,
      totalWrong: Number(gameData.totalWrong) || 0,
      bestStreak: Number(gameData.bestStreak) || 0,
      modeQuestionCount: gameData.modeQuestionCount || null,
      difficultyMultiplier: gameData.difficultyMultiplier || 1,
      timerType: gameData.timerType || "per_question",
      totalSeconds: gameData.totalSeconds || 0,
    });
    if (!validation.ok) {
      if (__DEV__) {
        console.warn("saveGameScore rejected: anomalous session", validation.reason, gameData);
      }
      return { rejected: true, reason: validation.reason };
    }

    const ref = doc(db, GAME_DOC_PATH, uid);
    const now = new Date().toISOString();
    const sessionId = String(gameData.sessionId || "").trim();

    // Part 16: yeni model belge referanslari. Hepsi AYNI transaction icinde
    // okunup yazilir; eski SceneGame yazimi ile yeni belgeler arasinda
    // kismi (partial) yazim riski olmamasi icin tum get() cagrilari ilk
    // once (Firestore transaction kurali: once oku, sonra yaz), tum set()
    // cagrilari sonra yapilir.
    const profileRef = gameProfileRef(uid);
    const statsRef = gameStatsRef(uid, SCENE_GAME_ID);
    const modeIdForBoard = gameData.modeId || "classic";
    const difficultyIdForBoard = gameData.difficultyId || "normal";
    const isPersonalForBoard = Boolean(gameData.isPersonal);
    const boardId = leaderboardBoardId(modeIdForBoard, difficultyIdForBoard);
    // Kisisel liste oyunlari hicbir leaderboard board'una yazilmaz (Part 8.5
    // ile ayni davranis korunur).
    const leaderboardRef = isPersonalForBoard ? null : leaderboardEntryRef(boardId, uid);

    const result = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      const existing = snap.exists() ? snap.data() : {};
      const recentSessionIds = Array.isArray(existing.recentSessionIds)
        ? existing.recentSessionIds
        : [];

      if (sessionId && recentSessionIds.includes(sessionId)) {
        return { ...existing, duplicate: true, newRecord: false };
      }

      // Lazy migration kontrolu (Notes/Reminders idiomu ile ayni: flag alani
      // yerine exists() kontrolu). Yeni belgeler yoksa eski SceneGame
      // belgesinden (snap, yukarida zaten okundu) turetilir.
      const profileSnap = await transaction.get(profileRef);
      const statsSnap = await transaction.get(statsRef);
      const profileExists = profileSnap.exists();
      const statsExists = statsSnap.exists();
      let leaderboardSnap = null;
      if (leaderboardRef) leaderboardSnap = await transaction.get(leaderboardRef);

      const modeId = gameData.modeId || "classic";
      const difficultyId = gameData.difficultyId || "normal";
      const sessionScore = Number(gameData.score) || 0;

      // Global liderlik (bestScore) yalnizca Klasik + Normal + kisisel olmayan
      // kaynaktan beslenir; farkli mod/zorluk skorlari karsilastirilamadigi (Part
      // 9.4 / 11.2) ve kisisel liste oyunlari tabloya girmedigi (Part 8.5) icin
      // ayni tabloda karistirilmaz. Diger kombinasyonlar bestScoresByMode altinda
      // mod+zorluk bazinda ayri tutulur.
      const isRanked =
        modeId === "classic" && difficultyId === "normal" && !gameData.isPersonal;
      const modeKey = `${modeId}_${difficultyId}`;
      // Bu oturum, bu mod+zorluk kombinasyonunun onceki rekorunu gecti mi (Part 13.1).
      const previousModeBest = Number(existing.bestScoresByMode?.[modeKey]) || 0;
      const newRecord = sessionScore > previousModeBest;
      const bestScoresByMode = {
        ...(existing.bestScoresByMode && typeof existing.bestScoresByMode === "object"
          ? existing.bestScoresByMode
          : {}),
      };
      bestScoresByMode[modeKey] = Math.max(
        Number(bestScoresByMode[modeKey]) || 0,
        sessionScore,
      );

      const data = {
        score: sessionScore,
        bestScore: isRanked
          ? Math.max(
              Number(existing.bestScore) || 0,
              sessionScore,
              Number(gameData.bestScore) || 0,
            )
          : Number(existing.bestScore) || 0,
        bestScoresByMode,
        bestStreak: Math.max(
          Number(existing.bestStreak) || 0,
          Number(gameData.bestStreak) || 0,
        ),
        totalCorrect:
          (Number(existing.totalCorrect) || 0) +
          (Number(gameData.totalCorrect) || 0),
        totalWrong:
          (Number(existing.totalWrong) || 0) +
          (Number(gameData.totalWrong) || 0),
        totalPlayed: (Number(existing.totalPlayed) || 0) + 1,
        // XP/seviye: skordan bagimsiz kalici ilerleme (Part 11.3).
        totalXp: (Number(existing.totalXp) || 0) + (Number(gameData.xpEarned) || 0),
        totalJokersUsed:
          (Number(existing.totalJokersUsed) || 0) + (Number(gameData.jokerCount) || 0),
        lastPlayedAt: gameData.lastPlayedAt || now,
        updatedAt: now,
        lastModeId: gameData.modeId || existing.lastModeId || "classic",
        lastDifficultyId:
          gameData.difficultyId || existing.lastDifficultyId || "normal",
        lastSourceId: gameData.sourceId || existing.lastSourceId || "popular",
        recentSessionIds: sessionId
          ? [...recentSessionIds, sessionId].slice(-MAX_RECENT_SESSION_IDS)
          : recentSessionIds,
      };

      // Toplam XP'den seviye turetilir (Part 11.3 / 15.1).
      data.level = computeLevel(data.totalXp).level;

      if (!snap.exists()) data.createdAt = now;
      if (gameData.displayName) data.displayName = gameData.displayName;
      if (gameData.avatarIndex !== undefined) data.avatarIndex = gameData.avatarIndex;

      transaction.set(ref, data, { merge: true });

      // ── Part 16.1: Users/{uid}/gameProfile/summary (lazy migration + guncelle) ──
      const profileBase = profileExists
        ? profileSnap.data()
        : deriveProfileFromOldDoc(existing, now);
      const profileData = {
        ...profileBase,
        totalXp: data.totalXp,
        level: data.level,
        lastPlayedAt: data.lastPlayedAt,
        totalSessions: (Number(profileBase.totalSessions) || 0) + 1,
        totalCorrect:
          (Number(profileBase.totalCorrect) || 0) + (Number(gameData.totalCorrect) || 0),
        totalWrong:
          (Number(profileBase.totalWrong) || 0) + (Number(gameData.totalWrong) || 0),
        achievementsCount: Number(profileBase.achievementsCount) || 0,
        schemaVersion: SCHEMA_VERSION,
      };
      transaction.set(profileRef, profileData, { merge: true });

      // ── Part 16.2: Users/{uid}/gameStats/{gameId} (lazy migration + guncelle) ──
      const statsBase = statsExists
        ? statsSnap.data()
        : deriveStatsFromOldDoc(existing, now);
      const sourceId = gameData.sourceId || "popular";
      const sourceStats = {
        ...(statsBase.sourceStats && typeof statsBase.sourceStats === "object"
          ? statsBase.sourceStats
          : {}),
      };
      sourceStats[sourceId] = (Number(sourceStats[sourceId]) || 0) + 1;
      const difficultyStats = {
        ...(statsBase.difficultyStats && typeof statsBase.difficultyStats === "object"
          ? statsBase.difficultyStats
          : {}),
      };
      difficultyStats[difficultyIdForBoard] =
        (Number(difficultyStats[difficultyIdForBoard]) || 0) + 1;
      const responseMsTotal = Number(gameData.totalAnswerTimeMs) || 0;
      const statsData = {
        bestScoresByMode,
        bestStreak: Math.max(
          Number(statsBase.bestStreak) || 0,
          Number(gameData.bestStreak) || 0,
        ),
        totalSessions: (Number(statsBase.totalSessions) || 0) + 1,
        totalQuestions:
          (Number(statsBase.totalQuestions) || 0) +
          (Number(gameData.totalCorrect) || 0) +
          (Number(gameData.totalWrong) || 0),
        totalCorrect:
          (Number(statsBase.totalCorrect) || 0) + (Number(gameData.totalCorrect) || 0),
        totalWrong:
          (Number(statsBase.totalWrong) || 0) + (Number(gameData.totalWrong) || 0),
        totalAnswerTimeMs: (Number(statsBase.totalAnswerTimeMs) || 0) + responseMsTotal,
        jokerUsage: (Number(statsBase.jokerUsage) || 0) + (Number(gameData.jokerCount) || 0),
        sourceStats,
        difficultyStats,
        updatedAt: now,
        schemaVersion: SCHEMA_VERSION,
      };
      transaction.set(statsRef, statsData, { merge: true });

      // ── Part 16.3: Users/{uid}/gameSessions/{sessionId} (yeni belge, her oturum) ──
      // Firestore auto-id yerine mevcut benzersiz sessionId (useSceneGame.js'de
      // uretiliyor) belge id'si olarak kullanilir: hem dogal olarak idempotent
      // (ayni id ikinci kez set edilirse veri kaybi olmaz, sadece merge olur),
      // hem de ayri bir auto-id uretmeye gerek kalmaz.
      if (sessionId) {
        const sessionRef = doc(gameSessionsCol(uid), sessionId);
        transaction.set(
          sessionRef,
          {
            gameId: SCENE_GAME_ID,
            modeId: modeIdForBoard,
            difficultyId: difficultyIdForBoard,
            sourceId,
            startedAt: gameData.startedAt || null,
            completedAt: now,
            status: gameData.outcome || "completed",
            score: sessionScore,
            correctCount: Number(gameData.totalCorrect) || 0,
            wrongCount: Number(gameData.totalWrong) || 0,
            averageAnswerMs: Number(gameData.averageAnswerMs) || 0,
            bestStreak: Number(gameData.bestStreak) || 0,
            jokerUsage: Number(gameData.jokerCount) || 0,
            gameVersion: Number(gameData.gameVersion) || 1,
            resultHash: sessionId,
            schemaVersion: SCHEMA_VERSION,
          },
          { merge: true },
        );
      }

      // ── Part 16.4: GameLeaderboards/{boardId}/entries/{uid} ──
      // Eski leaderboard mekanizmasi (SceneGame.bestScore + fetchLeaderboard
      // orderBy bestScore) DEGISTIRILMEDI/KALDIRILMADI; bu sadece ek bir yazimdir.
      // verified: false her zaman (Part 17 bulgusu: backend yok, dogrulama
      // yapilamiyor).
      if (leaderboardRef) {
        const prevEntry = leaderboardSnap?.exists() ? leaderboardSnap.data() : {};
        const prevBest = Number(prevEntry.score) || 0;
        if (sessionScore >= prevBest) {
          transaction.set(
            leaderboardRef,
            {
              uid,
              displayNameSnapshot: gameData.displayName || prevEntry.displayNameSnapshot || null,
              avatarIndexSnapshot:
                gameData.avatarIndex !== undefined
                  ? gameData.avatarIndex
                  : prevEntry.avatarIndexSnapshot ?? null,
              score: sessionScore,
              correctCount: Number(gameData.totalCorrect) || 0,
              totalAnswerMs: responseMsTotal,
              jokerCount: Number(gameData.jokerCount) || 0,
              achievedAt: now,
              verified: false,
              gameVersion: Number(gameData.gameVersion) || 1,
              schemaVersion: SCHEMA_VERSION,
            },
            { merge: true },
          );
        }
      }

      return { ...existing, ...data, duplicate: false, newRecord };
    });

    // Oyun oturumu tamamlandı. Tekrar (duplicate) yazımları saymıyoruz;
    // aynı sessionId ile ikinci çağrı oturum sayısını şişirirdi.
    if (result && !result.duplicate) {
      trackEvent(ANALYTICS_EVENTS.GAME_PLAYED, {
        mode: gameData.modeId || null,
        difficulty: gameData.difficultyId || null,
        source: gameData.sourceId || null,
        score: Number(gameData.score) || 0,
        correct_count: Number(gameData.totalCorrect) || 0,
        wrong_count: Number(gameData.totalWrong) || 0,
        best_streak: Number(gameData.bestStreak) || 0,
        joker_count: Number(gameData.jokerCount) || 0,
        outcome: gameData.outcome || "completed",
        new_record: !!result.newRecord,
      });
    }

    return result;
  } catch (e) {
    if (__DEV__) console.warn("saveGameScore error:", e?.message);
    return null;
  }
}

export async function saveQuestionHistory(uid, answeredItems, scope = "popular") {
  try {
    const ref = doc(db, GAME_HISTORY_DOC_PATH, uid);
    const historyScope = normalizeHistoryScope(scope);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      const existing = snap.exists() ? snap.data() : {};
      const historyBySource = existing.historyBySource || {};
      const current = Array.isArray(historyBySource[historyScope])
        ? historyBySource[historyScope]
        : [];
      const merged = [...new Set([...current, ...(answeredItems || [])])].slice(
        -MAX_QUESTION_HISTORY,
      );

      transaction.set(
        ref,
        {
          historyBySource: { ...historyBySource, [historyScope]: merged },
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    });
    return true;
  } catch (e) {
    if (__DEV__) console.warn("saveQuestionHistory error:", e?.message);
    return false;
  }
}

export async function loadQuestionHistory(uid, scope = "popular") {
  try {
    const ref = doc(db, GAME_HISTORY_DOC_PATH, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const historyScope = normalizeHistoryScope(scope);
    return snap.data()?.historyBySource?.[historyScope] || [];
  } catch {
    return [];
  }
}

export async function fetchLeaderboard(limitCount = 50) {
  try {
    const q = query(
      collection(db, GAME_DOC_PATH),
      orderBy("bestScore", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const results = [];
    snap.forEach((doc) => {
      results.push({ uid: doc.id, ...doc.data() });
    });
    return results;
  } catch (e) {
    if (__DEV__) console.warn("fetchLeaderboard error:", e?.message);
    throw e;
  }
}
