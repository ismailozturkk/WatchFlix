// services/gameLeaderboards.js
//
// Oyun liderlik tablolarını OKUR (her oyun + Genel) ve hızlı oyunların rekorunu tabloya YAZAR. Kurallar
// utils/gameBoards.js'te (saf, testli).
//
// OKUMA: bir tablo = tek sorgu (ilk BOARD_LIMIT). Genel, sıralı tüm oyunların tablolarını paralel okur (8 sorgu);
// bu yüzden sonuçlar kısa süre (BOARD_TTL_MS) bellekte tutulur — Oyun Merkezi ile Liderlik arasında gidip gelmek
// her seferinde 400 belge okutmasın. Kendi yazımımızdan sonra o tablonun önbelleği düşürülür.
//
// YAZMA (hızlı oyunlar): GameLeaderboards/quick_<oyun>/entries/{uid}. Kural zaten var (sahibi kendi uid'ine yazar,
// oturum açan okur — firestore.rules "Part 16.4"); yeni kural/deploy gerekmez. Yazılan skor oyuncunun o oyundaki
// REKORUDUR ve yalnız tablodakinden büyükse yazılır (iki cihazdan oynayan, düşük rekorlu cihazla iyisini ezmesin).
// Sahne Tahmin ve Poster Bulmaca kendi tablolarını saveGameScore'da yazar. Doğrulama yok (verified: false) — Sahne
// Tahmin tablosuyla aynı güven modeli.

import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { fetchLeaderboard } from "./sceneGameService";
import { readBoardSnapshot } from "./boardSnapshots";
import {
  BOARD_LIMIT,
  RANKED_GAME_IDS,
  SCENE_BOARD_GAME,
  boardEntryToRow,
  boardIdOf,
  buildOverallRows,
  isQuickBoardGame,
} from "../utils/gameBoards";

export const BOARD_TTL_MS = 60 * 1000;
const cache = new Map(); // gameId → { at, promise }

/** Sahne Tahmin satırı zaten genel tablo şeklinde (bestScore, totalCorrect…); yalnız gerekli alanlar. */
const sceneRow = (row) => ({
  uid: row.uid,
  displayName: row.displayName || null,
  avatarIndex: row.avatarIndex ?? null,
  photoURL: row.photoURL || null,
  bestScore: Number(row.bestScore) || 0,
  totalCorrect: Number(row.totalCorrect) || 0,
  totalWrong: Number(row.totalWrong) || 0,
  bestStreak: Number(row.bestStreak) || 0,
});

async function readBoard(gameId) {
  // Önce sunucunun anlık görüntüsü (1 okuma); yoksa tablo doğrudan okunur (BOARD_LIMIT okuma).
  // "Genel" tablo 8 oyunu okuduğu için açılış başına 400 okuma → 8.
  const snapshotId = gameId === SCENE_BOARD_GAME ? SCENE_BOARD_GAME : boardIdOf(gameId);
  const entries = snapshotId ? await readBoardSnapshot(snapshotId) : null;
  if (entries) {
    return entries.map(({ id, data }) =>
      gameId === SCENE_BOARD_GAME ? sceneRow({ uid: id, ...data }) : boardEntryToRow(id, data),
    );
  }
  if (gameId === SCENE_BOARD_GAME) return (await fetchLeaderboard(BOARD_LIMIT)).map(sceneRow);
  const boardId = boardIdOf(gameId);
  if (!boardId) return [];
  const snap = await getDocs(
    query(collection(db, "GameLeaderboards", boardId, "entries"), orderBy("score", "desc"), limit(BOARD_LIMIT)),
  );
  const rows = [];
  snap.forEach((entry) => rows.push(boardEntryToRow(entry.id, entry.data())));
  return rows;
}

/**
 * Bir oyunun tablosu (ilk BOARD_LIMIT satır). Hata fırlatır (ekran "yüklenemedi" gösterir).
 * @param {string} gameId
 * @param {{ fresh?: boolean }} [options] fresh: önbelleği atla ("tekrar dene")
 */
export function fetchGameBoard(gameId, { fresh = false } = {}) {
  const hit = cache.get(gameId);
  if (!fresh && hit && Date.now() - hit.at < BOARD_TTL_MS) return hit.promise;
  const promise = readBoard(gameId);
  cache.set(gameId, { at: Date.now(), promise });
  promise.catch(() => {
    if (cache.get(gameId)?.promise === promise) cache.delete(gameId); // hata önbelleklenmez
  });
  return promise;
}

/**
 * Genel sıralama: tüm oyun tabloları + sıra puanı toplamı. Bir oyunun tablosu okunamazsa o oyun boş sayılır;
 * HİÇBİRİ okunamazsa hata fırlatır.
 * @returns {Promise<{ rows: Array, failed: string[] }>}
 */
export async function fetchOverallBoard({ fresh = false } = {}) {
  const settled = await Promise.allSettled(RANKED_GAME_IDS.map((gameId) => fetchGameBoard(gameId, { fresh })));
  const boards = {};
  const failed = [];
  settled.forEach((result, index) => {
    const gameId = RANKED_GAME_IDS[index];
    if (result.status === "fulfilled") boards[gameId] = result.value;
    else failed.push(gameId);
  });
  if (failed.length === RANKED_GAME_IDS.length) throw new Error("boards_unavailable");
  return { rows: buildOverallRows(boards), failed };
}

/** Testler ve hesap sıfırlama için. */
export const __clearBoardCache = () => cache.clear();

/**
 * Hızlı oyun rekorunu tabloya yazar (tablodakinden büyükse). Sessiz: hata/çevrimdışı oyunu bozmaz.
 * @param {string} uid
 * @param {string} gameId "older" | hızlı oyun kimliği
 * @param {{ best: number, correct?: number }} stats  cihaz-yerel kayıt (rekor + toplam doğru)
 * @param {{ displayName?: string, avatarIndex?: number|null, photoURL?: string|null }|null} identity
 * @returns {Promise<boolean>} yazıldı mı
 */
export async function saveQuickBoardEntry(uid, gameId, stats, identity) {
  const score = Math.max(0, Math.trunc(Number(stats?.best)) || 0);
  if (!uid || !isQuickBoardGame(gameId) || score <= 0) return false;
  try {
    const ref = doc(db, "GameLeaderboards", boardIdOf(gameId), "entries", uid);
    const snap = await getDoc(ref);
    const previous = snap.exists() ? snap.data() : {};
    if ((Number(previous.score) || 0) >= score) return false;
    await setDoc(
      ref,
      {
        uid,
        displayNameSnapshot: identity?.displayName || previous.displayNameSnapshot || null,
        avatarIndexSnapshot: identity?.avatarIndex !== undefined ? identity.avatarIndex : previous.avatarIndexSnapshot ?? null,
        photoURLSnapshot: identity?.photoURL !== undefined ? identity.photoURL || null : previous.photoURLSnapshot ?? null,
        score,
        correctCount: Math.max(0, Math.trunc(Number(stats?.correct)) || 0),
        bestStreak: 0,
        achievedAt: new Date().toISOString(),
        verified: false,
        gameVersion: 1,
      },
      { merge: true },
    );
    cache.delete(gameId);
    return true;
  } catch (e) {
    if (__DEV__) console.warn("saveQuickBoardEntry error:", e?.message);
    return false;
  }
}
