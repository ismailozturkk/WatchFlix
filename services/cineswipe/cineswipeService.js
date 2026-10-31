// services/cineswipe/cineswipeService.js
//
// CineSwipe ("Birlikte Ne İzlesek?") servis katmanı.
// Solo mod için dinamik ve sayfalı deste üretir; Film/Dizi kategorileri, türler
// ve kullanıcının kendi izleme listesinden beslenir.
// Duo mod için Firestore üzerinde oda kurma, yapılandırma ve eşleşme motoru sunar.
//
// Saf mantık (istek kurulumu, kart normalizasyonu, sayfa birleştirme)
// services/cineswipe/deckModel.js'tedir; burası yalnızca ağ ve Firestore.

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import axios from "axios";
import { db } from "../../firebase";
import {
  SWIPE_CATEGORIES,
  GENRE_OPTIONS,
  cineMediaKey,
  buildDeckRequests,
  normalizeDeckItem,
  normalizeWatchlistItem,
  normalizeFilters,
  mergeUniqueCards,
  interleaveCards,
  shuffleCards,
} from "./deckModel";
import {
  ASYNC_JOIN_MS,
  ASYNC_RESULT_MS,
  LIVE_RESULT_MS,
  asyncRoomRow,
  isAsyncRoom,
  roomModeOf,
  sortAsyncRows,
} from "./asyncRoom";
import { isInviteMessageId } from "../../utils/chatInvites";
import { getLocalList, hasLocalList } from "../listSyncService";

export { SWIPE_CATEGORIES, GENRE_OPTIONS, cineMediaKey };

const TMDB_BASE = "https://api.themoviedb.org/3";
const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;

// TMDB sayfa sınırı; bunun ötesi 422 döner.
const MAX_TMDB_PAGES = 500;

/**
 * 6 haneli rastgele oda kodu üretir (örn. "749215").
 */
export function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Geçici hatada (ağ, 5xx, 429) bir kez daha dener; kalıcı 4xx'te denemez. */
async function requestDeckPage(request) {
  const url = `${TMDB_BASE}${request.endpoint}`;
  const config = {
    params: request.params,
    headers: { accept: "application/json", Authorization: API_KEY },
    timeout: 8000,
  };
  try {
    return await axios.get(url, config);
  } catch (error) {
    const status = error?.response?.status;
    if (status >= 400 && status < 500 && status !== 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return axios.get(url, config);
  }
}

/**
 * CineSwipe için BİR SAYFA film/dizi destesi çeker. Ağ hatasında FIRLATIR
 * (boş liste "sonuç yok" demektir, hata demek değil) — ekran ikisini ayrı gösterir.
 *
 * @param {Object} options
 * @param {string} options.language - TMDB dil kodu: "tr-TR" | "en-US"
 * @param {string} options.category - bkz. SWIPE_CATEGORIES
 * @param {string} options.mediaType - "all" | "movie" | "tv"
 * @param {number|null} options.genreId - Tür filtresi (film tür kimliği)
 * @param {number} options.page - Sayfa numarası (1, 2, 3...)
 * @param {string|null} options.userId - İzleme listesi için uid
 * @returns {Promise<{ items: Array<Object>, hasMore: boolean }>}
 */
export async function fetchSwipeDeckPage(options = {}) {
  const { language = "tr-TR", page = 1, userId = null } = options;
  const filters = normalizeFilters(options);

  // 1. Kendi izleme listemden: tek seferde gelir, sayfalama yok. Liste cihazda zaten
  // tutuluyor (listSyncService, ListStatusContext eşitler) → 0 okuma. Yerel kopya henüz
  // kurulmadıysa (ilk açılış eşitlemesi bitmeden) Firestore'a düşülür.
  if (filters.category === "watchlist") {
    if (!userId || page > 1) return { items: [], hasMore: false };
    const entries = hasLocalList(userId, "watchList")
      ? Object.entries(getLocalList(userId, "watchList"))
      : (await getDocs(collection(db, "Lists", userId, "watchList"))).docs.map((entry) => [
          entry.id,
          entry.data(),
        ]);
    const items = [];
    entries.forEach(([id, data]) => {
      const card = normalizeWatchlistItem(data, id);
      if (card && (filters.mediaType === "all" || card.mediaType === filters.mediaType)) {
        items.push(card);
      }
    });
    return { items: shuffleCards(items), hasMore: false };
  }

  // 2. TMDB
  const requests = buildDeckRequests({ ...filters, page, language });
  if (!requests.length) return { items: [], hasMore: false };

  const settled = await Promise.allSettled(requests.map(requestDeckPage));
  if (settled.every((entry) => entry.status === "rejected")) throw settled[0].reason;

  const lists = [];
  let hasMore = false;
  settled.forEach((entry, index) => {
    if (entry.status !== "fulfilled") return; // "Karışık"ta bir uç düşse de diğeri gösterilir.
    const data = entry.value?.data || {};
    lists.push(
      (data.results || []).map((raw) => normalizeDeckItem(raw, requests[index].mediaType)).filter(Boolean),
    );
    if (page < Math.min(data.total_pages || 1, MAX_TMDB_PAGES)) hasMore = true;
  });

  const merged = lists.length > 1 ? interleaveCards(lists[0], lists[1]) : lists[0] || [];
  return { items: mergeUniqueCards([], merged), hasMore };
}

/**
 * Duo oda destesini toplar: tekrarsız, en fazla `targetCardsCount` kart.
 * Hiç kart toplanamazsa `empty-deck` fırlatır (ekranda "içerik yüklenemedi").
 */
export async function fetchRoomDeck(config = {}, { language = "tr-TR", userId = null } = {}) {
  const target = config.targetCardsCount || 20;
  const filters = normalizeFilters({
    category: config.category || "trending",
    mediaType: config.mediaType || "all",
    genreId: config.genreId ?? null,
  });
  const deck = [];
  const seen = new Set();
  try {
    for (let page = 1; deck.length < target && page <= 6; page += 1) {
      const result = await fetchSwipeDeckPage({ ...filters, language, userId, page });
      for (const item of result.items) {
        const key = cineMediaKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          deck.push(item);
        }
      }
      if (!result.hasMore) break;
    }
  } catch (error) {
    if (!deck.length) throw cineRoomError("empty-deck");
  }
  if (!deck.length) throw cineRoomError("empty-deck");
  return deck.slice(0, target);
}

/**
 * Duo Mod: Yeni bir eşleşme odası oluşturur.
 * @param {Object} hostUser - { uid, displayName, photoURL }
 * @param {Array<Object>} deck - Odaya ait kart destesi
 * @param {Object} config - { targetCardsCount, category, mediaType, genreId, mode }
 *   mode "async" (sırayla): kurucu hemen seçer, davet 24 saat açık kalır (bkz. ./asyncRoom).
 * @returns {Promise<{ roomId: string, roomCode: string }>}
 */
export async function createCineRoom(hostUser, deck = [], config = {}) {
  if (!hostUser || !hostUser.uid) {
    throw new Error("Oda oluşturmak için kullanıcı oturumu gereklidir.");
  }

  const targetCount = config.targetCardsCount || 20;
  const roomCode = generateRoomCode();
  const roomId = `room_${roomCode}_${Date.now()}`;
  const roomRef = doc(db, "CineRooms", roomId);

  const cleanDeck = (deck || []).slice(0, targetCount).map((item) => ({
    id: item.id,
    title: item.title || item.name || "Film",
    original_title: item.original_title || item.original_name || "",
    mediaType: item.mediaType || "movie",
    poster_path: item.poster_path || "",
    backdrop_path: item.backdrop_path || "",
    release_date: item.release_date || "",
    vote_average: typeof item.vote_average === "number" ? item.vote_average : 0,
    overview: item.overview || "",
    genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids.slice(0, 3) : [],
  }));

  if (!cleanDeck.length) throw cineRoomError("empty-deck");

  const payload = {
    roomId,
    roomCode,
    hostUid: hostUser.uid,
    hostName: hostUser.displayName || "Ev Sahibi",
    hostAvatar: hostUser.photoURL || null,
    guestUid: null,
    guestName: null,
    guestAvatar: null,
    status: "waiting", // "waiting" | "active" | "finished"
    mode: roomModeOf(config.mode), // "live" | "async"
    deck: cleanDeck,
    targetCount,
    category: config.category || "trending",
    mediaType: config.mediaType || "all",
    genreId: config.genreId ?? null,
    swipes: {}, // { [mediaId]: { [uid]: "like" | "pass" } }
    matches: [], // [mediaId, ...]
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + ASYNC_JOIN_MS,
  };

  await setDoc(roomRef, payload);
  return { roomId, roomCode };
}

/**
 * Beklemedeki odayı iptal eder / siler.
 * @param {string} roomId
 */
export async function deleteCineRoom(roomId) {
  if (!roomId) return;
  await deleteDoc(doc(db, "CineRooms", roomId));
}

export function cineRoomError(code) {
  return Object.assign(new Error(code), { code });
}

export function assertCineRoomAvailable(data, uid) {
  const expiresAt = data.expiresAt?.toMillis?.() ?? data.expiresAt;
  if (data.status === "expired" ||
      (typeof expiresAt === "number" && expiresAt <= Date.now())) {
    throw cineRoomError("room-expired");
  }
  if (data.hostUid === uid || data.guestUid === uid) return;
  if (data.status === "finished") throw cineRoomError("room-expired");
  if (data.guestUid || data.status === "active") throw cineRoomError("room-full");
  if (data.status !== "waiting") throw cineRoomError("room-expired");
}

/**
 * Join by six-digit code; recheck occupancy inside the atomic write.
 * `resultChat`: the chat the invitation came from. A "sırayla" room stores it so whichever device casts
 * the final vote posts the matches there (the host may finish last, without the invite context).
 * `inviteMessageId`: the invite card in that chat; stored the same way so the last voter marks the card
 * finished (utils/chatInvites, services/chatInviteService.markCineInviteDone).
 */
export async function joinCineRoom(roomCode, guestUser, { resultChat = null, inviteMessageId = null } = {}) {
  const code = typeof roomCode === "string" ? roomCode.trim() : "";
  if (!/^\d{6}$/.test(code)) throw cineRoomError("invalid-code");
  if (!guestUser?.uid) throw cineRoomError("unauthenticated");
  const snapshot = await getDocs(query(collection(db, "CineRooms"), where("roomCode", "==", code)));
  if (snapshot.empty) throw cineRoomError("room-not-found");
  // Prefer the newest room if a randomly generated code has been reused.
  const candidates = [...snapshot.docs].sort((a, b) =>
    (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
  const roomRef = doc(db, "CineRooms", candidates[0].id);
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(roomRef);
    if (!current.exists()) throw cineRoomError("room-deleted");
    const roomData = current.data();
    assertCineRoomAvailable(roomData, guestUser.uid);
    if (roomData.hostUid === guestUser.uid || roomData.guestUid === guestUser.uid) {
      return { roomId: candidates[0].id, roomData };
    }
    const payload = {
      guestUid: guestUser.uid,
      guestName: guestUser.displayName || "Misafir",
      guestAvatar: guestUser.photoURL || null,
      status: "active",
    };
    if (isAsyncRoom(roomData)) {
      // Katılan misafire seçimlerini bitirmesi için yeniden bir gün.
      payload.expiresAt = Math.max(Number(roomData.expiresAt) || 0, Date.now() + ASYNC_JOIN_MS);
      // Grup daveti grubun kendisine; 1-1 davet zaten iki kişinin sohbeti (resultChatOf varsayılanı).
      if (typeof resultChat?.groupId === "string" && resultChat.groupId) {
        payload.resultChat = { groupId: resultChat.groupId, groupName: String(resultChat.groupName || "") };
      }
      if (isInviteMessageId(inviteMessageId)) payload.inviteMessageId = inviteMessageId;
    }
    transaction.update(roomRef, payload);
    return { roomId: candidates[0].id, roomData: { ...roomData, ...payload } };
  });
}

export const cineVotesFor = (room, media) =>
  room.swipes?.[cineMediaKey(media)] || room.swipes?.[String(media.id)] || {};

export function summarizeCineRoom(room) {
  const deck = room.deck || [];
  const count = (uid, direction) => uid ? deck.filter((media) => {
    const vote = cineVotesFor(room, media)[uid];
    return direction ? vote === direction : vote === "like" || vote === "pass";
  }).length : 0;
  const matches = deck.filter((media) => {
    const votes = cineVotesFor(room, media);
    return room.hostUid && room.guestUid && votes[room.hostUid] === "like" && votes[room.guestUid] === "like";
  });
  const host = { reviewed: count(room.hostUid), likes: count(room.hostUid, "like"), passes: count(room.hostUid, "pass") };
  const guest = { reviewed: count(room.guestUid), likes: count(room.guestUid, "like"), passes: count(room.guestUid, "pass") };
  return { total: deck.length, matches, host, guest,
    matchRate: deck.length ? Math.round(matches.length * 100 / deck.length) : 0,
    complete: deck.length > 0 && !!room.guestUid && host.reviewed === deck.length && guest.reviewed === deck.length };
}

/** Atomic, idempotent votes; the final committed vote finishes the room. */
export async function recordSwipe(roomId, uid, media, direction = "like") {
  if (!roomId || !uid || !media || !["like", "pass"].includes(direction)) throw cineRoomError("invalid-vote");
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, "CineRooms", roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw cineRoomError("room-deleted");
    const room = snapshot.data();
    if (uid !== room.hostUid && uid !== room.guestUid) throw cineRoomError("permission-denied");
    assertCineRoomAvailable(room, uid);
    // Sırayla odada kurucu, misafir katılmadan (status "waiting") seçimlerini yapar.
    const canVote = room.status === "active" || (room.status === "waiting" && isAsyncRoom(room) && uid === room.hostUid);
    if (!canVote) throw cineRoomError("room-expired");
    const card = room.deck?.find((item) => cineMediaKey(item) === cineMediaKey(media));
    if (!card) throw cineRoomError("invalid-vote");
    const votes = cineVotesFor(room, card);
    // Duplicate taps/retries must not replace an already committed choice.
    if (votes[uid]) return { roomData: room };
    const swipes = { ...room.swipes, [cineMediaKey(card)]: { ...votes, [uid]: direction } };
    const next = { ...room, swipes };
    const summary = summarizeCineRoom(next);
    const patch = { swipes, matches: summary.matches };
    if (summary.complete) Object.assign(patch, {
      status: "finished", finishedAt: serverTimestamp(),
      expiresAt: Date.now() + (isAsyncRoom(room) ? ASYNC_RESULT_MS : LIVE_RESULT_MS),
    });
    transaction.update(ref, patch);
    // finishedByMe: bu oy odayı bitirdi; sırayla odada sonucu sohbete/bildirime bu cihaz yazar.
    return { roomData: { ...next, ...patch }, finishedByMe: !!summary.complete };
  });
}

/** Odaya kimliğiyle dön (lobi satırı / sonuç bildirimi). Yalnız katılımcı; süresi dolduysa hata. */
export async function loadCineRoom(roomId, uid) {
  if (!roomId || !uid) throw cineRoomError("unauthenticated");
  const snapshot = await getDoc(doc(db, "CineRooms", roomId));
  if (!snapshot.exists()) throw cineRoomError("room-deleted");
  const roomData = snapshot.data();
  if (roomData.hostUid !== uid && roomData.guestUid !== uid) throw cineRoomError("permission-denied");
  assertCineRoomAvailable(roomData, uid);
  return { roomId, roomData };
}

/** Benim süren "sırayla" odalarım (kurduklarım + katıldıklarım), lobide gösterilecek sırayla. */
export async function listMyAsyncRooms(uid, now = Date.now()) {
  if (!uid) return [];
  const rooms = collection(db, "CineRooms");
  const [hosted, joined] = await Promise.all([
    getDocs(query(rooms, where("hostUid", "==", uid))),
    getDocs(query(rooms, where("guestUid", "==", uid))),
  ]);
  const rows = new Map();
  [...hosted.docs, ...joined.docs].forEach((entry) => {
    const row = asyncRoomRow(entry.id, entry.data(), uid, now);
    if (row) rows.set(entry.id, row);
  });
  return sortAsyncRows([...rows.values()]);
}

/** Sent only after the final result has been stored locally. */
export async function acknowledgeCineResults(roomId, uid) {
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, "CineRooms", roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return; // Already cleaned up: acknowledgement is idempotent.
    const room = snapshot.data();
    if (uid !== room.hostUid && uid !== room.guestUid) throw cineRoomError("permission-denied");
    if (room.status !== "finished") throw cineRoomError("room-not-finished");
    const received = room.resultsReceived || [];
    if (!received.includes(uid)) transaction.update(ref, { resultsReceived: [...received, uid] });
  });
}

/**
 * CineRoom canlı dinleyicisi.
 * @param {string} roomId
 * @param {(roomData: Object) => void} onUpdate
 * @returns {() => void} Unsubscribe fonksiyonu
 */
export function subscribeToCineRoom(roomId, onUpdate, onError = () => {}) {
  if (!roomId) return () => {};
  const roomRef = doc(db, "CineRooms", roomId);
  return onSnapshot(roomRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data());
    } else {
      onError(cineRoomError("room-deleted"));
    }
  }, onError);
}
