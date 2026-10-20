// services/chatRtdb.js
//
// Sohbete özgü EPHEMERAL sinyaller (typing + inChat) Realtime Database'de:
//   /chatMeta/{chatId}/typing/{uid} : bağlantı kimliği | (yok)
//   /chatMeta/{chatId}/inChat/{uid} : bağlantı kimliği | (yok)
//
// Mantık services/chatSignals.js'de (saf, testli); veri modeli ve "bayrak neden
// takılı kalamaz" açıklaması services/presenceModel.js'de. Burası yalnızca RTDB
// yazımı ve dinleyiciyi bağlar.
//
// Bayrakların değeri `true` değil presence BAĞLANTI KİMLİĞİDİR: karşı taraf
// bayrağı yalnız o kimliğin /presence/{uid}/conns kaydı duruyorsa geçerli sayar.
// Uygulama arka plana atılınca ya da soket ölünce o kayıt silinir ve bayraklar
// kendiliğinden geçersizleşir. Eskiden her bayrak için ayrı, tek seferlik
// onDisconnect kuruluyordu; yeniden bağlanmada tükeniyor, sonraki ani kapanışta
// "Sohbette" ve sunucu push'unun susması sonsuza dek takılı kalabiliyordu.
//
// KALICI veriler (mesajlar, lastMessage) Firestore'da KALIR — burada yalnızca
// uçucu sinyaller var.

import { rtdb } from "../firebase";
import { ref, onValue, set } from "firebase/database";
import { getPresenceSession } from "./presenceService";
import { createChatSignals, resolveFriendSignals } from "./chatSignals";

export { createTypingController } from "./chatSignals";

const metaRef = (chatId, kind, uid) => ref(rtdb, `chatMeta/${chatId}/${kind}/${uid}`);

// false → düğümü sil (boş bayrak artığı birikmesin).
const flagValue = (value) => (value === false ? null : value);

let signals = null;
function getSignals() {
  if (signals) return signals;
  const session = rtdb ? getPresenceSession() : null;
  if (!session) return null;
  signals = createChatSignals({
    session,
    adapter: {
      writeInChat: (chatId, uid, value) =>
        set(metaRef(chatId, "inChat", uid), flagValue(value)),
      writeTyping: (chatId, uid, value) =>
        set(metaRef(chatId, "typing", uid), flagValue(value)),
    },
  });
  return signals;
}

/**
 * Sohbet ekranı kullanıcıya GÖRÜNÜR oldu (odakta + uygulama ön planda).
 * Sayaçlı: yığında aynı sohbetin iki ekranı olabilir.
 */
export function enterChat(chatId, uid) {
  getSignals()?.enterChat(chatId, uid);
}

/** Ekran görünmez oldu. Aynı sohbeti hâlâ gösteren başka ekran varsa dokunmaz. */
export function leaveChat(chatId, uid) {
  getSignals()?.leaveChat(chatId, uid);
}

/** "Yazıyor" bayrağı. Zamanlama/boşta kapanma için createTypingController kullan. */
export function setTyping(chatId, uid, isTyping) {
  getSignals()?.setTyping(chatId, uid, !!isTyping);
}

/**
 * Karşı tarafın canlı durumunu realtime dinle: sohbet bayrakları + presence tek
 * dinleyici çiftiyle. callback({ typing, inChat, presence }):
 *   typing/inChat — yalnız karşı tarafın bağlantısı canlıysa true,
 *   presence      — karşı tarafın ham presence düğümü (çevrimiçi/son görülme için;
 *                   gizlilik filtresi çağıranda uygulanır).
 * Geri dönen fn her iki dinleyiciyi kapatır.
 */
export function subscribeChatMeta(chatId, friendUid, callback) {
  if (!chatId || !friendUid || !rtdb) return () => {};
  let meta = null;
  let presence = null;
  const emit = () =>
    callback({ ...resolveFriendSignals(meta, presence, friendUid), presence });

  const offMeta = onValue(
    ref(rtdb, `chatMeta/${chatId}`),
    (snap) => {
      meta = snap.val();
      emit();
    },
    (err) => __DEV__ && console.warn("subscribeChatMeta:", err.message),
  );
  const offPresence = onValue(
    ref(rtdb, `presence/${friendUid}`),
    (snap) => {
      presence = snap.exists() ? snap.val() : null;
      emit();
    },
    (err) => __DEV__ && console.warn("subscribeChatMeta/presence:", err.message),
  );
  return () => {
    offMeta();
    offPresence();
  };
}
