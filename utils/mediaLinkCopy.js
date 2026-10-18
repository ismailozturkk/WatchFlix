// utils/mediaLinkCopy.js
//
// Arama ekranındaki "bağlantıdan aç" (TMDB / IMDb) metinleri (tr / en / es). Saf veri.
// __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.

import { copyLanguage } from "./appLanguages";

export const MEDIA_LINK_COPY = {
  tr: {
    pasteLabel: "Panodaki film ya da dizi bağlantısını aç",
    opening: "Bağlantı açılıyor…",
    emptyClipboard: "Panoda IMDb ya da TMDB bağlantısı yok",
    notFound: "Bu bağlantıdaki yapım bulunamadı",
    clipboardFailed: "Pano okunamadı",
  },
  en: {
    pasteLabel: "Open the movie or show link from your clipboard",
    opening: "Opening link…",
    emptyClipboard: "There's no IMDb or TMDB link on your clipboard",
    notFound: "Couldn't find the title for this link",
    clipboardFailed: "Couldn't read the clipboard",
  },
  es: {
    pasteLabel: "Abrir el enlace de película o serie del portapapeles",
    opening: "Abriendo enlace…",
    emptyClipboard: "No hay ningún enlace de IMDb o TMDB en el portapapeles",
    notFound: "No se encontró el título de este enlace",
    clipboardFailed: "No se pudo leer el portapapeles",
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getMediaLinkCopy = (language) =>
  MEDIA_LINK_COPY[copyLanguage(language, Object.keys(MEDIA_LINK_COPY))];
