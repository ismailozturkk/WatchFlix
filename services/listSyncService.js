// services/listSyncService.js
//
// Yerel Önbellek & Delta Senkronizasyon Katmanı (Offline-First / Zero-Read Sync)
//
// ── AMACI ────────────────────────────────────────────────────────────────────
// Liste ekranları açıldığında Firestore'daki yüzlerce/binlerce dokümanı tekrar tekrar
// indirmek yerine:
// 1. Veriyi yerel depodan (snapshotCache / cacheStore) SENKRON olarak anında (0 ms, 0 Read) getirir.
// 2. Yalnızca değişen/yeni eklenen dokümanları `where("updatedAt", ">", lastSyncedAt)` ile sorgular (Delta Sync).
// 3. Ekleme ve silme anında yerel depoyu anında güncelleyerek UI'ı gecikmesiz tutar.

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { cacheKeys } from "../utils/cacheKeys";
import {
  seed as seedSnapshot,
  publish as publishSnapshot,
  getSnapshot,
} from "./snapshotCache";
import * as cacheStore from "../utils/cacheStore";
import { trackFirestoreRead } from "./usageTrackerService";

// In-memory subscribers for UI reactivity without Firestore reads
const subscribers = new Set();

/**
 * Yerel liste değişikliklerine abone olur (React Context için).
 * @param {(uid: string, listKey: string, dataMap: Record<string, any>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeLocalList(callback) {
  if (typeof callback === "function") {
    subscribers.add(callback);
  }
  return () => {
    subscribers.delete(callback);
  };
}

function notifySubscribers(uid, listKey, dataMap) {
  subscribers.forEach((cb) => {
    try {
      cb(uid, listKey, dataMap);
    } catch (err) {
      if (__DEV__) console.warn("[listSyncService] subscriber callback error:", err);
    }
  });
}

/**
 * Yerel depodan belirli bir listenin map verisini senkron okur.
 * @param {string} uid
 * @param {string} listKey ("favorites" | "watchList" | "watchedMovies" | "watchedTv" | "customItems")
 * @returns {Record<string, any>} { [docId]: itemData }
 */
export function getLocalList(uid, listKey) {
  if (!uid || !listKey) return {};
  try {
    const cached = seedSnapshot(cacheKeys.lists(uid, listKey));
    if (cached?.data && typeof cached.data === "object") {
      return cached.data;
    }
  } catch (err) {
    if (__DEV__) console.warn(`[listSyncService] getLocalList error (${listKey}):`, err);
  }
  return {};
}

/**
 * Bu liste bu cihaza HİÇ indirildi mi? `getLocalList` "hiç indirilmedi" ile "indirildi
 * ama boş" durumlarını ikisi de {} döndürerek ayırt edemez; ilk indirme kararı
 * (ListStatusContext) bunu bilmek zorunda: boş liste her açılışta yeniden
 * sorgulanmasın, ama hiç çekilmemiş liste de boş sanılıp atlanmasın.
 *
 * Eski kapı kök dokümandaki sayaçlara (`counts.X > 0`) bakıyordu; sayaçlar
 * artış/azalış ile tutulduğundan sapabiliyor ve sıfıra düşmüş bir sayaç, yeni
 * cihazda dolu listeyi BOŞ gösteriyordu.
 *
 * @returns {boolean}
 */
export function hasLocalList(uid, listKey) {
  if (!uid || !listKey) return false;
  try {
    return Boolean(seedSnapshot(cacheKeys.lists(uid, listKey)).hasCache);
  } catch {
    return false;
  }
}

/**
 * Yerel depoya listenin son halini kaydeder ve aboneleri bilgilendirir.
 * @param {string} uid
 * @param {string} listKey
 * @param {Record<string, any>} dataMap
 */
export function setLocalList(uid, listKey, dataMap) {
  if (!uid || !listKey) return;
  try {
    const cleanMap = dataMap || {};
    publishSnapshot(cacheKeys.lists(uid, listKey), cleanMap, { immediate: true });
    notifySubscribers(uid, listKey, cleanMap);
  } catch (err) {
    if (__DEV__) console.warn(`[listSyncService] setLocalList error (${listKey}):`, err);
  }
}

/**
 * Tek bir öğeyi yerel depoda hemen günceller (Optimistic update).
 * @param {string} uid
 * @param {string} listKey
 * @param {string} itemKey (Örn: "movie_157336" veya "tv_1399")
 * @param {any} itemData
 */
export function updateLocalItem(uid, listKey, itemKey, itemData) {
  if (!uid || !listKey || !itemKey) return;
  const current = { ...getLocalList(uid, listKey) };
  current[itemKey] = itemData;
  setLocalList(uid, listKey, current);
}

/**
 * Birden çok öğeyi yerel depoda TEK yazımda günceller. `setLocalList` her
 * çağrıda haritanın tamamını diske yazar; N öğe için N kez çağırmak büyük
 * listelerde N tam yazım demekti.
 * @param {Record<string, any>} patch { [itemKey]: itemData }
 */
export function updateLocalItems(uid, listKey, patch) {
  if (!uid || !listKey || !patch || Object.keys(patch).length === 0) return;
  setLocalList(uid, listKey, { ...getLocalList(uid, listKey), ...patch });
}

/**
 * Tek bir öğeyi yerel depodan hemen siler (Optimistic delete).
 * @param {string} uid
 * @param {string} listKey
 * @param {string} itemKey
 */
export function deleteLocalItem(uid, listKey, itemKey) {
  if (!uid || !listKey || !itemKey) return;
  const current = { ...getLocalList(uid, listKey) };
  if (current[itemKey]) {
    delete current[itemKey];
    setLocalList(uid, listKey, current);
  }
}

/**
 * Belirli bir alt koleksiyonu tek seferlik baştan sona çeker ve yerel depoya kaydeder.
 * (İlk kurulum veya lazy migration anında kullanılır).
 * @param {string} uid
 * @param {string} listKey
 * @returns {Promise<Record<string, any>>}
 */
export async function fetchFullListOnce(uid, listKey) {
  if (!uid || !listKey) return {};
  try {
    const colRef = collection(db, "Lists", uid, listKey);
    const snap = await getDocs(colRef);
    trackFirestoreRead(`Lists/${listKey}`, snap.docs.length || 1);

    const m = {};
    snap.docs.forEach((docSnap) => {
      m[docSnap.id] = docSnap.data();
    });

    setLocalList(uid, listKey, m);
    return m;
  } catch (err) {
    if (__DEV__) console.warn(`[listSyncService] fetchFullListOnce error (${listKey}):`, err);
    return getLocalList(uid, listKey);
  }
}

/**
 * Delta Senkronizasyonu: Yalnızca lastSyncedAt zaman damgasından sonra
 * güncellenen öğeleri Firestore'dan çeker ve yerel önbelleğe birleştirir.
 * @param {string} uid
 * @param {string} listKey
 * @param {number|Date|Timestamp} lastSyncedAt
 * @returns {Promise<Record<string, any>>} Güncellenmiş map
 */
export async function syncListDelta(uid, listKey, lastSyncedAt) {
  if (!uid || !listKey) return {};

  const currentMap = getLocalList(uid, listKey);
  if (!lastSyncedAt || Object.keys(currentMap).length === 0) {
    return fetchFullListOnce(uid, listKey);
  }

  try {
    let syncThreshold = lastSyncedAt;
    if (typeof lastSyncedAt === "number") {
      syncThreshold = Timestamp.fromMillis(lastSyncedAt);
    } else if (lastSyncedAt instanceof Date) {
      syncThreshold = Timestamp.fromDate(lastSyncedAt);
    }

    const colRef = collection(db, "Lists", uid, listKey);
    const deltaQuery = query(colRef, where("updatedAt", ">", syncThreshold));
    const snap = await getDocs(deltaQuery);

    if (snap.empty) {
      // Hiçbir değişiklik yok -> 0 Doküman indi, maliyet 0
      return currentMap;
    }

    trackFirestoreRead(`Lists/${listKey}/delta`, snap.docs.length);

    const updatedMap = { ...currentMap };
    snap.docs.forEach((docSnap) => {
      updatedMap[docSnap.id] = docSnap.data();
    });

    setLocalList(uid, listKey, updatedMap);
    return updatedMap;
  } catch (err) {
    if (__DEV__) console.warn(`[listSyncService] syncListDelta error (${listKey}):`, err);
    return currentMap;
  }
}
