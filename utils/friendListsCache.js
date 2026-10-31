// utils/friendListsCache.js
//
// Arkadaş profilindeki liste koleksiyonları (izlenen film/dizi, favoriler, izleme listesi, özel
// liste öğeleri) için cihaz önbelleği. Eskiden profil HER açılışta beş koleksiyonun tamamını
// okuyordu (1.000 izlemeli arkadaş = açılış başına 1.000+ okuma).
//
// Geçerlilik: arkadaşın `Lists/{uid}` kök belgesinin `updatedAt` damgası. Ekran o belgeyi zaten
// dinliyor (1 okuma); listeye her ekleme/çıkarma kökü de günceller (listItemsService). Damga
// aynıysa önbellek kullanılır, değiştiyse yeniden okunur. Kökü güncellemeyen nadir yazımlara karşı
// (ör. bölüm ilerlemesi) kayıt en fazla FRIEND_LISTS_MAX_AGE tutulur.
//
// Önbellek klasörü sistemce silinebilir (cacheStore varsayılan konumu): kaybolursa yalnız bir kez
// yeniden okunur. Gizlilik: çağıran yalnız listeleri görmeye izni varken okur/yazar.

import * as cacheStore from "./cacheStore";

export const FRIEND_LISTS_NS = "friendLists";
export const FRIEND_LISTS_MAX_AGE = 24 * 60 * 60 * 1000;

/** Kök belgenin `updatedAt` damgası (ms); yoksa 0. Firestore Timestamp ya da {seconds}. */
export function listsRootStamp(root) {
  const value = root?.updatedAt;
  if (typeof value?.toMillis === "function") return value.toMillis();
  return Number.isFinite(value?.seconds) ? value.seconds * 1000 : 0;
}

/** @returns {{movies, shows, favorites, watchList, customItems} | null} */
export function readFriendLists(uid, stamp) {
  if (!uid) return null;
  const entry = cacheStore.getJSON(FRIEND_LISTS_NS, uid, { maxAge: FRIEND_LISTS_MAX_AGE });
  if (!entry || entry.stamp !== stamp || !entry.lists) return null;
  return entry.lists;
}

export function writeFriendLists(uid, stamp, lists) {
  if (!uid || !lists) return;
  cacheStore.setJSON(FRIEND_LISTS_NS, uid, { stamp, lists });
}
