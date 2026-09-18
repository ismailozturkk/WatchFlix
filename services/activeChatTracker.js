// services/activeChatTracker.js
//
// O an ekranda açık olan sohbetin chatId'sini bellekte tutar. Amaç: kullanıcı
// zaten bir sohbeti görüntülerken o sohbetten gelen yeni mesaj için gereksiz
// foreground bildirim banner'ı gösterilmesini önlemek (DeviceNotificationsContext).
// ChatScreen mount/unmount'ta günceller. Grup + 1-1 her ikisi için geçerli.

let _activeChatId = null;

export function setActiveChatId(chatId) {
  _activeChatId = chatId || null;
}

export function getActiveChatId() {
  return _activeChatId;
}
