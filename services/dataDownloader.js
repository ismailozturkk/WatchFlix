// services/dataDownloader.js
//
// "Verileri İndir" — kullanıcının kişisel verisini, sosyal feed'i ve ana
// TMDB film/dizi verilerini çekip cache'e yazar; içeriklerdeki posterleri de
// expo-image disk cache'ine indirir. Böylece internet yokken/azken bu veriler
// ve görseller hazır olur.
//
// Kapsam (her biri ayrı bir veri türü — Ayarlar > Genel'den seçilir):
//   profil · listeler · notlar · hatırlatıcılar · gönderiler · etkinlikler ·
//   film içerikleri · dizi içerikleri · görseller (posterler)
//
// KAPI: Ana "Verileri indir" anahtarı kapalıysa bu fonksiyon hiçbir şey
// indirmez (blocked: "disabled" döner). Açıkken yalnızca seçili türler işlenir;
// "Görseller" kapalıysa poster prefetch hiç çalışmaz.
//
// NOT: Koleksiyon yolları mevcut context'lerden doğrulandı:
//   Users/{uid}                       (UserProfileContext)
//   Lists/{uid} + alt: favorites|watchList|watchedMovies|watchedTv (ListStatusContext)
//   Notes/{uid}/items                 (ProfileNotesContext)
//   Reminders/{uid}/movies|tvShows    (ProfileRemindersContext)

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import * as cacheStore from "../utils/cacheStore";
import { prefetchImages } from "./imagePrefetch";
import { buildTmdbUrl } from "../utils/tmdbImageUtils";
import { cacheKeys } from "../utils/cacheKeys";
import { i18nText } from "../utils/i18nText";
import { setCachedValue } from "../utils/apiCache";
import {
  getAutoDataCacheEnabled,
  getDataTypes,
  normalizeDataTypes,
} from "../utils/dataCacheSettings";
import * as PostsApi from "./postsService";

// Cache anahtarları tek kaynaktan (context read-through ile AYNI).
export const CACHE = cacheKeys;

const LIST_SUBCOLLECTIONS = ["favorites", "watchList", "watchedMovies", "watchedTv"];
const POSTER_KEY_RE = /poster|still|backdrop/i;
const FEED_CACHE_KEY = "feed_cache_v1";
const WATCHED_TV_CACHE_KEY = "cache_watchedTvShows";
const LIST_STATUS_PREFIX = "list_status_cache_";
const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;

const MOVIE_OSCAR_IDS = [
  1054867, 1064213, 872585, 545611, 776503, 581734, 496243, 490132, 399055,
  376867, 314365, 194662, 76203, 68734, 70586, 45269, 12162, 12405, 6978,
  1422, 10123, 70, 122, 1574, 274, 98, 14, 1934, 597, 409, 197, 13,
];

const MOVIE_COLLECTION_IDS = [
  "10", "1241", "86311", "748", "263", "9485", "119", "121938", "87359",
  "556", "531241", "295", "645", "2344", "8650", "131635", "328", "8354",
  "14740",
];

// Bir döküman/objedeki poster benzeri alanları (/ ile başlayan TMDB path'leri) topla.
function collectPosterPaths(obj, out) {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.startsWith("/") && POSTER_KEY_RE.test(k)) {
      out.add(v);
    } else if (v && typeof v === "object") {
      collectPosterPaths(v, out);
    }
  }
}

function snapToMap(snap) {
  const m = {};
  snap.forEach((d) => {
    m[d.id] = d.data();
  });
  return m;
}

const markStatus = (index, rawType, id, field) => {
  if (id == null) return;
  const bucket = rawType === "tv" ? index.tv : index.movie;
  if (!bucket[id]) {
    bucket[id] = {
      inWatchList: false,
      inFavorites: false,
      isWatched: false,
      isInOtherLists: false,
    };
  }
  bucket[id][field] = true;
};

function buildStatusIndex(root, maps) {
  const index = { movie: {}, tv: {} };
  Object.values(maps.favorites || {}).forEach(({ id, type }) =>
    markStatus(index, type, id, "inFavorites"),
  );
  Object.values(maps.watchList || {}).forEach(({ id, type }) =>
    markStatus(index, type, id, "inWatchList"),
  );
  Object.values(maps.watchedMovies || {}).forEach(({ id, type }) =>
    markStatus(index, type || "movie", id, "isWatched"),
  );
  Object.values(maps.watchedTv || {}).forEach(({ id, type }) =>
    markStatus(index, type || "tv", id, "isWatched"),
  );

  Object.keys(root || {})
    .filter((key) => !LIST_SUBCOLLECTIONS.includes(key))
    .forEach((key) => {
      (root[key] || []).forEach(({ id, type }) =>
        markStatus(index, type, id, "isInOtherLists"),
      );
    });

  return index;
}

function watchedTvFromMaps(root, watchedTvMap) {
  const fromSub = Object.values(watchedTvMap || {});
  const fromRoot = Array.isArray(root?.watchedTv) ? root.watchedTv : [];
  const byId = new Map();
  [...fromRoot, ...fromSub].forEach((item) => {
    if (!item) return;
    const id = item.id ?? item.showId ?? item.tvId;
    if (id == null) return;
    if (item.type === "tv" || item.seasons !== undefined) byId.set(String(id), item);
  });
  return [...byId.values()].sort(
    (a, b) => new Date(b.addedShowDate || 0) - new Date(a.addedShowDate || 0),
  );
}

async function tmdbGet(path, params = {}) {
  if (!API_KEY) throw new Error("TMDB API key yok");
  const res = await axios.get(`https://api.themoviedb.org/3/${path}`, {
    params,
    headers: { accept: "application/json", Authorization: API_KEY },
  });
  return res.data;
}

async function cachePagedTmdb(cacheKey, path, params, posterPaths) {
  const data = await tmdbGet(path, params);
  const entry = { results: data.results || [], total_pages: data.total_pages || 1 };
  setCachedValue(cacheKey, entry, { force: true });
  collectPosterPaths(entry, posterPaths);
  return entry.results.length;
}

async function cacheArrayTmdb(cacheKey, path, params, posterPaths, picker = (data) => data.results || []) {
  const data = await tmdbGet(path, params);
  const picked = picker(data);
  setCachedValue(cacheKey, picked, { force: true });
  collectPosterPaths(picked, posterPaths);
  return Array.isArray(picked) ? picked.length : 1;
}

/**
 * Seçili veri türlerini indir/cache'le.
 *
 * Ana anahtar ("Verileri indir" ayarı) kapalıysa HİÇBİR ŞEY indirilmez —
 * poster prefetch dahil. Açıkken yalnız seçili türler işlenir.
 *
 * @param {object} [opts]
 * @param {string} [opts.language] 'tr' | 'en'
 * @param {Record<string, boolean>} [opts.types] Tür seçimi; verilmezse kayıtlı ayar
 * @param {(percent:number, label:string)=>void} [opts.onProgress] percent: 0..1
 * @returns {Promise<{ok:boolean, blocked?:string, cachedDocs:number, prefetchedImages:number, skipped:string[], errors:string[]}>}
 */
export async function downloadAllData({ language = "tr", types, onProgress } = {}) {
  const uid = auth.currentUser?.uid;
  const errors = [];
  const skipped = [];
  let cachedDocs = 0;
  const posterPaths = new Set();
  const tmdbLanguage = language === "tr" ? "tr-TR" : "en-US";
  const tmdbRegion = language === "tr" ? "TR" : "US";

  // Ana anahtar kapalıysa indirme yok (ekran da butonu kilitler; bu ikinci hat).
  if (!getAutoDataCacheEnabled()) {
    return {
      ok: false,
      blocked: "disabled",
      cachedDocs: 0,
      prefetchedImages: 0,
      skipped: [],
      errors: ["disabled"],
    };
  }

  const selected = normalizeDataTypes(types ?? getDataTypes());
  const isOn = (category) => selected[category] !== false;

  if (!uid) {
    return {
      ok: false,
      blocked: "no-user",
      cachedDocs: 0,
      prefetchedImages: 0,
      skipped: [],
      errors: ["no-user"],
    };
  }

  // Adımlar — `category` alanı Ayarlar'daki tür seçimiyle eşleşir.
  const steps = [
    {
      category: "profile",
      label: i18nText("profile", "Profil"),
      run: async () => {
        const snap = await getDoc(doc(db, "Users", uid));
        // Şekil UserProfileContext ile aynı: { uid, ...userDoc }
        const data = snap.exists() ? { uid: snap.id, ...snap.data() } : null;
        cacheStore.setJSON(...CACHE.profile(uid), data);
        collectPosterPaths(data, posterPaths);
        cachedDocs += 1;
      },
    },
    {
      category: "lists",
      label: i18nText("autoI18n.listeler", "Listeler"),
      run: async () => {
        // kök döküman
        const rootSnap = await getDoc(doc(db, "Lists", uid));
        const root = rootSnap.exists() ? rootSnap.data() : null;
        cacheStore.setJSON(
          ...CACHE.lists(uid, "root"),
          root,
        );
        cachedDocs += 1;

        const maps = {};
        // alt koleksiyonlar
        for (const name of LIST_SUBCOLLECTIONS) {
          const snap = await getDocs(collection(db, "Lists", uid, name));
          const map = snapToMap(snap);
          maps[name] = map;
          cacheStore.setJSON(...CACHE.lists(uid, name), map);
          collectPosterPaths(map, posterPaths);
          cachedDocs += snap.size;
        }
        await AsyncStorage.setItem(
          `${LIST_STATUS_PREFIX}${uid}`,
          JSON.stringify({
            allLists: root,
            statusIndex: buildStatusIndex(root, maps),
            ts: Date.now(),
          }),
        );
        await AsyncStorage.setItem(
          WATCHED_TV_CACHE_KEY,
          JSON.stringify(watchedTvFromMaps(root, maps.watchedTv)),
        );
      },
    },
    {
      category: "notes",
      label: i18nText("autoI18n.notlar", "Notlar"),
      run: async () => {
        const snap = await getDocs(collection(db, "Notes", uid, "items"));
        // Şekil ProfileNotesContext ile ayni: dizi, createdAt azalan.
        const arr = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        cacheStore.setJSON(...CACHE.notes(uid), arr);
        cachedDocs += snap.size;
      },
    },
    {
      category: "reminders",
      label: i18nText("autoI18n.hatirlaticilar", "Hatırlatıcılar"),
      run: async () => {
        // movies → dizi (ProfileRemindersContext.movieReminders ile aynı)
        const moviesSnap = await getDocs(collection(db, "Reminders", uid, "movies"));
        const movies = moviesSnap.docs.map((d) => d.data());
        cacheStore.setJSON(...CACHE.reminders(uid, "movies"), movies);
        collectPosterPaths(movies, posterPaths);

        // tvShows → her show'un episodes alt koleksiyonu düzleştirilir
        // (ProfileRemindersContext.allTvEpisodes ile aynı şekil).
        const showsSnap = await getDocs(collection(db, "Reminders", uid, "tvShows"));
        const episodes = [];
        for (const showDoc of showsSnap.docs) {
          collectPosterPaths(showDoc.data(), posterPaths);
          const epSnap = await getDocs(
            collection(db, "Reminders", uid, "tvShows", showDoc.id, "episodes"),
          );
          epSnap.docs.forEach((d) => episodes.push(d.data()));
        }
        cacheStore.setJSON(...CACHE.reminders(uid, "episodes"), episodes);
        collectPosterPaths(episodes, posterPaths);

        cachedDocs += moviesSnap.size + episodes.length;
      },
    },
    {
      category: "posts",
      label: i18nText("autoI18n.gonderiler", "Gönderiler"),
      run: async () => {
        const { posts } = await PostsApi.fetchFeed({ filter: "all" });
        await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(posts));
        collectPosterPaths(posts, posterPaths);
        cachedDocs += posts.length;
      },
    },
    {
      category: "activity",
      label: i18nText("autoI18n.etkinlikler", "Etkinlikler"),
      run: async () => {
        // Etkinliklerim hub'ı (MyActivityScreen) bu cache'i okur.
        const toArr = (snap) =>
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? b.likedAt?.toMillis?.() ?? b.bookmarkedAt?.toMillis?.() ?? 0) -
                            (a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? a.likedAt?.toMillis?.() ?? a.bookmarkedAt?.toMillis?.() ?? 0));
        const [ratingsSnap, commentsSnap, likesSnap, bmSnap] = await Promise.all([
          getDocs(collection(db, "Users", uid, "myRatings")),
          getDocs(collection(db, "Users", uid, "myComments")),
          getDocs(collection(db, "Users", uid, "likedPosts")),
          getDocs(collection(db, "Users", uid, "bookmarks")),
        ]);
        const { posts: userPosts } = await PostsApi.fetchUserPosts(uid);
        const activity = {
          ratings: toArr(ratingsSnap),
          comments: toArr(commentsSnap),
          likes: toArr(likesSnap),
          bookmarks: toArr(bmSnap),
          posts: userPosts || [],
        };
        cacheStore.setJSON(...CACHE.activity(uid), activity);
        collectPosterPaths(activity, posterPaths);
        cachedDocs +=
          activity.ratings.length +
          activity.comments.length +
          activity.likes.length +
          activity.bookmarks.length +
          activity.posts.length;
      },
    },
    {
      category: "movieContent",
      label: i18nText("autoI18n.film_icerikleri", "Film içerikleri"),
      run: async () => {
        let count = 0;
        const shortLang = language === "tr" ? "tr-TR" : "en-US";

        for (const sort of ["vote_count.desc", "popularity.desc"]) {
          count += await cachePagedTmdb(
            `movie_bests_${shortLang}_${sort}_page_1`,
            "discover/movie",
            {
              include_adult: "true",
              include_null_first_air_dates: "false",
              language: shortLang,
              page: 1,
              sort_by: sort,
              "vote_count.gte": "100",
            },
            posterPaths,
          );
        }
        for (const window of ["week", "day"]) {
          count += await cacheArrayTmdb(
            `movie_trends_${shortLang}_${window}_trending`,
            `trending/movie/${window}`,
            {
              include_adult: "false",
              include_null_first_air_dates: "false",
              language: shortLang,
              page: "1",
            },
            posterPaths,
            (data) => [{ id: "left-spacer" }, ...(data.results || []), { id: "right-spacer" }],
          );
        }

        const oscarMovies = await Promise.all(
          MOVIE_OSCAR_IDS.map((id) =>
            tmdbGet(`movie/${id}`, { language: shortLang }).catch(() => null),
          ),
        );
        const oscarClean = oscarMovies.filter(Boolean);
        setCachedValue(`movie_oscar_${shortLang}`, oscarClean, { force: true });
        collectPosterPaths(oscarClean, posterPaths);
        count += oscarClean.length;

        const collections = await Promise.all(
          MOVIE_COLLECTION_IDS.map((id) =>
            tmdbGet(`collection/${id}`, { language: shortLang }).catch(() => null),
          ),
        );
        const collectionClean = collections.filter(Boolean);
        setCachedValue(`movie_collection_${shortLang}`, collectionClean, { force: true });
        collectPosterPaths(collectionClean, posterPaths);
        count += collectionClean.length;

        count += await cacheArrayTmdb(
          `movie_providers_${tmdbLanguage}_${tmdbRegion}`,
          "watch/providers/movie",
          { language: tmdbLanguage, watch_region: tmdbRegion },
          posterPaths,
        );
        count += await cacheArrayTmdb(
          `movie_now_playing_${tmdbLanguage}_${tmdbRegion}`,
          "movie/now_playing",
          { language: tmdbLanguage, region: tmdbRegion },
          posterPaths,
        );
        count += await cacheArrayTmdb(
          `movie_genres_${tmdbLanguage}`,
          "genre/movie/list",
          { language: tmdbLanguage },
          posterPaths,
          (data) => data.genres || [],
        );
        count += await cachePagedTmdb(
          `movie_genres_content_${tmdbLanguage}_p1_g`,
          "discover/movie",
          { language: tmdbLanguage, page: 1 },
          posterPaths,
        );

        cachedDocs += count;
      },
    },
    {
      category: "tvContent",
      label: i18nText("autoI18n.dizi_icerikleri", "Dizi içerikleri"),
      run: async () => {
        let count = 0;
        const shortLang = language === "tr" ? "tr-TR" : "en-US";

        for (const window of ["week", "day"]) {
          count += await cacheArrayTmdb(
            `tv_trends_${shortLang}_${window}_trending`,
            `trending/tv/${window}`,
            {
              include_adult: "false",
              include_null_first_air_dates: "false",
              language: shortLang,
              page: "1",
            },
            posterPaths,
            (data) => [{ id: "left-spacer" }, ...(data.results || []), { id: "right-spacer" }],
          );
        }

        for (const sort of ["vote_count", "popularity"]) {
          count += await cachePagedTmdb(
            `tv_bests_${shortLang}_discover_${sort}_page_1`,
            "discover/tv",
            {
              include_adult: "false",
              include_null_first_air_dates: "false",
              language: shortLang,
              page: 1,
              sort_by: `${sort}.desc`,
              "vote_count.gte": "500",
            },
            posterPaths,
          );
        }
        count += await cacheArrayTmdb(
          `tv_providers_${tmdbLanguage}_${tmdbRegion}`,
          "watch/providers/tv",
          { language: tmdbLanguage, watch_region: tmdbRegion },
          posterPaths,
        );
        count += await cachePagedTmdb(
          `tv_airing_today_${tmdbLanguage}_${tmdbRegion}_page_1`,
          "tv/airing_today",
          {
            include_adult: "false",
            include_video: "false",
            language: tmdbLanguage,
            region: tmdbRegion,
            page: 1,
            sort_by: "popularity.desc",
          },
          posterPaths,
        );
        count += await cacheArrayTmdb(
          `tv_genres_${tmdbLanguage}`,
          "genre/tv/list",
          { language: tmdbLanguage },
          posterPaths,
          (data) => data.genres || [],
        );
        count += await cachePagedTmdb(
          `tv_genres_content_${tmdbLanguage}_p1_g`,
          "discover/tv",
          { language: tmdbLanguage, page: 1 },
          posterPaths,
        );
        count += await cachePagedTmdb(
          `tv_on_the_air_${tmdbLanguage}_${tmdbRegion}_page_1`,
          "tv/on_the_air",
          {
            include_adult: "false",
            include_video: "false",
            language: tmdbLanguage,
            region: tmdbRegion,
            page: 1,
            sort_by: "popularity.desc",
          },
          posterPaths,
        );

        cachedDocs += count;
      },
    },
  ];

  // Kapalı türler hiç çalıştırılmaz; ilerleme yalnız açık adımlara bölünür ki
  // yüzde atlamasın. Görseller kapalıysa veri adımları %100'ü paylaşır.
  steps.filter((s) => !isOn(s.category)).forEach((s) => skipped.push(s.category));
  const activeSteps = steps.filter((s) => isOn(s.category));
  const withImages = isOn("images");
  if (!withImages) skipped.push("images");

  if (activeSteps.length === 0 && !withImages) {
    return {
      ok: false,
      blocked: "no-types",
      cachedDocs: 0,
      prefetchedImages: 0,
      skipped,
      errors: ["no-types"],
    };
  }

  const dataWeight = withImages ? 0.85 : 1; // veri adımları toplamı

  for (let i = 0; i < activeSteps.length; i++) {
    const step = activeSteps[i];
    onProgress?.((i / activeSteps.length) * dataWeight, step.label);
    try {
      await step.run();
    } catch (e) {
      errors.push(`${step.label}: ${e?.message || i18nText("autoI18n.hata", "Hata")}`);
    }
  }

  let prefetchedImages = 0;
  if (withImages) {
    onProgress?.(dataWeight, i18nText("autoI18n.gorseller", "Görseller"));

    // Posterleri prefetch et (kalan %15).
    const urls = [...posterPaths]
      .map((p) => buildTmdbUrl(p, "poster", 342, "good"))
      .filter(Boolean);

    try {
      prefetchedImages = await prefetchImages(urls, {
        onProgress: (done, total) => {
          const frac = total ? done / total : 1;
          onProgress?.(dataWeight + frac * (1 - dataWeight), i18nText("autoI18n.gorseller", "Görseller"));
        },
      });
    } catch (e) {
      errors.push(`${i18nText("autoI18n.gorseller", "Görseller")}: ${e?.message || i18nText("autoI18n.hata", "Hata")}`);
    }
  }

  onProgress?.(1, "Tamam");
  return {
    ok: errors.length === 0,
    cachedDocs,
    prefetchedImages,
    skipped,
    errors,
  };
}
