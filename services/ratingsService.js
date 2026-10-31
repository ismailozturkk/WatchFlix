import { nestedSummaryFields } from "../utils/firestoreNestedFields";
// services/ratingsService.js
//
// Film / dizi için uygulama-içi yıldız derecelendirme katmanı (Firestore) +
// TMDB ile HYBRID skor hesabı.
//
// Ölçek: HER ŞEY 0-10. Kullanıcı 5 yıldız üzerinden yarım yıldızlarla puanlar
// (5 × 2 = 10), TMDB vote_average de zaten 0-10. Böylece tek ölçekte birleşir.
//
// Hybrid model: OY SAYISINA GÖRE ağırlıklı ortalama (gerçek toplu ortalama).
//   hybrid = (tmdbAvg * tmdbCount + appSum) / (tmdbCount + appCount)
//     tmdbAvg/tmdbCount = TMDB ortalaması ve oy sayısı (details.vote_average/vote_count)
//     appSum/appCount   = uygulama oylarının toplamı ve sayısı
//   Yani TMDB'yi tmdbCount kişi, uygulamayı appCount kişi oylamış gibi tek havuzda
//   ortalama alınır. Çok oylu içerikte (ör. 26k) tek bir kullanıcı oyu skoru
//   neredeyse hiç oynatmaz; az oyluda (TMDB 1 oy + app 1 oy) yarı yarıya etkiler.
// Örnekler:
//   TMDB 10 (1 oy) + app 4 (1 oy) → (10+4)/2 = 7.0
//   TMDB 8.0 (26000 oy) + app 4 (1 oy) → (8*26000+4)/26001 ≈ 8.0
//
// Firestore yapısı:
//   Ratings/{mediaKey}                       → { mediaType, mediaId, count, sum, updatedAt }
//   Ratings/{mediaKey}/userRatings/{uid}     → { rating(0-10), updatedAt }
//   mediaKey = `${mediaType}_${mediaId}`  (ör. "movie_550", "tv_1399")

import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDoc,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { trackFirestoreWrite, trackFirestoreDelete } from "./usageTrackerService";

export const mediaKey = (mediaType, mediaId) => `${mediaType}_${mediaId}`;

const clampRating = (r) => {
  const n = Number(r);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
};

/**
 * Hybrid skor (0-10): oy sayısına göre ağırlıklı ortalama. Bkz. dosya başı.
 * @param {Object} p
 * @param {number} p.tmdbAvg    TMDB vote_average (0-10)
 * @param {number} p.tmdbCount  TMDB vote_count
 * @param {number} p.count      uygulama oy sayısı
 * @param {number} p.sum        uygulama oy toplamı (0-10)
 * @returns {number}
 */
export function computeHybrid({ tmdbAvg = 0, tmdbCount = 0, count = 0, sum = 0 } = {}) {
  const m = clampRating(tmdbAvg);
  // TMDB ortalaması var ama oy sayısı bilinmiyorsa (0), en az 1 oy say ki
  // tamamen yok sayılmasın.
  const tWeight = m > 0 ? Math.max(0, tmdbCount) || 1 : 0;
  const totalWeight = tWeight + Math.max(0, count);
  if (totalWeight <= 0) return 0;
  return (m * tWeight + sum) / totalWeight;
}

/** Uygulama kullanıcılarının ortalaması (0-10) — oy yoksa null. */
export function userAverage({ count = 0, sum = 0 } = {}) {
  if (!count || count <= 0) return null;
  return sum / count;
}

// ─── READ (realtime) ──────────────────────────────────────────────────────────

/**
 * Bir içeriğin agregat sayaçlarını canlı dinler.
 * @returns {Function} unsubscribe — callback({ count, sum })
 */
export function subscribeToAggregate(key, callback) {
  if (!key) return () => {};
  return onSnapshot(
    doc(db, "Ratings", key),
    (snap) => {
      const d = snap.exists() ? snap.data() : null;
      callback({ count: d?.count || 0, sum: d?.sum || 0 });
    },
    (err) => {
      if (__DEV__) console.warn("subscribeToAggregate error:", err.message);
    },
  );
}

/**
 * Kullanıcının kendi oyunu canlı dinler.
 * @returns {Function} unsubscribe — callback(rating|null)
 */
export function subscribeToMyRating(key, uid, callback) {
  if (!key || !uid) return () => {};
  return onSnapshot(
    doc(db, "Ratings", key, "userRatings", uid),
    (snap) => callback(snap.exists() ? snap.data()?.rating ?? null : null),
    (err) => {
      if (__DEV__) console.warn("subscribeToMyRating error:", err.message);
    },
  );
}

// ─── WRITE (toplu yazım — agregat tutarlılığı) ─────────────────────────────────
// Agregat OKUNMAZ; increment(±fark) ile yazılır (2026-10-31 denetimi: popüler içerikte oku-değiştir-yaz
// transaction'ı aynı belgeye yığılıp yeniden deneme bütçesini tüketiyordu). Fark yalnız KENDİ oy belgemden
// hesaplanır (başkasıyla çekişmez); firestore.rules farkı o belgeyle birebir doğrular. Okuma ile yazım arasında
// başka cihaz oyumu değiştirirse yazım reddedilir → bir kez taze okumayla yeniden denenir.
const withOneRetry = (write) => write().catch(() => write());

/**
 * Kullanıcının oyunu ekle/güncelle. Agregat sum/count atomik güncellenir.
 * @param {Object} p
 * @param {string} p.mediaType 'movie' | 'tv'
 * @param {string|number} p.mediaId
 * @param {string} p.uid
 * @param {number} p.rating 0-10
 */
export async function setMyRating({ mediaType, mediaId, uid, rating, title = "", poster = null }) {
  if (!uid) throw new Error("setMyRating: uid yok");
  if (!mediaType || mediaId == null) throw new Error("setMyRating: media eksik");
  const value = clampRating(rating);
  const key = mediaKey(mediaType, mediaId);
  const aggRef = doc(db, "Ratings", key);
  const userRef = doc(db, "Ratings", key, "userRatings", uid);
  // Kullanıcı için denormalize kopya — "Puanladıklarım" sayfası bunu okur
  // (poster/başlık dahil, ekstra TMDB isteği gerekmez).
  const mirrorRef = doc(db, "Users", uid, "myRatings", key);
  const rootListsRef = doc(db, "Lists", uid);

  await withOneRetry(async () => {
    const userSnap = await getDoc(userRef);
    // Güncellemede sayaç değişmez, toplam yalnız fark kadar oynar; ilk oyda +1 / +değer.
    const prev = userSnap.exists() ? clampRating(userSnap.data()?.rating) : null;

    const batch = writeBatch(db);
    batch.set(userRef, { rating: value, updatedAt: serverTimestamp() });
    batch.set(
      aggRef,
      {
        mediaType,
        mediaId: String(mediaId),
        count: increment(prev === null ? 1 : 0),
        sum: increment(prev === null ? value : value - prev),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    batch.set(mirrorRef, {
      mediaType,
      mediaId: String(mediaId),
      rating: value,
      title: title || "",
      poster: poster || null,
      updatedAt: serverTimestamp(),
    });
    batch.set(
      rootListsRef,
      nestedSummaryFields({
        [`activityIndex.ratings.${key}`]: value,
        updatedAt: serverTimestamp(),
        _schemaVersion: 3,
      }),
      { merge: true },
    );
    await batch.commit();
  });
  trackFirestoreWrite("Ratings", 2);
  trackFirestoreWrite("Lists/activityIndex", 1);

  return value;
}

/**
 * Kullanıcının oyunu kaldır. Agregat geri düşürülür.
 */
export async function removeMyRating({ mediaType, mediaId, uid }) {
  if (!uid) throw new Error("removeMyRating: uid yok");
  const key = mediaKey(mediaType, mediaId);
  const aggRef = doc(db, "Ratings", key);
  const userRef = doc(db, "Ratings", key, "userRatings", uid);
  const mirrorRef = doc(db, "Users", uid, "myRatings", key);
  const rootListsRef = doc(db, "Lists", uid);

  await withOneRetry(async () => {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return; // zaten yok
    const prev = clampRating(userSnap.data()?.rating);

    const batch = writeBatch(db);
    batch.delete(userRef);
    batch.delete(mirrorRef);
    batch.set(
      aggRef,
      {
        mediaType,
        mediaId: String(mediaId),
        count: increment(-1),
        sum: increment(-prev),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    batch.set(
      rootListsRef,
      nestedSummaryFields({
        [`activityIndex.ratings.${key}`]: null,
        updatedAt: serverTimestamp(),
        _schemaVersion: 3,
      }),
      { merge: true },
    );
    await batch.commit();
  });
  trackFirestoreDelete("Ratings", 1);
  trackFirestoreWrite("Lists/activityIndex", 1);
}

// ─── "Puanladıklarım" listesi (kullanıcı mirror'ı) ─────────────────────────────

/**
 * Kullanıcının puanladığı tüm içerikleri canlı dinler (en yeni üstte).
 * @returns {Function} unsubscribe — callback(Array<{id, mediaType, mediaId, rating, title, poster}>)
 */
export function subscribeToMyRatings(uid, callback) {
  if (!uid) return () => {};
  const q = query(
    collection(db, "Users", uid, "myRatings"),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      if (__DEV__) console.warn("subscribeToMyRatings error:", err.message);
    },
  );
}
