// services/chatRtdb.js
//
// Sohbete özgü EPHEMERAL sinyaller (typing + inChat) Realtime Database'de:
//   /chatMeta/{chatId}/typing/{uid} : boolean
//   /chatMeta/{chatId}/inChat/{uid} : boolean
//
// NEDEN RTDB:
//   Bunlar geçmişi önemsenmeyen, yüksek-frekanslı, anlık sinyaller. Firestore'da
//   her toggle bir doc write'ı + `onDisconnect` yokluğu nedeniyle crash/ağ kopması
//   anında "takılı yazıyor…" / "sohbette" hayalet durumları oluşuyordu. RTDB'nin
//   onDisconnect'i socket koptuğu an bu bayrakları sunucu tarafında temizler.
//
// KALICI veriler (mesajlar, lastMessage) Firestore'da KALIR — burada yalnızca
// uçucu sinyaller var.

import { AppState } from "react-native";
import { rtdb } from "../firebase";
import { ref, onValue, onDisconnect, set } from "firebase/database";

const typingRef = (chatId, uid) => ref(rtdb, `chatMeta/${chatId}/typing/${uid}`);
const inChatRef = (chatId, uid) => ref(rtdb, `chatMeta/${chatId}/inChat/${uid}`);

// Ekran mount'tayken uygulama arka plana alınırsa React Navigation ekranı
// UNMOUNT ETMEZ (leaveChat tetiklenmez) ve socket de hemen kopmayabilir (RTDB
// onDisconnect gecikmeli). Bu yüzden presenceService ile aynı desen: AppState'i
// dinleyip arka plana geçişte inChat/typing'i elle false yaz, öne dönünce
// (ekran hâlâ açıksa) inChat'i geri true yap.
let _activeChatId = null;
let _activeUid = null;
let _appStateSub = null;

function _ensureAppStateSub() {
  if (_appStateSub) return;
  _appStateSub = AppState.addEventListener("change", (next) => {
    if (!_activeChatId || !_activeUid) return;
    if (next === "active") {
      set(inChatRef(_activeChatId, _activeUid), true).catch(() => {});
    } else {
      set(inChatRef(_activeChatId, _activeUid), false).catch(() => {});
      set(typingRef(_activeChatId, _activeUid), false).catch(() => {});
    }
  });
}

/**
 * Sohbete girince inChat=true yaz ve socket koparsa otomatik temizlenecek
 * şekilde onDisconnect'i kur (hem inChat hem typing false'a iner).
 */
export function enterChat(chatId, uid) {
  if (!chatId || !uid || !rtdb) return;
  const ic = inChatRef(chatId, uid);
  const tp = typingRef(chatId, uid);
  onDisconnect(ic).set(false).catch(() => {});
  onDisconnect(tp).set(false).catch(() => {});
  set(ic, true).catch(() => {});
  _activeChatId = chatId;
  _activeUid = uid;
  _ensureAppStateSub();
}

/**
 * Ekrandan ayrılınca (unmount) inChat + typing'i kapat ve onDisconnect'leri iptal et.
 */
export function leaveChat(chatId, uid) {
  if (!chatId || !uid || !rtdb) return;
  const ic = inChatRef(chatId, uid);
  const tp = typingRef(chatId, uid);
  onDisconnect(ic).cancel().catch(() => {});
  onDisconnect(tp).cancel().catch(() => {});
  set(ic, false).catch(() => {});
  set(tp, false).catch(() => {});
  if (_activeChatId === chatId && _activeUid === uid) {
    _activeChatId = null;
    _activeUid = null;
  }
}

/**
 * "Yazıyor" bayrağını güncelle (çağıran taraf debounce uygular).
 */
export function setTyping(chatId, uid, isTyping) {
  if (!chatId || !uid || !rtdb) return;
  set(typingRef(chatId, uid), !!isTyping).catch(() => {});
}

/**
 * Karşı tarafın typing + inChat durumunu realtime dinle.
 * callback({ typing: boolean, inChat: boolean }). Geri dönen fn dinleyiciyi kapatır.
 */
export function subscribeChatMeta(chatId, friendUid, callback) {
  if (!chatId || !friendUid || !rtdb) return () => {};
  return onValue(
    ref(rtdb, `chatMeta/${chatId}`),
    (snap) => {
      const data = snap.val() || {};
      callback({
        typing: Boolean(data.typing?.[friendUid]),
        inChat: Boolean(data.inChat?.[friendUid]),
      });
    },
    (err) => __DEV__ && console.warn("subscribeChatMeta:", err.message),
  );
}
