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
      writeBatch,
    increment,
  where,
  getDocs,
  startAfter,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { snapshotErrorHandler } from "../utils/firestoreError";
import { matchingInvitationIds } from "../utils/importantInvites";
import { trackFirestoreRead } from "./usageTrackerService";

const PAGE = 30;

/**
 * Realtime: kullanıcının en son N bildirimi.
 * @returns {Function} unsubscribe
 */
export function subscribeToNotifications(uid, callback, onError) {
  if (!uid) return () => {};
  const q = query(
    collection(db, "Users", uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(PAGE),
  );
  return onSnapshot(
    q,
    (snap) => {
      trackFirestoreRead("notifications", snap.docs.length);
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })), {
        cursor: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.size === PAGE,
      });
    },
    (error) => {
      snapshotErrorHandler("notifications")(error);
      onError?.(error);
    },
  );
}

export async function fetchOlderNotifications(uid, cursor) {
  if (!uid || !cursor) return { items: [], cursor: null, hasMore: false };
  const snap = await getDocs(query(
    collection(db, "Users", uid, "notifications"),
    orderBy("createdAt", "desc"), startAfter(cursor), limit(PAGE),
  ));
  trackFirestoreRead("notifications", snap.docs.length);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.size === PAGE,
  };
}

/**
 * Tek bildirimi okundu işaretle. Eğer halen okunmamışsa
 * `unreadNotifsCount` -= 1.
 */
export async function markNotificationRead(uid, notifId) {
  if (!uid || !notifId) return;
  // Two taps/devices must never decrement the same notification twice.
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, "Users", uid, "notifications", notifId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists() || snapshot.data().read) return;
    const userRef = doc(db, "Users", uid);
    const userSnapshot = await transaction.get(userRef);
    transaction.update(ref, { read: true });
    transaction.update(userRef, {
      unreadNotifsCount: Math.max(0, (Number(userSnapshot.data()?.unreadNotifsCount) || 0) - 1),
    });
  });
}

/** Accept or decline an actionable invitation once, across devices. Reading it alone leaves it pending. */
export async function respondToInvitation(uid, notifId, response) {
  if (!uid || !notifId || !["accepted", "declined"].includes(response)) return false;
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, "Users", uid, "notifications", notifId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return false;
    const item = snapshot.data();
    if (!["cineswipe_invite", "game_challenge"].includes(item.type) || item.response) return false;
    const userRef = doc(db, "Users", uid);
    const userSnapshot = item.read ? null : await transaction.get(userRef);
    transaction.update(ref, { response, read: true });
    if (!item.read) {
      transaction.update(userRef, {
        unreadNotifsCount: Math.max(0, (Number(userSnapshot.data()?.unreadNotifsCount) || 0) - 1),
      });
    }
    return true;
  });
}

/**
 * An invitation accepted from its chat card also accepts its inbox record, so the priority bar on
 * Profile (ImportantInvitesBar) stops asking. Reads only that sender's records (single equality query,
 * no composite index); matching rule: utils/importantInvites.matchingInvitationIds.
 * @returns {Promise<number>} records marked "accepted"
 */
export async function acceptMatchingInvitations(uid, match) {
  if (!uid || !match?.type || !match?.fromUid) return 0;
  const snap = await getDocs(
    query(collection(db, "Users", uid, "notifications"), where("fromUid", "==", match.fromUid), limit(20)),
  );
  trackFirestoreRead("notifications", snap.docs.length);
  const ids = matchingInvitationIds(snap.docs.map((d) => ({ id: d.id, ...d.data() })), match);
  const saved = await Promise.all(ids.map((id) => respondToInvitation(uid, id, "accepted").catch(() => false)));
  return saved.filter(Boolean).length;
}

// Bir toplu yazım en fazla 500 işlem alır; sayaç güncellemesine yer kalsın.
const MARK_ALL_CHUNK = 400;

/**
 * Tüm okunmamış bildirimleri parça parça okundu işaretle (yüklenmemiş eskiler dahil).
 * Sayaç YALNIZ son parçayla sıfırlanır: yarıda kalan bir çalışma okunmamışları gizlemez.
 * Okunmamış belge kalmasa da sayaç sıfırlanır — kaymış sayaç böyle düzelir.
 * @returns {Promise<number>} okundu işaretlenen bildirim sayısı
 */
export async function markAllNotificationsRead(uid) {
  if (!uid) return 0;
  const unread = query(
    collection(db, "Users", uid, "notifications"),
    where("read", "==", false),
    limit(MARK_ALL_CHUNK),
  );
  let marked = 0;
  for (;;) {
    const snap = await getDocs(unread);
    trackFirestoreRead("notifications", snap.docs.length);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    marked += snap.docs.length;
    const last = snap.docs.length < MARK_ALL_CHUNK;
    if (last) batch.update(doc(db, "Users", uid), { unreadNotifsCount: 0 });
    await batch.commit();
    if (last) return marked;
  }
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
