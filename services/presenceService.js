// services/presenceService.js
//
// Presence (online/offline) artık Realtime Database üzerinde: /presence/{uid}.
//
// NEDEN RTDB (Firestore yerine):
//   Firestore'da bağlantı kopunca otomatik temizlik PRIMITIFI YOKTUR; bu yüzden
//   eskiden 60 sn'de bir heartbeat yazıp "stale window" ile online tahmini
//   yapıyorduk (100 kullanıcı x 8 saat ≈ 48.000 yazma/gün). RTDB'nin
//   `onDisconnect()` primitifi, socket koptuğu an sunucu tarafında isOnline:false
//   + lastSeen yazar. Böylece:
//     - Heartbeat write fırtınası TAMAMEN kalkar (yazma maliyeti ~0).
//     - Crash/ağ kopması/uygulama öldürülmesi anında güvenilir offline.
//     - isOnline boolean'ı artık GÜVENİLİR (tahmin/stale-window gerekmez).
//
// PUBLIC API değişmedi — tüketiciler (App.js, ChatScreen, FriendProfileScreen)
// aynen çalışır. Sadece backend Firestore→RTDB değişti ve zaman damgaları artık
// number (ms) olarak gelir (helper'lar her iki tipi de tolere eder).
//
// ŞEMA:
//   /presence/{uid}
//     isOnline      : boolean
//     lastActiveAt  : number (serverTimestamp)  ← son foreground/connect
//     lastSeen      : number (serverTimestamp)  ← onDisconnect / background

import { AppState } from "react-native";
import { rtdb } from "../firebase";
import { i18nText } from "../utils/i18nText";
import {
  ref,
  onValue,
  onDisconnect,
  set,
  get,
  serverTimestamp as rtdbServerTimestamp,
} from "firebase/database";

let _connectedUnsub = null;
let _appStateSub = null;
let _currentUid = null;

const presenceRef = (uid) => ref(rtdb, `presence/${uid}`);

const OFFLINE = () => ({ isOnline: false, lastSeen: rtdbServerTimestamp() });
const ONLINE = () => ({ isOnline: true, lastActiveAt: rtdbServerTimestamp() });

const writeOnline = (uid) =>
  set(presenceRef(uid), ONLINE()).catch(() => {});
const writeOffline = (uid) =>
  set(presenceRef(uid), OFFLINE()).catch(() => {});

// ─── Public API ──────────────────────────────────────────────────────────────

export function startPresence(uid) {
  if (!uid || !rtdb) return () => {};
  if (_currentUid === uid && _connectedUnsub) return stopPresence;

  // Hesap değişimi: önceki kullanıcıyı offline yap ve dinleyicileri temizle.
  if (_currentUid && _currentUid !== uid) {
    writeOffline(_currentUid);
    _cleanup();
  }

  _currentUid = uid;

  // Kanonik Firebase presence deseni: `.info/connected` dinle; bağlantı kurulunca
  // ÖNCE onDisconnect'i kur (socket koparsa sunucu offline yazsın), SONRA online yaz.
  const connectedRef = ref(rtdb, ".info/connected");
  _connectedUnsub = onValue(connectedRef, (snap) => {
    if (snap.val() !== true) return;
    const myRef = presenceRef(uid);
    onDisconnect(myRef)
      .set(OFFLINE())
      .then(() => set(myRef, ONLINE()))
      .catch(() => {});
  });

  // Uygulama arka plana alınınca (socket hemen kopmayabilir) elle offline yaz;
  // öne gelince tekrar online. onDisconnect armed kalır (zarar vermez).
  _appStateSub = AppState.addEventListener("change", (next) => {
    if (!_currentUid) return;
    if (next === "active") writeOnline(_currentUid);
    else writeOffline(_currentUid);
  });

  return stopPresence;
}

export function stopPresence() {
  if (_currentUid) {
    const myRef = presenceRef(_currentUid);
    onDisconnect(myRef).cancel().catch(() => {});
    writeOffline(_currentUid);
  }
  _cleanup();
  _currentUid = null;
}

function _cleanup() {
  if (_connectedUnsub) {
    _connectedUnsub();
    _connectedUnsub = null;
  }
  if (_appStateSub) {
    _appStateSub.remove?.();
    _appStateSub = null;
  }
}

// ─── Zaman damgası yardımcısı (Firestore Timestamp | number ms) ───────────────
const toMillis = (v) => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  return null;
};

// ─── Stale check helpers ─────────────────────────────────────────────────────

/**
 * "Gerçekten online mi?" — onDisconnect sayesinde isOnline boolean'ı artık
 * güvenilir; tahmin/stale-window gerekmez.
 */
export function isOnlineEffective(presence) {
  return !!presence && presence.isOnline === true;
}

/**
 * Privacy filtreli versiyon (Users.privacy.onlineStatus alanına bakar).
 */
export function isOnlineVisible(
  presence,
  userPrivacy,
  { viewerIsFriend = false } = {},
) {
  const mode = userPrivacy?.onlineStatus || "everyone";
  if (mode === "none") return false;
  if (mode === "friends" && !viewerIsFriend) return false;
  return isOnlineEffective(presence);
}

/**
 * "5 dakika önce" gibi relative string.
 */
export function formatLastSeen(presence, t = {}) {
  const ms = toMillis(presence?.lastSeen);
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

/**
 * Tek seferlik presence çekme (liste ekranlarında uygun).
 */
export async function getUserPresence(uid) {
  if (!uid || !rtdb) return null;
  try {
    const snap = await get(presenceRef(uid));
    return snap.exists() ? snap.val() : null;
  } catch {
    return null;
  }
}
