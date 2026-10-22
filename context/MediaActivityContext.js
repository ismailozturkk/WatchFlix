import { buildActivityFromRoot } from "../utils/mediaActivityIndex";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { Keys, set, getActiveUser, useStored } from "../services/storage";
import { useAuth } from "./AuthContext";
import { useListStatusContext } from "./ListStatusContext";

// Kullanıcının içerik-bazlı ETKİNLİK durumu (puan verdi mi / yorum yaptı mı).
// Artık Lists/{uid}.activityIndex üzerinden tek bir dokümandan 0 ek okuma ile beslenir.
//
// Index formatı:
//   { movie: { [id]: { hasRating, hasComment } }, tv: { ... } }

const EMPTY_INDEX = Object.freeze({ movie: {}, tv: {} });

const MediaActivityContext = createContext();

export const useMediaActivityContext = () => useContext(MediaActivityContext);

export const MediaActivityProvider = ({ children }) => {
  const { user } = useAuth();
  const { activityIndex: rootActivity } = useListStatusContext() || {};

  // ÖNBELLEK — MMKV'den senkron ve REAKTİF okuma. Eskiden açılışta bir kez state'e
  // kopyalanıyordu; hesap SIFIRLANINCA anahtar silinse bile ekran eski "puanladım /
  // yorumladım" işaretlerini göstermeye devam ediyordu (canlı kök belge boşken yedek
  // olarak bu kopya kullanılır). useStored silinmeyi/yazımı izler.
  const cacheUid = user?.uid ?? getActiveUser();
  const stored = useStored(Keys.mediaActivity, cacheUid ? { uid: cacheUid } : undefined);
  const cachedIndex = stored?.activityIndex ?? EMPTY_INDEX;

  const liveIndex = useMemo(
    () => (rootActivity ? buildActivityFromRoot(rootActivity) : null),
    [rootActivity],
  );

  const activityIndex = liveIndex || cachedIndex;

  // Debounce'lu cache yazımı
  useEffect(() => {
    if (!user?.uid || !liveIndex) return undefined;
    const uid = user.uid;
    const timer = setTimeout(() => {
      set(Keys.mediaActivity, { activityIndex: liveIndex, ts: Date.now() }, { uid });
    }, 2500);
    return () => clearTimeout(timer);
  }, [liveIndex, user?.uid]);

  const value = useMemo(() => ({ activityIndex }), [activityIndex]);

  return (
    <MediaActivityContext.Provider value={value}>
      {children}
    </MediaActivityContext.Provider>
  );
};
