// services/socialNotificationsService.js
//
// Sosyal olaylar için uygulama-içi bildirim üretimi (Firestore).
// Şema: Users/{uid}/notifications/{notifId}
//   type, fromUid, fromName, fromAvatarIndex, postId?, commentId?, text?,
//   read:false, createdAt
//
// Güvenlik kuralı (firestore.rules):
//   create  → request.resource.data.fromUid == auth.uid  (yani fromUid = ben)
//   Users update → non-owner yalnızca counter alanlarını (unreadNotifsCount)
// Bu yüzden friendsService ile birebir aynı pattern kullanılır.
//
// NOT: Bu çağrılar "best-effort"tur — ana aksiyonu (beğeni/yorum) bloklamaz;
// çağıran taraf .catch() ile sessiz geçer.

import {
  collection,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { clampAvatarIndex } from "../utils/avatars";

/**
 * Tek bir sosyal bildirim oluştur + alıcının unreadNotifsCount'unu +1.
 * Kendine bildirim üretmez. Eksik alanlarda sessizce çıkar.
 */
export async function createSocialNotification({
  toUid,
  fromUid,
  fromName = "",
  fromAvatarIndex = 0,
  type,
  postId,
  commentId,
  text,
  groupId,
  groupName,
}) {
  if (!toUid || !fromUid || !type) return;
  if (toUid === fromUid) return; // kendine bildirim yok

  const batch = writeBatch(db);
  const notifRef = doc(collection(db, "Users", toUid, "notifications"));
  batch.set(notifRef, {
    type,
    fromUid,
    fromName: fromName || "",
    fromAvatarIndex: clampAvatarIndex(fromAvatarIndex),
    ...(postId ? { postId } : {}),
    ...(commentId ? { commentId } : {}),
    ...(text ? { text: String(text).slice(0, 140) } : {}),
    // Grup mesajı bildirimi: başlık=grup adı, gövde="gönderen: mesaj" (WhatsApp tarzı)
    // ve dokunulunca doğru gruba yönlendirme için groupId/groupName saklanır.
    ...(groupId ? { groupId } : {}),
    ...(groupName ? { groupName: String(groupName).slice(0, 80) } : {}),
    read: false,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "Users", toUid), {
    unreadNotifsCount: increment(1),
  });
  await batch.commit();
}

/**
 * Metindeki @kullanıcıadı geçişlerini uid'lere çözer (Usernames koleksiyonu).
 * @returns {Promise<Array<{uid:string, username:string}>>}
 */
export async function resolveMentionedUids(text, { excludeUid } = {}) {
  if (!text || typeof text !== "string") return [];
  const usernames = [
    ...new Set(
      (text.match(/@([a-zA-Z0-9_]{3,20})/g) || []).map((m) =>
        m.slice(1).toLowerCase(),
      ),
    ),
  ];
  if (!usernames.length) return [];

  const results = await Promise.all(
    usernames.map(async (uname) => {
      try {
        const snap = await getDoc(doc(db, "Usernames", uname));
        if (snap.exists() && snap.data()?.uid) {
          return { uid: snap.data().uid, username: uname };
        }
      } catch {
        /* yok say */
      }
      return null;
    }),
  );

  return results.filter((r) => r && r.uid && r.uid !== excludeUid);
}

/**
 * Bir post yorumunun tüm türev bildirimlerini üretir:
 *  - post_comment  → post sahibine
 *  - comment_reply → yanıtlanan yorumun sahibine (parentId varsa)
 *  - mention       → metinde @geçen kullanıcılara
 * Her biri bağımsız; biri patlarsa diğerleri etkilenmez.
 */
export async function notifyOnComment({
  postId,
  commentId,
  parentId = null,
  text = "",
  fromUid,
  fromName = "",
  fromAvatarIndex = 0,
}) {
  if (!postId || !fromUid) return;
  const notified = new Set([fromUid]); // kendine ve tekrar etme

  try {
    // Post sahibi
    let postAuthorId = null;
    try {
      const postSnap = await getDoc(doc(db, "Posts", postId));
      postAuthorId = postSnap.exists() ? postSnap.data()?.authorId : null;
    } catch {
      /* yok say */
    }

    // Yanıt ise → parent yorum sahibi
    let parentAuthorId = null;
    if (parentId) {
      try {
        const parentSnap = await getDoc(
          doc(db, "Posts", postId, "comments", parentId),
        );
        parentAuthorId = parentSnap.exists() ? parentSnap.data()?.authorId : null;
      } catch {
        /* yok say */
      }
    }

    const tasks = [];

    if (parentAuthorId && !notified.has(parentAuthorId)) {
      notified.add(parentAuthorId);
      tasks.push(
        createSocialNotification({
          toUid: parentAuthorId,
          fromUid,
          fromName,
          fromAvatarIndex,
          type: "comment_reply",
          postId,
          commentId,
          text,
        }),
      );
    }

    if (postAuthorId && !notified.has(postAuthorId)) {
      notified.add(postAuthorId);
      tasks.push(
        createSocialNotification({
          toUid: postAuthorId,
          fromUid,
          fromName,
          fromAvatarIndex,
          type: "post_comment",
          postId,
          commentId,
          text,
        }),
      );
    }

    // Mention'lar
    const mentioned = await resolveMentionedUids(text, { excludeUid: fromUid });
    for (const m of mentioned) {
      if (notified.has(m.uid)) continue;
      notified.add(m.uid);
      tasks.push(
        createSocialNotification({
          toUid: m.uid,
          fromUid,
          fromName,
          fromAvatarIndex,
          type: "mention",
          postId,
          commentId,
          text,
        }),
      );
    }

    await Promise.allSettled(tasks);
  } catch (e) {
    if (__DEV__) console.warn("notifyOnComment error:", e?.message);
  }
}
