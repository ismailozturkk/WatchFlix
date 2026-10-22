// utils/profileEdit.js
//
// "Profili düzenle" ekranının SAF kararları. Ekran RN/Firebase'e bağlı olduğu
// için burada test edilebilir tutuluyor (bkz. jest.config.js).

import { favoritesEqual } from "./fourFavorites";
import { socialLinksEqual } from "./socialLinks";

/**
 * Formda kaydedilmemiş bir değişiklik var mı? Kaydet düğmesi buna bakar.
 *
 * Karşılaştırmalar `EditProfileScreen.onSave` ile AYNI olmak zorunda: orada
 * hangi alan "değişti" sayılıyorsa burada da öyle sayılmalı, yoksa düğme ya hiç
 * açılmaz ya da hiçbir şey yazmayan bir kayıt için açılır.
 *
 * @param {object}  p
 * @param {boolean} p.ready  Form profilden doldurulduktan sonra true. Öncesinde
 *   alanlar boş, profil dolu olduğundan her şey "değişmiş" görünürdü.
 * @param {object|null} p.saved  Profilde KAYITLI olan değerler. `username`
 *   normalize edilmiş gelir; `avatarIndex` formun başlangıçta aldığı değerdir.
 * @param {object}  p.draft  Formdaki anlık değerler (`username` normalize).
 *   `saved.fourFavorites` / `draft.fourFavorites` (isteğe bağlı): dört favori.
 *   Alan yoksa iki taraf da "boş" sayılır — eski hesaplar kendiliğinden kirlenmez.
 *   `saved.socialLinks` / `draft.socialLinks` (isteğe bağlı): ÇÖZÜLMÜŞ sosyal hesap
 *   haritası; `draft.socialInvalid` (anahtar dizisi) doluysa Kaydet açık kalır ki
 *   hata mesajı gösterilebilsin.
 */
export function isProfileEditDirty({ ready, saved, draft }) {
  if (!ready || !saved || !draft) return false;
  if ((draft.displayName || "").trim() !== (saved.displayName || "")) return true;
  if ((draft.username || "") !== (saved.username || "")) return true;
  if ((draft.bio || "").trim() !== (saved.bio || "")) return true;
  if (draft.avatarIndex !== saved.avatarIndex) return true;
  if (!favoritesEqual(saved.fourFavorites, draft.fourFavorites)) return true;
  if (!socialLinksEqual(saved.socialLinks, draft.socialLinks)) return true;
  if (draft.socialInvalid?.length) return true;
  // Doğum tarihi bir kez yazılır (firestore.rules → birthDateKept): yalnız
  // henüz kayıtlı değilken girilmesi bir değişikliktir.
  if (!saved.birthDate && !!draft.birthDate) return true;
  return false;
}

/**
 * Kullanıcı adı alanının kenar/ikon tonu: yanlış (false), geçerli (true) ya da
 * nötr (null). AuthField'in `state` sözleşmesiyle aynı.
 */
export function usernameFieldState(status) {
  if (status === "taken" || status === "invalid") return false;
  if (status === "available") return true;
  return null;
}

/** Sayaç sınıra yaklaşınca uyarı tonu (son 20 karakter). */
export function isNearLimit(length, max, margin = 20) {
  return length >= max - margin;
}
