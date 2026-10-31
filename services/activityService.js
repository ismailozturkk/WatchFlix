// services/activityService.js
//
// "Etkinliklerim" hub'ı için OKUMA katmanı. Yazma (denormalizasyon) ilgili
// kaynaklarda yapılır:
//   - Yorumlar  → components/Comment.js (film/dizi) + services/postsService.js (post)
//                 → Users/{uid}/myComments/{commentId}
//   - Beğeni    → postsService.toggleLike    → Users/{uid}/likedPosts/{postId} (+display)
//   - Kaydetme  → postsService.toggleBookmark → Users/{uid}/bookmarks/{postId} (+display)
//   - Puanlar   → ratingsService (Users/{uid}/myRatings) — orada
//
// myComments/{commentId} → { kind:'movie'|'tv'|'post', targetId, text, title, createdAt }
//   Dizi yorumlarında ayrıca KAPSAM alanları taşınır (utils/commentScope.js):
//   scope ('show'|'season'|'episode'), seasonNumber, episodeNumber, scopeKey,
//   scopeTitle. "Etkinliklerim → Yorumlarım" satırındaki S2·B5 rozeti ve
//   satıra dokununca yorum sayfasının o kapsamda açılması bunlara dayanır.
//   Alanları taşımayan ESKİ kayıtlar 'show' sayılır.

import {
  collection,
  getCountFromServer,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { trackFirestoreRead } from "./usageTrackerService";

const subColumn = (uid, sub, orderField, cb) => {
  if (!uid) return () => {};
  const q = query(
    collection(db, "Users", uid, sub),
    orderBy(orderField, "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      trackFirestoreRead(`Users/${sub}`, snap.docs.length);
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      if (__DEV__) console.warn(`subscribe ${sub} error:`, err.message);
    },
  );
};

/** Kullanıcının yazdığı tüm yorumlar (film/dizi + post), en yeni üstte. */
export const subscribeToMyComments = (uid, cb) =>
  subColumn(uid, "myComments", "createdAt", cb);

/** Kullanıcının beğendiği postlar, en yeni üstte. */
export const subscribeToMyLikes = (uid, cb) =>
  subColumn(uid, "likedPosts", "likedAt", cb);

/** Kullanıcının kaydettiği postlar, en yeni üstte. */
export const subscribeToMyBookmarks = (uid, cb) =>
  subColumn(uid, "bookmarks", "bookmarkedAt", cb);

// ─── Sayaçlar (Profil'deki "Etkinliklerim" düğmesi) ──────────────────────────
// Düğme yalnız SAYI gösterir. Eskiden dört koleksiyonun TAMAMI canlı dinleniyordu (profil
// sekmesi açık kaldıkça; 1.000 puan + 500 beğeni = her açılış/yeniden bağlanmada 1.500+ okuma).
// Artık sayım sorgusu: 1.000 belge başına 1 okuma. Kısa sürede tekrar sorulursa (sekme
// geçişleri) bellekteki son değer döner.
export const ACTIVITY_COUNTS_MIN_INTERVAL_MS = 15 * 1000;
const ACTIVITY_COUNT_SUBS = {
  ratings: "myRatings",
  comments: "myComments",
  likes: "likedPosts",
  bookmarks: "bookmarks",
};
const countsCache = new Map(); // uid → { at, counts }

/** Son bilinen sayılar (ağ yok); hiç sorulmadıysa null. */
export function peekMyActivityCounts(uid) {
  return countsCache.get(uid)?.counts ?? null;
}

/**
 * @returns {Promise<{ratings:number, comments:number, likes:number, bookmarks:number}>}
 *   Okunamayan sayı son bilinen değerde (yoksa 0) kalır.
 */
export async function fetchMyActivityCounts(uid, { force = false, now = Date.now } = {}) {
  if (!uid) return { ratings: 0, comments: 0, likes: 0, bookmarks: 0 };
  const cached = countsCache.get(uid);
  if (!force && cached && now() - cached.at < ACTIVITY_COUNTS_MIN_INTERVAL_MS) return cached.counts;
  const keys = Object.keys(ACTIVITY_COUNT_SUBS);
  const results = await Promise.allSettled(
    keys.map((key) => getCountFromServer(collection(db, "Users", uid, ACTIVITY_COUNT_SUBS[key]))),
  );
  const counts = {};
  keys.forEach((key, i) => {
    const r = results[i];
    counts[key] = r.status === "fulfilled" ? r.value.data().count : cached?.counts?.[key] ?? 0;
  });
  countsCache.set(uid, { at: now(), counts });
  return counts;
}
