import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { intlLocaleOf } from "../utils/appLanguages";
import useStartupGate from "../hooks/useStartupGate";
import useAppActive from "../hooks/useAppActive";
import {
  fetchSharedListItems,
  onSharedListItemsChanged,
  subscribeToMySharedLists,
} from "../services/sharedListsService";
import { peekStamped, readStamped, stampOf, writeStamped } from "../utils/stampedCache";

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

// Öğeler canlı DİNLENMEZ: eskiden her ortak liste için ayrı, hep-açık bir dinleyici vardı ve
// her yeniden bağlanmada tüm öğeler baştan faturalanıyordu (3 liste × 50 öğe = 150 okuma).
// Artık liste belgesinin updatedAt damgası (üyelik sorgusu zaten canlı) değişince o liste bir
// kez okunur; damga aynıysa cihaz önbelleği. Damgayı tazelemeyen yazımlara karşı (eski
// istemciler; kural yayınlanana dek kurucu olmayan üyeler) kayıt en fazla bu kadar geçerli,
// süre ön plana dönüşte de denetlenir. Liste ekranı (SharedListScreen) kendi canlı dinleyicisini
// kullanmaya devam eder.
const SHARED_ITEMS_NS = "sharedListItems";
const SHARED_ITEMS_MAX_AGE = 30 * 60 * 1000;

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
  const { language } = useLanguage();
  // Liste adı sıralaması uygulama dilinin kurallarıyla (ö/ü/ñ/ç harfleri dile göre yerleşir).
  const sortLocale = intlLocaleOf(language);
  const sortLocaleRef = useRef(sortLocale);
  sortLocaleRef.current = sortLocale;
  const [sharedLists, setSharedLists] = useState([]);
  const [sharedItemsByList, setSharedItemsByList] = useState({});
  const [loading, setLoading] = useState(true);
  const appActive = useAppActive();

  // Açılış yolunda bunu okuyan tek şey poster rozetlerindeki "shared" işareti;
  // tohum/cache olmadığı için rozet kapı+snapshot kadar geç görünür (kayıp
  // yok, kozmetik). Üyelik listesi gelmeden item listener'ları da açılmıyor —
  // ikinci effect'i ayrıca kapılamaya gerek yok. Kademeler: hooks/useStartupGate.js.
  const startupReady = useStartupGate(1800);

  useEffect(() => {
    if (!startupReady) return undefined;
    if (!user?.uid) {
      setSharedLists([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeToMySharedLists(user.uid, (lists) => {
      // İsim sırasına göre sabit sıralama — kart dizilimi snapshot'tan
      // snapshot'a zıplamasın.
      lists.sort((a, b) => (a.name || "").localeCompare(b.name || "", sortLocaleRef.current));
      setSharedLists(lists);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, startupReady]);

  // Dil değişince mevcut dizi yeni dilin sırasına girsin (sonraki snapshot'ı beklemeden).
  useEffect(() => {
    setSharedLists((prev) =>
      prev.length > 1
        ? [...prev].sort((a, b) => (a.name || "").localeCompare(b.name || "", sortLocale))
        : prev,
    );
  }, [sortLocale]);

  // Üyelik sorgusu her item ekleme/çıkarmada (updatedAt bump) yeni snapshot
  // üretir; dizi kimliği her seferinde değişir. Etki yalnız liste kümesi ya da
  // bir listenin damgası değişince çalışsın diye anahtar string.
  const sharedStampsKey = sharedLists
    .map((list) => `${list.id}@${stampOf(list.updatedAt)}`)
    .join(",");
  const sharedListsRef = useRef(sharedLists);
  sharedListsRef.current = sharedLists;

  const loadListItems = useCallback(
    (uid, listId, stamp, isCancelled = () => false) =>
      fetchSharedListItems(listId)
        .then((items) => {
          if (stamp) writeStamped(SHARED_ITEMS_NS, `${uid}/${listId}`, stamp, items);
          if (!isCancelled()) {
            setSharedItemsByList((current) => ({ ...current, [listId]: items }));
          }
        })
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    const uid = user?.uid;
    const lists = sharedListsRef.current;
    if (!uid || lists.length === 0) {
      setSharedItemsByList({});
      return undefined;
    }
    if (!appActive) return undefined;
    let cancelled = false;
    const known = {};
    const stale = [];
    lists.forEach((list) => {
      const key = `${uid}/${list.id}`;
      const stamp = stampOf(list.updatedAt);
      const fresh = stamp ? readStamped(SHARED_ITEMS_NS, key, stamp, SHARED_ITEMS_MAX_AGE) : null;
      if (fresh) {
        known[list.id] = fresh;
        return;
      }
      // Damga değişti / süresi doldu: taze sayfa gelene dek son bilinen öğeler çizilir.
      // Damga 0 = sunucu saati henüz yazılmadı (kendi bekleyen yazımımız): gelince tekrar bakılır.
      const last = peekStamped(SHARED_ITEMS_NS, key);
      if (last) known[list.id] = last;
      // Damgasız ve hiç okunmamış liste (eski kayıt) yine de bir kez okunur; önbelleğe girmez.
      if (stamp || !last) stale.push([list.id, stamp]);
    });
    setSharedItemsByList((current) => {
      const next = {};
      lists.forEach((list) => {
        const items = known[list.id] ?? current[list.id];
        if (items) next[list.id] = items;
      });
      return next;
    });
    stale.forEach(([listId, stamp]) => loadListItems(uid, listId, stamp, () => cancelled));
    return () => {
      cancelled = true;
    };
  }, [user?.uid, sharedStampsKey, appActive, loadListItems]);

  // Bu cihazdaki ekleme/çıkarma: damga tazelenmese bile (kural) o liste hemen yeniden okunur.
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return undefined;
    return onSharedListItemsChanged((listId) => {
      const list = sharedListsRef.current.find((entry) => entry.id === listId);
      if (list) loadListItems(uid, listId, stampOf(list.updatedAt));
    });
  }, [user?.uid, loadListItems]);

  const sharedListIndex = useMemo(() => {
    if (!Object.keys(sharedItemsByList).length) return EMPTY_SHARED_LIST_INDEX;
    return buildSharedListIndex(sharedItemsByList);
  }, [sharedItemsByList]);

  // sharedItemsByList: listId → item[] (canlı). Detay ekranındaki "Ortak
  // Listeler" bölümü üyelik durumunu buradan okur; böylece başka bir üye
  // ekleyip çıkardığında kart rengi de anında güncellenir.
  const value = useMemo(
    () => ({ sharedLists, sharedItemsByList, sharedListIndex, loading }),
    [sharedLists, sharedItemsByList, sharedListIndex, loading],
  );

  return (
    <SharedListsContext.Provider value={value}>
      {children}
    </SharedListsContext.Provider>
  );
};
