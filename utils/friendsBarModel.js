// utils/friendsBarModel.js
//
// Profil ekranındaki arkadaş şeridinin (Ara / Arkadaşlar / Mesajlar / İstekler)
// görüntü modeli. Saf fonksiyon: RN importu yok, jest doğrudan test eder.
//
// KURAL — şeritte yalnız kullanıcıdan EYLEM bekleyen sayılar görünür:
//   badge → okunmamış mesaj (tekil + grup TOPLAMI, tek rozet) ve gelen istek.
//           Kırmızı rozet olarak çizilir, 0 ise hiç çizilmez.
// Arkadaş sayısı şeritte BİLEREK yok (7 Kas, kullanıcı kararı): "Arkadaşlar"
// karosunda her zaman ikon durur. Eskiden önce rozet, sonra ikonun yerinde düz
// rakam olarak çiziliyordu; hiç sıfırlanmayan bir sayı bildirim gibi duruyordu.
// Tekil ve grup mesajları için iki ayrı rozet de denendi, kalabalık durduğu için
// tek toplam rozete dönüldü.
//
// Gönderilen (cevap bekleyen) istek sayısı şeritte BİLEREK yok: kullanıcıdan
// eylem beklemiyor, şerit kompakt kalsın diye İstekler ekranının içinde.

import { toCount } from "./appBadge";

export const BADGE_CAP = 99;

/** Rozet metni: 0 → "", 1..99 → "n", üstü "99+". */
export function formatBadge(count) {
  const n = toCount(count);
  if (n <= 0) return "";
  return n > BADGE_CAP ? `${BADGE_CAP}+` : String(n);
}

/**
 * @param {{ unreadMessages?: number, incomingRequests?: number }} counts
 *   unreadMessages: tekil + grup okunmamış toplamı (UnreadMessagesContext)
 * @returns {{ search, friends, messages, requests }} her biri { badge: number }
 */
export function buildFriendsBarModel({
  unreadMessages = 0,
  incomingRequests = 0,
} = {}) {
  return {
    search: { badge: 0 },
    friends: { badge: 0 },
    messages: { badge: toCount(unreadMessages) },
    requests: { badge: toCount(incomingRequests) },
  };
}
