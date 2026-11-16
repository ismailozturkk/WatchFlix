// services/forceUpdate.js
//
// `AppConfig/minVersion` okuyucu (zorunlu güncelleme; kararlar utils/forceUpdate.js).
//
// OKUMA BÜTÇESİ: cihazda 1 saat önbelleklenir → cihaz başına saatte en çok bir okuma.
// Çevrimdışıyken apiCache süresi geçmiş kaydı da döndürür: bilinen bir "güncelle" kararı
// ağ yokken de geçerli kalır. Hiç okunamazsa null → engel yok (güvenli yön).

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getCachedValue, setCachedValue } from "../utils/apiCache";

const CACHE_KEY = "appconfig_minversion_v1";
export const MIN_VERSION_TTL = 60 * 60 * 1000;

/** AppConfig/minVersion verisi; belge yoksa {} ; okunamazsa (önbellek de yoksa) null. */
export async function fetchMinVersionConfig() {
  try {
    const cached = getCachedValue(CACHE_KEY, MIN_VERSION_TTL);
    if (cached && typeof cached === "object") return cached;
  } catch {
    // önbellek okunamadı → ağdan dene
  }
  try {
    const snap = await getDoc(doc(db, "AppConfig", "minVersion"));
    const data = snap.exists() ? snap.data() || {} : {};
    setCachedValue(CACHE_KEY, data);
    return data;
  } catch {
    return null;
  }
}
