// utils/ratingDistributionCopy.js
//
// Profildeki "Puan dağılımı" kartının metinleri (tr / en / es / pt / de).
// Şekil eşitliği __tests__/copyTablesSpanish.test.js'te bekçilenir.
// Sayı + isim tekil/çoğul tuzağı için `count` işlevi dil kuralını kendisi uygular.

import { copyLanguage } from "./appLanguages";

export const RATING_DISTRIBUTION_COPY = {
  tr: {
    title: "Puan dağılımı",
    count: (n, shown = n) => `${shown} puan`,
    average: "ortalama",
    mostCommon: "en sık",
    share: (pct) => `%${pct}`,
    emptyOwn: "Puanladıkça dağılımın burada şekillenir",
    a11y: (count, average) => `Puan dağılımı: ${count} puan, ortalama ${average} yıldız`,
    a11yStep: (stars, n) => `${stars} yıldız: ${n} puan`,
  },
  en: {
    title: "Rating spread",
    count: (n, shown = n) => `${shown} ${n === 1 ? "rating" : "ratings"}`,
    average: "average",
    mostCommon: "most",
    share: (pct) => `${pct}%`,
    emptyOwn: "Your rating spread takes shape here as you rate",
    a11y: (count, average) => `Rating spread: ${count} ratings, average ${average} stars`,
    a11yStep: (stars, n) => `${stars} stars: ${n} ratings`,
  },
  es: {
    title: "Puntuaciones",
    count: (n, shown = n) => `${shown} ${n === 1 ? "puntuación" : "puntuaciones"}`,
    average: "media",
    mostCommon: "más",
    share: (pct) => `${pct}%`,
    emptyOwn: "Tu distribución tomará forma aquí a medida que puntúes",
    a11y: (count, average) => `Distribución: ${count} puntuaciones, media ${average} estrellas`,
    a11yStep: (stars, n) => `${stars} estrellas: ${n} puntuaciones`,
  },
  pt: {
    title: "Notas",
    count: (n, shown = n) => `${shown} ${n === 1 ? "nota" : "notas"}`,
    average: "média",
    mostCommon: "mais",
    share: (pct) => `${pct}%`,
    emptyOwn: "Sua distribuição de notas toma forma aqui conforme você avalia",
    a11y: (count, average) => `Distribuição: ${count} notas, média ${average} estrelas`,
    a11yStep: (stars, n) => `${stars} estrelas: ${n} notas`,
  },
  de: {
    title: "Bewertungen",
    count: (n, shown = n) => `${shown} ${n === 1 ? "Bewertung" : "Bewertungen"}`,
    average: "Schnitt",
    mostCommon: "meist",
    share: (pct) => `${pct} %`,
    emptyOwn: "Deine Verteilung entsteht hier, sobald du bewertest",
    a11y: (count, average) => `Verteilung: ${count} Bewertungen, Schnitt ${average} Sterne`,
    a11yStep: (stars, n) => `${stars} Sterne: ${n} Bewertungen`,
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getRatingDistributionCopy = (language) =>
  RATING_DISTRIBUTION_COPY[copyLanguage(language, Object.keys(RATING_DISTRIBUTION_COPY))];
