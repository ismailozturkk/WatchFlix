import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { doc, collection, onSnapshot } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
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
    const subFavIds = new Set(Object.values(favoritesMap).map((i) => i.id));
    const subWatchIds = new Set(Object.values(watchListMap).map((i) => i.id));
    const subMovIds = new Set(Object.values(watchedMoviesMap).map((i) => i.id));
    const subTvIds = new Set(Object.values(watchedTvMap).map((i) => i.id));

    (allLists.favorites || []).forEach(({ id, type }) => {
      if (!subFavIds.has(id)) mark(type, id, "inFavorites");
    });
    (allLists.watchList || []).forEach(({ id, type }) => {
      if (!subWatchIds.has(id)) mark(type, id, "inWatchList");
    });
    (allLists.watchedMovies || []).forEach(({ id, type }) => {
      if (!subMovIds.has(id)) mark(type || "movie", id, "isWatched");
    });
    (allLists.watchedTv || []).forEach(({ id, type }) => {
      if (!subTvIds.has(id)) mark(type || "tv", id, "isWatched");
    });

    Object.keys(allLists)
      .filter((key) => !PREDEFINED.has(key))
      .forEach((listKey) => {
        (allLists[listKey] || []).forEach(({ id, type }) =>
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
    if (!user?.uid) return undefined;

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
      updateMap(setWatchedTvMap),
      snapshotErrorHandler("Lists/watchedTv"),
    );

    return () => {
      unsubFav();
      unsubWatch();
      unsubMov();
      unsubTv();
    };
  }, [user?.uid]);

  const firestoreStatusIndex = useMemo(
    () =>
      buildStatusIndex({
        allLists,
        favoritesMap,
        watchListMap,
        watchedMoviesMap,
        watchedTvMap,
      }),
    [allLists, favoritesMap, watchListMap, watchedMoviesMap, watchedTvMap],
  );

  const hasFirestoreIndex =
    rootLoaded ||
    Object.keys(firestoreStatusIndex.movie).length > 0 ||
    Object.keys(firestoreStatusIndex.tv).length > 0;

  const statusIndex = hasFirestoreIndex
    ? firestoreStatusIndex
    : cachedStatusIndex;

  useEffect(() => {
    if (!user?.uid || !hasFirestoreIndex) return;

    if (!shouldPersistInternetData()) return;

    AsyncStorage.setItem(
      `${CACHE_PREFIX}${user.uid}`,
      JSON.stringify({
        allLists,
        statusIndex: firestoreStatusIndex,
        ts: Date.now(),
      }),
    ).catch(() => {});
  }, [allLists, firestoreStatusIndex, hasFirestoreIndex, user?.uid]);

  const otherListKeys = useMemo(() => {
    if (!allLists) return [];
    return Object.keys(allLists).filter((key) => !PREDEFINED.has(key));
  }, [allLists]);

  const allListKeys = useMemo(() => {
    if (!allLists) return [];
    return Object.keys(allLists);
  }, [allLists]);

  const value = useMemo(
    () => ({
      allLists,
      loading,
      statusIndex,
      otherListKeys,
      allListKeys,
      watchedTvMap,
    }),
    [allLists, loading, statusIndex, otherListKeys, allListKeys, watchedTvMap],
  );

  return (
    <ListStatusContext.Provider value={value}>
      {children}
    </ListStatusContext.Provider>
  );
};
