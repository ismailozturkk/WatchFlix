// services/cineswipe/asyncRoom.js
//
// "Sırayla" (oturumlu) CineSwipe odasının SAF kuralları (Firebase/React yok, jest ile test edilir).
//
// Canlı oda: iki kişi aynı anda odadadır; misafir katılana kadar kimse oy veremez.
// Sırayla oda: kuran kişi odayı kurar kurmaz kendi seçimlerini yapar ve ekrandan çıkabilir. Davet
// 24 saat açıktır; misafir bu sürede katılıp seçer. Son oyu veren cihaz (hangisi olursa) ortak
// eşleşmeleri sohbete yazar ve diğer kişiye `cineswipe_result` bildirimi bırakır.

import { cineMediaKey } from "./deckModel";

export const ROOM_MODES = Object.freeze({ live: "live", async: "async" });

// Davetin açık kaldığı süre; misafir katılınca bitirmesi için yeniden bu kadar süre tanınır.
export const ASYNC_JOIN_MS = 24 * 60 * 60 * 1000;
// Bitmiş sırayla oda: oyunda olmayan taraf sonucu bildirimden açabilsin diye bir gün daha durur.
export const ASYNC_RESULT_MS = 24 * 60 * 60 * 1000;
export const LIVE_RESULT_MS = 60 * 60 * 1000;

export const roomModeOf = (value) => (value === ROOM_MODES.async ? ROOM_MODES.async : ROOM_MODES.live);
export const isAsyncRoom = (room) => room?.mode === ROOM_MODES.async;

const expiryOf = (room) => {
  const raw = room?.expiresAt?.toMillis?.() ?? room?.expiresAt;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
};

/** Odanın kalan süresi (ms); süre yoksa null, dolmuşsa 0. */
export function roomTimeLeft(room, now = Date.now()) {
  const expiry = expiryOf(room);
  return expiry === null ? null : Math.max(0, expiry - now);
}

/** Bu odada henüz oy vermediğim ilk kartın sırası (hepsi bittiyse deste uzunluğu). */
export function nextCardIndex(room, uid) {
  const deck = Array.isArray(room?.deck) ? room.deck : [];
  const key = (media) => cineMediaKey(media);
  const swipes = room?.swipes || {};
  const index = deck.findIndex((media) => !(swipes[key(media)] || swipes[String(media.id)] || {})[uid]);
  return index < 0 ? deck.length : index;
}

/**
 * Sırayla odada benim açımdan durum:
 *   "finished"     – iki taraf da bitirdi
 *   "yourTurn"     – destede oy vermediğim kart var
 *   "waitingGuest" – ben bitirdim (kurucuyum), henüz kimse katılmadı
 *   "partnerTurn"  – ben bitirdim, arkadaşım hâlâ seçiyor
 */
export function asyncRoomStage(room, uid) {
  if (!room || !uid) return null;
  if (room.status === "finished") return "finished";
  const deck = Array.isArray(room.deck) ? room.deck : [];
  if (nextCardIndex(room, uid) < deck.length) return "yourTurn";
  return room.guestUid ? "partnerTurn" : "waitingGuest";
}

/** Sonuç kimin sohbetine yazılır: misafirin davetle geldiği sohbet, yoksa iki kişinin 1-1 sohbeti. */
export function resultChatOf(room, uid) {
  const chat = room?.resultChat;
  if (chat?.groupId) return { groupId: String(chat.groupId), groupName: String(chat.groupName || "") };
  const partnerUid = room?.hostUid === uid ? room?.guestUid : room?.hostUid;
  const partnerName = room?.hostUid === uid ? room?.guestName : room?.hostName;
  if (!partnerUid || partnerUid === uid) return null;
  return { friendUid: partnerUid, friendName: String(partnerName || "") };
}

/**
 * Lobi satırı: Firestore odası → görünüm özeti. Canlı / süresi dolmuş / başkasının odası null.
 * Bitmiş oda listede kalır ("Sonuçlar hazır"): oyunda olmayan taraf sonucu buradan açar.
 */
export function asyncRoomRow(roomId, room, uid, now = Date.now()) {
  if (!roomId || !isAsyncRoom(room) || !uid) return null;
  if (room.hostUid !== uid && room.guestUid !== uid) return null;
  const left = roomTimeLeft(room, now);
  if (left !== null && left <= 0) return null;
  const isHost = room.hostUid === uid;
  const deck = Array.isArray(room.deck) ? room.deck : [];
  return {
    roomId,
    roomCode: String(room.roomCode || ""),
    isHost,
    partnerName: (isHost ? room.guestName : room.hostName) || "",
    stage: asyncRoomStage(room, uid),
    done: nextCardIndex(room, uid),
    total: deck.length,
    timeLeft: left,
    poster: deck.find((media) => media?.poster_path)?.poster_path || "",
  };
}

/** Lobide sıra: önce benden bir şey bekleyenler (sonuç hazır, sıra bende), sonra en az süre kalan. */
const STAGE_ORDER = { finished: 0, yourTurn: 1, partnerTurn: 2, waitingGuest: 3 };
export function sortAsyncRows(rows) {
  return [...rows].sort(
    (a, b) =>
      (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) ||
      (a.timeLeft ?? Infinity) - (b.timeLeft ?? Infinity),
  );
}

/** "18 sa" / "45 dk" — kalan süre etiketi için sayı + birim. */
export function timeLeftParts(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return { value: 0, unit: "minute" };
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return { value: minutes, unit: "minute" };
  return { value: Math.ceil(minutes / 60), unit: "hour" };
}
