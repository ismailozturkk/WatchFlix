// services/pendingFavorites.js
//
// Tanıtımda (kayıttan ÖNCE) seçilen "dört favori"nin cihazdaki geçici kopyası.
// Hesap yokken Firestore'a yazılamaz; kayıt/giriş sonrası ilk profil yüklemesinde
// Users/{uid}.fourFavorites alanına taşınır (fourFavoritesService.adoptPendingFavorites).
//
// Yalnız depolama — Firebase/ağ importu YOK. Tanıtım ekranı bunu açılışın hafif
// yolunda kullanıyor; hesap servisini (ve Firebase'i) çekmesin diye ayrı dosya.

import { Keys, get, remove, set } from "./storage";
import {
  hasAnyFavorites,
  normalizeFavorites,
  toProfilePayload,
} from "../utils/fourFavorites";

/** Cihazdaki bekleyen seçimler; yoksa ya da boşsa null. */
export function readPendingFavorites() {
  const pending = normalizeFavorites(get(Keys.pendingFourFavorites));
  return hasAnyFavorites(pending) ? pending : null;
}

/** Boş durum anahtarı SİLER — depoda boş bir kayıt bırakmaz. */
export function writePendingFavorites(favorites) {
  const clean = normalizeFavorites(favorites);
  if (hasAnyFavorites(clean)) set(Keys.pendingFourFavorites, toProfilePayload(clean));
  else remove(Keys.pendingFourFavorites);
}

export const clearPendingFavorites = () => remove(Keys.pendingFourFavorites);
