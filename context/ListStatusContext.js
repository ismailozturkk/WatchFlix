import { buildStatusIndex, resolveStatusIndex } from "../utils/listStatusIndex";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import { Keys, get, set, getActiveUser } from "../services/storage";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import {
  dedupeWatchedTvEntries,
  migrateWatchedTvDocIds,
  migrateLegacyShow,
} from "../services/watchedTvService";
import {
  migrateLegacyMovieLists,
  PREDEFINED_MOVIE_LISTS,
} from "../services/listItemsService";
import {
  RESERVED_LIST_NAMES,
} from "../utils/listShare";
import {
  isAuthTransitionError,
} from "../utils/firestoreError";
import * as cacheStore from "../utils/cacheStore";
import { cacheKeys } from "../utils/cacheKeys";
import { publish as publishSnapshot } from "../services/snapshotCache";
import { sameJson } from "../utils/sameData";
import {
  trackFirestoreRead,
} from "../services/usageTrackerService";
import {
  getLocalList,
  setLocalList,
  subscribeLocalList,
  fetchFullListOnce,
  syncListDelta,
} from "../services/listSyncService";
import {
  materializeTvWatchState,
  countTvWatchStats,
} from "../utils/watchHistory";

const RESERVED_SET = new Set(RESERVED_LIST_NAMES);

const EMPTY_INDEX = Object.freeze({ movie: {}, tv: {} });

const ListStatusContext = createContext();

export const useListStatusContext = () => useContext(ListStatusContext);

/**
 * Kayıtlı liste durumunu SENKRON okur (0 ms, 0 Read).
 */
const tohumOku = (uid) => {
  if (!uid) return null;

  const parsed = get(Keys.listStatus, { uid });
  try {
    const root = cacheStore.getJSON(...cacheKeys.lists(uid, "root"));
    const favorites = getLocalList(uid, "favorites") || {};
    const watchList = getLocalList(uid, "watchList") || {};
    const watchedMovies = getLocalList(uid, "watchedMovies") || {};
    const watchedTv = getLocalList(uid, "watchedTv") || {};

    const hasMaps =
      Object.keys(favorites).length > 0 ||
      Object.keys(watchList).length > 0 ||
      Object.keys(watchedMovies).length > 0 ||
      Object.keys(watchedTv).length > 0;

    if (hasMaps || root || parsed?.statusIndex) {
      const allLists = root ?? parsed?.allLists ?? null;
      return {
        statusIndex:
          resolveStatusIndex(allLists, buildStatusIndex({
            allLists,
            favoritesMap: favorites,
            watchListMap: watchList,
            watchedMoviesMap: watchedMovies,
            watchedTvMap: watchedTv,
          }), parsed?.statusIndex),
        allLists,
        favoritesMap: favorites,
        watchListMap: watchList,
        watchedMoviesMap: watchedMovies,
        watchedTvMap: watchedTv,
        hasMaps: Boolean(hasMaps),
      };
    }
  } catch {}
  return null;
};

export const ListStatusProvider = ({ children }) => {
  const { user } = useAuth();
  const ilkTohum = useMemo(
    () => tohumOku(user?.uid ?? getActiveUser()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [allLists, setAllLists] = useState(ilkTohum?.allLists ?? null);
  const [loading, setLoading] = useState(!ilkTohum);
  const [rootLoaded, setRootLoaded] = useState(false);
  const [cachedStatusIndex, setCachedStatusIndex] = useState(
    ilkTohum?.statusIndex ?? EMPTY_INDEX,
  );
  const currentUidRef = useRef(user?.uid ?? getActiveUser());
  const cacheHydratedForUid = useRef(null);
  const hasHydratedStatusCache = useRef(Boolean(ilkTohum));
  const missingSyncInitiatedForUidRef = useRef(null);

  const [favoritesMap, setFavoritesMap] = useState(
    ilkTohum?.favoritesMap ?? {},
  );
  const [watchListMap, setWatchListMap] = useState(
    ilkTohum?.watchListMap ?? {},
  );
  const [watchedMoviesMap, setWatchedMoviesMap] = useState(
    ilkTohum?.watchedMoviesMap ?? {},
  );
  const [watchedTvMap, setWatchedTvMap] = useState(
    ilkTohum?.watchedTvMap ?? {},
  );
  const [watchedTvLoaded, setWatchedTvLoaded] = useState(
    Boolean(ilkTohum?.hasMaps),
  );

  // ── 1. Kullanıcı Değişimi & Açılış: Senkron Yerel Yükleme ve Temizlik ────────
  useEffect(() => {
    const uid = user?.uid;
    currentUidRef.current = uid;

    if (!uid) {
      // Çıkış yapıldı veya henüz oturum açılmadı
      setAllLists(null);
      setCachedStatusIndex(EMPTY_INDEX);
      setFavoritesMap({});
      setWatchListMap({});
      setWatchedMoviesMap({});
      setWatchedTvMap({});
      setWatchedTvLoaded(true);
      setRootLoaded(false);
      hasHydratedStatusCache.current = false;
      cacheHydratedForUid.current = null;
      missingSyncInitiatedForUidRef.current = null;
      setLoading(false);
      return;
    }

    if (cacheHydratedForUid.current !== uid) {
      cacheHydratedForUid.current = uid;
      const tohum = tohumOku(uid);
      if (tohum) {
        hasHydratedStatusCache.current = true;
        setCachedStatusIndex(tohum.statusIndex);
        setAllLists(tohum.allLists);
        setFavoritesMap(tohum.favoritesMap ?? {});
        setWatchListMap(tohum.watchListMap ?? {});
        setWatchedMoviesMap(tohum.watchedMoviesMap ?? {});
        setWatchedTvMap(tohum.watchedTvMap ?? {});
        setWatchedTvLoaded(Boolean(tohum.hasMaps));
        setLoading(false);
      } else {
        // Yeni cihazda ilk açılış veya bu kullanıcı için yerel önbellek henüz yok
        setAllLists(null);
        setCachedStatusIndex(EMPTY_INDEX);
        setFavoritesMap({});
        setWatchListMap({});
        setWatchedMoviesMap({});
        setWatchedTvMap({});
        setWatchedTvLoaded(false);
        setRootLoaded(false);
        hasHydratedStatusCache.current = false;
        setLoading(true);
      }
    }
  }, [user?.uid]);

  // ── 2. Yerel Bellek Aboneliği: Ekleme/Silme/Güncelleme Anında 0-Read Reaktivite ──
  useEffect(() => {
    const unsubscribe = subscribeLocalList((syncUid, listKey, dataMap) => {
      if (syncUid !== currentUidRef.current) return;
      if (listKey === "favorites") setFavoritesMap(dataMap || {});
      else if (listKey === "watchList") setWatchListMap(dataMap || {});
      else if (listKey === "watchedMovies") setWatchedMoviesMap(dataMap || {});
      else if (listKey === "watchedTv") {
        setWatchedTvMap(dataMap || {});
        setWatchedTvLoaded(true);
      }
    });
    return unsubscribe;
  }, [user?.uid]);

  // ── 3. Yerelde Olmayan Listeleri TEK SEFERLİK Çek ve Kaydet (Lazy Hydration) ──
  const checkAndFetchMissingLists = useCallback(async (uid, rootData) => {
    if (!uid || currentUidRef.current !== uid) return;
    try {
      const counts = rootData?.counts || {};

      // Legacy migration: eski kök-array formatı varsa
      const hasLegacyMovies = PREDEFINED_MOVIE_LISTS.some(
        (k) => Array.isArray(rootData?.[k]) && rootData[k].length > 0,
      );
      if (hasLegacyMovies && currentUidRef.current === uid) {
        await migrateLegacyMovieLists(uid, rootData);
      }
      if (Array.isArray(rootData?.watchedTv) && rootData.watchedTv.length > 0 && currentUidRef.current === uid) {
        for (const show of rootData.watchedTv) {
          if (show && show.id != null && currentUidRef.current === uid) {
            await migrateLegacyShow(uid, show);
          }
        }
      }

      // YALNIZCA yerel depoda hiç veri yoksa ve Firestore'da kayıt varsa TEK SEFERLİK çek
      const favLocal = getLocalList(uid, "favorites");
      if ((counts.favorites > 0 || hasLegacyMovies) && Object.keys(favLocal).length === 0) {
        const favs = await fetchFullListOnce(uid, "favorites");
        if (currentUidRef.current === uid) setFavoritesMap(favs);
      }

      const watchLocal = getLocalList(uid, "watchList");
      if ((counts.watchList > 0 || hasLegacyMovies) && Object.keys(watchLocal).length === 0) {
        const wls = await fetchFullListOnce(uid, "watchList");
        if (currentUidRef.current === uid) setWatchListMap(wls);
      }

      const movLocal = getLocalList(uid, "watchedMovies");
      if ((counts.watchedMovies > 0 || hasLegacyMovies) && Object.keys(movLocal).length === 0) {
        const movs = await fetchFullListOnce(uid, "watchedMovies");
        if (currentUidRef.current === uid) setWatchedMoviesMap(movs);
      }

      const tvLocal = getLocalList(uid, "watchedTv");
      if ((counts.watchedTv > 0 || Array.isArray(rootData?.watchedTv)) && Object.keys(tvLocal).length === 0) {
        const tvs = await fetchFullListOnce(uid, "watchedTv");
        if (currentUidRef.current === uid) {
          setWatchedTvMap(tvs);
        }
      }
    } catch (err) {
      if (__DEV__) console.warn("[ListStatusContext] checkAndFetchMissingLists error:", err);
    } finally {
      if (currentUidRef.current === uid) {
        setWatchedTvLoaded(true);
        setLoading(false);
      }
    }
  }, []);

  // ── 4. KÖK DOKÜMAN DİNLEYİCİSİ: Lists/{uid} (Açılışta YALNIZCA 1 READ) ───
  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribe = onSnapshot(
      doc(db, "Lists", user.uid),
      (docSnap) => {
        trackFirestoreRead("Lists/root", 1);
        const next = docSnap.exists() ? docSnap.data() : null;
        if (currentUidRef.current === user.uid) {
          setAllLists((current) => (sameJson(current, next) ? current : next));
          publishSnapshot(cacheKeys.lists(user.uid, "root"), next);
          setRootLoaded(true);
          setLoading(false);

          if (missingSyncInitiatedForUidRef.current !== user.uid) {
            missingSyncInitiatedForUidRef.current = user.uid;
            checkAndFetchMissingLists(user.uid, next);
          }
        }
      },
      (error) => {
        if (!isAuthTransitionError(error) && __DEV__)
          console.warn("[Lists] snapshot error:", error?.message);
        if (currentUidRef.current === user.uid) {
          setLoading(false);
        }
      },
    );

    return () => unsubscribe();
  }, [user?.uid, checkAndFetchMissingLists]);

  // ── 5. Manuel / İsteğe Bağlı Yenileme (Pull-to-Refresh / Delta Sync) ───────
  const refreshList = useCallback(
    async (listKey = "all") => {
      const uid = user?.uid;
      if (!uid || currentUidRef.current !== uid) return;
      if (listKey === "all") {
        const [f, w, m, t] = await Promise.all([
          fetchFullListOnce(uid, "favorites"),
          fetchFullListOnce(uid, "watchList"),
          fetchFullListOnce(uid, "watchedMovies"),
          fetchFullListOnce(uid, "watchedTv"),
        ]);
        if (currentUidRef.current === uid) {
          setFavoritesMap(f);
          setWatchListMap(w);
          setWatchedMoviesMap(m);
          setWatchedTvMap(t);
          setWatchedTvLoaded(true);
        }
      } else {
        const res = await fetchFullListOnce(uid, listKey);
        if (currentUidRef.current === uid) {
          if (listKey === "favorites") setFavoritesMap(res);
          else if (listKey === "watchList") setWatchListMap(res);
          else if (listKey === "watchedMovies") setWatchedMoviesMap(res);
          else if (listKey === "watchedTv") {
            setWatchedTvMap(res);
            setWatchedTvLoaded(true);
          }
        }
      }
    },
    [user?.uid],
  );

  // ── bare+tv_ ikileme giderme ──────────────────────────────────────────────
  const dedupedWatchedTvMap = useMemo(() => {
    const entries = Object.entries(watchedTvMap || {});
    if (entries.length === 0) return watchedTvMap;
    const deduped = dedupeWatchedTvEntries(entries);
    if (deduped.length === entries.length) return watchedTvMap;
    const m = {};
    deduped.forEach((item) => {
      m[`tv_${item.id}`] = item;
    });
    return m;
  }, [watchedTvMap]);

  // ── Durum İndeksi: Öncelik kök dokümandaki statusIndex'tir ────────────────
  const fallbackStatusIndex = useMemo(
    () =>
      buildStatusIndex({
        allLists,
        favoritesMap,
        watchListMap,
        watchedMoviesMap,
        watchedTvMap: dedupedWatchedTvMap,
      }),
    [
      allLists,
      favoritesMap,
      watchListMap,
      watchedMoviesMap,
      dedupedWatchedTvMap,
    ],
  );

  const statusIndex = useMemo(() => resolveStatusIndex(
    allLists,
    fallbackStatusIndex,
    rootLoaded ? null : cachedStatusIndex,
  ), [rootLoaded, cachedStatusIndex, fallbackStatusIndex, allLists]);

  // Debounce'lu cache yazımı
  useEffect(() => {
    if (!user?.uid || !statusIndex) return undefined;
    const uid = user.uid;
    const timer = setTimeout(() => {
      set(
        Keys.listStatus,
        { allLists, statusIndex, ts: Date.now() },
        { uid },
      );
    }, 2500);
    return () => clearTimeout(timer);
  }, [allLists, statusIndex, user?.uid]);

  const otherListKeys = useMemo(() => {
    if (!allLists) return [];
    return Object.keys(allLists).filter(
      (key) => !RESERVED_SET.has(key) && Array.isArray(allLists[key]),
    );
  }, [allLists]);

  const allListKeys = useMemo(() => {
    if (!allLists) return [];
    return Object.keys(allLists).filter(
      (key) => !RESERVED_SET.has(key) && Array.isArray(allLists[key]),
    );
  }, [allLists]);

  const favoritesItems = useMemo(
    () => Object.values(favoritesMap || {}),
    [favoritesMap],
  );
  const watchListItems = useMemo(
    () => Object.values(watchListMap || {}),
    [watchListMap],
  );
  const watchedMoviesItems = useMemo(
    () => Object.values(watchedMoviesMap || {}),
    [watchedMoviesMap],
  );

  const combinedLists = useMemo(() => {
    const out = {};
    if (allLists) {
      Object.entries(allLists).forEach(([k, v]) => {
        if (Array.isArray(v) && !RESERVED_SET.has(k)) {
          out[k] = v;
        }
      });
    }
    out.favorites = favoritesItems;
    out.watchList = watchListItems;
    out.watchedMovies = watchedMoviesItems;
    out.watchedTv = Object.values(dedupedWatchedTvMap || {});
    return out;
  }, [
    allLists,
    favoritesItems,
    watchListItems,
    watchedMoviesItems,
    dedupedWatchedTvMap,
  ]);

  const value = useMemo(
    () => ({
      allLists,
      loading,
      statusIndex,
      otherListKeys,
      allListKeys,
      watchedTvMap: dedupedWatchedTvMap,
      watchedTvLoaded,
      favoritesItems,
      watchListItems,
      watchedMoviesItems,
      combinedLists,
      refreshList,
      counts: allLists?.counts || null,
      stats: allLists?.stats || null,
      activityIndex: allLists?.activityIndex || null,
    }),
    [
      allLists,
      loading,
      statusIndex,
      otherListKeys,
      allListKeys,
      dedupedWatchedTvMap,
      watchedTvLoaded,
      favoritesItems,
      watchListItems,
      watchedMoviesItems,
      combinedLists,
      refreshList,
    ],
  );

  return (
    <ListStatusContext.Provider value={value}>
      {children}
    </ListStatusContext.Provider>
  );
};
