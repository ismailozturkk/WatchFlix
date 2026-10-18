// utils/externalEntryCopy.js
//
// Simge uzun basma kısayolu başlıkları + paylaşım menüsünden gelen bağlantı iletileri (tr / en / es). Saf veri.
// __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.
// Kısayol başlıkları KISA tutulur (iOS ~25 karakterden sonra kırpar).

import { copyLanguage } from "./appLanguages";

export const EXTERNAL_ENTRY_COPY = {
  tr: {
    search: "Ara",
    upnext: "Sıradaki",
    reminders: "Hatırlatıcılar",
    lists: "Listelerim",
    shareOpening: "Bağlantı açılıyor…",
    shareUnrecognized: "Bu bağlantıda bir film ya da dizi bulamadım. IMDb veya TMDB bağlantısı paylaşın.",
    shareNotFound: "Bu bağlantıdaki yapım bulunamadı",
  },
  en: {
    search: "Search",
    upnext: "Up Next",
    reminders: "Reminders",
    lists: "My lists",
    shareOpening: "Opening link…",
    shareUnrecognized: "I couldn't find a movie or show in this link. Share an IMDb or TMDB link.",
    shareNotFound: "Couldn't find the title for this link",
  },
  es: {
    search: "Buscar",
    upnext: "Siguiente",
    reminders: "Recordatorios",
    lists: "Mis listas",
    shareOpening: "Abriendo enlace…",
    shareUnrecognized: "No encontré ninguna película o serie en este enlace. Comparte un enlace de IMDb o TMDB.",
    shareNotFound: "No se encontró el título de este enlace",
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getExternalEntryCopy = (language) =>
  EXTERNAL_ENTRY_COPY[copyLanguage(language, Object.keys(EXTERNAL_ENTRY_COPY))];
