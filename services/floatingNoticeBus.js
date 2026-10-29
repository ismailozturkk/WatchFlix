// services/floatingNoticeBus.js
//
// Uygulamanın geri kalanının yüzen bildirim katmanıyla (components/floatingNotice/FloatingNoticeHost)
// konuştuğu ince kanal:
//   • odak isteği: bildirime dokunuldu (push) → katman o bildirimin kartını açsın. Katman henüz
//     kurulmamışsa (soğuk açılış) istek bekletilir, kurulunca alınır.
//   • sunum durumu: katman şu an görünür mü (oturum açık + gizli rota değil). Ön plandaki cihaz
//     bildirimi (DeviceNotificationsContext) davetler için bununla karar verir: katman davet kartını
//     zaten üstte gösteriyorsa sistem afişi ikinci kez çıkmasın.

let presenting = false;
let pendingFocus = null;
const listeners = new Set();

export function setFloatingNoticesPresenting(value) {
  presenting = Boolean(value);
}

export const floatingNoticesPresenting = () => presenting;

/** @param {string} noticeId  utils/floatingNotices kimliği (ör. `invite:<bildirimId>`) */
export function requestFloatingNoticeFocus(noticeId) {
  if (!noticeId) return;
  pendingFocus = noticeId;
  listeners.forEach((listener) => listener(noticeId));
}

export const pendingFloatingNoticeFocus = () => pendingFocus;

export function clearFloatingNoticeFocus() {
  pendingFocus = null;
}

export function subscribeFloatingNoticeFocus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
