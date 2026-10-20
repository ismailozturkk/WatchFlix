// utils/threadPreview.js
//
// Sohbet önizlemesi (Mesajlar listesindeki satır / grup satırı) — saf yardımcılar.
//
// Önizleme gönderim anında yazılır ve mesajın kendisi değişince eskirdi: son mesaj
// SİLİNİNCE silinen metin karşı tarafın listesinde kalıyor, son mesaj
// DÜZENLENİNCE liste eski metni gösteriyordu. Gönderilen önizleme metni mesajın
// `text` alanıyla aynıdır (metin, anket "📊 soru", medya başlığı, koleksiyon
// başlığı), bu yüzden güncel önizleme = güncel son mesajın `text`'i.

export const PREVIEW_MAX = 180;

/** Önizleme metni; mesaj yoksa boş. */
export function previewOf(message) {
  if (!message) return "";
  return String(message.text || "").slice(0, PREVIEW_MAX);
}

/**
 * Sunucuya yazılmış en yeni mesaj. `messages` yeni → eski sıralıdır; iyimser
 * (henüz gitmemiş) yerel mesajlar ve `excludeId` atlanır.
 */
export function latestServerMessage(messages, { excludeId } = {}) {
  if (!Array.isArray(messages)) return null;
  return (
    messages.find((m) => m && m.id && !m._optimistic && m.id !== excludeId) || null
  );
}

/** `messageId` sohbetin sunucudaki en yeni mesajı mı? */
export function isLatestMessage(messages, messageId) {
  const latest = latestServerMessage(messages);
  return !!latest && latest.id === messageId;
}

/**
 * Silinen mesajdan sonra listede görünecek son mesaj. Silinen en yeni değilse
 * önizleme değişmez → undefined (yazma gerekmez). Kalmadıysa null.
 */
export function latestAfterDelete(messages, deletedId) {
  if (!isLatestMessage(messages, deletedId)) return undefined;
  return latestServerMessage(messages, { excludeId: deletedId });
}
