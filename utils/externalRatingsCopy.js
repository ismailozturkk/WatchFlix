// utils/externalRatingsCopy.js
//
// Harici puanlar (IMDb · Rotten Tomatoes · Metascore) ayrıntı sayfasının metinleri (tr / en / es). Saf veri.
// __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.
// Marka adları (IMDb, Rotten Tomatoes, Metascore) çevrilmez.

import { copyLanguage } from "./appLanguages";

export const EXTERNAL_RATINGS_COPY = {
  tr: {
    title: "Puanlar",
    close: "Kapat",
    open: (summary) => `Harici puanlar: ${summary}. Ayrıntılar için dokun`,
    imdb: {
      sub: (votes) => (votes ? `${votes} oy` : "Kullanıcı puanı"),
      scale: "10 üzerinden",
    },
    rt: {
      sub: "Eleştirmen onay oranı",
      fresh: "Taze",
      rotten: "Çürük",
    },
    meta: {
      sub: "Eleştirmen ortalaması",
      scale: "100 üzerinden",
      verdicts: {
        universalAcclaim: "Evrensel beğeni",
        favorable: "Genel olarak olumlu",
        mixed: "Karışık ya da ortalama",
        unfavorable: "Genel olarak olumsuz",
        overwhelmingDislike: "Aşırı hoşnutsuzluk",
      },
    },
    source: "Puanlar OMDb üzerinden alınır. Her yapım için üçü de bulunmayabilir; özellikle dizilerde Rotten Tomatoes ve Metascore çoğunlukla yoktur.",
  },
  en: {
    title: "Ratings",
    close: "Close",
    open: (summary) => `External ratings: ${summary}. Tap for details`,
    imdb: {
      sub: (votes) => (votes ? `${votes} votes` : "User rating"),
      scale: "out of 10",
    },
    rt: {
      sub: "Critics' approval rate",
      fresh: "Fresh",
      rotten: "Rotten",
    },
    meta: {
      sub: "Critics' average",
      scale: "out of 100",
      verdicts: {
        universalAcclaim: "Universal acclaim",
        favorable: "Generally favorable",
        mixed: "Mixed or average",
        unfavorable: "Generally unfavorable",
        overwhelmingDislike: "Overwhelming dislike",
      },
    },
    source: "Ratings come from OMDb. Not every title has all three; shows in particular often lack Rotten Tomatoes and Metascore.",
  },
  es: {
    title: "Puntuaciones",
    close: "Cerrar",
    open: (summary) => `Puntuaciones externas: ${summary}. Toca para ver los detalles`,
    imdb: {
      sub: (votes) => (votes ? `${votes} votos` : "Puntuación de usuarios"),
      scale: "sobre 10",
    },
    rt: {
      sub: "Aprobación de la crítica",
      fresh: "Fresca",
      rotten: "Podrida",
    },
    meta: {
      sub: "Media de la crítica",
      scale: "sobre 100",
      verdicts: {
        universalAcclaim: "Aclamación universal",
        favorable: "Generalmente favorable",
        mixed: "Mixta o media",
        unfavorable: "Generalmente desfavorable",
        overwhelmingDislike: "Rechazo abrumador",
      },
    },
    source: "Las puntuaciones vienen de OMDb. No todos los títulos tienen las tres; las series suelen carecer de Rotten Tomatoes y Metascore.",
  },
  pt: {
    title: "Notas",
    close: "Fechar",
    open: (summary) => `Notas externas: ${summary}. Toque para ver os detalhes`,
    imdb: {
      sub: (votes) => (votes ? `${votes} votos` : "Nota dos usuários"),
      scale: "de 10",
    },
    rt: {
      sub: "Aprovação da crítica",
      fresh: "Fresco",
      rotten: "Podre",
    },
    meta: {
      sub: "Média da crítica",
      scale: "de 100",
      verdicts: {
        universalAcclaim: "Aclamação universal",
        favorable: "Geralmente favorável",
        mixed: "Mista ou mediana",
        unfavorable: "Geralmente desfavorável",
        overwhelmingDislike: "Rejeição esmagadora",
      },
    },
    source: "As notas vêm do OMDb. Nem todos os títulos têm as três; as séries costumam não ter Rotten Tomatoes nem Metascore.",
  },
  de: {
    title: "Bewertungen",
    close: "Schließen",
    open: (summary) => `Externe Bewertungen: ${summary}. Tippe für Details`,
    imdb: {
      sub: (votes) => (votes ? `${votes} Stimmen` : "Nutzerbewertung"),
      scale: "von 10",
    },
    rt: {
      sub: "Zustimmungsquote der Kritiker",
      fresh: "Frisch",
      rotten: "Verfault",
    },
    meta: {
      sub: "Kritikerdurchschnitt",
      scale: "von 100",
      verdicts: {
        universalAcclaim: "Allgemeine Anerkennung",
        favorable: "Überwiegend positiv",
        mixed: "Gemischt oder durchschnittlich",
        unfavorable: "Überwiegend negativ",
        overwhelmingDislike: "Überwältigende Ablehnung",
      },
    },
    source: "Die Bewertungen stammen von OMDb. Nicht jeder Titel hat alle drei; besonders bei Serien fehlen oft Rotten Tomatoes und Metascore.",
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getExternalRatingsCopy = (language) =>
  EXTERNAL_RATINGS_COPY[copyLanguage(language, Object.keys(EXTERNAL_RATINGS_COPY))];
