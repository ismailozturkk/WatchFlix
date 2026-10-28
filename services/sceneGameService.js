// services/sceneGameService.js
//
// Sahne Tahmin Oyunu — Optimize Edilmiş TMDB API servisi
// Popüler başlıkları rastgele sayfalardan çeker, zorlaştırılmış sahne görselleri alır,
// türe göre akıllı şıklar üretir ve Firebase işlemlerini yönetir.

import { tmdbLanguageOf } from "../utils/appLanguages";
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
import { createStableSource, randomSource } from "../utils/seededRandom";
import {
  dailyBoardId,
  dailySeed,
  dayKeyOf,
  nextStreak,
} from "../utils/dailyChallenge";
import {
  distillImages,
  maxPageForSource,
  pickSceneImage,
  pickTextlessPoster,
  pickWeightedPages,
  weightedOrder,
} from "../utils/gameSelection";

// ── Cache ────────────────────────────────────────────────────────────────────
// Bellek ici cache: ayni oturumda tekrar tekrar API istegi yapmayi onler.
// Havuz, kaynak+dil basina BUYUR: her oyunda yeni sayfalar eklenir, cekilmis
// sayfalar (`pages`) tekrar istenmez.
const poolState = new Map(); // `${source}_${language}` -> { items: [], pages: Set<number> }

// Yapim basina gorsel listesi (sahne + afis ayni istekten). Promise saklanir:
// ayni yapim icin es zamanli iki istek tek aga duser. LRU, en cok IMAGES_CACHE_MAX.
const imagesCache = new Map(); // mediaKey -> Promise<{backdrops, posters}|null>
const IMAGES_CACHE_MAX = 400;
const TMDB_TIMEOUT_MS = 10000;

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
    // Oy sayisi "herkes izlemis mi"nin kalici gostergesi (popularity gunluk
    // dalgalanir); bilindik yapimlari one cikarmak icin (utils/gameSelection).
    voteCount: Number(raw.vote_count ?? raw.voteCount) || 0,
    posterPath: raw.posterPath || raw.poster_path || raw.imagePath || null,
    backdropPath: raw.backdropPath || raw.backdrop_path || null,
    sourceIds: sourceId ? [sourceId] : [],
  };
}

// ── TMDB API Helpers ─────────────────────────────────────────────────────────

const POOL_ENDPOINTS = {
  trending: "https://api.themoviedb.org/3/trending/all/week",
  top_rated_movie: "https://api.themoviedb.org/3/movie/top_rated",
  top_rated_tv: "https://api.themoviedb.org/3/tv/top_rated",
  popular_movie: "https://api.themoviedb.org/3/movie/popular",
  popular_tv: "https://api.themoviedb.org/3/tv/popular",
};
// "popular" — karisik trending (varsayilan)
const poolEndpointOf = (source) => POOL_ENDPOINTS[source] || POOL_ENDPOINTS.trending;

const POOL_PAGES_PER_FETCH = 3;
// Havuzda oyuncunun HENUZ gormedigi en az bu kadar yapim olmali; azsa yeni
// sayfalar cekilir (eskiden gecmis havuzu kapladiginda gecmis tamamen siliniyor,
// ayni 60 yapim yeniden donuyordu).
const POOL_MIN_FRESH = 30;
const POOL_MAX_TOPUP_ROUNDS = 2;
const POOL_MAX_ITEMS = 400;

const mergePoolItems = (existing, incoming) => {
  const byKey = new Map();
  existing.forEach((item) => byKey.set(item.mediaKey || mediaKeyOf(item.type, item.id), item));
  incoming.forEach((item) => {
    if (!byKey.has(item.mediaKey)) byKey.set(item.mediaKey, item);
  });
  const merged = Array.from(byKey.values());
  return merged.length > POOL_MAX_ITEMS ? merged.slice(merged.length - POOL_MAX_ITEMS) : merged;
};

const countFresh = (items, seen) => {
  if (!seen || seen.size === 0) return items.length;
  let fresh = 0;
  for (const item of items) {
    if (!seen.has(`${item.type}_${item.id}`)) fresh += 1;
  }
  return fresh;
};

/**
 * Belirtilen kaynaktan baslik havuzu. Sayfalar ilk sayfalara dogru AGIRLIKLI
 * secilir (utils/gameSelection#pickWeightedPages): sondaki sayfalar cok az
 * kisinin taniyacagi yapimlar getiriyordu.
 *
 * Havuz oturum boyunca BUYUR. Yeterince taze (oyuncunun gormedigi) yapim varsa
 * hic ag istegi yapmadan bellekten doner; azsa yalnizca daha once cekilmemis
 * yeni sayfalar eklenir.
 *
 * @param {object} [opts]
 * @param {Set<string>} [opts.seen] Oyuncunun gecmisteki `${type}_${id}` anahtarlari.
 */
export async function fetchTitlePool(apiKey, language = "tr", source = "popular", { seen } = {}) {
  const cacheKey = `${source}_${language}`;
  const state = poolState.get(cacheKey) || { items: [], pages: new Set() };
  poolState.set(cacheKey, state);

  if (state.items.length > 20 && countFresh(state.items, seen) >= POOL_MIN_FRESH) {
    return state.items;
  }

  const lang = tmdbLanguageOf(language);
  const url = poolEndpointOf(source);
  const maxPage = maxPageForSource(source);

  // Part 18.3: TMDB istegi cachedRead uzerinden yapilir. Online iken her zaman
  // taze sayfalar cekilir (cesitlilik tasarimin parcasi oldugu icin TTL ile
  // dondurulmez); cachedRead burada sadece "cevrimdisi/hata aninda son bilinen
  // havuza dus" rolunu ustlenir (Part 18.4). Basarili sonuc diske yazilir ki
  // internet kesilince antrenman modu mumkun olsun.
  const fetchFresh = async () => {
    for (let round = 0; round < POOL_MAX_TOPUP_ROUNDS; round += 1) {
      const pages = pickWeightedPages(POOL_PAGES_PER_FETCH, maxPage, { exclude: state.pages });
      if (pages.length === 0) break;

      const responses = await Promise.allSettled(
        pages.map((page) =>
          axios.get(url, {
            params: { language: lang, page },
            headers: HEADERS(apiKey),
            timeout: TMDB_TIMEOUT_MS,
          }),
        ),
      );
      const incoming = [];
      responses.forEach((res, index) => {
        if (res.status !== "fulfilled" || !Array.isArray(res.value.data?.results)) return;
        state.pages.add(pages[index]);
        res.value.data.results.forEach((raw) => {
          // 10.1 adim 3: gorseli (backdrop) olmayan kayitlar elenir.
          if (!raw.backdrop_path) return;
          incoming.push(normalizeMediaItem(raw, source));
        });
      });
      state.items = mergePoolItems(state.items, incoming);
      if (countFresh(state.items, seen) >= POOL_MIN_FRESH) break;
    }
    if (state.items.length === 0) {
      throw Object.assign(new Error("TMDB title pool fetch returned no items"), {
        code: "empty_pool_fetch",
      });
    }
    return state.items;
  };

  try {
    const { data } = await cachedRead(
      GAME_CACHE_NS,
      poolCacheKey(source, language),
      fetchFresh,
      { forceRefresh: true, fallbackToCache: true },
    );
    if (Array.isArray(data) && data.length > 0) {
      // Cevrimdisi/hata aninda diskten gelen havuz bellege de alinir.
      if (data !== state.items) state.items = mergePoolItems(state.items, data);
      return state.items;
    }
  } catch (error) {
    if (__DEV__) console.warn("fetchTitlePool error", error);
  }

  // cachedRead disk cache'inde de veri yoksa (ilk kez cevrimdisi acilis vb.)
  // bellek ici havuz varsa onu kullan, yoksa bos dondur.
  return state.items;
}

const DAILY_POOL_MAX_AGE = 24 * 60 * 60 * 1000;
const dailyPoolCacheKey = (dayKey, language) => `scene:daily:${dayKey}:${language}:v1`;

/**
 * Günlük Meydan Okuma'nın sabit havuzu. Havuz TOHUMDAN türetilir (rastgele sayfa
 * yok): herkes aynı TMDB "en yüksek puanlı" sayfalarını okur ve havuz id'ye göre
 * sıralanır; soru üretimi de hash sıralamalı kaynakla (createStableSource)
 * yapıldığı için sonuç herkeste aynı çıkar.
 *
 * Sayfaların TAMAMI gelmezse HATA fırlatılır — eksik havuzla "biraz farklı"
 * sorular üretmek herkese aynı sorular vaadini sessizce bozardı. Gün içinde
 * bir kez başarıyla çekilen havuz önbellekten (cevrimdisi dahil) kullanılır.
 */
export async function fetchDailyPool(apiKey, language = "tr", dayKey = dayKeyOf()) {
  const pick = createStableSource(`${dailySeed(dayKey)}|pool`);
  // Ayrik araliklar → sayfalar birbirinden farkli olmak zorunda. Ilk 14 film
  // ve 9 dizi sayfasi (en yuksek puanlilar) → taninabilir yapimlar.
  const jobs = [
    { url: "https://api.themoviedb.org/3/movie/top_rated", page: pick.int(1, 6, "movie:a") },
    { url: "https://api.themoviedb.org/3/movie/top_rated", page: pick.int(7, 14, "movie:b") },
    { url: "https://api.themoviedb.org/3/tv/top_rated", page: pick.int(1, 4, "tv:a") },
    { url: "https://api.themoviedb.org/3/tv/top_rated", page: pick.int(5, 9, "tv:b") },
  ];
  const lang = tmdbLanguageOf(language);

  const fetchFresh = async () => {
    const responses = await Promise.all(
      jobs.map((job) =>
        axios.get(job.url, { params: { language: lang, page: job.page }, headers: HEADERS(apiKey) }),
      ),
    );
    const seen = new Set();
    const items = [];
    responses.forEach((res) => {
      (res.data?.results || []).forEach((raw) => {
        if (!raw.backdrop_path) return;
        const item = normalizeMediaItem(raw, "daily");
        if (seen.has(item.mediaKey)) return;
        seen.add(item.mediaKey);
        items.push(item);
      });
    });
    if (items.length < 20) {
      throw Object.assign(new Error("Daily pool is too small"), { code: "empty_pool_fetch" });
    }
    // Kanonik sira: TMDB'nin sayfa ici sirasi saatler icinde oynasa da ayni kalir.
    return items.sort((a, b) => (a.mediaKey < b.mediaKey ? -1 : a.mediaKey > b.mediaKey ? 1 : 0));
  };

  const { data } = await cachedRead(
    GAME_CACHE_NS,
    dailyPoolCacheKey(dayKey, language),
    fetchFresh,
    { maxAge: DAILY_POOL_MAX_AGE, fallbackToCache: true },
  );
  if (!Array.isArray(data) || data.length === 0) {
    throw Object.assign(new Error("Daily pool is unavailable"), { code: "empty_pool_fetch" });
  }
  return data;
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
 * Bir yapimin DILSIZ (iso_639_1 = null) gorselleri: sahne kareleri + afisler.
 * `/images` ucu, eski `/{type}/{id}?append_to_response=images` cagrisinin tum
 * detay govdesini tasimadan ayni listeyi verir; sahne ve afis oyunu AYNI istegi
 * paylasir. Sonuc bellekte saklanir (ayni yapim ikinci kez sorulmaz); hata
 * onbelleklenmez, sonraki denemede yeniden istenir.
 *
 * @returns {Promise<{backdrops:Array, posters:Array}|null>} ag hatasinda null
 */
export function fetchTitleImages(apiKey, item) {
  const key = mediaKeyOf(item.type, item.id);
  const hit = imagesCache.get(key);
  if (hit) {
    // LRU: en son kullanilan sona tasinir.
    imagesCache.delete(key);
    imagesCache.set(key, hit);
    return hit;
  }

  const promise = axios
    .get(`https://api.themoviedb.org/3/${item.type}/${item.id}/images`, {
      // Yazisiz (dilsiz) gorseller: ustunde baslik/slogan olmayanlar.
      params: { include_image_language: "null" },
      headers: HEADERS(apiKey),
      timeout: TMDB_TIMEOUT_MS,
    })
    .then((res) => distillImages(res.data))
    .catch(() => {
      if (imagesCache.get(key) === promise) imagesCache.delete(key);
      return null;
    });

  imagesCache.set(key, promise);
  if (imagesCache.size > IMAGES_CACHE_MAX) {
    imagesCache.delete(imagesCache.keys().next().value);
  }
  return promise;
}

/**
 * Sahne karesi. Zorluga gore tanirlik araligi utils/gameSelection#pickSceneImage'da:
 *   - easy  : en taninir kareler (TMDB siralamasinda bastakiler).
 *   - normal: ana veya ikincil sahne.
 *   - hard  : daha az bilinen, sondaki sahneler.
 * Gorsel listesi alinamazsa yapimin varsayilan arka plani kullanilir.
 */
export async function getDetailedSceneImage(
  apiKey,
  item,
  language = "tr",
  difficulty = "normal",
  source = randomSource,
) {
  const images = await fetchTitleImages(apiKey, item);
  const picked = images
    ? pickSceneImage(
        images.backdrops,
        difficulty,
        source,
        `image:${mediaKeyOf(item.type, item.id)}`,
      )
    : null;
  return picked || { mainImage: item.backdropPath, hints: [] };
}

/**
 * Yazisiz (basliksiz) afis. TMDB'de dilsiz afis her yapimda yoktur; yoksa null.
 * Eskiden varsayilan afis gosteriliyordu ve ustundeki baslik soruyu bir bakista
 * cozuyordu.
 */
export async function getTextlessPoster(apiKey, item, source = randomSource) {
  const images = await fetchTitleImages(apiKey, item);
  if (!images) return null;
  return pickTextlessPoster(images.posters, source, `poster:${mediaKeyOf(item.type, item.id)}`);
}

// Afis sorusunda adaylar sirayla degil GRUPLAR halinde sorulur: yazisiz afisi
// olmayan yapim cok oldugundan ard arda tek tek denemek soru basina birkac
// ag turu demekti. Grup icinde sira korunur (ilk uygun, agirlik sirasina gore).
const POSTER_PROBE_BATCH = 4;
const POSTER_PROBE_MAX = 20;

async function findTextlessPosterCandidate(apiKey, ordered, source) {
  const limitCount = Math.min(ordered.length, POSTER_PROBE_MAX);
  for (let start = 0; start < limitCount; start += POSTER_PROBE_BATCH) {
    const batch = ordered.slice(start, Math.min(start + POSTER_PROBE_BATCH, limitCount));
    const paths = await Promise.all(batch.map((item) => getTextlessPoster(apiKey, item, source)));
    const index = paths.findIndex(Boolean);
    if (index >= 0) return { item: batch[index], path: paths[index] };
  }
  return null;
}

// ── Akıllı Soru Üretimi ──────────────────────────────────────────────────────

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

// Havuz nesneleri oyun boyunca ayni kalir; normalizasyon (NFD + 3 regex) her
// soruda butun havuz icin yeniden calismasin diye nesne basina bir kez hesaplanir.
const titleMetaCache = new WeakMap();
const titleMetaOf = (item) => {
  let meta = titleMetaCache.get(item);
  if (!meta) {
    meta = { norm: normalizeTitle(item.title), franchise: franchiseKey(item.title) };
    titleMetaCache.set(item, meta);
  }
  return meta;
};

// Yanlis siklar dogru cevaptan daha az bilinen olursa "tanidigim tek baslik"
// ipucu verir; bu yuzden siklar da bilindik olanlara dogru agirliklanir, ama
// dogru cevaptan daha yumusak.
const DISTRACTOR_BIAS_FACTOR = 0.6;

/**
 * Zorluğa göre yanlış şıkları seçer (Part 9 + 10.3 sinyalleri):
 *   - Aynı mediaType tercih edilir (film sorusuna film şıkları).
 *   - Aynı isim (dil varyantı) ve aynı franchise şıklar elenir.
 *   - easy  : daha farklı türlerden (ayırt etmesi kolay).
 *   - normal: benzer türlerden.
 *   - hard  : aynı tür + yakın yıl + benzer popülerlik bandı (en zorlayıcı).
 * Şıklar benzersiz görünen başlıklara sahip olur; havuz küçükse kural gevşetilir.
 */
function getSmartOptions(
  pool,
  correctItem,
  count = 3,
  difficulty = "normal",
  source = randomSource,
  popularityBias = 0,
) {
  // Tuz: ayni dogru cevap icin her karistirma bagimsiz, ama stabil kaynakta
  // (gunluk) herkeste ayni olsun.
  const salt = `opt:${mediaKeyOf(correctItem.type, correctItem.id)}`;
  // bias 0 → source.shuffle (eski davranis, gunluk degismez); >0 → bilindik
  // yapimlar daha olasi.
  const shuffle = (list, tag) =>
    weightedOrder(list, source, `${salt}:${tag}`, popularityBias * DISTRACTOR_BIAS_FACTOR);
  const correctGenres = new Set(correctItem.genreIds || []);
  const { norm: correctNorm, franchise: correctFranchise } = titleMetaOf(correctItem);

  const otherItems = pool.filter(
    (item) => item.id !== correctItem.id || item.type !== correctItem.type,
  );

  // Aynı isim (dil varyantı) ve aynı franchise yapımları doğru cevaba karşı ele.
  const baseAll = otherItems.filter((item) => {
    const { norm, franchise } = titleMetaOf(item);
    if (!norm || norm === correctNorm) return false;
    if (correctFranchise && franchise === correctFranchise) return false;
    return true;
  });

  // Aynı mediaType tercih edilir; yeterli değilse karışık havuza düşülür.
  const sameType = baseAll.filter((item) => item.type === correctItem.type);
  const typed = sameType.length >= count ? sameType : baseAll;

  let candidates;
  if (difficulty === "easy") {
    const different = typed.filter((item) => !sharesGenre(item, correctGenres));
    candidates = shuffle(different.length >= count ? different : typed, "easy");
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
    // Skor aday basina BIR kez hesaplanir (siralama karsilastirmasinda her
    // seferinde yil ayristirip bant hesaplamaz).
    const scored = base.map((item) => ({ item, score: closeness(item) }));
    candidates = shuffle(
      scored
        .sort((a, b) => a.score - b.score)
        .slice(0, Math.max(count * 3, count))
        .map((entry) => entry.item),
      "hard",
    );
  } else {
    candidates = shuffle(typed.filter((item) => sharesGenre(item, correctGenres)), "normal");
  }

  // Başlıkları benzersiz tutarak seç (aynı isim/franchise tekrar etmesin).
  const chosen = [];
  const usedNorms = new Set([correctNorm]);
  const usedFranchises = new Set(correctFranchise ? [correctFranchise] : []);
  const tryAdd = (item) => {
    if (chosen.some((o) => o.id === item.id && o.type === item.type)) return;
    const { norm, franchise: fk } = titleMetaOf(item);
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
    for (const item of shuffle(baseAll, "fill")) {
      if (chosen.length >= count) break;
      tryAdd(item);
    }
  }
  // Hâlâ yetersizse (çok küçük havuz) benzersizlik kuralını gevşet.
  if (chosen.length < count) {
    for (const item of shuffle(otherItems, "relax")) {
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
 *
 * @param {number} optionCount Toplam şık sayısı (zorluğa göre 3 veya 4).
 * @param {object} [extra]
 * @param {object} [extra.source] Rastgelelik kaynağı (utils/seededRandom).
 *   Varsayılan her oyunda farklıdır; Günlük Meydan Okuma createStableSource
 *   verir ve herkeste aynı soru çıkar.
 * @param {"scene"|"poster"} [extra.kind] "poster": görsel olarak YAZISIZ (başlıksız)
 *   afiş döner, ipucu görseli yoktur; yazısız afişi olmayan yapımlar soru olmaz.
 *   "scene": TMDB sahne görseli.
 * @param {number} [extra.popularityBias] 0..1. Doğru cevap ve şıklar bilindik
 *   yapımlara doğru ağırlıklanır (0 = düz rastgele). Günlük Meydan Okuma ve kişisel
 *   listeler 0 verir: günlük sorular herkeste aynı kalmalı, kişisel liste zaten
 *   oyuncunun kendi seçimidir.
 * @returns {Promise<Object|null>} question =
 *   { correctItem, imagePath, hints, options[], correctIndex, kind }
 */
export async function generateQuestion(
  pool,
  apiKey,
  language = "tr",
  usedIds = new Set(),
  round = 1,
  optionCount = 4,
  difficulty = "normal",
  { source = randomSource, kind = "scene", popularityBias = 0 } = {},
) {
  // Şık sayısı kadar (en az 3) başlık gerekir.
  const totalOptions = Math.max(3, Math.min(Number(optionCount) || 4, 4));
  const wrongNeeded = totalOptions - 1;
  if (!pool || pool.length < totalOptions) return null;

  const isPoster = kind === "poster";
  // Daha önce kullanılmamış başlıkları filtrele (afiş oyununda afişi olmayan da elenir).
  const available = pool.filter(
    (item) => !usedIds.has(`${item.type}_${item.id}`) && (!isPoster || item.posterPath),
  );
  // Yalnizca dogru cevap yeni olmak zorunda. Yanlis secenekler tum havuzdan
  // uretildigi icin son dort kayda gelince oyunu erken bitirme.
  if (available.length < 1) return null;

  // Doğru cevabı seç. Tuz = tur numarası: stabil kaynakta her tur bağımsız ama
  // herkeste aynı kayıt çıkar.
  // bias > 0: bilindik yapimlar daha olasi (utils/gameSelection#weightedOrder).
  const shuffled = weightedOrder(available, source, `correct:${round}`, popularityBias);
  let correctItem = null;
  let imagePath = null;
  let hints = [];

  if (isPoster) {
    const found = await findTextlessPosterCandidate(apiKey, shuffled, source);
    // Yazisiz afisi olan aday yok: baslikli afis gostermek soruyu bir bakista
    // cozdurdugu icin soru uretilmez.
    if (!found) return null;
    correctItem = found.item;
    imagePath = found.path;
  } else {
    // Uygun bir resim bulana kadar dene (çok beklememek için max 3 deneme)
    for (let i = 0; i < Math.min(3, shuffled.length); i++) {
      const candidate = shuffled[i];
      const fetchedImageObj = await getDetailedSceneImage(apiKey, candidate, language, difficulty, source);
      if (fetchedImageObj && fetchedImageObj.mainImage) {
        correctItem = candidate;
        imagePath = fetchedImageObj.mainImage;
        hints = fetchedImageObj.hints;
        break;
      }
    }

    // Eğer detaylı resim bulunamazsa fallback olarak backdrop_path olan ilkini al
    if (!correctItem) {
      correctItem = shuffled.find((c) => c.backdropPath);
      if (!correctItem) return null;
      imagePath = correctItem.backdropPath;
      hints = [];
    }
  }

  // Akıllı şıkları getir (zorluğa göre)
  const wrongOptions = getSmartOptions(
    pool,
    correctItem,
    wrongNeeded,
    difficulty,
    source,
    popularityBias,
  );
  if (wrongOptions.length < wrongNeeded) return null;

  // Şıkları klonla (cache'deki havuz nesnelerini bozmadan başlık ayarlamak için)
  // ve karıştır; aynı isimli şıklarda yıl bilgisini göster (Part 10.3).
  const options = source.shuffle(
    [correctItem, ...wrongOptions].map((o) => ({ ...o })),
    `options:${round}`,
  );
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
    kind: isPoster ? "poster" : "scene",
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
// Afis oyunu kendi tahtalarina yazar ("poster_classic_normal"); sahne
// tahtalariyla (scene_*) karismaz.
const leaderboardBoardId = (modeId, difficultyId, isPoster = false) =>
  `${isPoster ? "poster" : SCENE_GAME_ID}_${modeId || "classic"}_${difficultyId || "normal"}`;
const POSTER_GAME_ID = "poster_puzzle";
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
    const isPoster = gameData.gameId === POSTER_GAME_ID;
    // Gunluk oturum: dailyKey, SORULARIN ait oldugu gundur (gece yarisini asan
    // oyun yine o gunun tahtasina yazilir).
    const dailyKey = gameData.modeId === "daily" ? String(gameData.dailyKey || "") : "";
    const isDaily = Boolean(dailyKey);
    const boardId = isDaily
      ? dailyBoardId(dailyKey)
      : leaderboardBoardId(modeIdForBoard, difficultyIdForBoard, isPoster);
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
        modeId === "classic" &&
        difficultyId === "normal" &&
        !gameData.isPersonal &&
        !isPoster;
      const modeKey = `${isPoster ? "poster_" : ""}${modeId}_${difficultyId}`;
      // Gunluk: ayni gun ikinci deneme "antrenman"dir; gunluk durumu, seriyi ve
      // tahtayi DEGISTIRMEZ (rekor/XP normal akar).
      const alreadyDoneDaily = isDaily && existing.dailyState?.dayKey === dailyKey;
      const countsAsDaily = isDaily && !alreadyDoneDaily;
      const todayKey = dayKeyOf(Date.now());
      const levelBefore = computeLevel(existing.totalXp).level;
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
        // Gunluk oyun "son tercih" sayilmaz: Hizli Oyna gunluk modu tekrar
        // baslatmaya calisirdi (tek deneme zaten bitmis olurdu).
        lastModeId: isDaily
          ? existing.lastModeId || "classic"
          : gameData.modeId || existing.lastModeId || "classic",
        lastDifficultyId: isDaily
          ? existing.lastDifficultyId || "normal"
          : gameData.difficultyId || existing.lastDifficultyId || "normal",
        lastSourceId: isDaily
          ? existing.lastSourceId || "popular"
          : gameData.sourceId || existing.lastSourceId || "popular",
        lastGameId: isPoster ? POSTER_GAME_ID : "scene_guess",
        // Kesintisiz oynama serisi (herhangi bir oyun, gun bazli).
        dayStreak: nextStreak(existing.dayStreak, existing.lastPlayDay, todayKey),
        lastPlayDay: todayKey,
        recentSessionIds: sessionId
          ? [...recentSessionIds, sessionId].slice(-MAX_RECENT_SESSION_IDS)
          : recentSessionIds,
      };

      // Toplam XP'den seviye turetilir (Part 11.3 / 15.1).
      data.level = computeLevel(data.totalXp).level;

      if (countsAsDaily) {
        data.dailyStreak = nextStreak(existing.dailyStreak, existing.lastDailyDay, dailyKey);
        data.lastDailyDay = dailyKey;
        data.bestDailyStreak = Math.max(Number(existing.bestDailyStreak) || 0, data.dailyStreak);
        data.totalDailyPlayed = (Number(existing.totalDailyPlayed) || 0) + 1;
        data.dailyState = {
          dayKey: dailyKey,
          score: sessionScore,
          correctCount: Number(gameData.totalCorrect) || 0,
          totalCount: (Number(gameData.totalCorrect) || 0) + (Number(gameData.totalWrong) || 0),
          outcome: gameData.outcome || "completed",
          xpEarned: Number(gameData.xpEarned) || 0,
          completedAt: now,
        };
      }

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
            gameId: isPoster ? "poster" : SCENE_GAME_ID,
            ...(isDaily ? { dailyKey } : {}),
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
      if (leaderboardRef && (!isDaily || countsAsDaily)) {
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
              photoURLSnapshot:
                gameData.photoURL !== undefined
                  ? gameData.photoURL || null
                  : prevEntry.photoURLSnapshot ?? null,
              score: sessionScore,
              bestStreak: Number(gameData.bestStreak) || 0,
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

      return { ...existing, ...data, duplicate: false, newRecord, levelBefore };
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

// ── Günlük tahta ─────────────────────────────────────────────────────────────
// GameLeaderboards/scene_daily_<gün>/entries/{uid} — saveGameScore yazar.
// Genel tablo (fetchLeaderboard) ile AYNI şekle çevrilir, böylece Liderlik
// ekranı iki kaynağı tek satır bileşeniyle çizer.
const dailyEntryToRow = (id, data) => ({
  uid: data.uid || id,
  displayName: data.displayNameSnapshot || null,
  avatarIndex: data.avatarIndexSnapshot ?? null,
  photoURL: data.photoURLSnapshot || null,
  bestScore: Number(data.score) || 0,
  totalCorrect: Number(data.correctCount) || 0,
  totalWrong: 0,
  bestStreak: Number(data.bestStreak) || 0,
  isDaily: true,
});

export async function fetchDailyLeaderboard(dayKey = dayKeyOf(), limitCount = 50) {
  try {
    const q = query(
      collection(db, "GameLeaderboards", dailyBoardId(dayKey), "entries"),
      orderBy("score", "desc"),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach((entry) => rows.push(dailyEntryToRow(entry.id, entry.data())));
    return rows;
  } catch (e) {
    if (__DEV__) console.warn("fetchDailyLeaderboard error:", e?.message);
    throw e;
  }
}

const FRIEND_QUERY_MAX = 60; // Okuma maliyetini sınırla.

/**
 * Yalnızca verilen kullanıcıların (arkadaşlar + ben) günlük sonuçları. Genel
 * ilk-50 listesini süzmek arkadaşı sıralamanın dışında kalan oyuncuyu gizlerdi.
 *
 * Satırlar belge kimliğiyle (entries/{uid}) DOĞRUDAN okunur, sorgu yok:
 * `where("uid", "in", …)` koleksiyon kapsamında dizin ister, ama
 * firestore.indexes.json'daki entries.uid geçersiz kılması yalnız
 * COLLECTION_GROUP dizini tanımlıyor (varsayılan tek alan dizinlerinin YERİNE
 * geçer). Sorgu her seferinde FAILED_PRECONDITION ile düşüyor, düello kartı
 * "oynadı"yı hiç göremiyor ve sonuç kartında rakip skoru "?" kalıyordu.
 */
export async function fetchDailyFriendRows(dayKey = dayKeyOf(), uids = []) {
  const unique = [...new Set((uids || []).filter(Boolean))].slice(0, FRIEND_QUERY_MAX);
  if (unique.length === 0) return [];
  try {
    const boardId = dailyBoardId(dayKey);
    const snaps = await Promise.all(unique.map((uid) => getDoc(leaderboardEntryRef(boardId, uid))));
    const rows = [];
    snaps.forEach((entry) => {
      if (entry.exists()) rows.push(dailyEntryToRow(entry.id, entry.data()));
    });
    return rows;
  } catch (e) {
    if (__DEV__) console.warn("fetchDailyFriendRows error:", e?.message);
    throw e;
  }
}
