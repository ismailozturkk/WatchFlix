// services/wrappedService.js
//
// Watchify Wrapped — Firestore arşivi.
// Yıllık özet anlık görüntüleri `Lists/{uid}/wrapped/{year}` altında saklanır.
// Bu yol firestore.rules'taki `match /Lists/{uid}/{document=**}` ile zaten
// sahibe-yaz / giriş-yapana-oku korumalıdır → ek kural gerekmez.
//
// Not: Recap tamamen cihazda hesaplanır (utils/wrapped.js). Bu servis yalnızca
// hesaplanmış özeti kalıcı kılar; böylece geçmiş yıllar liste sonradan değişse
// bile korunur ve ileride uygulama-içi paylaşıma hazır olur.

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const wrappedDocRef = (uid, year) =>
  doc(db, "Lists", uid, "wrapped", String(year));

/**
 * Bir yılın özetini arşivler (merge). Animated.Value vb. taşımayan, düz veri
 * (utils/wrapped.js çıktısı) beklenir.
 */
export const archiveWrapped = async (uid, year, recap) => {
  if (!uid || year == null || !recap) return;
  try {
    // Firestore `undefined` değerleri reddeder; JSON round-trip ile temizle
    // (undefined alanlar düşer, sayı/string/array/null korunur).
    const clean = JSON.parse(JSON.stringify(recap));
    await setDoc(
      wrappedDocRef(uid, year),
      { ...clean, year: Number(year), savedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    // Arşivleme best-effort: UI'yı bloklamaz.
    if (__DEV__) console.warn("[wrapped] archive failed:", err?.message);
  }
};

/** Belirli yıl için arşiv var mı? (tekrar yazımı önlemek için) */
export const wrappedExists = async (uid, year) => {
  if (!uid || year == null) return false;
  try {
    const snap = await getDoc(wrappedDocRef(uid, year));
    return snap.exists();
  } catch {
    return false;
  }
};

/** Arşivlenmiş tüm yılların listesi (azalan). */
export const getArchivedYears = async (uid) => {
  if (!uid) return [];
  try {
    const snap = await getDocs(collection(db, "Lists", uid, "wrapped"));
    return snap.docs
      .map((d) => Number(d.id))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
};

/** Arşivlenmiş bir yılın özetini okur (yoksa null). */
export const getArchivedWrapped = async (uid, year) => {
  if (!uid || year == null) return null;
  try {
    const snap = await getDoc(wrappedDocRef(uid, year));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
};
