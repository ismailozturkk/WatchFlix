// services/presenceService.js
//
// Presence (çevrimiçi / son görülme) — Realtime Database üzerinde /presence/{uid}.
//
// 1 Kas 2026: çevrimiçi / son görülme GÖSTERGELERİ uygulamadan kaldırıldı (kullanıcı kararı;
// profil ve sohbet artık kimsenin durumunu okumuyor). Kayıt yine tutulur, çünkü sohbetin
// görünmez "inChat" bayrağı yalnız canlı bir conns kaydıyla geçerli sayılır ve sunucu açık
// sohbetin push'unu bununla susturur (functions/chatPresence.js).
//
// MİMARİ:
//   • Karar mantığı services/presenceSession.js'de (saf durum makinesi, testli).
//     Burası yalnızca onu gerçek RTDB + AppState'e bağlayan ince katman.
//   • Veri modeli ve okuyucu yardımcıları services/presenceModel.js'de.
//
// Çevrimiçi kaydı soket başına /presence/{uid}/conns/{connId}. Kullanıcı en az
// bir canlı kaydı varken çevrimiçidir; her kayıt yalnız kendi soketinin ölümüyle
// (onDisconnect) ya da uygulama arka plana atılınca silinir. Firestore'daki
// heartbeat (60 sn'de bir yazma) modeli yok; RTDB'nin onDisconnect'i soket
// koptuğu an sunucu tarafında temizler.
//
//   /presence/{uid}
//     conns/{connId} : number (serverTimestamp)  ← açık soket + ön plan
//     lastSeen       : number (serverTimestamp)  ← en son çevrimdışına düşüş
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
import { isOnlineEffective } from "./presenceModel";

export { isOnlineEffective };

// Çıkış yolunu bekletmemek için kaydı silmeye ayrılan azami süre.
const SIGN_OUT_BUDGET_MS = 1500;

const presenceRef = (uid) => ref(rtdb, `presence/${uid}`);
const connRef = (uid, connId) => ref(rtdb, `presence/${uid}/conns/${connId}`);
const lastSeenRef = (uid) => ref(rtdb, `presence/${uid}/lastSeen`);

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
  arm: (uid, connId) =>
    Promise.all([
      onDisconnect(connRef(uid, connId)).remove(),
      onDisconnect(lastSeenRef(uid)).set(rtdbServerTimestamp()),
    ]),
  disarm: (uid, connId) =>
    Promise.all([
      onDisconnect(connRef(uid, connId)).cancel(),
      onDisconnect(lastSeenRef(uid)).cancel(),
    ]),
  // isOnline/lastActiveAt: eski şemanın (takılı kalabilen) alanları — temizlenir.
  markOnline: (uid, connId, staleConnId) =>
    update(presenceRef(uid), {
      [`conns/${connId}`]: rtdbServerTimestamp(),
      ...(staleConnId ? { [`conns/${staleConnId}`]: null } : {}),
      isOnline: null,
      lastActiveAt: null,
    }),
  markOffline: (uid, connId) =>
    update(presenceRef(uid), {
      [`conns/${connId}`]: null,
      lastSeen: rtdbServerTimestamp(),
    }),
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
