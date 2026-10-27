// screens/game/gameLabels.js
//
// Oyun ekranlarının ortak METİN yardımcıları (gameConfig saf veri modülü
// kalsın diye i18n burada). Detay, kurulum ve sonuç ekranları aynı mod özetini
// ve aynı oyun adını gösterir.

import { copyLanguage } from "../../utils/appLanguages";
import { i18nText } from "@utils/i18nText";
import { getGameEntry } from "./gameRegistry";
import { OLDER_BOARD_GAME, OVERALL_BOARD } from "@utils/gameBoards";
import { getGameBoardsCopy } from "@utils/gameBoardsCopy";
import { getOlderCopy } from "@utils/olderGameCopy";
import { getQuickCopy } from "@utils/quickGamesCopy";

/** "10 soru · ~3 dk · Liderlik" gibi mod özeti. */
export function getModeMetaLine(mode, language) {
  const en = copyLanguage(language, ["tr", "en"]) === "en";
  const parts = [];
  if (mode.questionCount) parts.push(`${mode.questionCount} ${i18nText("autoI18n.soru", en ? "questions" : "soru")}`);
  if (mode.totalSeconds) parts.push(`${mode.totalSeconds} ${i18nText("autoI18n.saniye", en ? "sec" : "sn")}`);
  if (mode.lives) parts.push(`${mode.lives} ${i18nText("autoI18n.can", en ? "lives" : "can")}`);
  if (mode.estimatedMinutes) parts.push(`~${mode.estimatedMinutes} ${i18nText("autoI18n.dakika", en ? "min" : "dk")}`);
  if (mode.leaderboardEligible) parts.push(i18nText("autoI18n.liderlik_uygun", "Liderlik"));
  return parts.join(" · ");
}

/** Oyunun görünen adı (Sahne Tahmin / Poster Bulmaca). */
export function getGameTitle(gameId) {
  const game = getGameEntry(gameId);
  return i18nText(game.titleKey, game.id);
}

/**
 * Liderlik oyun seçicisindeki ad: "Genel", Sahne Tahmin / Poster Bulmaca (kayıt defteri), "Önce hangisi?" ve hızlı
 * oyunlar (kendi metin tabloları).
 */
export function getBoardGameTitle(gameId, language) {
  if (gameId === OVERALL_BOARD) return getGameBoardsCopy(language).overall;
  if (gameId === OLDER_BOARD_GAME) return getOlderCopy(language).title;
  const quick = getQuickCopy(language).games[gameId];
  if (quick) return quick.title;
  return getGameTitle(gameId);
}
