import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { doc, collection, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import {
  migrateLegacyShow,
  migrateSeasonSubdocs,
  migrateWatchedTvDocIds,
  dedupeWatchedTvEntries,
} from "../services/watchedTvService";
import {
  migrateLegacyMovieLists,
  PREDEFINED_MOVIE_LISTS,
} from "../services/listItemsService";
import {
  isAuthTransitionError,
  snapshotErrorHandler,
} from "../utils/firestoreError";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";
import * as cacheStore from "../utils/cacheStore";
import { cacheKeys } from "../utils/cacheKeys";

const PREDEFINED = new Set([
  "watchedTv",
  "favorites",
  "watchList",
  "watchedMovies",
]);
const CACHE_PREFIX = "list_status_cache_";
const EMPTY_INDEX = Object.freeze({ movie: {}, tv: {} });

const ListStatusContext = createContext();

export const useListStatusContext = () => useContext(ListStatusContext);

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const buildStatusIndex = ({
  allLists,
  favoritesMap,
  watchListMap,
  watchedMoviesMap,
  watchedTvMap,
}) => {
  const index = { movie: {}, tv: {} };

  const mark = (rawType, id, field) => {
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

  Object.values(favoritesMap).forEach(({ id, type }) =>
    mark(type, id, "inFavorites"),
  );
  Object.values(watchListMap).forEach(({ id, type }) =>
    mark(type, id, "inWatchList"),
  );
  Object.values(watchedMoviesMap).forEach(({ id, type }) =>
    mark(type || "movie", id, "isWatched"),
  );
  Object.values(watchedTvMap).forEach(({ id, type }) =>
    mark(type || "tv", id, "isWatched"),
  );

  if (allLists) {
    // favorites/watchList/watchedMovies artık YALNIZ subcollection'dan okunur
    // (yukarıdaki map'ler). Eski kök-array dual-read'i kaldırıldı — migration
    // (migrateLegacyMovieLists) array'leri subcollection'a taşıyıp kök'ten siler.
    const subTvIds = new Set(Object.values(watchedTvMap).map((i) => i.id));

    // watchedTv hâlâ kendi (kanıtlanmış) migration'ında dual-read tutar.
    (allLists.watchedTv || []).forEach(({ id, type }) => {
      if (!subTvIds.has(id)) mark(type || "tv", id, "isWatched");
    });

    // Özel listeler (Part B'de customItems'a taşınacak; şimdilik kök-array).
    Object.keys(allLists)
      .filter((key) => !PREDEFINED.has(key) && key !== "customLists")
      .forEach((listKey) => {
        if (!Array.isArray(allLists[listKey])) return;
        allLists[listKey].forEach(({ id, type }) =>
          mark(type, id, "isInOtherLists"),
        );
      });
  }

  return index;
};

export const ListStatusProvider = ({ children }) => {
  const { user } = useAuth();
  const [allLists, setAllLists] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rootLoaded, setRootLoaded] = useState(false);
  const [cachedStatusIndex, setCachedStatusIndex] = useState(EMPTY_INDEX);
  const cacheHydratedForUid = useRef(null);
  const hasHydratedStatusCache = useRef(false);

  const [favoritesMap, setFavoritesMap] = useState({});
  const [watchListMap, setWatchListMap] = useState({});
  const [watchedMoviesMap, setWatchedMoviesMap] = useState({});
  const [watchedTvMap, setWatchedTvMap] = useState({});
  // watchedTv subcollection en az bir kez yüklendi mi? (migration yarışını önler)
  const [watchedTvLoaded, setWatchedTvLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const uid = user?.uid ?? (await AsyncStorage.getItem("cachedUserId"));
      if (!uid || cacheHydratedForUid.current === uid) return;
      cacheHydratedForUid.current = uid;

      try {
        const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${uid}`);
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw);
        if (parsed?.statusIndex) {
          hasHydratedStatusCache.current = true;
          setCachedStatusIndex(parsed.statusIndex);
          setAllLists(parsed.allLists ?? null);
          setLoading(false);
          return;
        }
      } catch {}

      try {
        const root = cacheStore.getJSON(...cacheKeys.lists(uid, "root"));
        const favorites = cacheStore.getJSON(...cacheKeys.lists(uid, "favorites")) || {};
        const watchList = cacheStore.getJSON(...cacheKeys.lists(uid, "watchList")) || {};
        const watchedMovies = cacheStore.getJSON(...cacheKeys.lists(uid, "watchedMovies")) || {};
        const watchedTv = cacheStore.getJSON(...cacheKeys.lists(uid, "watchedTv")) || {};

        if (
          root ||
          Object.keys(favorites).length ||
          Object.keys(watchList).length ||
          Object.keys(watchedMovies).length ||
          Object.keys(watchedTv).length
        ) {
          const statusIndex = buildStatusIndex({
            allLists: root,
            favoritesMap: favorites,
            watchListMap: watchList,
            watchedMoviesMap: watchedMovies,
            watchedTvMap: watchedTv,
          });
          hasHydratedStatusCache.current = true;
          setCachedStatusIndex(statusIndex);
          setAllLists(root ?? null);
          setLoading(false);
        }
      } catch {}
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setAllLists(null);
      setCachedStatusIndex(EMPTY_INDEX);
      setRootLoaded(false);
      hasHydratedStatusCache.current = false;
      setLoading(false);
      return;
    }

    if (!hasHydratedStatusCache.current) {
      setLoading(true);
    }

    const unsubscribe = onSnapshot(
      doc(db, "Lists", user.uid),
      (docSnap) => {
        const next = docSnap.exists() ? docSnap.data() : null;
        setAllLists((current) => (sameJson(current, next) ? current : next));
        setRootLoaded(true);
        setLoading(false);
      },
      (error) => {
        if (!isAuthTransitionError(error) && __DEV__)
          console.warn("[Lists] snapshot error:", error?.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setWatchedTvMap({});
      setWatchedTvLoaded(true);
      return undefined;
    }

    setWatchedTvMap({});
    setWatchedTvLoaded(false);
    const uid = user.uid;
    const snap2map = (snap) => {
      const m = {};
      snap.docs.forEach((d) => {
        m[d.id] = d.data();
      });
      return m;
    };
    const updateMap = (setter) => (snap) => {
      const next = snap2map(snap);
      setter((current) => (sameJson(current, next) ? current : next));
    };

    const unsubFav = onSnapshot(
      collection(db, "Lists", uid, "favorites"),
      updateMap(setFavoritesMap),
      snapshotErrorHandler("Lists/favorites"),
    );
    const unsubWatch = onSnapshot(
      collection(db, "Lists", uid, "watchList"),
      updateMap(setWatchListMap),
      snapshotErrorHandler("Lists/watchList"),
    );
    const unsubMov = onSnapshot(
      collection(db, "Lists", uid, "watchedMovies"),
      updateMap(setWatchedMoviesMap),
      snapshotErrorHandler("Lists/watchedMovies"),
    );
    const unsubTv = onSnapshot(
      collection(db, "Lists", uid, "watchedTv"),
      (snap) => {
        updateMap(setWatchedTvMap)(snap);
        setWatchedTvLoaded(true);
      },
      (error) => {
        setWatchedTvLoaded(true);
        snapshotErrorHandler("Lists/watchedTv")(error);
      },
    );

    return () => {
      unsubFav();
      unsubWatch();
      unsubMov();
      unsubTv();
    };
  }, [user?.uid]);

  // ── Tek seferlik migration: eski kök-dizi watchedTv[] → subcollection ──────
  // SeasonItem yeni modele (subcollection) yazıyor; eski "İzledim"/bölüm yazımları
  // kök diziye gidiyordu. Burada subcollection'da OLMAYAN eski dizileri taşıyıp
  // kök diziden çıkarıyoruz (çift sayımı önler). FAZ 6/7 deseni.
  const migratingRef = useRef(false);
  const migratingForUid = useRef(null);
  useEffect(() => {
    if (!user?.uid) return;
    // Kullanıcı değişince guard'ı sıfırla.
    if (migratingForUid.current !== user.uid) {
      migratingForUid.current = user.uid;
      migratingRef.current = false;
    }
    // Subcollection en az bir kez yüklenmeden migrate etme (aksi halde zaten taşınmış
    // bir diziyi eski veriyle ezebiliriz).
    if (migratingRef.current || !watchedTvLoaded) return;

    // Doc id artık `tv_${id}`; varlık kontrolünü doc.id KEY'iyle değil, doc
    // verisindeki `id` ALANIYLA yap (re-key sonrası key'ler tv_ olur).
    const subTvIdSet = new Set(
      Object.values(watchedTvMap || {}).map((s) => String(s?.id)),
    );

    // (1) Eski kök-dizi watchedTv[] → tek-doküman (gömülü seasons).
    const legacy = Array.isArray(allLists?.watchedTv) ? allLists.watchedTv : [];
    const pendingRoot = legacy.filter(
      (s) =>
        s &&
        s.id != null &&
        !subTvIdSet.has(String(s.id)) &&
        Array.isArray(s.seasons) &&
        s.seasons.length > 0,
    );

    // (2) Eski SeasonItem'ın ayrı seasons alt-koleksiyonu → show doküman'ına gömme.
    //     `seasons` alanı OLMAYAN show doküman'ları aday.
    const pendingSubdocs = Object.values(watchedTvMap || {}).filter(
      (s) => s && s.id != null && !Array.isArray(s.seasons),
    );

    if (pendingRoot.length === 0 && pendingSubdocs.length === 0) return;

    migratingRef.current = true;
    const uid = user.uid;
    (async () => {
      try {
        for (const show of pendingSubdocs) {
          await migrateSeasonSubdocs(uid, show.id);
        }
        for (const show of pendingRoot) {
          await migrateLegacyShow(uid, show);
        }
        if (pendingRoot.length > 0) {
          const migratedIds = new Set(pendingRoot.map((s) => String(s.id)));
          const remaining = legacy.filter((s) => !migratedIds.has(String(s.id)));
          await updateDoc(doc(db, "Lists", uid), { watchedTv: remaining });
        }
      } catch (e) {
        migratingRef.current = false; // sonraki snapshot'ta tekrar dene
        if (__DEV__) console.warn("[watchedTv] migration error:", e?.message);
      }
    })();
  }, [user?.uid, allLists, watchedTvMap, watchedTvLoaded]);

  // ── Tek seferlik: watchedTv doc id şemasını birleştir (`1399` → `tv_1399`) ──
  // Tüm liste öğesi doc id'leri `${type}_${id}` olsun (favorites/watchList karışık
  // olduğu için zorunlu; tutarlılık için watchedTv de). Ayrı guard — kanıtlanmış
  // root/subdoc migration'ına dokunmaz.
  const rekeyRef = useRef(false);
  const rekeyForUid = useRef(null);
  useEffect(() => {
    if (!user?.uid || !watchedTvLoaded) return;
    if (rekeyForUid.current !== user.uid) {
      rekeyForUid.current = user.uid;
      rekeyRef.current = false;
    }
    if (rekeyRef.current) return;

    // TÜM bare (tv_ olmayan) doc'lar aday: tv_ yoksa taşı, VARSA ikilemeyi gider
    // (sezonları birleştirip bare'i sil). Önceki sürüm tv_ varsa bare'i atlıyordu
    // → bare hiç silinmiyor, ikileme kalıcı oluyordu.
    const pendingRekey = Object.entries(watchedTvMap || {})
      .filter(([docId]) => !docId.startsWith("tv_"))
      .map(([docId, data]) => ({
        docId,
        data,
        existing: watchedTvMap["tv_" + String(data?.id ?? docId)] || null,
      }));
    if (pendingRekey.length === 0) return;

    rekeyRef.current = true;
    migrateWatchedTvDocIds(user.uid, pendingRekey).catch((e) => {
      rekeyRef.current = false; // sonraki snapshot'ta tekrar dene
      if (__DEV__) console.warn("[watchedTv] rekey error:", e?.message);
    });
  }, [user?.uid, watchedTvMap, watchedTvLoaded]);

  // ── Tek seferlik migration: eski kök-array film listeleri → subcollection ──
  // favorites/watchList/watchedMovies eski dev array'lerini her-öğe-ayrı-doküman
  // modeline taşır, sonra kök doc'tan array alanlarını siler (deleteField).
  // setDoc(merge) idempotent olduğundan map'ler henüz yüklenmese de güvenli.
  const movieMigratingRef = useRef(false);
  const movieMigratingForUid = useRef(null);
  useEffect(() => {
    if (!user?.uid) return;
    if (movieMigratingForUid.current !== user.uid) {
      movieMigratingForUid.current = user.uid;
      movieMigratingRef.current = false;
    }
    if (movieMigratingRef.current || !rootLoaded || !allLists) return;

    const hasLegacy = PREDEFINED_MOVIE_LISTS.some(
      (k) => Array.isArray(allLists[k]) && allLists[k].length > 0,
    );
    if (!hasLegacy) return;

    movieMigratingRef.current = true;
    const uid = user.uid;
    (async () => {
      try {
        await migrateLegacyMovieLists(uid, allLists, {
          favorites: favoritesMap,
          watchList: watchListMap,
          watchedMovies: watchedMoviesMap,
        });
      } catch (e) {
        movieMigratingRef.current = false; // sonraki snapshot'ta tekrar dene
        if (__DEV__) console.warn("[movieLists] migration error:", e?.message);
      }
    })();
  }, [
    user?.uid,
    allLists,
    rootLoaded,
    favoritesMap,
    watchListMap,
    watchedMoviesMap,
  ]);

  // ── bare+tv_ ikileme giderme — TÜM downstream tüketiciler için tek nokta ──
  // Raw watchedTvMap'te aynı dizi hem bare `1399` hem `tv_1399` olarak
  // durabilir (migration henüz koşmadıysa). Burada id bazlı tekilleştirip
  // temiz bir map üretiyoruz; context value ve combinedLists bunu kullanır.
  const dedupedWatchedTvMap = useMemo(() => {
    const entries = Object.entries(watchedTvMap || {});
    if (entries.length === 0) return watchedTvMap;
    const deduped = dedupeWatchedTvEntries(entries);
    // Eğer boyut aynıysa ikileme yoktur — yeni obje oluşturmaya gerek yok.
    if (deduped.length === entries.length) return watchedTvMap;
    const m = {};
    deduped.forEach((item) => {
      m[`tv_${item.id}`] = item;
    });
    return m;
  }, [watchedTvMap]);

  const firestoreStatusIndex = useMemo(
    () =>
      buildStatusIndex({
        allLists,
        favoritesMap,
        watchListMap,
        watchedMoviesMap,
        watchedTvMap: dedupedWatchedTvMap,
      }),
    [allLists, favoritesMap, watchListMap, watchedMoviesMap, dedupedWatchedTvMap],
  );

  const hasFirestoreIndex =
    rootLoaded ||
    Object.keys(firestoreStatusIndex.movie).length > 0 ||
    Object.keys(firestoreStatusIndex.tv).length > 0;

  const statusIndex = hasFirestoreIndex
    ? firestoreStatusIndex
    : cachedStatusIndex;

  // Debounce'lu cache yazımı: açılışta 5 listener'ın snapshot'ları art arda
  // gelirken her birinde büyük JSON.stringify + AsyncStorage yazmak JS thread'i
  // kilitliyordu. Yazma yalnız veri duraklayınca (2,5 sn) bir kez yapılır;
  // içerik/davranış aynı, sadece ara yazımlar birleştirilir.
  useEffect(() => {
    if (!user?.uid || !hasFirestoreIndex) return undefined;

    if (!shouldPersistInternetData({ category: "lists" })) return undefined;

    const uid = user.uid;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(
        `${CACHE_PREFIX}${uid}`,
        JSON.stringify({
          allLists,
          statusIndex: firestoreStatusIndex,
          ts: Date.now(),
        }),
      ).catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [allLists, firestoreStatusIndex, hasFirestoreIndex, user?.uid]);

  const otherListKeys = useMemo(() => {
    if (!allLists) return [];
    return Object.keys(allLists).filter((key) => !PREDEFINED.has(key));
  }, [allLists]);

  const allListKeys = useMemo(() => {
    if (!allLists) return [];
    return Object.keys(allLists);
  }, [allLists]);

  // Subcollection'dan türetilen öğe dizileri — kök-array tüketicilerinin
  // (oyun havuzları, AI bağlamı) `allLists.favorites/watchList/watchedMovies`
  // yerine kullanacağı tek kaynak.
  const favoritesItems = useMemo(() => Object.values(favoritesMap), [favoritesMap]);
  const watchListItems = useMemo(() => Object.values(watchListMap), [watchListMap]);
  const watchedMoviesItems = useMemo(
    () => Object.values(watchedMoviesMap),
    [watchedMoviesMap],
  );

  // Eski `allLists` (kök-array) şeklinde, ama öntanımlı listeler + watchedTv
  // subcollection'dan türetilir; özel listeler (Part B'ye kadar) kök-array'den.
  // Oyun havuzları ve AI bağlamı gibi "tüm listeyi dizi olarak" isteyen
  // tüketiciler bunu kullanır (allLists yerine).
  const combinedLists = useMemo(() => {
    const out = {};
    if (allLists) {
      Object.entries(allLists).forEach(([k, v]) => {
        if (Array.isArray(v) && !PREDEFINED.has(k) && k !== "customLists") {
          out[k] = v;
        }
      });
    }
    out.favorites = favoritesItems;
    out.watchList = watchListItems;
    out.watchedMovies = watchedMoviesItems;
    out.watchedTv = Object.values(dedupedWatchedTvMap);
    return out;
  }, [allLists, favoritesItems, watchListItems, watchedMoviesItems, dedupedWatchedTvMap]);

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
    ],
  );

  return (
    <ListStatusContext.Provider value={value}>
      {children}
    </ListStatusContext.Provider>
  );
};
