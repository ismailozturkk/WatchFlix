// utils/chatMediaBackdrop.js
//
// Sohbete giden tekli film/dizi mesajının arka plan alanları. Gönderenin
// GÖRDÜĞÜ arka plan yazılır: özel afiş seçimi (PosterChoices) varsa o, yoksa
// TMDB'nin varsayılanı. Alıcı kartı (components/chat/SharedMediaMessage) bunu
// bulanık fon olarak çizer.
//
// İki alan birlikte taşınır:
//   • backdrop_path — TMDB yolu; alıcı kendi kalite ayarıyla URL kurar.
//   • backdrop_url  — hazır tam URL (sabit w780); yol çözemeyen okuyucular
//                     (bildirim, web, eski istemci) doğrudan kullanır.
// Kişi (oyuncu) mesajlarında arka plan yoktur; nesne olduğu gibi döner.

export const CHAT_BACKDROP_SIZE = "w780";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";

export function chatBackdropUrl(path) {
  return typeof path === "string" && path.startsWith("/")
    ? `${TMDB_IMAGE_BASE}${CHAT_BACKDROP_SIZE}${path}`
    : null;
}

/**
 * @param {object} media   Firestore'a yazılacak media payload'u
 * @param {(type: string, id: number, fallback: string|null) => string|null} [resolveBackdrop]
 *        PosterChoices çözücüsü (gönderenin seçimi)
 * @returns {object} backdrop_path + backdrop_url eklenmiş YENİ nesne
 */
export function withSenderBackdrop(media, resolveBackdrop) {
  if (!media || typeof media !== "object") return media;
  if (media.media_type === "person") return media;
  const type = media.media_type === "tv" ? "tv" : "movie";
  const fallback = media.backdrop_path || media.backdropPath || null;
  const resolved = typeof resolveBackdrop === "function" ? resolveBackdrop(type, media.id, fallback) : null;
  const path = resolved || fallback || null;
  // Firestore undefined kabul etmez: eksik alanlar null.
  return { ...media, backdrop_path: path, backdrop_url: chatBackdropUrl(path) };
}
