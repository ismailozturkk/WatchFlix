// utils/chatEntrance.js
//
// Sohbette "sekme" (bounce) giriş animasyonunu YALNIZ yeni mesajlara vermek için
// saf tespit mantığı. Liste ilk yüklendiğinde, eski sayfa çekildiğinde ya da
// hücre sanallaştırma yüzünden yeniden bağlandığında balonlar hareket etmemeli;
// aksi halde geçmişi kaydırırken her balon yeniden zıplıyordu.
//
// Giriş kuralı: yeni mesaj listenin BAŞINA (Firestore desc → en yeni önde)
// eklenir. Eski sayfa yüklemesi listenin SONUNA eklendiği için bu kuralla
// karışmaz; saat farkına da bağımlı değil (zaman damgası değil sıra kullanılır).

/** Girişin "taze" sayıldığı süre; sonradan yeniden bağlanan hücre oynamaz. */
export const ENTRANCE_WINDOW_MS = 1600;

/** Bir kerede en fazla bu kadar balon zıplar (toplu gelen mesajda ekran oynamasın). */
const MAX_FRESH = 4;

/** İlk sayfa tek seferde bu sayıdan fazla geldiyse yeni mesaj değil, yüklemedir. */
const MAX_BATCH_FROM_EMPTY = 3;

/** FlatList keyExtractor ile birebir aynı: optimistic → sunucu geçişinde sabit kalır. */
export const messageKey = (message) => message?.clientId || message?.id;

/**
 * @param {Array|null} prev   Önceki mesaj listesi (en yeni önde). Henüz
 *                            yüklenmediyse çağırmayın / boş verin.
 * @param {Array} next        Yeni mesaj listesi (en yeni önde).
 * @param {string} uid        Giden/gelen ayrımı için oturum sahibinin uid'si.
 * @returns {Array<{key: string, kind: "send"|"receive"}>}
 */
export function detectFreshMessages(prev, next, uid) {
  if (!Array.isArray(prev) || !Array.isArray(next) || next.length === 0) return [];

  const toFresh = (message) => ({
    key: messageKey(message),
    kind: message.senderId === uid ? "send" : "receive",
  });

  // Boş sohbete ilk mesaj: çapa yok ama gerçek bir yeni mesaj. Ancak büyük bir
  // ilk sayfa (önbellek boşken sunucudan gelen geçmiş) yeni sayılmaz.
  if (prev.length === 0) {
    return next.length <= MAX_BATCH_FROM_EMPTY
      ? next.filter((m) => messageKey(m)).map(toFresh)
      : [];
  }

  const prevKeys = new Set(prev.map(messageKey));
  // Çapa: önceki listede de bulunan ilk SUNUCU mesajı. Optimistic geçici balonlar
  // çapa olamaz — onlar listenin başında dururken araya gelen mesajı gizlerdi.
  const anchor = next.findIndex(
    (m) => m._optimistic !== true && prevKeys.has(messageKey(m)),
  );
  if (anchor < 0) return [];

  const fresh = [];
  for (let i = 0; i < anchor; i += 1) {
    const key = messageKey(next[i]);
    if (key && !prevKeys.has(key)) fresh.push(toFresh(next[i]));
  }
  return fresh.slice(0, MAX_FRESH);
}

/**
 * Taze kayıtları haritaya işler ve süresi geçenleri ayıklar.
 * @param {Map<string, {kind: string, at: number}>} registry
 */
export function recordFresh(registry, fresh, now = Date.now()) {
  for (const [key, entry] of registry) {
    if (now - entry.at > ENTRANCE_WINDOW_MS * 4) registry.delete(key);
  }
  for (const { key, kind } of fresh) registry.set(key, { kind, at: now });
  return registry;
}

/** Hücre bağlanırken geçerli giriş türü; süre dolduysa null (animasyon yok). */
export function entranceFor(registry, key, now = Date.now()) {
  const entry = registry.get(key);
  if (!entry) return null;
  return now - entry.at <= ENTRANCE_WINDOW_MS ? entry.kind : null;
}
