// utils/friendsBarModel.js
//
// Profil ekranındaki arkadaş şeridinin (Ara / Arkadaşlar / Mesajlar / İstekler)
// görüntü modeli. Saf fonksiyon: RN importu yok, jest doğrudan test eder.
//
// KURAL — şeritte iki tür sayı var ve birbirine benzememeli:
//   badge → kullanıcıdan EYLEM bekleyen sayı (okunmamış mesaj, gelen istek).
//           Kırmızı rozet olarak çizilir, 0 ise hiç çizilmez.
//   count → bilgi (arkadaş sayısı). Rozet DEĞİL: "Arkadaşlar" sütununda ikonun
//           yerine, ikon karosunun İÇİNDE düz rakam olarak çizilir (köşede
//           asılı kırmızı bir nokta değil, sıfırlanması beklenmez).
// Eskiden HER sayı (arkadaş sayısı, gönderilen istek dahil) aynı bildirim
// rozetiyle çiziliyordu; hiç sıfırlanmayan "12" bir bildirim gibi asılı kalıyordu.
//
// Gönderilen (cevap bekleyen) istek sayısı şeritte BİLEREK yok: kullanıcıdan
// eylem beklemiyor, şerit kompakt kalsın diye İstekler ekranının içinde.

import { toCount } from "./appBadge";

export const BADGE_CAP = 99;
export const FRIEND_COUNT_CAP = 999;

/** Rozet metni: 0 → "", 1..99 → "n", üstü "99+". */
export function formatBadge(count) {
  const n = toCount(count);
  if (n <= 0) return "";
  return n > BADGE_CAP ? `${BADGE_CAP}+` : String(n);
}

/**
 * Arkadaş sayısı metni (ikon karosuna sığacak biçimde). 0 → "" (çağıran ikonu
 * gösterir: boş durumda "0" yazmak yerine ikon, "arkadaş ekle" çağrısını taşır),
 * 1..999 → "n", üstü "999+".
 */
export function formatFriendCount(count) {
  const n = toCount(count);
  if (n <= 0) return "";
  return n > FRIEND_COUNT_CAP ? `${FRIEND_COUNT_CAP}+` : String(n);
}

/**
 * @param {{ friendCount?: number, unreadMessages?: number,
 *           incomingRequests?: number }} counts
 * @returns {{ search, friends, messages, requests }}
 *   her biri { badge: number }; friends ayrıca { count: number }
 */
export function buildFriendsBarModel({
  friendCount = 0,
  unreadMessages = 0,
  incomingRequests = 0,
} = {}) {
  return {
    search: { badge: 0 },
    friends: { badge: 0, count: toCount(friendCount) },
    messages: { badge: toCount(unreadMessages) },
    requests: { badge: toCount(incomingRequests) },
  };
}
