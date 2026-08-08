import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Keys, get, set, getActiveUser } from "../services/storage";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { snapshotErrorHandler } from "../utils/firestoreError";
import { sameJson } from "../utils/sameData";
import useStartupGate from "../hooks/useStartupGate";

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

// Anahtar öneki artık registry'de (Keys.mediaActivity, cache deposu).
const EMPTY_INDEX = Object.freeze({ movie: {}, tv: {} });

const MediaActivityContext = createContext();

export const useMediaActivityContext = () => useContext(MediaActivityContext);

// `sameJson` utils/sameData.js'e taşındı: aynı satır bu dosyada, TvShowContex,
// MovieContex ve ListStatusContext'te ayrı ayrı yazılıydı.

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
    // Kapsam (dizi/sezon/bölüm) burada BİLEREK yok sayılır: rozet "bu içeriğe
    // yorum yaptım" demektir, bir sezona yazmak da diziye yorum yapmaktır.
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
  // AÇILIŞ TOHUMU — rozetler auth/snapshot beklemeden görünsün.
  //
  // Eskiden bu okuma bir `useEffect` içindeydi, yani önbellek DOLU olsa bile
  // ilk kare rozetsiz çiziliyordu. MMKV senkron olduğu için okuma doğrudan
  // başlangıç değeri olabiliyor. `uid` ilk render'da genelde null (Firebase
  // oturumu asenkron çözülüyor); son aktif kullanıcı depodan senkron okunuyor.
  const ilkTohum = useMemo(
    () => {
      const uid = user?.uid ?? getActiveUser();
      return uid ? get(Keys.mediaActivity, { uid })?.activityIndex ?? null : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [cachedIndex, setCachedIndex] = useState(ilkTohum ?? EMPTY_INDEX);
  const cacheHydratedForUid = useRef(null);

  // uid DEĞİŞİMİ (hesap geçişi) için; ilk render'ı yukarıdaki tohum karşılıyor.
  useEffect(() => {
    const uid = user?.uid ?? getActiveUser();
    if (!uid || cacheHydratedForUid.current === uid) return;
    cacheHydratedForUid.current = uid;

    const parsed = get(Keys.mediaActivity, { uid });
    if (parsed?.activityIndex) setCachedIndex(parsed.activityIndex);
  }, [user?.uid]);

  // Poster rozetleri ilk kareyi yukarıdaki senkron tohumdan (cachedIndex)
  // çiziyor; canlı listener'lar tazeleme işi — splash penceresinin dışına.
  // Kademeler: hooks/useStartupGate.js.
  const startupReady = useStartupGate(1800);

  useEffect(() => {
    if (!startupReady) return undefined;
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
  }, [user?.uid, startupReady]);

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

    // "Verileri indir" ayarına bilerek TABİ DEĞİL: o ayar TMDB içeriği içindir,
    // buradaki veri kullanıcının kendi puan/yorum etkinliği.
    const uid = user.uid;
    const timer = setTimeout(() => {
      set(Keys.mediaActivity, { activityIndex: firestoreIndex, ts: Date.now() }, { uid });
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
