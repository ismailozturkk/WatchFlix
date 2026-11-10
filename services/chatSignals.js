// services/chatSignals.js
//
// "Bu sohbet şu an EKRANDA" bayrağının (inChat) yazıcısı — saf mantık
// (RN/Firebase yok). RTDB yazımı `adapter` ile enjekte edilir; gerçek bağlantı
// services/chatRtdb.js'de.
//
// Bayrağın değeri `true` yerine bağlantı kimliğidir: sunucu (functions/
// chatPresence.js) bayrağı yalnız o kimliğin /presence/{uid}/conns kaydı hâlâ
// duruyorsa geçerli sayar. Soket ölünce / uygulama arka plana atılınca kayıt
// silinir ve bayrak kendiliğinden geçersiz olur. Eskiden bunun için chatMeta
// başına ayrı onDisconnect kuruluyordu; tek seferlik olduğundan yeniden
// bağlanmada kayboluyor, ardından gelen ani kapanışta sunucu push'unun susması
// TAKILI kalıyordu.
//
// Karşı tarafın durumunu okuyan kod ve ikinci bayrak 10 Kas 2026'da silindi
// (çevrimiçi durumu özelliği kaldırıldı).

/**
 * inChat yazıcısı. `session`: presenceSession (getConnection/subscribe).
 * Bağlantı yoksa (arka plan, çevrimdışı) hiçbir şey yazılmaz; bağlantı geri
 * gelince istenen durum otomatik yeniden yazılır.
 */
export function createChatSignals({ session, adapter }) {
  const entries = new Map(); // chatId -> { uid, count } — ekranda açık sohbetler
  const written = new Map(); // chatId -> istenen son değer
  const pending = new Map(); // chatId -> sıralı yazım

  const valueFor = (uid) => {
    const conn = session.getConnection();
    return conn && conn.uid === uid ? conn.connId : false;
  };

  function push(chatId, uid, value) {
    const memo = written;
    if ((memo.get(chatId) ?? false) === value) return;
    memo.set(chatId, value);
    const write = adapter.writeInChat;
    // Gir/çık ve arka plan/ön plan geçişleri ağda ters sırayla tamamlanırsa
    // eski "açık" bayrağı yeniden canlanıp sonraki push'ları susturabilir.
    // Aynı sohbetin yazımlarını sırala; henüz başlamamış ara değerleri atla.
    const previous = pending.get(chatId);
    const task = Promise.resolve(previous)
      .catch(() => {})
      .then(() => {
        if (memo.get(chatId) !== value) return;
        return write(chatId, uid, value);
      })
      .catch(() => {
        // Yazım başarısız: yeniden denenebilsin.
        if (memo.get(chatId) === value) memo.delete(chatId);
      })
      .finally(() => {
        if (pending.get(chatId) === task) pending.delete(chatId);
      });
    pending.set(chatId, task);
  }

  function sync() {
    entries.forEach(({ uid }, chatId) => {
      push(chatId, uid, valueFor(uid));
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
      push(chatId, uid, false);
    },

    dispose() {
      unsubscribe();
      entries.clear();
      written.clear();
      pending.clear();
    },
  };
}
