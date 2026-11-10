// services/presenceService.js
//
// Bağlantı kaydı — Realtime Database üzerinde /presence/{uid}/conns.
//
// ÇEVRİMİÇİ DURUMU ÖZELLİĞİ YOK (1 Kas 2026 göstergeler, 10 Kas 2026 veri): kimse kimsenin
// durumunu göremez, son görülme YAZILMAZ, düğümü yalnız sahibi ve sunucu okuyabilir
// (database.rules.json). Geriye kalan tek şey teknik bir bağlantı kaydıdır: sohbetin görünmez
// "inChat" bayrağı yalnız canlı bir conns kaydıyla geçerli sayılır ve sunucu açık sohbetin
// push'unu bununla susturur (functions/chatPresence.js). Kayıt olmasa, uygulama ani
// kapandığında bayrak takılı kalır ve o sohbetin bildirimleri sonsuza dek susardı.
//
// MİMARİ:
//   • Karar mantığı services/presenceSession.js'de (saf durum makinesi, testli).
//     Burası yalnızca onu gerçek RTDB + AppState'e bağlayan ince katman.
//
// Kayıt soket başına /presence/{uid}/conns/{connId}; her kayıt yalnız kendi soketinin ölümüyle
// (onDisconnect) ya da uygulama arka plana atılınca silinir. Firestore'daki
// heartbeat (60 sn'de bir yazma) modeli yok; RTDB'nin onDisconnect'i soket
// koptuğu an sunucu tarafında temizler.
//
//   /presence/{uid}
//     conns/{connId} : number (serverTimestamp)  ← açık soket + ön plan
//   (lastSeen yazılmaz; eski sürümlerin bıraktığı değer ilk bağlantıda silinir.)
//
// ÇIKIŞ: auth düştükten sonra offline yazımı reddedilirdi (kullanıcı çıkış
// yapınca "çevrimiçi" takılı kalırdı). `beforeAuthStateChanged` kancası oturum
// DEĞİŞMEDEN önce kaydı siler; Ayarlar'daki çıkış, hesap silme ve kayıt sonrası
// çıkış gibi her yolu tek noktadan kapsar.

import { AppState } from "react-native";
import { auth, rtdb } from "../firebase";
import {
  ref,
  onValue,
  onDisconnect,
  update,
  push,
  serverTimestamp as rtdbServerTimestamp,
} from "firebase/database";
import { createPresenceSession } from "./presenceSession";

// Çıkış yolunu bekletmemek için kaydı silmeye ayrılan azami süre.
const SIGN_OUT_BUDGET_MS = 1500;

const presenceRef = (uid) => ref(rtdb, `presence/${uid}`);
const connRef = (uid, connId) => ref(rtdb, `presence/${uid}/conns/${connId}`);

// RTDB + AppState'i durum makinesinin beklediği arayüze çevirir.
const adapter = {
  getAppState: () => AppState.currentState,
  subscribeConnected: (cb) =>
    onValue(ref(rtdb, ".info/connected"), (snap) => cb(snap.val() === true)),
  subscribeAppState: (cb) => {
    const sub = AppState.addEventListener("change", cb);
    return () => sub.remove?.();
  },
  // push() yalnızca anahtar üretir; ağ çağrısı yapmaz.
  newConnId: (uid) => push(ref(rtdb, `presence/${uid}/conns`)).key,
  arm: (uid, connId) => onDisconnect(connRef(uid, connId)).remove(),
  disarm: (uid, connId) => onDisconnect(connRef(uid, connId)).cancel(),
  // isOnline/lastActiveAt (eski şema) ve lastSeen (son görülme, artık tutulmuyor) temizlenir.
  markOnline: (uid, connId, staleConnId) =>
    update(presenceRef(uid), {
      [`conns/${connId}`]: rtdbServerTimestamp(),
      ...(staleConnId ? { [`conns/${staleConnId}`]: null } : {}),
      isOnline: null,
      lastActiveAt: null,
      lastSeen: null,
    }),
  markOffline: (uid, connId) =>
    update(presenceRef(uid), { [`conns/${connId}`]: null }),
  onError: (err) => {
    if (__DEV__) console.warn("presence:", err?.message);
  },
};

let session = null;
let authGuardOff = null;

/** Paylaşılan oturum (sohbet sinyalleri aynı bağlantı kimliğini kullanır). */
export function getPresenceSession() {
  if (!session && rtdb) session = createPresenceSession(adapter);
  return session;
}

function ensureAuthGuard() {
  if (authGuardOff || typeof auth?.beforeAuthStateChanged !== "function") return;
  authGuardOff = auth.beforeAuthStateChanged(async (nextUser) => {
    // Bu kanca çıkışı/hesap geçişini ASLA engellememeli: hata yutulur, süre kısıtlıdır.
    let budgetTimer;
    try {
      const current = session?.getState().uid;
      if (!current || nextUser?.uid === current) return;
      await Promise.race([
        stopPresence(),
        new Promise((resolve) => {
          budgetTimer = setTimeout(resolve, SIGN_OUT_BUDGET_MS);
        }),
      ]);
    } catch {
      /* yut */
    } finally {
      clearTimeout(budgetTimer);
    }
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startPresence(uid) {
  const s = getPresenceSession();
  if (!uid || !s) return () => {};
  ensureAuthGuard();
  s.start(uid);
  return stopPresence;
}

/** Kaydı siler (mümkünse) ve dinleyicileri bırakır. Çıkışta beklenebilir. */
export function stopPresence() {
  return session ? session.stop() : Promise.resolve();
}
