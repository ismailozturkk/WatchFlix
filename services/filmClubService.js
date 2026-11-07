// services/filmClubService.js
//
// Film Kulübü Firestore katmanı (docs/ozellikler/FILM_KULUBU.md). Kurallar utils/filmClub.js'te (saf), yetki
// firestore.rules → groups/{gid}.club + clubRounds + discussion.
//
// Kulüp olayları (tur açıldı / film seçildi / tur bitti) grup sohbetine `clubShare` kartı olarak düşer. Kart,
// ChatScreen'in gönderim batch'iyle AYNI biçimde yazılır: mesaj + grup özeti (lastMessage) + diğer üyelerin
// okunmamış sayacı tek atomik batch'te; push'u sunucu mesaj tetikleyicisi dağıtır (utils/chatPush.js).
//
// Evre geçişleri (oylamayı kapat, turu bitir) TRANSACTION: iki üye aynı anda "süre doldu" diye kapatırsa yalnız
// biri geçer ve duyuruyu yalnız o yazar.

import { db } from "../firebase";
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { buildClubShare, buildShareMessage } from "../utils/chatShare";
import { prepareOutgoingMessage } from "../utils/chatPush";
import {
  CLUB_SENDER_NAME_MAX,
  buildRoundDraft,
  cadenceOf,
  isValidRating,
  pickWinner,
  roundStats,
  sanitizeComment,
  watchEndsAtFor,
  candidateIdOf,
} from "../utils/filmClub";
import { queueGroupUnreadIncrements } from "./groupsService";

const ROUNDS = "clubRounds";
const DISCUSSION = "discussion";
// Arşiv ekranı için yeterli; tur başına bir belge (haftalık kulüpte ~1 yıl).
const ROUND_LIMIT = 60;
const COMMENT_LIMIT = 300;

const roundsCol = (groupId) => collection(db, "groups", groupId, ROUNDS);
const roundDoc = (groupId, roundId) => doc(db, "groups", groupId, ROUNDS, roundId);

const withId = (snap) => ({ id: snap.id, ...snap.data() });

/** Firestore undefined kabul etmez: gönderen alanlarından boşları at. */
function senderFieldsOf(sender) {
  const out = {
    senderName: String(sender?.name || "").slice(0, CLUB_SENDER_NAME_MAX),
    senderUsername: sender?.username || "",
  };
  if (typeof sender?.avatarIndex === "number") out.senderAvatarIndex = sender.avatarIndex;
  if (typeof sender?.photoURL === "string" && sender.photoURL) out.senderPhotoURL = sender.photoURL;
  return out;
}

/**
 * Kulüp duyurusunu grup sohbetine yazar (ChatScreen.postMessage'ın grup dalıyla aynı batch). Geçersiz gövde → hata.
 * `batch` verilirse ona eklenir (tur açılışı: tur belgesi + duyuru tek batch).
 */
function queueClubAnnouncement(batch, { groupId, members, sender, share }) {
  const built = buildShareMessage(share);
  if (!built) throw new Error("club share invalid");
  const { message } = prepareOutgoingMessage({
    ...built,
    senderId: sender.uid,
    timestamp: serverTimestamp(),
    status: "sent",
    ...senderFieldsOf(sender),
  });
  batch.set(doc(collection(db, "groups", groupId, "messages")), message);
  batch.set(
    doc(db, "groups", groupId),
    {
      lastMessage: {
        text: built.text,
        senderId: sender.uid,
        senderName: senderFieldsOf(sender).senderName,
        senderUsername: sender.username || "",
        time: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  queueGroupUnreadIncrements(batch, groupId, members, sender.uid);
}

async function postClubAnnouncement(args) {
  const batch = writeBatch(db);
  queueClubAnnouncement(batch, args);
  await batch.commit();
}

// ─── Kulüp ayarı ─────────────────────────────────────────────────────────────

/** Kulübü aç/kapat ya da sıklığını değiştir (kurucu/yönetici; açmak Premium — kural da denetler). */
export function setClubSettings(groupId, { enabled, cadence }, uid) {
  return updateDoc(doc(db, "groups", groupId), {
    club: { enabled: !!enabled, cadence: cadenceOf(cadence).id, updatedBy: uid },
    updatedAt: serverTimestamp(),
  });
}

// ─── Dinleyiciler ────────────────────────────────────────────────────────────

/** Tüm turlar, yeniden eskiye. */
export function subscribeClubRounds(groupId, callback, onError) {
  if (!groupId) return () => {};
  return onSnapshot(
    query(roundsCol(groupId), orderBy("number", "desc"), limit(ROUND_LIMIT)),
    (snap) => callback(snap.docs.map(withId)),
    (err) => {
      if (__DEV__) console.warn("subscribeClubRounds:", err.message);
      onError?.(err);
    },
  );
}

/** Tek tur (tartışma ekranı: izledim durumu + başlık). Silinmişse null. */
export function subscribeClubRound(groupId, roundId, callback) {
  if (!groupId || !roundId) return () => {};
  return onSnapshot(
    roundDoc(groupId, roundId),
    (snap) => callback(snap.exists() ? withId(snap) : null),
    (err) => {
      if (__DEV__) console.warn("subscribeClubRound:", err.message);
      callback(null);
    },
  );
}

/** Açık tur(lar) — sohbet şeridi için; tek alanlı `in` sorgusu, bileşik dizin gerekmez. */
export function subscribeOpenClubRounds(groupId, callback) {
  if (!groupId) return () => {};
  return onSnapshot(
    query(roundsCol(groupId), where("status", "in", ["voting", "watching"])),
    (snap) => callback(snap.docs.map(withId)),
    (err) => __DEV__ && console.warn("subscribeOpenClubRounds:", err.message),
  );
}

/** Tartışma (yalnız izleyen okuyabilir; izlemeyende kural reddeder → onError). */
export function subscribeDiscussion(groupId, roundId, callback, onError) {
  if (!groupId || !roundId) return () => {};
  return onSnapshot(
    query(collection(roundDoc(groupId, roundId), DISCUSSION), orderBy("createdAt", "asc"), limit(COMMENT_LIMIT)),
    (snap) => callback(snap.docs.map(withId)),
    (err) => {
      if (__DEV__) console.warn("subscribeDiscussion:", err.message);
      onError?.(err);
    },
  );
}

// ─── Tur yaşam döngüsü ───────────────────────────────────────────────────────

/**
 * Yeni tur + sohbete "oylama başladı" kartı (tek batch). Tek açık tur kuralını çağıran denetler.
 * @returns {Promise<string>} roundId
 */
export async function startClubRound({ groupId, group, sender, candidates, number }) {
  const draft = buildRoundDraft({
    number,
    candidates,
    cadence: group?.club?.cadence,
    uid: sender.uid,
    nowMs: Date.now(),
  });
  if (!draft) throw new Error("not enough candidates");
  const { voteEndsAtMs, ...fields } = draft;
  const ref = doc(roundsCol(groupId));
  const batch = writeBatch(db);
  batch.set(ref, { ...fields, voteEndsAt: Timestamp.fromMillis(voteEndsAtMs), createdAt: serverTimestamp() });
  queueClubAnnouncement(batch, {
    groupId,
    members: group?.members,
    sender,
    share: buildClubShare({
      event: "voting",
      groupId,
      roundId: ref.id,
      number: draft.number,
      candidates: draft.candidates,
      endsAt: voteEndsAtMs,
    }),
  });
  await batch.commit();
  return ref.id;
}

/** Oy ver / geri çek (`candidateId` null → geri çek). */
export function castClubVote(groupId, roundId, uid, candidateId) {
  return updateDoc(roundDoc(groupId, roundId), { [`votes.${uid}`]: candidateId ? candidateId : deleteField() });
}

/**
 * Oylamayı kapatır: en çok oy alan aday seçilir (eşitlikte aday sırası), izleme süresi başlar, sohbete
 * "haftanın filmi" kartı gider. Başkası önce kapattıysa null döner (duyuru yazılmaz).
 */
export async function closeClubVoting({ groupId, group, roundId, sender }) {
  const ref = roundDoc(groupId, roundId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const round = snap.data();
    if (round.status !== "voting") return null;
    const pick = pickWinner(round);
    if (!pick) return null;
    const watchEndsAtMs = watchEndsAtFor(round.cadence, Date.now());
    tx.update(ref, {
      status: "watching",
      pickId: candidateIdOf(pick),
      pick,
      pickedAt: serverTimestamp(),
      watchEndsAt: Timestamp.fromMillis(watchEndsAtMs),
    });
    return { number: round.number, pick, watchEndsAtMs };
  });
  if (!result) return null;
  await postClubAnnouncement({
    groupId,
    members: group?.members,
    sender,
    share: buildClubShare({
      event: "picked",
      groupId,
      roundId,
      number: result.number,
      pick: result.pick,
      endsAt: result.watchEndsAtMs,
    }),
  }).catch((err) => __DEV__ && console.warn("club picked announce:", err.message));
  return result;
}

/** Turu bitirir (arşive alır) ve sohbete özet kartı yazar. Başkası önce bitirdiyse null. */
export async function finishClubRound({ groupId, group, roundId, sender }) {
  const ref = roundDoc(groupId, roundId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const round = snap.data();
    if (round.status !== "watching") return null;
    tx.update(ref, { status: "done", finishedAt: serverTimestamp() });
    return { number: round.number, pick: round.pick, stats: roundStats(round, group?.members) };
  });
  if (!result) return null;
  await postClubAnnouncement({
    groupId,
    members: group?.members,
    sender,
    share: buildClubShare({
      event: "done",
      groupId,
      roundId,
      number: result.number,
      pick: result.pick,
      avgRating: result.stats.avgRating,
      watchedCount: result.stats.watchedCount,
      memberCount: result.stats.memberCount,
    }),
  }).catch((err) => __DEV__ && console.warn("club done announce:", err.message));
  return result;
}

/** Turu siler (yönetici). Tartışma alt koleksiyonu kalır ama tur olmadan okunamaz (kural tur belgesine bakar). */
export function deleteClubRound(groupId, roundId) {
  return deleteDoc(roundDoc(groupId, roundId));
}

// ─── İzledim, puan, tartışma ─────────────────────────────────────────────────

/** İzledim işaretle / geri al. Geri alınca puan da silinir (kural puanı izlemeye bağlar). */
export function setClubWatched(groupId, roundId, uid, watched) {
  return updateDoc(
    roundDoc(groupId, roundId),
    watched
      ? { [`watched.${uid}`]: serverTimestamp() }
      : { [`watched.${uid}`]: deleteField(), [`ratings.${uid}`]: deleteField() },
  );
}

/** Puan (1–10) ya da null → sil. */
export function setClubRating(groupId, roundId, uid, rating) {
  if (rating != null && !isValidRating(rating)) return Promise.reject(new Error("invalid rating"));
  return updateDoc(roundDoc(groupId, roundId), { [`ratings.${uid}`]: rating == null ? deleteField() : rating });
}

/** Tartışmaya yaz (yalnız izleyen; sayaç aynı batch'te +1). */
export async function postClubComment({ groupId, roundId, sender, text }) {
  const clean = sanitizeComment(text);
  if (!clean) return null;
  const ref = roundDoc(groupId, roundId);
  const batch = writeBatch(db);
  const commentRef = doc(collection(ref, DISCUSSION));
  batch.set(commentRef, {
    senderId: sender.uid,
    senderName: senderFieldsOf(sender).senderName,
    text: clean,
    createdAt: serverTimestamp(),
  });
  batch.update(ref, { commentCount: increment(1) });
  await batch.commit();
  return commentRef.id;
}

/** Kendi yorumunu (ya da yönetici herhangi birini) siler. Sayaç düşmez — "kaç mesaj yazıldı" olarak kalır. */
export function deleteClubComment(groupId, roundId, commentId) {
  return deleteDoc(doc(roundDoc(groupId, roundId), DISCUSSION, commentId));
}
