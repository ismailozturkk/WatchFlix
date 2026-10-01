// services/activeChatTracker.js
//
// O an KULLANICIYA GÖRÜNEN sohbetlerin chatId'lerini bellekte tutar. Amaç:
// kullanıcı bir sohbeti zaten izlerken o sohbetten gelen mesaj için OS
// banner'ı/sesi çıkmasın (bkz. utils/notificationPresentation.js).
//
// ESKİ HATA: tek bir `_activeChatId` değişkeni vardı ve ChatScreen unmount
// olunca koşulsuz null'a çekiyordu. Sohbet yığında iki kez bulunabilir (A
// açıkken bildirimden B'ye geçmek, profil → "mesaj gönder" gibi); üstteki
// ekran kapanınca altta hâlâ görünen sohbet "açık değil" sayılıp banner
// basılıyordu. Artık her giriş kendi sayacını artırıp kendi `release`
// fonksiyonuyla düşürür — sıra ne olursa olsun durum doğru kalır.
//
// Saf modül: RN/Firebase importu yok (jest doğrudan yükleyebilir).

// chatId -> o sohbeti şu an gösteren ekran sayısı
const active = new Map();

/**
 * Sohbeti "ekranda" olarak işaretler.
 * @returns {() => void} release — idempotent; cleanup'ta çağır.
 */
export function enterActiveChat(chatId) {
  if (!chatId) return () => {};
  active.set(chatId, (active.get(chatId) || 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = (active.get(chatId) || 1) - 1;
    if (next <= 0) active.delete(chatId);
    else active.set(chatId, next);
  };
}

/** Bu sohbet şu an ekranda mı? */
export function isChatActive(chatId) {
  return !!chatId && active.has(chatId);
}

/** Test + çıkış temizliği için. */
export function resetActiveChats() {
  active.clear();
}

/**
 * 1-1 sohbet kimliği: iki uid, büyük olan başta. ChatScreen, functions/index.js
 * ve foreground bildirim süzgeci AYNI formülü kullanmak zorunda.
 */
export function pairChatId(uidA, uidB) {
  if (!uidA || !uidB) return null;
  return uidA > uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

/**
 * Bir mesaj bildiriminin (Firestore dokümanı VEYA push `data`'sı) ait olduğu
 * sohbet kimliği. Açık `chatId` varsa o; grup ise groupId; 1-1 ise gönderen +
 * alıcı çifti. Çözülemezse null.
 */
export function chatIdForNotification(source, myUid) {
  if (!source) return null;
  if (source.chatId) return String(source.chatId);
  if (source.groupId) return String(source.groupId);
  if (source.fromUid && myUid) return pairChatId(String(source.fromUid), String(myUid));
  return null;
}

/**
 * Teslim edilmiş (bildirim çekmecesindeki) bir bildirim bu sohbete mi ait?
 * Eski sunucu sürümünün push'ları `chatId` taşımaz; o yüzden groupId/fromUid
 * ile de çözülür.
 */
export function notificationBelongsToChat(data, chatId, myUid) {
  if (!data || !chatId) return false;
  if (data.kind !== "social" || data.type !== "message") return false;
  return chatIdForNotification(data, myUid) === chatId;
}
