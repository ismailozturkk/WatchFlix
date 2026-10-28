// utils/photoRevalidation.js
//
// Adresi DEĞİŞMEDEN içeriği değişen uzak fotoğrafların önbellek sürümü — SAF
// kararlar (yerel taraf: services/photoRevalidation.js; testler:
// __tests__/photoRevalidation.test.js).
//
// Sorun: Google, kullanıcı profil fotoğrafını değiştirince AYNI adresin
// (lh3.googleusercontent.com/a/…) arkasındaki resmi değiştirir. expo-image
// görseli diskte adrese göre saklar ve bir daha sunucuya sormaz (Android
// Glide: süresiz; iOS SDWebImage: bir hafta). Resmi bir kez indirmiş cihaz —
// hangi hesapla bakarsa baksın — eski fotoğrafı göstermeye devam eder; resmi
// hiç indirmemiş cihaz yenisini görür. Firestore'daki adres değişmediği için
// avatar senkronu (utils/avatarPhotos.js) da "değişiklik yok" der.
//
// Çözüm: bu tür adresler arada bir ağdan yeniden indirilir; içerik (md5)
// önbellektekinden farklıysa yeni dosya önbelleğe YENİ bir anahtarla
// (`adres#v<sürüm>`) yazılır ve görseller o anahtara geçer. Denetim eski kopya
// ekrandayken arka planda yapılır: çevrimdışıyken ya da indirme düşerse
// hiçbir şey kaybolmaz, boş kare görünmez.

import { isGooglePhotoUrl } from "./avatarPhotos";

// Başkalarının fotoğrafı en fazla bu kadar bayat kalır.
export const PHOTO_CHECK_TTL_MS = 24 * 60 * 60 * 1000;
// Kendi fotoğrafım: kullanıcı Google'da değiştirip uygulamaya dönünce görmeli.
export const OWN_PHOTO_CHECK_TTL_MS = 10 * 60 * 1000;
// İndirme düştüyse (çevrimdışı) aynı adres bu süre dolmadan yeniden denenmez.
export const PHOTO_CHECK_RETRY_MS = 5 * 60 * 1000;
// Kalıcı kayıtta tutulan en fazla adres (en son denetlenenler kalır).
export const MAX_TRACKED_PHOTOS = 400;

/** İçeriği adresi değişmeden yenilenebilen fotoğraf mı? */
export function isRevalidatedPhoto(uri) {
  return isGooglePhotoUrl(uri);
}

/**
 * Görsel kaynağından denetlenecek adres; denetlenmeyecekse null. Kendi
 * `cacheKey`'i olan kaynağa dokunulmaz (sürümü zaten verilmiş ya da çağıran
 * anahtarı bilerek seçmiş).
 */
export function revalidatedUriOf(source) {
  if (!source || typeof source !== "object" || source.cacheKey) return null;
  return isRevalidatedPhoto(source.uri) ? source.uri : null;
}

export function photoCacheKey(uri, version) {
  return version ? `${uri}#v${version.toString(36)}` : uri;
}

/** Kaynağı bilinen son sürümün önbellek anahtarına bağlar (sürüm yoksa aynen). */
export function withPhotoVersion(source, version) {
  const uri = revalidatedUriOf(source);
  if (!uri || !version) return source;
  return { ...source, cacheKey: photoCacheKey(uri, version) };
}

/**
 * @param {{at?:number}|undefined} entry kayıt: { v: sürüm, h: md5, at: son denetim }
 */
export function isPhotoCheckDue(entry, now, maxAgeMs = PHOTO_CHECK_TTL_MS) {
  if (!entry || !entry.at) return true;
  return now - entry.at >= maxAgeMs;
}

/**
 * Yeni indirilen içeriğin md5'ine göre kaydın yeni hâli.
 * `changed: true` → içerik önbellekteki sürümden farklı; dosya yeni sürümün
 * anahtarına yazılmalı. İlk denetimde (özet bilinmiyor) de değişmiş sayılır:
 * önbellekteki kopyanın ne zaman indirildiği bilinmiyor — bayat olabilir.
 */
export function planPhotoCheck(entry, md5, now) {
  if (entry?.h && entry.h === md5) {
    return { changed: false, entry: { ...entry, at: now } };
  }
  const v = Math.max(now, (entry?.v || 0) + 1);
  return { changed: true, entry: { v, h: md5, at: now } };
}

/** Kayıt büyümesin: en son denetlenen `max` adres kalır. */
export function prunePhotoEntries(entries, max = MAX_TRACKED_PHOTOS) {
  const list = Object.entries(entries || {});
  if (list.length <= max) return entries || {};
  list.sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0));
  return Object.fromEntries(list.slice(0, max));
}
