// utils/avatars.js
//
// Avatar asset map. Modül seviyesinde tanımlı — her require() bir kez çalışır,
// Metro bundle'da cache'lenir, runtime'da yeni allocation yok.
//
// Firestore'da ve cihaz deposunda (MMKV) sadece "index" sayısı saklanır (0-55).
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
export const CUSTOM_AVATAR_INDEX = -1;
export const SOCIAL_AVATAR_INDEX = -1;

/**
 * Geçersiz/eksik index'i güvenli sınıra çek.
 * allowCustom=true ise -1 (Google/Apple sosyal profil fotoğrafı) geçerli kabul edilir.
 */
export function clampAvatarIndex(index, allowCustom = true) {
  if (index === null || index === undefined) return DEFAULT_AVATAR_INDEX;
  const n = Number(index);
  if (allowCustom && n === CUSTOM_AVATAR_INDEX) {
    return CUSTOM_AVATAR_INDEX;
  }
  if (!Number.isFinite(n)) return DEFAULT_AVATAR_INDEX;
  if (n < 0 || n >= AVATAR_COUNT) return DEFAULT_AVATAR_INDEX;
  return Math.floor(n);
}

// ── Oyuncu / yönetmen fotoğrafı (TMDB) ─────────────────────────────────────
// Avatar olarak seçilen kişi fotoğrafı TMDB görsel sunucusundan gelir:
//   https://image.tmdb.org/t/p/<boyut>/<dosya>.jpg
// Dosya adı içerik özetidir (resim değişirse adres de değişir) — Google'daki
// "aynı adres, yeni resim" sorunu burada yok, yeniden doğrulama gerekmez.
// Kayıtta TEK biçim tutulur (PERSON_PHOTO_SIZE); çizilirken boyuta göre
// küçük kopya seçilir (akıştaki 40 pt'lik avatar 632 px'lik resmi indirmesin).
const TMDB_PHOTO_RE =
  /^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9_]+\/([A-Za-z0-9_-]+\.(?:jpe?g|png|webp))$/i;
export const PERSON_PHOTO_SIZE = "h632";
// w185 kopyası bu piksel genişliğine kadar yeter (185 × ~1.2 tolerans).
const TMDB_SMALL_MAX_PX = 222;

/** Adres bir TMDB görseli mi? (kişi fotoğrafı avatarı) */
export function isTmdbPhotoUrl(url) {
  return typeof url === "string" && TMDB_PHOTO_RE.test(url.trim());
}

/** TMDB görsel adresinin dosya adı ("abc.jpg"); değilse null. */
export function tmdbPhotoFile(url) {
  if (typeof url !== "string") return null;
  const match = TMDB_PHOTO_RE.exec(url.trim());
  return match ? match[1] : null;
}

/**
 * TMDB `profile_path` ("/abc.jpg") → kayda yazılacak tam adres. Geçersizse null.
 * Yol yalnız güvenli karakterler içerebilir; kural tarafı (firestore.rules
 * avatarPhotoOk) aynı biçimi ister.
 */
export function tmdbPersonPhotoUrl(profilePath, size = PERSON_PHOTO_SIZE) {
  if (typeof profilePath !== "string") return null;
  const file = profilePath.trim().replace(/^\/+/, "");
  if (!/^[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(file)) return null;
  return `https://image.tmdb.org/t/p/${size}/${file}`;
}

/**
 * Avatarın çizim boyutu (pt) → istenecek görsel genişliği (px). 3x ekranı
 * varsayar; kesin ekran yoğunluğu gerekmez, yalnız küçük/büyük kopya seçilir.
 */
export function avatarRenderPx(size) {
  const n = Number(size);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 3) : 500;
}

/**
 * Kaynağa göre kırpma konumu. TMDB kişi fotoğrafı dikey portredir (2:3) ve
 * yüz resmin üst yarısındadır: ortadan kırpılınca daire alnı keser. Üstten
 * kırpınca yüz dairenin ortasına gelir. Diğer kaynaklar ortalanır.
 */
export function avatarContentPosition(source) {
  const uri = source && typeof source === "object" ? source.uri : null;
  return isTmdbPhotoUrl(uri) ? "top" : "center";
}

/**
 * Profil fotoğrafı URL'sini çizim boyutuna göre ayarlar.
 *   Google `=s96-c` → `=s500-c` (yüksek çözünürlük; boyuttan bağımsız, yeniden
 *     doğrulama adres başına tutulduğu için tek adres kalmalı).
 *   TMDB → `size` (piksel) küçükse w185, büyükse h632.
 */
export function optimizeAvatarUrl(url, size = 500) {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (trimmed.includes("googleusercontent.com") || trimmed.includes("ggpht.com")) {
    if (/=s\d+(-c)?$/i.test(trimmed)) {
      return trimmed.replace(/=s\d+(-c)?$/i, "=s500-c");
    }
    return trimmed;
  }
  const file = tmdbPhotoFile(trimmed);
  if (file) {
    return tmdbPersonPhotoUrl(file, size <= TMDB_SMALL_MAX_PX ? "w185" : PERSON_PHOTO_SIZE);
  }
  return trimmed;
}

/**
 * Index veya URL'den `<Image source={...} />`'e geçirilebilir asset resource veya URI döner.
 *
 * @param {number|string|object} index - Avatar indexi (0-55), -1 (özel/sosyal), URL string'i veya { uri }
 * @param {string|object|null} photoURL - İsteğe bağlı Google/Apple profil fotoğrafı URL'si
 * @param {number} [px=500] - Çizim genişliği (piksel). Yalnız boyut seçeneği olan
 *   kaynaklarda (TMDB) küçük kopyayı seçer.
 */
export function getAvatarSource(index, photoURL = null, px = 500) {
  const fit = (url) => optimizeAvatarUrl(url, px);
  // 1) Doğrudan URI nesnesi geçilmişse
  if (index && typeof index === "object" && index.uri) {
    const optUri = fit(index.uri);
    return optUri === index.uri ? index : { ...index, uri: optUri };
  }

  // 2) Doğrudan URL string'i geçilmişse
  if (
    typeof index === "string" &&
    (index.startsWith("http://") ||
      index.startsWith("https://") ||
      index.startsWith("file://") ||
      index.startsWith("data:"))
  ) {
    return { uri: fit(index) };
  }

  // 3) Özel / Sosyal Avatar (-1)
  const numericIndex = Number(index);
  if (numericIndex === CUSTOM_AVATAR_INDEX) {
    if (photoURL && typeof photoURL === "string" && photoURL.trim()) {
      return { uri: fit(photoURL.trim()) };
    }
    if (photoURL && typeof photoURL === "object" && photoURL.uri) {
      const optUri = fit(photoURL.uri);
      return optUri === photoURL.uri ? photoURL : { ...photoURL, uri: optUri };
    }
    return AVATARS[DEFAULT_AVATAR_INDEX];
  }

  // 4) Eğer index geçersiz ama photoURL dolu gelmişse
  if (
    (!Number.isFinite(numericIndex) || numericIndex < 0) &&
    typeof photoURL === "string" &&
    (photoURL.startsWith("http://") || photoURL.startsWith("https://"))
  ) {
    return { uri: fit(photoURL.trim()) };
  }

  // 5) Hazır yerel avatarlar (0-55)
  return AVATARS[clampAvatarIndex(index, false)];
}

/**
 * Yeni hesaplara atanacak rastgele avatar index'i.
 * Herkesin 0 numaralı avatarla başlamaması ve dağılımın 56 görsele düzgün
 * yayılması için CSPRNG kullanılır (bkz. utils/randomPick.js).
 */
export function randomAvatarIndex() {
  return randomInt(AVATAR_COUNT);
}
