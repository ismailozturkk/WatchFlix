import {
  applyStatusOverlay,
  buildStatusIndex,
  findDriftedLists,
  resolveStatusIndex,
} from "../utils/listStatusIndex";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import { Keys, get, set, getActiveUser } from "../services/storage";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { useConnectivity } from "./ConnectivityContext";
import {
  EMPTY_OVERLAY,
  clearOverlayFor,
  getOverlay,
  subscribeOverlay,
} from "../services/libraryOverlay";
import {
  clearLegacyWatchedTv,
  dedupeWatchedTvEntries,
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
  hasLocalList,
  setLocalList,
  subscribeLocalList,
  fetchFullListOnce,
} from "../services/listSyncService";
import {
  materializeTvWatchState,
  countTvWatchStats,
} from "../utils/watchHistory";

const RESERVED_SET = new Set(RESERVED_LIST_NAMES);

const EMPTY_INDEX = Object.freeze({ movie: {}, tv: {} });

// Bu cihazda ilk açılışta indirilen dört alt koleksiyon.
const LIST_KEYS = ["favorites", "watchList", "watchedMovies", "watchedTv"];

// Kök snapshot geldikten sonra sapma denetimini bu kadar bekletiriz: kendi
// yazımızın yankısı (sunucu commit'i yerel haritayı güncellemeden önce gelebilir)
// sapma gibi görünmesin.
const DRIFT_CHECK_DELAY_MS = 2500;

// Kök dokümanın son değişiklik zamanı (ms) — "bu sürümü zaten denedik" damgası.
const rootStamp = (root) => {
  const value = root?.updatedAt;
  if (typeof value?.toMillis === "function") return value.toMillis();
  return Number.isFinite(value?.seconds) ? value.seconds * 1000 : 0;
};

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
  const { isOnline } = useConnectivity();
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
  // Son kök snapshot SUNUCUDAN mı geldi (yerel yazım yankısı / önbellek değil)?
  const rootFromServerRef = useRef(false);
  // listKey → o listeyi yeniden çektiğimiz kök sürümü (updatedAt ms). Sapma
  // yeniden çekmeyle de kapanmıyorsa (ör. eski bir hatadan kalma hayalet bayrak)
  // aynı sürümde tekrar tekrar sorgulamayalım.
  const driftResyncRef = useRef({});
  const allListsRef = useRef(null);

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
    // Önceki kullanıcının bekleyen iyimser bayrakları yenisine sızmasın.
    if (currentUidRef.current && currentUidRef.current !== uid) {
      clearOverlayFor(currentUidRef.current);
    }
    currentUidRef.current = uid;
    rootFromServerRef.current = false;
    driftResyncRef.current = {};

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

  // ── 3. Bu Cihaza Hiç İndirilmemiş Listeleri TEK SEFERLİK Çek (Lazy Hydration) ──
  //
  // KAPI: "bu liste bu cihaza hiç indirildi mi?" (hasLocalList). Eskiden kapı kök
  // dokümandaki `counts.X > 0` sayacıydı; sayaçlar artış/azalışla tutulduğundan
  // sapabiliyor ve sıfıra inmiş bir sayaç yeni cihazda dolu listeyi BOŞ
  // gösteriyordu. İndirilmiş-ama-boş liste hasLocalList'te true kalır, yani boş
  // listeler her açılışta yeniden sorgulanmaz.
  //
  // @returns {Promise<boolean>} dört liste de bu cihazda mevcutsa true
  const checkAndFetchMissingLists = useCallback(async (uid, rootData) => {
    if (!uid || currentUidRef.current !== uid) return true;
    const setters = {
      favorites: setFavoritesMap,
      watchList: setWatchListMap,
      watchedMovies: setWatchedMoviesMap,
      watchedTv: setWatchedTvMap,
    };
    try {
      // Legacy migration: eski kök-array formatı varsa
      const hasLegacyMovies = PREDEFINED_MOVIE_LISTS.some(
        (k) => Array.isArray(rootData?.[k]) && rootData[k].length > 0,
      );
      if (hasLegacyMovies && currentUidRef.current === uid) {
        await migrateLegacyMovieLists(uid, rootData);
      }
      if (Array.isArray(rootData?.watchedTv) && currentUidRef.current === uid) {
        for (const show of rootData.watchedTv) {
          if (show && show.id != null && currentUidRef.current === uid) {
            await migrateLegacyShow(uid, show);
          }
        }
        // Hepsi hatasız taşındıysa eski dizi silinir; yoksa her açılışta yeniden denenirdi.
        if (currentUidRef.current === uid) await clearLegacyWatchedTv(uid);
      }

      for (const listKey of LIST_KEYS) {
        if (currentUidRef.current !== uid) break;
        if (hasLocalList(uid, listKey)) continue;
        const map = await fetchFullListOnce(uid, listKey);
        if (currentUidRef.current === uid) setters[listKey](map);
      }
    } catch (err) {
      if (__DEV__) console.warn("[ListStatusContext] checkAndFetchMissingLists error:", err);
    } finally {
      if (currentUidRef.current === uid) {
        setWatchedTvLoaded(true);
        setLoading(false);
      }
    }
    // fetchFullListOnce hatada yerel işaretçiyi YAZMAZ: eksik kalan varsa tekrar denenecek.
    return LIST_KEYS.every((listKey) => hasLocalList(uid, listKey));
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
          // Yerel yazım yankısı / önbellek değil, sunucu onaylı sürüm: sapma
          // denetimi yalnız buna güvenir (aşağıdaki "sapma onarımı" effect'i).
          rootFromServerRef.current =
            !docSnap.metadata?.fromCache && !docSnap.metadata?.hasPendingWrites;
          allListsRef.current = next;
          setAllLists((current) => (sameJson(current, next) ? current : next));
          publishSnapshot(cacheKeys.lists(user.uid, "root"), next);
          setRootLoaded(true);
          setLoading(false);

          if (missingSyncInitiatedForUidRef.current !== user.uid) {
            missingSyncInitiatedForUidRef.current = user.uid;
            checkAndFetchMissingLists(user.uid, next).then((complete) => {
              // Çevrimdışı açılış gibi durumlarda eksik kalan liste olursa bir
              // sonraki fırsatta (kök değişimi / bağlantı dönüşü) yeniden denensin.
              if (!complete && currentUidRef.current === user.uid) {
                missingSyncInitiatedForUidRef.current = null;
              }
            });
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

  const baseStatusIndex = useMemo(() => resolveStatusIndex(
    allLists,
    fallbackStatusIndex,
    rootLoaded ? null : cachedStatusIndex,
  ), [rootLoaded, cachedStatusIndex, fallbackStatusIndex, allLists]);

  // Bekleyen (henüz sunucuya yazılmamış) işlemlerin niyeti: düğmeye basıldığı
  // an o eseri gösteren HER ekran güncellensin (bkz. services/libraryOverlay).
  const overlayUid = user?.uid;
  const overlay = useSyncExternalStore(
    subscribeOverlay,
    useCallback(() => getOverlay(overlayUid), [overlayUid]),
  );
  const statusIndex = useMemo(
    () => applyStatusOverlay(baseStatusIndex, overlay),
    [baseStatusIndex, overlay],
  );

  // Debounce'lu cache yazımı — bindirmesiz TABAN indeks yazılır: başarısız olacak
  // bir iyimser bayrak diske kalıcı olmasın.
  useEffect(() => {
    if (!user?.uid || !baseStatusIndex) return undefined;
    const uid = user.uid;
    const timer = setTimeout(() => {
      set(
        Keys.listStatus,
        { allLists, statusIndex: baseStatusIndex, ts: Date.now() },
        { uid },
      );
    }, 2500);
    return () => clearTimeout(timer);
  }, [allLists, baseStatusIndex, user?.uid]);

  // ── Sapma onarımı ─────────────────────────────────────────────────────────
  // Kök dokümandaki statusIndex canlı dinlenir; yerel liste haritaları ise
  // yalnız bu cihazın yazımlarıyla ve ilk indirmeyle güncellenir. Başka cihazda
  // yapılan ekleme/silme (ya da commit sonrası yerel güncellemeden önce kapanan
  // uygulama) ikisini ayırır. Sapma SIFIR okumayla tespit edilir; yalnız sapan
  // liste yeniden çekilir. Aynı kök sürümünde bir liste bir kez denenir:
  // yeniden çekmeyle de kapanmayan sapma (ör. eski bir hatadan kalma hayalet
  // bayrak) sonsuz sorgu döngüsüne dönmez.
  const overlayIdle = overlay === EMPTY_OVERLAY;
  useEffect(() => {
    const uid = user?.uid;
    const index = allLists?.statusIndex;
    if (!uid || !rootLoaded || !overlayIdle || !index || !rootFromServerRef.current) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (currentUidRef.current !== uid) return;
      const stamp = rootStamp(allListsRef.current);
      findDriftedLists(index, {
        favorites: favoritesMap,
        watchList: watchListMap,
        watchedMovies: watchedMoviesMap,
        watchedTv: watchedTvMap,
      }).forEach((listKey) => {
        if (driftResyncRef.current[listKey] === stamp) return;
        driftResyncRef.current[listKey] = stamp;
        refreshList(listKey).catch(() => {});
      });
    }, DRIFT_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    user?.uid,
    rootLoaded,
    overlayIdle,
    allLists,
    favoritesMap,
    watchListMap,
    watchedMoviesMap,
    watchedTvMap,
    refreshList,
  ]);

  // Bağlantı geri geldiğinde, çevrimdışı açılışta indirilemeyen listeler varsa
  // ilk indirmeyi yeniden dene (kök snapshot'ın değişmesini beklemeden).
  useEffect(() => {
    const uid = user?.uid;
    if (!isOnline || !uid || !rootLoaded) return;
    if (missingSyncInitiatedForUidRef.current !== null) return;
    missingSyncInitiatedForUidRef.current = uid;
    checkAndFetchMissingLists(uid, allListsRef.current).then((complete) => {
      if (!complete && currentUidRef.current === uid) {
        missingSyncInitiatedForUidRef.current = null;
      }
    });
  }, [isOnline, user?.uid, rootLoaded, checkAndFetchMissingLists]);

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
