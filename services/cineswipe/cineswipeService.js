// services/cineswipe/cineswipeService.js
//
// CineSwipe ("Birlikte Ne İzlesek?") servis katmanı.
// Solo mod için dinamik ve sayfalı deste üretir; Film/Dizi kategorileri, türler
// ve kullanıcının kendi izleme listesinden beslenir.
// Duo mod için Firestore üzerinde oda kurma, yapılandırma ve eşleşme motoru sunar.

import {
  doc,
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

const TMDB_BASE = "https://api.themoviedb.org/3";
const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;

export const SWIPE_CATEGORIES = [
  { id: "trending", label: "Popüler & Trendler", icon: "flame-outline" },
  { id: "now_playing", label: "Vizyondaki Filmler", icon: "film-outline", mediaType: "movie" },
  { id: "upcoming", label: "Yakında Gelecekler", icon: "time-outline", mediaType: "movie" },
  { id: "top_rated_movie", label: "En İyi Filmler (IMDb/TMDB)", icon: "trophy-outline", mediaType: "movie" },
  { id: "popular_tv", label: "Popüler Diziler", icon: "tv-outline", mediaType: "tv" },
  { id: "top_rated_tv", label: "Efsane Diziler", icon: "star-outline", mediaType: "tv" },
  { id: "watchlist", label: "Kendi İzleme Listem", icon: "bookmark-outline" },
];

export const GENRE_OPTIONS = [
  { id: null, label: "Tüm Türler" },
  { id: 28, label: "Aksiyon" },
  { id: 35, label: "Komedi" },
  { id: 18, label: "Dram" },
  { id: 878, label: "Bilim Kurgu" },
  { id: 27, label: "Korku" },
  { id: 10749, label: "Romantik" },
  { id: 16, label: "Animasyon" },
  { id: 53, label: "Gerilim" },
  { id: 99, label: "Belgesel" },
  { id: 80, label: "Suç" },
];

/**
 * 6 haneli rastgele oda kodu üretir (örn. "749215").
 */
export function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * CineSwipe için film/dizi destesi çeker.
 * @param {Object} options
 * @param {string} options.language - "tr-TR" | "en-US"
 * @param {string} options.category - "trending" | "now_playing" | "upcoming" | "top_rated_movie" | "popular_tv" | "top_rated_tv" | "watchlist"
 * @param {string} options.mediaType - "all" | "movie" | "tv"
 * @param {number|null} options.genreId - Tür filtresi
 * @param {number} options.page - Sayfa numarası (1, 2, 3...)
 * @param {string|null} options.userId - Kullanıcı izleme listesi çekimi için uid
 */
export async function fetchSwipeDeck({
  language = "tr-TR",
  category = "trending",
  mediaType = "movie",
  genreId = null,
  page = 1,
  userId = null,
} = {}) {
  try {
    // 1. Kendi İzleme Listemden Çekme
    if (category === "watchlist" && userId) {
      const watchlistRef = collection(db, "Lists", userId, "watchList");
      const snap = await getDocs(watchlistRef);
      const items = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data && (data.name || data.title) && data.imagePath) {
          items.push({
            id: data.id || parseInt(d.id, 10),
            title: data.name || data.title || "Film",
            original_title: data.name || data.title || "",
            mediaType: data.type || "movie",
            poster_path: data.imagePath,
            backdrop_path: data.imagePath,
            release_date: "",
            vote_average: 0,
            overview: data.overview || "",
          });
        }
      });
      // Karıştır
      return items.sort(() => Math.random() - 0.5);
    }

    // 2. TMDB Kategori Çözümleme
    let endpoint = "/trending/all/week";
    let params = {
      language,
      page,
      include_adult: false,
    };

    if (category === "now_playing") {
      endpoint = "/movie/now_playing";
    } else if (category === "upcoming") {
      endpoint = "/movie/upcoming";
    } else if (category === "top_rated_movie") {
      endpoint = "/movie/top_rated";
    } else if (category === "popular_tv") {
      endpoint = "/tv/popular";
    } else if (category === "top_rated_tv") {
      endpoint = "/tv/top_rated";
    } else if (genreId) {
      endpoint = mediaType === "tv" ? "/discover/tv" : "/discover/movie";
      params.with_genres = genreId;
      params.sort_by = "popularity.desc";
      params["vote_count.gte"] = 80;
    } else if (mediaType === "tv") {
      endpoint = "/trending/tv/week";
    } else if (mediaType === "movie") {
      endpoint = "/trending/movie/week";
    }

    const res = await axios.get(`${TMDB_BASE}${endpoint}`, {
      params,
      headers: { accept: "application/json", Authorization: API_KEY },
      timeout: 8000,
    });

    const results = res.data.results || [];
    return results
      .filter((item) => item.poster_path && (item.title || item.name))
      .map((item) => {
        const itemType = item.title ? "movie" : item.name ? "tv" : mediaType || "movie";
        return {
          id: item.id,
          title: item.title || item.name || "Film",
          original_title: item.original_title || item.original_name || "",
          mediaType: itemType,
          poster_path: item.poster_path || "",
          backdrop_path: item.backdrop_path || "",
          release_date: item.release_date || item.first_air_date || "",
          vote_average: typeof item.vote_average === "number" ? item.vote_average : 0,
          overview: item.overview || "",
        };
      });
  } catch (e) {
    return [];
  }
}

/**
 * Duo Mod: Yeni bir eşleşme odası oluşturur.
 * @param {Object} hostUser - { uid, displayName, photoURL }
 * @param {Array<Object>} deck - Odaya ait kart destesi
 * @param {Object} config - { targetCardsCount, category, mediaType, genreId }
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
    deck: cleanDeck,
    targetCount,
    category: config.category || "trending",
    swipes: {}, // { [mediaId]: { [uid]: "like" | "pass" } }
    matches: [], // [mediaId, ...]
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
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

/** Join by six-digit code; recheck occupancy inside the atomic write. */
export async function joinCineRoom(roomCode, guestUser) {
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
    transaction.update(roomRef, payload);
    return { roomId: candidates[0].id, roomData: { ...roomData, ...payload } };
  });
}

export const cineMediaKey = (media) => `${media.mediaType || "movie"}_${media.id}`;
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
    if (room.status !== "active") throw cineRoomError("room-expired");
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
      status: "finished", finishedAt: serverTimestamp(), expiresAt: Date.now() + 60 * 60 * 1000,
    });
    transaction.update(ref, patch);
    return { roomData: { ...next, ...patch } };
  });
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
