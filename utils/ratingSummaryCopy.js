// utils/ratingSummaryCopy.js
//
// Sade puan özetinin erişilebilirlik metinleri (tr / en / es). Görünür metinler mevcut
// "autoI18n.puan_ver" / "autoI18n.yayinlanmadi" anahtarlarından gelir; burada yalnız ekran okuyucu cümleleri var.
// __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.

import { copyLanguage } from "./appLanguages";

export const RATING_SUMMARY_COPY = {
  tr: {
    score: (score, votes) => `Puan ${score} üzerinden 10${votes ? `, ${votes} oy` : ""}`,
    noScore: "Henüz puan yok",
    rate: "Puan vermek için dokun",
    rated: (mine) => `Senin puanın ${mine}. Değiştirmek için dokun`,
    locked: "Henüz yayınlanmadı",
  },
  en: {
    score: (score, votes) => `Rating ${score} out of 10${votes ? `, ${votes} votes` : ""}`,
    noScore: "No rating yet",
    rate: "Tap to rate",
    rated: (mine) => `Your rating ${mine}. Tap to change`,
    locked: "Not released yet",
  },
  es: {
    score: (score, votes) => `Puntuación ${score} de 10${votes ? `, ${votes} votos` : ""}`,
    noScore: "Aún sin puntuación",
    rate: "Toca para puntuar",
    rated: (mine) => `Tu puntuación ${mine}. Toca para cambiarla`,
    locked: "Aún no estrenada",
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getRatingSummaryCopy = (language) =>
  RATING_SUMMARY_COPY[copyLanguage(language, Object.keys(RATING_SUMMARY_COPY))];
