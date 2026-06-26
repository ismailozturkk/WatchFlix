// services/notificationsService.js
//
// Merkezi bildirim yönetimi:
//   - Subscribe: kullanıcının notifications subcollection'ı (limit 30)
//   - markRead/markAllRead: read=true + unreadNotifsCount güncelle
//   - clear: tek bildirimi sil
//
// Notification şeması:
//   Users/{uid}/notifications/{notifId}
//     type: 'friend_request' | 'friend_accepted' |
//           'post_like'      | 'post_comment'    |
//           'comment_reply'  | 'mention'
//     fromUid, fromName, fromAvatarIndex
//     postId? requestId? commentId?
//     text?: string
//     read: boolean
//     createdAt: Timestamp

import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  increment,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { snapshotErrorHandler } from "../utils/firestoreError";

const PAGE = 30;

/**
 * Realtime: kullanıcının en son N bildirimi.
 * @returns {Function} unsubscribe
 */
export function subscribeToNotifications(uid, callback) {
  if (!uid) return () => {};
  const q = query(
    collection(db, "Users", uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(PAGE),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapshotErrorHandler("notifications"),
  );
}

/**
 * Tek bildirimi okundu işaretle. Eğer halen okunmamışsa
 * `unreadNotifsCount` -= 1.
 */
export async function markNotificationRead(uid, notifId, wasRead) {
  if (!uid || !notifId) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "Users", uid, "notifications", notifId), {
    read: true,
  });
  if (!wasRead) {
    batch.update(doc(db, "Users", uid), {
      unreadNotifsCount: increment(-1),
    });
  }
  await batch.commit();
}

/**
 * Tüm bildirimleri toplu okundu işaretle.
 * Performans için: önce unread olanları sorgula, sayıyı bil, hepsini güncelle.
 * Büyük sayılarda chunk gerekir; şimdilik 30'la sınırlı görünüm yeterli.
 */
export async function markAllNotificationsRead(uid) {
  if (!uid) return;
  const q = query(
    collection(db, "Users", uid, "notifications"),
    where("read", "==", false),
    limit(100),
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  batch.update(doc(db, "Users", uid), {
    unreadNotifsCount: 0,
  });
  await batch.commit();
}

/**
 * Tek bildirimi sil. Eğer okunmamışsa unreadNotifsCount düzelt.
 */
export async function deleteNotification(uid, notifId, wasUnread) {
  if (!uid || !notifId) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, "Users", uid, "notifications", notifId));
  if (wasUnread) {
    batch.update(doc(db, "Users", uid), {
      unreadNotifsCount: increment(-1),
    });
  }
  await batch.commit();
}
