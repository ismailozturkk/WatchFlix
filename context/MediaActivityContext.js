import { buildActivityFromRoot } from "../utils/mediaActivityIndex";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Keys, get, set, getActiveUser } from "../services/storage";
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

  // AÇILIŞ TOHUMU — MMKV'den senkron okuma
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

  useEffect(() => {
    const uid = user?.uid ?? getActiveUser();
    if (!uid || cacheHydratedForUid.current === uid) return;
    cacheHydratedForUid.current = uid;

    const parsed = get(Keys.mediaActivity, { uid });
    if (parsed?.activityIndex) setCachedIndex(parsed.activityIndex);
  }, [user?.uid]);

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
