// utils/friendsBarModel.js
//
// Profil ekranındaki arkadaş şeridinin (Ara / Arkadaşlar / Mesajlar / İstekler)
// görüntü modeli. Saf fonksiyon: RN importu yok, jest doğrudan test eder.
//
// ESKİ HATA: şeritteki HER sayı aynı "bildirim rozeti" görünümündeydi — arkadaş
// sayısı da, gönderilen istek sayısı da. Oysa kullanıcıdan EYLEM bekleyen yalnız
// iki sayı var; geri kalanı bilgi. İkisi aynı görününce rozet "yeni bir şey var"
// diye okunuyor, hiç sıfırlanmayan "12" bir bildirim gibi asılı kalıyordu.
//
// KURAL:
//   badge   → kullanıcıdan eylem bekleyen sayı (okunmamış mesaj, gelen istek).
//             Kırmızı rozet olarak çizilir, 0 ise hiç çizilmez.
//   caption → bilgi. Etiketin altında sönük düz metin; rozet gibi durmaz.
// Caption bir "anahtar" olarak döner; metni bileşen (i18n) üretir.

import { toCount } from "./appBadge";

export const BADGE_CAP = 99;

/** Rozet metni: 0 → "", 1..99 → "n", üstü "99+". */
export function formatBadge(count) {
  const n = toCount(count);
  if (n <= 0) return "";
  return n > BADGE_CAP ? `${BADGE_CAP}+` : String(n);
}

/**
 * @param {{ friendCount?: number, unreadMessages?: number,
 *           incomingRequests?: number, outgoingRequests?: number }} counts
 * @returns {{ search, friends, messages, requests }} her biri
 *   { badge: number, caption: { key: string, count?: number } }
 */
export function buildFriendsBarModel({
  friendCount = 0,
  unreadMessages = 0,
  incomingRequests = 0,
  outgoingRequests = 0,
} = {}) {
  const friends = toCount(friendCount);
  const unread = toCount(unreadMessages);
  const incoming = toCount(incomingRequests);
  const outgoing = toCount(outgoingRequests);

  return {
    search: { badge: 0, caption: { key: "searchHint" } },
    friends: {
      badge: 0,
      caption:
        friends > 0
          ? { key: friends === 1 ? "friendsOne" : "friendsMany", count: friends }
          : { key: "friendsNone" },
    },
    messages: { badge: unread, caption: { key: "messagesIdle" } },
    requests: {
      badge: incoming,
      caption:
        outgoing > 0
          ? { key: "requestsSent", count: outgoing }
          : { key: "requestsIdle" },
    },
  };
}
