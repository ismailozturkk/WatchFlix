import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { collection, onSnapshot } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { snapshotErrorHandler } from "../utils/firestoreError";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";

// Kullanıcının içerik-bazlı ETKİNLİK durumu (puan verdi mi / yorum yaptı mı).
// ListStatusContext'in kardeşi: o "hangi listede" sorusuna, bu "ne yaptı"
// sorusuna cevap verir. ListBadges ikisini birleştirip poster rozetlerini çizer.
//
// Kaynaklar (denormalize mirror'lar, yazma ilgili yerlerde):
//   Users/{uid}/myRatings/{mediaKey}   → ratingsService.setMyRating
//                                        { mediaType, mediaId, rating, ... }
//   Users/{uid}/myComments/{commentId} → components/Comment.js (film/dizi)
//                                        { kind:'movie'|'tv'|'post', targetId, ... }
//                                        (kind:'post' burada sayılmaz)
//
// Index şekli statusIndex ile aynı desen:
//   { movie: { [id]: { hasRating, hasComment } }, tv: { ... } }

const CACHE_PREFIX = "media_activity_cache_";
const EMPTY_INDEX = Object.freeze({ movie: {}, tv: {} });

const MediaActivityContext = createContext();

export const useMediaActivityContext = () => useContext(MediaActivityContext);

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const buildActivityIndex = ({ ratingsMap, commentsMap }) => {
  const index = { movie: {}, tv: {} };

  const mark = (rawType, id, field) => {
    if (id == null) return;
    const bucket = rawType === "tv" ? index.tv : index.movie;
    if (!bucket[id]) {
      bucket[id] = { hasRating: false, hasComment: false };
    }
    bucket[id][field] = true;
  };

  Object.values(ratingsMap).forEach(({ mediaType, mediaId }) =>
    mark(mediaType, mediaId, "hasRating"),
  );
  Object.values(commentsMap).forEach(({ kind, targetId }) => {
    if (kind !== "movie" && kind !== "tv") return; // post yorumları içerik rozeti değil
    mark(kind, targetId, "hasComment");
  });

  return index;
};

export const MediaActivityProvider = ({ children }) => {
  const { user } = useAuth();
  const [ratingsMap, setRatingsMap] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [ratingsLoaded, setRatingsLoaded] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [cachedIndex, setCachedIndex] = useState(EMPTY_INDEX);
  const cacheHydratedForUid = useRef(null);

  // Açılışta cache'ten hızlı hidrasyon (rozetler auth/snapshot beklemeden görünsün).
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
        if (parsed?.activityIndex) setCachedIndex(parsed.activityIndex);
      } catch {}
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setRatingsMap({});
      setCommentsMap({});
      setCachedIndex(EMPTY_INDEX);
      setRatingsLoaded(false);
      setCommentsLoaded(false);
      return undefined;
    }

    const uid = user.uid;
    const snap2map = (snap) => {
      const m = {};
      snap.docs.forEach((d) => {
        m[d.id] = d.data();
      });
      return m;
    };
    const updateMap = (setter, setDone) => (snap) => {
      const next = snap2map(snap);
      setter((current) => (sameJson(current, next) ? current : next));
      setDone(true);
    };

    const unsubRatings = onSnapshot(
      collection(db, "Users", uid, "myRatings"),
      updateMap(setRatingsMap, setRatingsLoaded),
      snapshotErrorHandler("Users/myRatings"),
    );
    const unsubComments = onSnapshot(
      collection(db, "Users", uid, "myComments"),
      updateMap(setCommentsMap, setCommentsLoaded),
      snapshotErrorHandler("Users/myComments"),
    );

    return () => {
      unsubRatings();
      unsubComments();
    };
  }, [user?.uid]);

  const firestoreIndex = useMemo(
    () => buildActivityIndex({ ratingsMap, commentsMap }),
    [ratingsMap, commentsMap],
  );

  // İKİ snapshot da gelene kadar cache'teki index gösterilir (ListStatus
  // deseni) — tek koleksiyon erken gelirse diğerinin rozetleri anlık kaybolmasın.
  const loaded = ratingsLoaded && commentsLoaded;
  const activityIndex = loaded ? firestoreIndex : cachedIndex;

  // Debounce'lu cache yazımı — iki listener art arda tetiklenince tek yazım.
  useEffect(() => {
    if (!user?.uid || !loaded) return undefined;
    if (!shouldPersistInternetData({ category: "activity" })) return undefined;

    const uid = user.uid;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(
        `${CACHE_PREFIX}${uid}`,
        JSON.stringify({ activityIndex: firestoreIndex, ts: Date.now() }),
      ).catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [firestoreIndex, loaded, user?.uid]);

  const value = useMemo(() => ({ activityIndex }), [activityIndex]);

  return (
    <MediaActivityContext.Provider value={value}>
      {children}
    </MediaActivityContext.Provider>
  );
};
