// services/presenceSession.js
//
// Presence YAZICI tarafı — "bu uygulama örneği şu an çevrimiçi mi?" kararını
// veren saf durum makinesi. RN/Firebase importu yok; RTDB ve AppState bir
// `adapter` ile enjekte edilir (gerçek bağlantı: services/presenceService.js,
// sahte bağlantı: __tests__/presenceSession.test.js). Veri modeli için bkz.
// services/presenceModel.js.
//
// KURAL (tek cümle): çevrimiçi kaydı YALNIZ "RTDB soketi açık VE uygulama ön
// planda VE oturum var" iken durur; üç koşuldan biri bozulduğu an kayıt silinir.
//
// ESKİ HATALAR (hepsi bu kuralı çiğniyordu):
//   • `.info/connected` her true olduğunda koşulsuz ONLINE yazılıyordu →
//     arka plandayken bağlantı yenilenirse kullanıcı sonsuza dek "çevrimiçi".
//   • onDisconnect TEK SEFERLİKTİR; ön plana dönünce yalnız ONLINE yazılıp yeniden
//     kurulmuyordu → sonraki ani kapanışta temizlik yoktu.
//   • Çıkışta offline yazımı auth düştükten SONRA deneniyordu → reddediliyordu.
//   • Eski soketin gecikmeli onDisconnect'i yeni oturumun ONLINE'ını eziyordu.
//
// SIRALAMA DEĞİŞMEZLERİ:
//   çevrimiçi olurken : önce onDisconnect KUR, sonra kaydı YAZ. (Arada ölürsek
//                       sunucu henüz var olmayan kaydı silmeye çalışır: zararsız.)
//   çevrimdışı olurken: önce kaydı SİL, sonra onDisconnect'i İPTAL ET. (Tersi
//                       olursa araya giren ölüm kaydı sonsuza dek bırakır.)
//
// Uzlaştırma döngüsü tek seferde yalnız bir adım çalıştırır; olaylar sırayla
// birikmez, "kirli" bayrağıyla döngüyü yeniden koşturur. Her ağ çağrısı zaman
// aşımıyla korunur: asılı kalan tek bir çağrı tüm makineyi kilitleyemez.

export const INACTIVE_GRACE_MS = 5000;
export const OP_TIMEOUT_MS = 8000;

export function createPresenceSession(adapter, options = {}) {
  const {
    inactiveGraceMs = INACTIVE_GRACE_MS,
    opTimeoutMs = OP_TIMEOUT_MS,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = options;

  let uid = null; // istenen kullanıcı (null: oturum yok)
  let connected = false; // RTDB soketi açık mı
  let foreground = true; // uygulama ön planda mı (inactive: süreli tolerans)
  let connId = null; // şu anki (uid, soket) çiftinin kimliği
  let armedConn = null; // onDisconnect'i kurulu bağlantı kimliği
  let onlineConn = null; // kaydı yazılı bağlantı kimliği
  let onlineUid = null; // kaydı hangi uid altına yazdık
  let staleConn = null; // ölen soketten kalmış olabilecek kayıt {uid,id}
  let run = null;
  let dirty = false;
  let graceTimer = null;
  let teardown = [];
  const listeners = new Set();

  const getConnection = () =>
    onlineConn ? { uid: onlineUid, connId: onlineConn } : null;

  const emit = () => {
    const snapshot = getConnection();
    listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch {
        /* dinleyici hatası makineyi etkilemesin */
      }
    });
  };

  const reportError = (err) => {
    try {
      adapter.onError?.(err);
    } catch {
      /* yut */
    }
  };

  // Adapter çağrısını zaman aşımı + senkron throw koruması ile çalıştırır.
  const call = (fn) =>
    new Promise((resolve, reject) => {
      const timer = setTimer(
        () => reject(new Error("presence op timeout")),
        opTimeoutMs,
      );
      Promise.resolve()
        .then(fn)
        .then(
          (v) => {
            clearTimer(timer);
            resolve(v);
          },
          (e) => {
            clearTimer(timer);
            reject(e);
          },
        );
    });

  const isWanted = () => !!uid && connected && foreground;

  async function release() {
    const wasUid = onlineUid;
    const wasConn = onlineConn;
    const changedUser = wasUid !== uid;
    try {
      if (connected) {
        // Önce kaydı sil; yazım başarısızsa onDisconnect kurulu KALSIN (sunucu
        // soket ölünce temizler) ve hata üst döngüye çıksın.
        await call(() => adapter.markOffline(wasUid, wasConn));
        await call(() => adapter.disarm(wasUid, wasConn)).catch(reportError);
      }
    } catch (err) {
      // Hesap değişiminde eski kullanıcının yetkisi artık yok (yazım reddedilir);
      // yerel durumu yine de bırak ki yeni kullanıcı çevrimiçi olabilsin. Eski
      // kaydı sunucudaki onDisconnect temizler. Diğer hatalarda durumu koru,
      // bir sonraki olayda yeniden denenir.
      if (!changedUser) throw err;
      reportError(err);
    }
    if (onlineConn === wasConn) {
      onlineConn = null;
      onlineUid = null;
      if (armedConn === wasConn) armedConn = null;
      // Başka bir kullanıcıya geçildiyse eski kimlik yeni uid'e taşınamaz.
      if (changedUser) connId = null;
      emit();
    }
  }

  async function acquire() {
    const myUid = uid;
    if (!connId) connId = adapter.newConnId(myUid);
    const myConn = connId;
    const same = () => uid === myUid && connId === myConn;

    if (armedConn !== myConn) {
      await call(() => adapter.arm(myUid, myConn));
      if (same()) armedConn = myConn;
      if (!(same() && isWanted())) {
        dirty = true;
        return;
      }
    }

    const stale = staleConn && staleConn.uid === myUid ? staleConn.id : null;
    await call(() => adapter.markOnline(myUid, myConn, stale));
    if (same()) {
      onlineConn = myConn;
      onlineUid = myUid;
      staleConn = null;
      emit();
    }
    // Yazım sürerken durum değiştiyse (arka plan, çıkış...) bir tur daha.
    if (!(same() && isWanted())) dirty = true;
  }

  async function step() {
    const wanted = isWanted();

    if (onlineConn && (!wanted || onlineUid !== uid)) {
      await release();
      dirty = true; // yeni duruma göre bir tur daha (ör. kullanıcı değişimi)
      return;
    }

    if (wanted && !onlineConn) {
      await acquire();
      return;
    }

    // Çevrimiçi olmadan kurulmuş (ör. kurarken arka plana geçildi) onDisconnect
    // artığı: sunucuda gereksiz bekleyen işlem bırakma.
    if (!wanted && armedConn && !onlineConn && connected) {
      const orphan = armedConn;
      await call(() => adapter.disarm(uid, orphan)).catch(reportError);
      if (armedConn === orphan) armedConn = null;
    }
  }

  function reconcile() {
    if (run) {
      dirty = true;
      return run;
    }
    run = (async () => {
      try {
        do {
          dirty = false;
          try {
            await step();
          } catch (err) {
            // Hata sonrası YENİDEN denemek için yeni bir olay (bağlantı/ön plan
            // değişimi) gerekir; kendi kendini besleyen döngü kurmayız.
            reportError(err);
          }
        } while (dirty);
      } finally {
        run = null;
      }
    })();
    return run;
  }

  function handleConnected(isConnected) {
    const next = isConnected === true;
    if (next === connected) return;
    connected = next;
    if (!connected) {
      // Soket öldü: sunucu onDisconnect'i çalıştırdı (ya da zaman aşımıyla
      // çalıştıracak). Kimliği bırak; bir sonraki bağlantı yeni kimlik alır ve
      // eskinin artığını açıkça siler.
      const wasOnline = !!onlineConn;
      if (onlineConn) staleConn = { uid: onlineUid, id: onlineConn };
      connId = null;
      armedConn = null;
      onlineConn = null;
      onlineUid = null;
      if (wasOnline) emit();
    }
    reconcile();
  }

  function clearGrace() {
    if (graceTimer) {
      clearTimer(graceTimer);
      graceTimer = null;
    }
  }

  function handleAppState(state) {
    if (state === "background") {
      clearGrace();
      foreground = false;
    } else if (state === "inactive") {
      // iOS'ta bildirim merkezi/uygulama değiştirici de "inactive" üretir;
      // kısa bir tolerans, çevrimiçi/çevrimdışı titremesini önler. Android
      // "inactive" üretmez. Zaten arka plandaysak ön plana alma: "active"
      // gelmeden kullanıcı görünür sayılmaz.
      if (!foreground || graceTimer) return;
      graceTimer = setTimer(() => {
        graceTimer = null;
        foreground = false;
        reconcile();
      }, inactiveGraceMs);
      return;
    } else {
      clearGrace();
      foreground = true;
    }
    reconcile();
  }

  function start(nextUid) {
    if (!nextUid || !adapter) return;
    if (uid === nextUid) return;
    const first = !teardown.length;
    uid = nextUid;
    if (first) {
      // Ön plan durumu bağlantıdan ÖNCE bilinmeli: arka planda başlayan süreç
      // (bildirimle uyanma vb.) bağlanır bağlanmaz çevrimiçi yazmamalı.
      handleAppState(adapter.getAppState());
      teardown = [
        adapter.subscribeConnected(handleConnected),
        adapter.subscribeAppState(handleAppState),
      ];
    } else {
      reconcile(); // hesap değişimi: eski kayıt bırakılır, yenisi yazılır
    }
  }

  async function stop() {
    uid = null;
    clearGrace();
    const subs = teardown;
    teardown = [];
    subs.forEach((off) => {
      try {
        off?.();
      } catch {
        /* yut */
      }
    });
    await reconcile();
    // Yazım başarısız olsa bile yerel durumu sıfırla (sunucuda onDisconnect
    // kurulu kaldıysa soket ölünce temizler).
    const wasOnline = !!onlineConn;
    connId = null;
    armedConn = null;
    onlineConn = null;
    onlineUid = null;
    staleConn = null;
    connected = false;
    foreground = true;
    if (wasOnline) emit();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    start,
    stop,
    subscribe,
    getConnection,
    /** Testler ve hata ayıklama için. */
    getState: () => ({
      uid,
      connected,
      foreground,
      connId,
      armed: armedConn !== null,
      online: onlineConn !== null,
    }),
  };
}
