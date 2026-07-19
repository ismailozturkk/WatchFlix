import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import {
  subscribeToMySharedLists,
  subscribeToSharedListItems,
} from "../services/sharedListsService";

// Kullanıcının üyesi olduğu ORTAK listeler (SharedLists koleksiyonu).
// Tek array-contains aboneliği; ListsViewScreen, detay ekranı "Diğer Listeler"
// modalı ve SharedListScreen buradan okur. Poster rozetleri için de yalnızca
// medya id'si bazlı kompakt bir ortak-liste indeksi yayınlanır.

const SharedListsContext = createContext();

const EMPTY_SHARED_LIST_INDEX = Object.freeze({
  movie: Object.freeze({}),
  tv: Object.freeze({}),
});

const normalizeSharedItemType = (type) => (type === "tv" ? "tv" : "movie");

const buildSharedListIndex = (itemsByList) => {
  const next = { movie: {}, tv: {} };

  Object.values(itemsByList).forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (item?.id == null) return;
      next[normalizeSharedItemType(item.type)][String(item.id)] = true;
    });
  });

  return next;
};

export const useSharedLists = () => useContext(SharedListsContext);

export const SharedListsProvider = ({ children }) => {
  const { user } = useAuth();
  const [sharedLists, setSharedLists] = useState([]);
  const [sharedItemsByList, setSharedItemsByList] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setSharedLists([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeToMySharedLists(user.uid, (lists) => {
      // İsim sırasına göre sabit sıralama — kart dizilimi snapshot'tan
      // snapshot'a zıplamasın.
      lists.sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"));
      setSharedLists(lists);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const sharedListIds = useMemo(
    () => sharedLists.map((list) => list.id).filter(Boolean),
    [sharedLists],
  );
  // Üyelik sorgusu her item ekleme/çıkarmada (updatedAt bump) yeni snapshot
  // üretir; id İÇERİĞİ değişmese de dizi kimliği değişir. Dep olarak diziyi
  // kullanmak tüm item listener'larını söküp yeniden kurar ve indeksi anlık
  // boşaltırdı — string key yalnızca gerçek üyelik değişiminde farklılaşır.
  const sharedListIdsKey = sharedListIds.join(",");

  useEffect(() => {
    if (!user?.uid || sharedListIds.length === 0) {
      setSharedItemsByList({});
      return undefined;
    }

    setSharedItemsByList({});
    const unsubs = sharedListIds.map((listId) =>
      subscribeToSharedListItems(listId, (items) => {
        setSharedItemsByList((current) => ({ ...current, [listId]: items }));
      }),
    );

    return () => {
      unsubs.forEach((unsub) => unsub?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, sharedListIdsKey]);

  const sharedListIndex = useMemo(() => {
    if (!Object.keys(sharedItemsByList).length) return EMPTY_SHARED_LIST_INDEX;
    return buildSharedListIndex(sharedItemsByList);
  }, [sharedItemsByList]);

  const value = useMemo(
    () => ({ sharedLists, sharedListIndex, loading }),
    [sharedLists, sharedListIndex, loading],
  );

  return (
    <SharedListsContext.Provider value={value}>
      {children}
    </SharedListsContext.Provider>
  );
};
