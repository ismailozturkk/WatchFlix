// utils/gameBoards.js
//
// Liderlik tablolarının SAF çekirdeği: hangi oyunun hangi tabloda durduğu, satır sıralaması ve "Genel" sıralama.
// RN/Firebase importu YOK (services/gameLeaderboards.js okur/yazar, ekranlar çizer).
//
// TABLOLAR
//   scene_guess   → SceneGame/{uid}.bestScore (Klasik + Normal, kişisel liste hariç) — eski genel tablo, DEĞİŞMEDİ
//   poster_puzzle → GameLeaderboards/poster_classic_normal/entries (saveGameScore zaten yazıyordu; okunmuyordu)
//   older + hızlı oyunlar → GameLeaderboards/quick_<oyun>/entries (oyun sonunda o oyunun REKORU yazılır)
//
// GENEL SIRALAMA: oyunların skorları aynı ölçekte değil (Sahne Tahmin binler, "Önce hangisi?" art arda doğru,
// Bulanık Afiş puan toplamı). Ham skor toplanamaz; ölçeğe göre bölmek de tek bir uçuk skorla herkesi sıfırlar.
// Bu yüzden SIRA PUANI: her oyunun tablosunda 1. → 50, 2. → 49 … 50. → 1 puan; Genel = oyunlardaki sıra
// puanlarının toplamı. Eşit skor eşit sıra (ve puan) alır. Tek oyunda uçuk bir skor yalnız o oyunun 1.liğini alır.
// Sınırlama: her tablonun ilk BOARD_LIMIT'i okunur; bir oyunda ilk 50'nin dışındaki oyuncu o oyundan puan almaz.

import { QUICK_GAME_IDS } from "./quickGames";

export const OVERALL_BOARD = "overall";
export const SCENE_BOARD_GAME = "scene_guess";
export const POSTER_BOARD_GAME = "poster_puzzle";
export const OLDER_BOARD_GAME = "older";

/** Sıralaması olan oyunlar (Eğlence'deki sırayla). */
export const RANKED_GAME_IDS = Object.freeze([SCENE_BOARD_GAME, POSTER_BOARD_GAME, OLDER_BOARD_GAME, ...QUICK_GAME_IDS]);
/** Liderlik ekranındaki oyun seçicisi: Genel + her oyun. */
export const BOARD_GAME_IDS = Object.freeze([OVERALL_BOARD, ...RANKED_GAME_IDS]);

export const BOARD_LIMIT = 50;
export const RANK_POINTS_MAX = BOARD_LIMIT;

export const isBoardGame = (id) => BOARD_GAME_IDS.includes(id);
/** Oyun sonunda tabloya cihaz-yerel rekorunu yazan oyunlar ("Önce hangisi?" + hızlı oyunlar). */
export const isQuickBoardGame = (id) => id === OLDER_BOARD_GAME || QUICK_GAME_IDS.includes(id);

/** GameLeaderboards altındaki tablo kimliği; Sahne Tahmin eski SceneGame koleksiyonundadır (null). */
export function boardIdOf(gameId) {
  if (gameId === POSTER_BOARD_GAME) return "poster_classic_normal";
  if (isQuickBoardGame(gameId)) return `quick_${gameId}`;
  return null;
}

/** Hızlı oyun tablolarının kimlikleri (hesap sıfırlama / silme bunları da temizler). */
export const QUICK_BOARD_IDS = Object.freeze(RANKED_GAME_IDS.filter(isQuickBoardGame).map(boardIdOf));

const num = (value) => Number(value) || 0;

/** Tablo içi sıra: skor, eşitse daha çok doğru, sonra daha uzun seri (eski Liderlik kuralı). */
export const compareBoardRows = (a, b) =>
  num(b.bestScore) - num(a.bestScore) ||
  num(b.totalCorrect) - num(a.totalCorrect) ||
  num(b.bestStreak) - num(a.bestStreak);

/** GameLeaderboards girdisi → ekran satırı (genel tabloyla aynı şekil). */
export const boardEntryToRow = (id, data = {}) => ({
  uid: data.uid || id,
  displayName: data.displayNameSnapshot || null,
  avatarIndex: data.avatarIndexSnapshot ?? null,
  photoURL: data.photoURLSnapshot || null,
  bestScore: num(data.score),
  totalCorrect: num(data.correctCount),
  totalWrong: 0,
  bestStreak: num(data.bestStreak),
});

/**
 * Sıralanmış satırlar + sıra (eşit skor = eşit sıra, "1-1-3"). Skoru 0 olanlar sıralamaya girmez.
 * @returns {Array<object & { rank: number }>}
 */
export function rankRows(rows) {
  const sorted = (Array.isArray(rows) ? rows : []).filter((row) => row?.uid && num(row.bestScore) > 0).sort(compareBoardRows);
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || num(row.bestScore) !== num(sorted[index - 1].bestScore)) rank = index + 1;
    return { ...row, rank };
  });
}

/** Sıra → Genel puanı (1. → 50 … 50. → 1, dışı 0). */
export const rankPoints = (rank) => Math.max(0, RANK_POINTS_MAX + 1 - Math.max(1, Math.trunc(num(rank)) || 1));

/**
 * Genel sıralama. `boards`: { [gameId]: rows } (yalnız RANKED_GAME_IDS sayılır, eksik oyun boş sayılır).
 * Satır: { uid, displayName, avatarIndex, photoURL, bestScore: toplam sıra puanı, games: puan aldığı oyun sayısı,
 *          firsts: 1. olduğu oyun sayısı, perGame: { [gameId]: { rank, points } } }.
 * Eşitlikte: daha çok 1.lik, sonra daha çok oyun.
 */
export function buildOverallRows(boards) {
  const players = new Map();
  RANKED_GAME_IDS.forEach((gameId) => {
    rankRows(boards?.[gameId]).forEach((row) => {
      const points = rankPoints(row.rank);
      if (points <= 0) return;
      const player = players.get(row.uid) || { uid: row.uid, displayName: null, avatarIndex: null, photoURL: null, bestScore: 0, games: 0, firsts: 0, perGame: {} };
      // Kimlik: ilk bulunan dolu değer (tablolar aynı profilin anlık kopyalarıdır).
      if (!player.displayName && row.displayName) player.displayName = row.displayName;
      if (player.avatarIndex == null && row.avatarIndex != null) player.avatarIndex = row.avatarIndex;
      if (!player.photoURL && row.photoURL) player.photoURL = row.photoURL;
      player.bestScore += points;
      player.games += 1;
      if (row.rank === 1) player.firsts += 1;
      player.perGame[gameId] = { rank: row.rank, points };
      players.set(row.uid, player);
    });
  });
  return [...players.values()].sort(
    (a, b) => b.bestScore - a.bestScore || b.firsts - a.firsts || b.games - a.games,
  );
}
