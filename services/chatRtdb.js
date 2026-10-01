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
//
// Tek değişken (_activeChatId) yerine SAYAÇLI harita: yığında iki sohbet
// ekranı bulunabilir ve yeni ekranın enter'ı eskisinin leave'inden ÖNCE
// gelebilir (aynı sohbet için bile). Tek yuvada ikinci leave, hâlâ görünen
// sohbeti "değil" yazıp sunucu push'unun gereksiz yere gitmesine yol açıyordu.
//   chatId -> { uid, count }
const _active = new Map();
let _appStateSub = null;

function _ensureAppStateSub() {
  if (_appStateSub) return;
  _appStateSub = AppState.addEventListener("change", (next) => {
    _active.forEach(({ uid }, chatId) => {
      if (next === "active") {
        set(inChatRef(chatId, uid), true).catch(() => {});
      } else {
        set(inChatRef(chatId, uid), false).catch(() => {});
        set(typingRef(chatId, uid), false).catch(() => {});
      }
    });
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
  const entry = _active.get(chatId);
  _active.set(chatId, { uid, count: (entry?.count || 0) + 1 });
  _ensureAppStateSub();
}

/**
 * Ekrandan ayrılınca (blur/unmount) inChat + typing'i kapat ve onDisconnect'leri
 * iptal et. Aynı sohbeti hâlâ gösteren başka bir ekran varsa bayraklara dokunmaz.
 */
export function leaveChat(chatId, uid) {
  if (!chatId || !uid || !rtdb) return;
  const entry = _active.get(chatId);
  if (entry && entry.count > 1) {
    _active.set(chatId, { uid: entry.uid, count: entry.count - 1 });
    return;
  }
  _active.delete(chatId);
  const ic = inChatRef(chatId, uid);
  const tp = typingRef(chatId, uid);
  onDisconnect(ic).cancel().catch(() => {});
  onDisconnect(tp).cancel().catch(() => {});
  set(ic, false).catch(() => {});
  set(tp, false).catch(() => {});
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
