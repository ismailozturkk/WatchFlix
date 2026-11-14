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
  pt: {
    pasteLabel: "Abrir o link de filme ou série da área de transferência",
    opening: "Abrindo link…",
    emptyClipboard: "Não há nenhum link do IMDb ou do TMDB na área de transferência",
    notFound: "Não foi possível encontrar o título deste link",
    clipboardFailed: "Não foi possível ler a área de transferência",
  },
  de: {
    pasteLabel: "Öffne den Film- oder Serienlink aus deiner Zwischenablage",
    opening: "Link wird geöffnet…",
    emptyClipboard: "In deiner Zwischenablage ist kein IMDb- oder TMDB-Link",
    notFound: "Der Titel zu diesem Link wurde nicht gefunden",
    clipboardFailed: "Die Zwischenablage konnte nicht gelesen werden",
  },

  it: {
  pasteLabel: "Apri il film o mostra il collegamento dagli appunti",
  opening: "Collegamento di apertura...",
  emptyClipboard: "Non è presente alcun collegamento IMDb o TMDB negli appunti",
  notFound: "Impossibile trovare il titolo per questo collegamento",
  clipboardFailed: "Impossibile leggere gli appunti"
},
  fr: {
    pasteLabel: "Ouvrir le lien de film ou de série du presse-papiers",
    opening: "Ouverture du lien…",
    emptyClipboard: "Aucun lien IMDb ou TMDB dans le presse-papiers",
    notFound: "Impossible de trouver le titre de ce lien",
    clipboardFailed: "Impossible de lire le presse-papiers",
  },
  ja: {
    pasteLabel: "クリップボードの映画・番組のリンクを開く",
    opening: "リンクを開いています…",
    emptyClipboard: "クリップボードにIMDbやTMDBのリンクがありません",
    notFound: "このリンクの作品が見つかりませんでした",
    clipboardFailed: "クリップボードを読み取れませんでした",
  }};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getMediaLinkCopy = (language) =>
  MEDIA_LINK_COPY[copyLanguage(language, Object.keys(MEDIA_LINK_COPY))];
