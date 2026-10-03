// services/chatSignals.js
//
// Sohbete özgü uçucu sinyaller — saf mantık (RN/Firebase yok). RTDB yazımı
// `adapter` ile enjekte edilir; gerçek bağlantı services/chatRtdb.js'de.
//
//   inChat/{uid} : "şu an bu sohbet EKRANDA" — değer bağlantı kimliğidir
//   typing/{uid} : "şu an yazıyor"          — değer bağlantı kimliğidir
//
// Değer `true` yerine presence bağlantı kimliğidir (bkz. presenceModel.js):
// karşı taraf bayrağı yalnız o kimliğin kaydı hâlâ duruyorsa geçerli sayar.
// Soket ölünce / uygulama arka plana atılınca kayıt silinir ve bayrak kendiliğinden
// geçersiz olur. Eskiden bunun için chatMeta başına ayrı onDisconnect kuruluyordu;
// tek seferlik olduğundan yeniden bağlanmada kayboluyor, ardından gelen ani
// kapanışta "Sohbette"/"yazıyor" ve sunucu push'unun susması TAKILI kalıyordu.

import { isLiveFlag } from "./presenceModel";

export const TYPING_IDLE_MS = 4000;

/**
 * Yazıyor göstergesi denetleyicisi.
 *   • İlk tuşta hemen "yazıyor" (eskiden 600 ms gecikmeliydi),
 *   • sonraki tuşlar yalnız zamanlayıcıyı uzatır (yazma yok),
 *   • `idleMs` hareketsizlik, boş girdi, gönderme veya odak kaybında kapanır.
 * Eskiden metin kutuda dururken bayrak sonsuza dek açık kalıyordu: yazıp
 * bırakan kullanıcı dakikalarca "yazıyor…" görünürdü.
 */
export function createTypingController({
  send,
  idleMs = TYPING_IDLE_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let typing = false;
  let timer = null;

  const clear = () => {
    if (timer) {
      clearTimer(timer);
      timer = null;
    }
  };
  const set = (value) => {
    if (typing === value) return;
    typing = value;
    send(value);
  };

  return {
    /** Her metin değişiminde çağır. */
    input(hasText) {
      if (!hasText) {
        clear();
        set(false);
        return;
      }
      set(true);
      clear();
      timer = setTimer(() => {
        timer = null;
        set(false);
      }, idleMs);
    },
    /** Gönderme, odak kaybı, ekrandan ayrılma. */
    stop() {
      clear();
      set(false);
    },
    isTyping: () => typing,
  };
}

/**
 * inChat + typing yazıcısı. `session`: presenceSession (getConnection/subscribe).
 * Bağlantı yoksa (arka plan, çevrimdışı) hiçbir şey yazılmaz; bağlantı geri
 * gelince istenen durum otomatik yeniden yazılır.
 */
export function createChatSignals({ session, adapter }) {
  const entries = new Map(); // chatId -> { uid, count } — ekranda açık sohbetler
  const typingWanted = new Map(); // chatId -> uid — "yazıyor" istendi
  const written = { inChat: new Map(), typing: new Map() }; // chatId -> son yazılan

  const valueFor = (uid) => {
    const conn = session.getConnection();
    return conn && conn.uid === uid ? conn.connId : false;
  };

  function push(kind, chatId, uid, value) {
    const memo = written[kind];
    if ((memo.get(chatId) ?? false) === value) return;
    memo.set(chatId, value);
    const write = kind === "inChat" ? adapter.writeInChat : adapter.writeTyping;
    Promise.resolve()
      .then(() => write(chatId, uid, value))
      .catch(() => {
        // Yazım başarısız: yeniden denenebilsin.
        if (memo.get(chatId) === value) memo.delete(chatId);
      });
  }

  function sync() {
    entries.forEach(({ uid }, chatId) => {
      push("inChat", chatId, uid, valueFor(uid));
    });
    const chatIds = new Set([...entries.keys(), ...typingWanted.keys()]);
    chatIds.forEach((chatId) => {
      const uid = entries.get(chatId)?.uid ?? typingWanted.get(chatId);
      push("typing", chatId, uid, typingWanted.has(chatId) ? valueFor(uid) : false);
    });
  }

  const unsubscribe = session.subscribe(sync);

  return {
    /** Sohbet ekranı görünür oldu. Sayaçlı: yığında iki ekran olabilir. */
    enterChat(chatId, uid) {
      if (!chatId || !uid) return;
      const entry = entries.get(chatId);
      entries.set(chatId, { uid, count: (entry?.count || 0) + 1 });
      sync();
    },

    /** Ekran görünmez oldu. Aynı sohbeti gösteren başka ekran varsa dokunmaz. */
    leaveChat(chatId, uid) {
      if (!chatId || !uid) return;
      const entry = entries.get(chatId);
      if (entry && entry.count > 1) {
        entries.set(chatId, { uid: entry.uid, count: entry.count - 1 });
        return;
      }
      entries.delete(chatId);
      typingWanted.delete(chatId);
      push("inChat", chatId, uid, false);
      push("typing", chatId, uid, false);
    },

    setTyping(chatId, uid, isTyping) {
      if (!chatId || !uid) return;
      if (isTyping) typingWanted.set(chatId, uid);
      else typingWanted.delete(chatId);
      push("typing", chatId, uid, isTyping ? valueFor(uid) : false);
    },

    dispose() {
      unsubscribe();
      entries.clear();
      typingWanted.clear();
      written.inChat.clear();
      written.typing.clear();
    },
  };
}

/**
 * Karşı tarafın sinyalleri: ham chatMeta + onun presence düğümü → canlı
 * "yazıyor" / "sohbette". Presence yoksa ya da bayrağın bağlantısı düşmüşse false.
 */
export function resolveFriendSignals(meta, presence, friendUid) {
  const data = meta || {};
  return {
    typing: isLiveFlag(data.typing?.[friendUid], presence),
    inChat: isLiveFlag(data.inChat?.[friendUid], presence),
  };
}
