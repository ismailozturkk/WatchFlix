// services/presenceService.js
//
// Presence (çevrimiçi / son görülme) — Realtime Database üzerinde /presence/{uid}.
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
import { i18nText } from "../utils/i18nText";
import {
  ref,
  onValue,
  onDisconnect,
  update,
  push,
  serverTimestamp as rtdbServerTimestamp,
} from "firebase/database";
import { createPresenceSession } from "./presenceSession";
import {
  isOnlineEffective,
  isOnlineVisible,
  lastSeenMs,
} from "./presenceModel";

export { isOnlineEffective, isOnlineVisible };

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

// ─── Son görülme biçimlendirme ───────────────────────────────────────────────

/**
 * "5 dakika önce" gibi relative string.
 */
export function formatLastSeen(presence, t = {}) {
  const ms = lastSeenMs(presence);
  if (!ms) return t.unknown || "";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t.now || i18nText("autoI18n.az_once", "az önce");
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${t.minute || i18nText("autoI18n.dk_once", "dk önce")}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t.hour || i18nText("autoI18n.saat_once", "saat önce")}`;
  const d = Math.floor(hr / 24);
  return `${d} ${t.day || i18nText("autoI18n.gun_once", "gün önce")}`;
}

// ─── Diğer kullanıcıların presence'ini sorgulama ─────────────────────────────

/**
 * Tek kullanıcının presence'ini realtime dinle.
 * Profil ekranlarında veya chat'te kullanılır. Liste ekranlarında
 * (örn. arkadaş listesi) AÇMA — N adet listener pahalıdır.
 * Geri dönen fonksiyon dinleyiciyi kapatır.
 */
export function subscribeToUserPresence(uid, callback) {
  if (!uid || !rtdb) return () => {};
  return onValue(
    presenceRef(uid),
    (snap) => callback(snap.exists() ? snap.val() : null),
    (err) => __DEV__ && console.warn("subscribeToUserPresence:", err.message),
  );
}
