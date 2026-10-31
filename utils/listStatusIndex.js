import { RESERVED_LIST_NAMES } from "./listShare";

export const EMPTY_LIST_STATUS = Object.freeze({
  inWatchList: false,
  inFavorites: false,
  isWatched: false,
  isInOtherLists: false,
});
const isMap = (value) => value != null && typeof value === "object" && !Array.isArray(value);

// Later sources override individual flags, including explicit removals (false).
export function mergeStatusIndexes(...sources) {
  const result = { movie: {}, tv: {} };
  for (const source of sources) {
    for (const type of ["movie", "tv"]) {
      if (!isMap(source?.[type])) continue;
      for (const [id, status] of Object.entries(source[type])) {
        if (!isMap(status)) continue;
        const next = { ...(result[type][id] || EMPTY_LIST_STATUS) };
        for (const flag of Object.keys(EMPTY_LIST_STATUS)) {
          if (typeof status[flag] === "boolean") next[flag] = status[flag];
        }
        result[type][id] = next;
      }
    }
  }
  return result;
}

export function resolveStatusIndex(root, fallback, cached) {
  const index = mergeStatusIndexes(cached, fallback, root?.statusIndex);
  // Legacy custom lists live entirely in the root. Their arrays are the
  // current membership source, even if an old status flag was never cleared.
  if (root && !root.customLists?.length) {
    for (const type of ["movie", "tv"]) {
      Object.entries(index[type]).forEach(([id, status]) => {
        status.isInOtherLists = !!fallback?.[type]?.[id]?.isInOtherLists;
      });
    }
  }
  return index;
}

const hasEntries = (value) => isMap(value) && Object.keys(value).length > 0;

/**
 * Bekleyen (henüz sunucuya yazılmamış) işlemlerin bayraklarını indeksin üstüne
 * bindirir. `overlay` biçimi indeksle aynı: { movie: { [id]: { inFavorites: true } }, tv: {...} }.
 * Bindirme boşsa AYNI referans döner (context gereksiz yeniden hesaplamasın).
 *
 * NEDEN BİNDİRME: kök dokümandaki `statusIndex` sunucudan gelir ve transaction
 * commit olana kadar değişmez; resolveStatusIndex'te kök, yerel tahminden önceliklidir.
 * Düğmeye basıldığı an ekranın tepki vermesi için işlemin NİYETİ kısa süre
 * indeksin üstüne konur, işlem bitince/başarısız olunca kalkar.
 */
export function applyStatusOverlay(index, overlay) {
  if (!hasEntries(overlay?.movie) && !hasEntries(overlay?.tv)) return index;
  const next = { movie: { ...(index?.movie || {}) }, tv: { ...(index?.tv || {}) } };
  for (const type of ["movie", "tv"]) {
    if (!hasEntries(overlay[type])) continue;
    for (const [id, flags] of Object.entries(overlay[type])) {
      next[type][id] = { ...(next[type][id] || EMPTY_LIST_STATUS), ...flags };
    }
  }
  return next;
}

// Sunucudaki durum bayrağı ↔ yerel liste haritası eşlemesi. `type` verilmişse
// o liste yalnız o tipi taşır (izlenen filmler film, izlenen diziler dizi).
const DRIFT_LISTS = [
  { listKey: "favorites", flag: "inFavorites" },
  { listKey: "watchList", flag: "inWatchList" },
  { listKey: "watchedMovies", flag: "isWatched", type: "movie" },
  { listKey: "watchedTv", flag: "isWatched", type: "tv" },
];

/**
 * Sunucudaki `statusIndex` ile yerel liste haritaları ARASINDA üyelik sapması
 * olan listeleri döndürür.
 *
 * Yerel haritalar yalnızca bu cihazın kendi yazımlarıyla ve açılıştaki tek
 * seferlik indirmeyle güncellenir; kök dokümandaki `statusIndex` ise canlı
 * dinlenir. Başka bir cihazda yapılan ekleme/silme, ya da yazım commit olduktan
 * sonra yerel güncellemeden önce uygulamanın kapanması, ikisini ayırır: detay
 * ekranı "listede" der, liste ekranı öğeyi göstermez. Bu fonksiyon o ayrışmayı
 * SIFIR okumayla tespit eder; yalnız sapan listeler yeniden çekilir.
 *
 * Yalnız AÇIK bayraklar karşılaştırılır:
 *   • bayrak true  ama yerelde yok → sunucuda var, bizde eksik
 *   • bayrak false ama yerelde var → sunucuda silinmiş, bizde kalmış
 * Bayrağı hiç olmayan öğe (eski kayıt) sapma SAYILMAZ.
 *
 * @param {{movie?:object, tv?:object}} statusIndex   sunucudan gelen kök statusIndex
 * @param {{favorites?:object, watchList?:object, watchedMovies?:object, watchedTv?:object}} maps
 *        listKey → { [docId]: öğe }; `undefined` olan liste (henüz yüklenmemiş) atlanır
 * @returns {string[]} sapan liste anahtarları
 */
export function findDriftedLists(statusIndex, maps) {
  if (!isMap(statusIndex)) return [];
  const drifted = [];
  for (const { listKey, flag, type: onlyType } of DRIFT_LISTS) {
    const map = maps?.[listKey];
    if (!isMap(map)) continue;

    const local = new Set();
    Object.values(map).forEach((item) => {
      if (!item || item.id == null) return;
      const type = onlyType || (item.type === "tv" ? "tv" : "movie");
      local.add(`${type}:${item.id}`);
    });

    let drift = false;
    for (const type of ["movie", "tv"]) {
      if (onlyType && onlyType !== type) continue;
      const bucket = statusIndex[type];
      if (!isMap(bucket)) continue;
      for (const [id, status] of Object.entries(bucket)) {
        const present = local.has(`${type}:${id}`);
        if ((status?.[flag] === true && !present) || (status?.[flag] === false && present)) {
          drift = true;
          break;
        }
      }
      if (drift) break;
    }
    if (drift) drifted.push(listKey);
  }
  return drifted;
}

/**
 * Sapan bir listeyi TAMAMEN yeniden çekmek yerine onarım planı (findDriftedLists ile aynı kural):
 *   • missing: bayrak true ama yerelde yok → sunucudan tek tek okunacak belge kimlikleri (`tür_id`)
 *   • extra:   bayrak false ama yerelde var → yerelden silinecek anahtarlar
 * Tam yeniden çekim liste boyu kadar okuma demekti (1.000 izlemeli kütüphanede 1.000); onarım yalnız
 * eksik öğe sayısı kadar okur, silme hiç okumaz.
 *
 * @returns {{missing: string[], extra: string[]} | null} liste ya da veri tanınmıyorsa null
 */
export function planDriftRepair(statusIndex, listKey, map) {
  const spec = DRIFT_LISTS.find((entry) => entry.listKey === listKey);
  if (!spec || !isMap(statusIndex) || !isMap(map)) return null;

  const localKeys = new Map(); // "tür:id" → yerel anahtarlar (eski "id" + yeni "tür_id" birlikte olabilir)
  Object.entries(map).forEach(([key, item]) => {
    if (!item || item.id == null) return;
    const type = spec.type || (item.type === "tv" ? "tv" : "movie");
    const mediaKey = `${type}:${item.id}`;
    localKeys.set(mediaKey, [...(localKeys.get(mediaKey) || []), key]);
  });

  const missing = [];
  const extra = [];
  for (const type of ["movie", "tv"]) {
    if (spec.type && spec.type !== type) continue;
    const bucket = statusIndex[type];
    if (!isMap(bucket)) continue;
    for (const [id, status] of Object.entries(bucket)) {
      const keys = localKeys.get(`${type}:${id}`);
      if (status?.[spec.flag] === true && !keys) missing.push(`${type}_${id}`);
      else if (status?.[spec.flag] === false && keys) extra.push(...keys);
    }
  }
  return { missing, extra };
}

export function buildStatusIndex({ allLists, favoritesMap = {}, watchListMap = {}, watchedMoviesMap = {}, watchedTvMap = {}, customItemsMap = {} } = {}) {
  const index = { movie: {}, tv: {} };
  const mark = (item, flag, fallback = "movie") => {
    if (!item || item.id == null) return;
    const type = (item.type || fallback) === "tv" ? "tv" : "movie";
    index[type][item.id] = { ...(index[type][item.id] || EMPTY_LIST_STATUS), [flag]: true };
  };
  for (const [key, map, flag, type] of [
    ["favorites", favoritesMap, "inFavorites", "movie"],
    ["watchList", watchListMap, "inWatchList", "movie"],
    ["watchedMovies", watchedMoviesMap, "isWatched", "movie"],
    ["watchedTv", watchedTvMap, "isWatched", "tv"],
    ["customItems", customItemsMap, "isInOtherLists", "movie"],
  ]) {
    Object.values(map || {}).forEach((item) => mark(item, flag, type));
    if (Array.isArray(allLists?.[key])) allLists[key].forEach((item) => mark(item, flag, type));
  }
  Object.entries(allLists || {}).forEach(([key, items]) => {
    if (!RESERVED_LIST_NAMES.includes(key) && Array.isArray(items)) {
      items.forEach((item) => mark(item, "isInOtherLists"));
    }
  });
  return index;
}
