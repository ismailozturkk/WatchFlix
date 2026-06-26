// services/friendsService.js
//
// Tüm arkadaşlık akışları — her biri atomic batch ile.
// Eş zamanlı çakışmalar ve kısmi yazma korunur.
//
// Koleksiyonlar:
//   Users/{uid}/friends/{friendUid}            ← kabul edilmiş arkadaşlar
//   Users/{uid}/friendRequests/{requestId}     ← GELEN istekler (incoming)
//   Users/{uid}/sentRequests/{requestId}       ← GÖNDERİLEN kopyası (outgoing)
//   Users/{uid}/blocked/{blockedUid}           ← engellenenler
//   Users/{uid}/notifications/{notifId}        ← bildirimler
//
// requestId = `${fromUid}_${toUid}` deterministik — duplicate istek imkânsız.

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { clampAvatarIndex } from "../utils/avatars";
import { snapshotErrorHandler } from "../utils/firestoreError";

// ── Helpers ──────────────────────────────────────────────────────────────────

const requestId = (fromUid, toUid) => `${fromUid}_${toUid}`;

const snapshotUserMeta = (userDoc) => ({
  uid: userDoc.uid,
  displayName: userDoc.displayName || "",
  username: userDoc.username || "",
  avatarIndex: clampAvatarIndex(userDoc.avatarIndex),
});

// İstek dokümanlarını createdAt'e göre yeniden→eskiye sıralar (client-side).
// serverTimestamp henüz çözülmemişse (null) en üste alır — yeni gelen istek.
const sortByCreatedAtDesc = (docs) =>
  docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? Infinity) -
      (a.createdAt?.toMillis?.() ?? Infinity));

// ── Sorgular (Reads) ─────────────────────────────────────────────────────────

/**
 * Realtime: kullanıcının arkadaş listesi.
 */
export function subscribeToFriends(uid, callback) {
  if (!uid) return () => {};
  return onSnapshot(
    collection(db, "Users", uid, "friends"),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapshotErrorHandler("friends"),
  );
}

/**
 * Realtime: gelen pending istekler.
 */
export function subscribeToIncomingRequests(uid, callback) {
  if (!uid) return () => {};
  // NOT: orderBy KASITLI olarak yok. status==pending + orderBy(createdAt)
  // composite index ister; index kurulmamışsa sorgu sessizce hata verir ve
  // gelen istekler hiç görünmez. Bunun yerine eşitlik filtresi (otomatik
  // single-field index) kullanıp sıralamayı client-side yapıyoruz.
  const q = query(
    collection(db, "Users", uid, "friendRequests"),
    where("status", "==", "pending"),
  );
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedAtDesc(snap.docs)),
    snapshotErrorHandler("incomingRequests"),
  );
}

/**
 * Realtime: gönderilen pending istekler.
 */
export function subscribeToOutgoingRequests(uid, callback) {
  if (!uid) return () => {};
  // orderBy yok — yukarıdaki subscribeToIncomingRequests ile aynı gerekçe.
  const q = query(
    collection(db, "Users", uid, "sentRequests"),
    where("status", "==", "pending"),
  );
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedAtDesc(snap.docs)),
    snapshotErrorHandler("outgoingRequests"),
  );
}

/**
 * Hızlı boolean kontroller (cache'lenir).
 */
export async function checkRelationship(currentUid, targetUid) {
  if (!currentUid || !targetUid || currentUid === targetUid)
    return { isFriend: false, requestSent: false, requestReceived: false, isBlocked: false };

  const reqIdOut = requestId(currentUid, targetUid);
  const reqIdIn = requestId(targetUid, currentUid);

  const [friendSnap, sentSnap, receivedSnap, blockedSnap] = await Promise.all([
    getDoc(doc(db, "Users", currentUid, "friends", targetUid)),
    getDoc(doc(db, "Users", currentUid, "sentRequests", reqIdOut)),
    getDoc(doc(db, "Users", currentUid, "friendRequests", reqIdIn)),
    getDoc(doc(db, "Users", currentUid, "blocked", targetUid)),
  ]);

  return {
    isFriend: friendSnap.exists(),
    requestSent: sentSnap.exists() && sentSnap.data().status === "pending",
    requestReceived: receivedSnap.exists() && receivedSnap.data().status === "pending",
    isBlocked: blockedSnap.exists(),
  };
}

// ── Mutations (her biri ATOMIC batch) ────────────────────────────────────────

/**
 * Arkadaşlık isteği gönder.
 *
 * Batch:
 *  - Users/{to}/friendRequests/{reqId}      → pending
 *  - Users/{from}/sentRequests/{reqId}      → pending
 *  - Users/{from}.pendingRequestsOutCount   += 1
 *  - Users/{to}.pendingRequestsInCount      += 1
 *  - Users/{to}.unreadNotifsCount           += 1
 *  - Users/{to}/notifications/{id}          → friend_request
 *
 * @param {Object} fromUser Users/{fromUid} dokümanı (en azından meta alanları)
 * @param {Object} toUser   Users/{toUid} dokümanı
 * @param {string} [message]
 */
export async function sendFriendRequest(fromUser, toUser, message = "") {
  if (!fromUser?.uid || !toUser?.uid)
    throw new Error("sendFriendRequest: uid eksik");
  if (fromUser.uid === toUser.uid)
    throw new Error("Kendine istek gönderemezsin");

  const reqId = requestId(fromUser.uid, toUser.uid);
  const fromMeta = snapshotUserMeta(fromUser);
  const toMeta = snapshotUserMeta(toUser);

  // NOT: "Engelli mi?" kontrolünü ARTIK istemci tarafında yapmıyoruz.
  // Hedefin blocked alt koleksiyonu yalnızca sahibine okutulur
  // (firestore.rules: Users/{uid}/blocked → isOwner(uid)); buradan
  // getDoc çağırmak permission-denied verir ve isteği komple bloklar.
  // Engel kontrolü zaten güvenlik kuralındaki notBlocked() ile sunucu
  // tarafında yapılıyor: hedef bizi engellediyse friendRequests create
  // reddedilir ve aşağıdaki batch.commit() hata fırlatır.

  const batch = writeBatch(db);

  batch.set(doc(db, "Users", toUser.uid, "friendRequests", reqId), {
    fromUid: fromUser.uid,
    fromName: fromMeta.displayName,
    fromUsername: fromMeta.username,
    fromAvatarIndex: fromMeta.avatarIndex,
    status: "pending",
    seen: false,
    message,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, "Users", fromUser.uid, "sentRequests", reqId), {
    toUid: toUser.uid,
    toName: toMeta.displayName,
    toUsername: toMeta.username,
    toAvatarIndex: toMeta.avatarIndex,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, "Users", fromUser.uid), {
    pendingRequestsOutCount: increment(1),
  });

  batch.update(doc(db, "Users", toUser.uid), {
    pendingRequestsInCount: increment(1),
    unreadNotifsCount: increment(1),
  });

  const notifRef = doc(collection(db, "Users", toUser.uid, "notifications"));
  batch.set(notifRef, {
    type: "friend_request",
    fromUid: fromUser.uid,
    fromName: fromMeta.displayName,
    fromAvatarIndex: fromMeta.avatarIndex,
    requestId: reqId,
    read: false,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return reqId;
}

/**
 * Gelen isteği kabul et.
 *  - Her iki tarafa /friends/{uid} doc
 *  - İki tarafın istek doc'larını sil
 *  - friendsCount += 1
 *  - pendingRequestsInCount -= 1, pendingRequestsOutCount -= 1
 *  - Sender'a friend_accepted notification
 */
export async function acceptFriendRequest(currentUser, fromUser) {
  if (!currentUser?.uid || !fromUser?.uid) throw new Error("uid eksik");
  const reqId = requestId(fromUser.uid, currentUser.uid);
  const meMeta = snapshotUserMeta(currentUser);
  const fromMeta = snapshotUserMeta(fromUser);

  const batch = writeBatch(db);

  // Friends doc'ları (her iki taraf)
  batch.set(doc(db, "Users", currentUser.uid, "friends", fromUser.uid), {
    friendUid: fromUser.uid,
    friendName: fromMeta.displayName,
    friendUsername: fromMeta.username,
    friendAvatarIndex: fromMeta.avatarIndex,
    friendsSince: serverTimestamp(),
  });
  batch.set(doc(db, "Users", fromUser.uid, "friends", currentUser.uid), {
    friendUid: currentUser.uid,
    friendName: meMeta.displayName,
    friendUsername: meMeta.username,
    friendAvatarIndex: meMeta.avatarIndex,
    friendsSince: serverTimestamp(),
  });

  // İstek doc'larını sil
  batch.delete(doc(db, "Users", currentUser.uid, "friendRequests", reqId));
  batch.delete(doc(db, "Users", fromUser.uid, "sentRequests", reqId));

  // Counter'lar
  batch.update(doc(db, "Users", currentUser.uid), {
    friendsCount: increment(1),
    pendingRequestsInCount: increment(-1),
  });
  batch.update(doc(db, "Users", fromUser.uid), {
    friendsCount: increment(1),
    pendingRequestsOutCount: increment(-1),
  });

  // Sender'a "kabul edildi" bildirimi
  const notifRef = doc(collection(db, "Users", fromUser.uid, "notifications"));
  batch.set(notifRef, {
    type: "friend_accepted",
    fromUid: currentUser.uid,
    fromName: meMeta.displayName,
    fromAvatarIndex: meMeta.avatarIndex,
    read: false,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "Users", fromUser.uid), {
    unreadNotifsCount: increment(1),
  });

  await batch.commit();
}

/**
 * Gelen isteği reddet.
 */
export async function declineFriendRequest(currentUid, fromUid) {
  if (!currentUid || !fromUid) throw new Error("uid eksik");
  const reqId = requestId(fromUid, currentUid);

  const batch = writeBatch(db);
  batch.delete(doc(db, "Users", currentUid, "friendRequests", reqId));
  batch.delete(doc(db, "Users", fromUid, "sentRequests", reqId));
  batch.update(doc(db, "Users", currentUid), {
    pendingRequestsInCount: increment(-1),
  });
  batch.update(doc(db, "Users", fromUid), {
    pendingRequestsOutCount: increment(-1),
  });
  await batch.commit();
}

/**
 * Gönderilmiş bekleyen isteği iptal et.
 */
export async function cancelFriendRequest(currentUid, toUid) {
  if (!currentUid || !toUid) throw new Error("uid eksik");
  const reqId = requestId(currentUid, toUid);

  const batch = writeBatch(db);
  batch.delete(doc(db, "Users", currentUid, "sentRequests", reqId));
  batch.delete(doc(db, "Users", toUid, "friendRequests", reqId));
  batch.update(doc(db, "Users", currentUid), {
    pendingRequestsOutCount: increment(-1),
  });
  batch.update(doc(db, "Users", toUid), {
    pendingRequestsInCount: increment(-1),
  });
  await batch.commit();
}

/**
 * Arkadaşlıktan çıkar.
 */
export async function unfriend(currentUid, friendUid) {
  if (!currentUid || !friendUid) throw new Error("uid eksik");
  const batch = writeBatch(db);
  batch.delete(doc(db, "Users", currentUid, "friends", friendUid));
  batch.delete(doc(db, "Users", friendUid, "friends", currentUid));
  batch.update(doc(db, "Users", currentUid), {
    friendsCount: increment(-1),
  });
  batch.update(doc(db, "Users", friendUid), {
    friendsCount: increment(-1),
  });
  await batch.commit();
}

/**
 * Kullanıcıyı engelle. Eğer arkadaşsalar otomatik unfriend +
 * aralarındaki tüm pending istekler temizlenir.
 */
export async function blockUser(currentUser, targetUid) {
  if (!currentUser?.uid || !targetUid || currentUser.uid === targetUid)
    throw new Error("blockUser: uid eksik veya kendisi");

  const batch = writeBatch(db);
  const meUid = currentUser.uid;

  // 1) Block doc'u
  batch.set(doc(db, "Users", meUid, "blocked", targetUid), {
    blockedAt: serverTimestamp(),
  });

  // 2) Arkadaşlığı temizle (varsa)
  const wasFriend = await getDoc(doc(db, "Users", meUid, "friends", targetUid));
  if (wasFriend.exists()) {
    batch.delete(doc(db, "Users", meUid, "friends", targetUid));
    batch.delete(doc(db, "Users", targetUid, "friends", meUid));
    batch.update(doc(db, "Users", meUid), { friendsCount: increment(-1) });
    batch.update(doc(db, "Users", targetUid), { friendsCount: increment(-1) });
  }

  // 3) Pending istekleri temizle (her iki yön)
  const reqOut = requestId(meUid, targetUid);
  const reqIn = requestId(targetUid, meUid);

  const [outSnap, inSnap] = await Promise.all([
    getDoc(doc(db, "Users", meUid, "sentRequests", reqOut)),
    getDoc(doc(db, "Users", meUid, "friendRequests", reqIn)),
  ]);
  if (outSnap.exists()) {
    batch.delete(doc(db, "Users", meUid, "sentRequests", reqOut));
    batch.delete(doc(db, "Users", targetUid, "friendRequests", reqOut));
    batch.update(doc(db, "Users", meUid), { pendingRequestsOutCount: increment(-1) });
    batch.update(doc(db, "Users", targetUid), { pendingRequestsInCount: increment(-1) });
  }
  if (inSnap.exists()) {
    batch.delete(doc(db, "Users", meUid, "friendRequests", reqIn));
    batch.delete(doc(db, "Users", targetUid, "sentRequests", reqIn));
    batch.update(doc(db, "Users", meUid), { pendingRequestsInCount: increment(-1) });
    batch.update(doc(db, "Users", targetUid), { pendingRequestsOutCount: increment(-1) });
  }

  await batch.commit();
}

/**
 * Engellemeyi kaldır.
 */
export async function unblockUser(currentUid, targetUid) {
  if (!currentUid || !targetUid) throw new Error("uid eksik");
  const batch = writeBatch(db);
  batch.delete(doc(db, "Users", currentUid, "blocked", targetUid));
  await batch.commit();
}

/**
 * Engellenenler listesi.
 */
export async function fetchBlockedUsers(uid) {
  if (!uid) return [];
  const snap = await getDocs(collection(db, "Users", uid, "blocked"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
