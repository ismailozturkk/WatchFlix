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

import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

const subColumn = (uid, sub, orderField, cb) => {
  if (!uid) return () => {};
  const q = query(
    collection(db, "Users", uid, sub),
    orderBy(orderField, "desc"),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
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
