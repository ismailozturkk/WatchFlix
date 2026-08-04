// utils/avatars.js
//
// Avatar asset map. Modül seviyesinde tanımlı — her require() bir kez çalışır,
// Metro bundle'da cache'lenir, runtime'da yeni allocation yok.
//
// FIRESTORE/AsyncStorage'da sadece "index" sayısı saklanır (0-55).
// UI tarafında `getAvatarSource(index)` ile gerçek resource'a çevrilir.
// Bu sayede:
//   - Firestore'a ~3 byte yazılır (URL string'i yerine)
//   - Resimler local'den yüklenir (CDN trafiği yok, anında render)
//   - Avatar değişse bile "eski post'lar eski avatarı gösterir" problemine
//     çözüm: post'ta sabit `authorAvatarIndex` snapshot'ı tutulur.

import { randomInt } from "./randomPick";

export const AVATARS = [
  require("../assets/avatar/0.png"),  require("../assets/avatar/1.png"),
  require("../assets/avatar/2.png"),  require("../assets/avatar/3.png"),
  require("../assets/avatar/4.png"),  require("../assets/avatar/5.png"),
  require("../assets/avatar/6.png"),  require("../assets/avatar/7.png"),
  require("../assets/avatar/8.png"),  require("../assets/avatar/9.png"),
  require("../assets/avatar/10.png"), require("../assets/avatar/11.png"),
  require("../assets/avatar/12.png"), require("../assets/avatar/13.png"),
  require("../assets/avatar/14.png"), require("../assets/avatar/15.png"),
  require("../assets/avatar/16.png"), require("../assets/avatar/17.png"),
  require("../assets/avatar/18.png"), require("../assets/avatar/19.png"),
  require("../assets/avatar/20.png"), require("../assets/avatar/21.png"),
  require("../assets/avatar/22.png"), require("../assets/avatar/23.png"),
  require("../assets/avatar/24.png"), require("../assets/avatar/25.png"),
  require("../assets/avatar/26.png"), require("../assets/avatar/27.png"),
  require("../assets/avatar/28.png"), require("../assets/avatar/29.png"),
  require("../assets/avatar/30.png"), require("../assets/avatar/31.png"),
  require("../assets/avatar/32.png"), require("../assets/avatar/33.png"),
  require("../assets/avatar/34.png"), require("../assets/avatar/35.png"),
  require("../assets/avatar/36.png"), require("../assets/avatar/37.png"),
  require("../assets/avatar/38.png"), require("../assets/avatar/39.png"),
  require("../assets/avatar/40.png"), require("../assets/avatar/41.png"),
  require("../assets/avatar/42.png"), require("../assets/avatar/43.png"),
  require("../assets/avatar/44.png"), require("../assets/avatar/45.png"),
  require("../assets/avatar/46.png"), require("../assets/avatar/47.png"),
  require("../assets/avatar/48.png"), require("../assets/avatar/49.png"),
  require("../assets/avatar/50.png"), require("../assets/avatar/51.png"),
  require("../assets/avatar/52.png"), require("../assets/avatar/53.png"),
  require("../assets/avatar/54.png"), require("../assets/avatar/55.png"),
];

export const AVATAR_COUNT = AVATARS.length;
export const DEFAULT_AVATAR_INDEX = 0;

/**
 * Geçersiz/eksik index'i güvenli sınıra çek.
 * Firestore'dan -1, null, NaN, undefined veya 9999 gibi bir değer gelirse
 * crash yerine varsayılan avatar döner.
 */
export function clampAvatarIndex(index) {
  const n = Number(index);
  if (!Number.isFinite(n)) return DEFAULT_AVATAR_INDEX;
  if (n < 0 || n >= AVATAR_COUNT) return DEFAULT_AVATAR_INDEX;
  return Math.floor(n);
}

/**
 * Index'ten `<Image source={...} />`'e geçirilebilir asset resource döner.
 */
export function getAvatarSource(index) {
  return AVATARS[clampAvatarIndex(index)];
}

/**
 * Yeni hesaplara atanacak rastgele avatar index'i.
 * Herkesin 0 numaralı avatarla başlamaması ve dağılımın 56 görsele düzgün
 * yayılması için CSPRNG kullanılır (bkz. utils/randomPick.js).
 */
export function randomAvatarIndex() {
  return randomInt(AVATAR_COUNT);
}
