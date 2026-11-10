// services/chatRtdb.js
//
// "Bu sohbet şu an ekranımda açık" bayrağı (inChat), Realtime Database'de:
//   /chatMeta/{chatId}/inChat/{uid}       : bağlantı kimliği | (yok)
//   /groupChatMeta/{groupId}/inChat/{uid} : bağlantı kimliği | (yok)
//
// TEK AMACI: sunucu, açık sohbetin push'unu susturur (functions/chatPresence.js).
// Bayrağı KİMSE okuyamaz (database.rules.json) — "Sohbette", "yazıyor" ve
// çevrimiçi göstergeleri uygulamada yok; okuyucu kodu 10 Kas 2026'da silindi.
//
// Değer `true` değil BAĞLANTI KİMLİĞİDİR: sunucu bayrağı yalnız o kimliğin
// /presence/{uid}/conns kaydı duruyorsa geçerli sayar. Uygulama arka plana
// atılınca ya da soket ölünce o kayıt silinir ve bayrak kendiliğinden
// geçersizleşir. Mantık services/chatSignals.js'de (saf, testli).

import { rtdb } from "../firebase";
import { ref, set } from "firebase/database";
import { getPresenceSession } from "./presenceService";
import { createChatSignals } from "./chatSignals";

const metaRef = (chatId, kind, uid) => {
  const group = chatId.startsWith("group:");
  const id = group ? chatId.slice(6) : chatId;
  return ref(rtdb, `${group ? "groupChatMeta" : "chatMeta"}/${id}/${kind}/${uid}`);
};

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
