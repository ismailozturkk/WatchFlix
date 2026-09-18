// services/mediaCommentsService.js
//
// Film/dizi için TEK yeni üst seviye (yanıt olmayan) yorum ekleme yolu.
// Firestore yazımı components/Comment.js'teki handleAddOrEdit'in (yanıt
// olmayan dal) BİREBİR aynısıdır — WatchedDateSheet gibi Comment.js
// bileşenini hiç render etmeyen çağıranların da aynı koleksiyona
// (MovieComment/TvComment), aynı mirror ("myComments") ve aynı
// activityIndex girdisiyle yazabilmesi için buraya çıkarıldı.
//
// Comment.js'in kendi input akışı bilerek DEĞİŞTİRİLMEDİ — oradaki yanıt/
// düzenleme/kapsam-filtre mantığı bu fonksiyonun kapsamı dışında.

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { clampAvatarIndex } from "../utils/avatars";
import { scopeWriteFields } from "../utils/commentScope";
import { trackFirestoreWrite } from "./usageTrackerService";

/**
 * @param {Object} p
 * @param {"movie"|"tv"} p.mediaType
 * @param {string|number} p.mediaId
 * @param {string} p.text
 * @param {boolean} [p.isSpoiler=false]
 * @param {Object|null} [p.scope]  Dizi kapsamı (show/season/episode) — sadece tv.
 * @param {string} p.uid
 * @param {string} [p.username]
 * @param {string} [p.userHandle]
 * @param {string|null} [p.avatar]
 * @param {number} [p.avatarIndex]
 * @param {string} [p.title]      "Etkinliklerim" mirror'ı için başlık.
 * @param {string|null} [p.poster]
 * @returns {Promise<string|null>} yeni yorumun id'si
 */
export async function addMediaComment({
  mediaType,
  mediaId,
  text,
  isSpoiler = false,
  scope = null,
  uid,
  username = "",
  userHandle = "",
  avatar = null,
  avatarIndex = 0,
  title = "",
  poster = null,
}) {
  const trimmed = (text || "").trim();
  if (!trimmed || !uid || mediaId == null) return null;

  const collectionName = mediaType === "tv" ? "TvComment" : "MovieComment";
  const cid = String(mediaId);
  const scopeFields = mediaType === "tv" && scope ? scopeWriteFields(scope) : null;
  const kind = collectionName === "TvComment" ? "tv" : "movie";

  const newRef = await addDoc(collection(db, collectionName, cid, "comments"), {
    userId: uid,
    username: username || "Anonim",
    userHandle: userHandle || "",
    avatar: avatar || null,
    authorPhotoURL: avatar || null,
    avatarIndex: clampAvatarIndex(avatarIndex),
    text: trimmed,
    isSpoiler,
    parentId: null,
    likeCount: 0,
    likedBy: {},
    replyCount: 0,
    timestamp: serverTimestamp(),
    ...(scopeFields || {}),
  });

  updateDoc(doc(db, "Users", uid), { mediaCommentCount: increment(1) }).catch(() => {});
  setDoc(doc(db, "Users", uid, "myComments", newRef.id), {
    kind,
    targetId: cid,
    parentId: null,
    text: trimmed,
    title: title || "",
    poster: poster || null,
    createdAt: serverTimestamp(),
    ...(scopeFields || {}),
  }).catch(() => {});
  setDoc(
    doc(db, "Lists", uid),
    {
      activityIndex: { comments: arrayUnion(`${kind}_${cid}`) },
      updatedAt: serverTimestamp(),
      _schemaVersion: 3,
    },
    { merge: true },
  ).catch(() => {});
  trackFirestoreWrite("Comments", 1);
  trackFirestoreWrite("Lists/activityIndex", 1);

  return newRef.id;
}
