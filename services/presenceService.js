// services/presenceService.js
//
// Presence (online/offline) için AYRI bir koleksiyon: Presence/{uid}.
//
// NEDEN AYRI KOLEKSİYON:
//   Heartbeat'i Users/{uid}'e yazınca, o dokümanı dinleyen TÜM listener'lar
//   (UserProfileContext, FriendsContext, profil ekranı, vs.) her 60 sn'de bir
//   re-render olurdu. Bu CPU + battery + Firestore listener trafiği israfı.
//   Presence kendi dokümanına ayrılınca Users stabil kalır.
//
// MALİYET:
//   100 aktif kullanıcı x 8 saat x 60 yazma/saat = 48.000 yazma/gün
//   (Eski 30sn'de 96k idi, neredeyse yarıya indi.)
//
// ŞEMA:
//   Presence/{uid}
//     isOnline      : boolean
//     lastActiveAt  : Timestamp   ← heartbeat
//     lastSeen      : Timestamp   ← son offline

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { AppState } from "react-native";
import { db } from "../firebase";

const HEARTBEAT_MS = 60 * 1000;      // 60 sn (eski 30sn idi)
const STALE_WINDOW_MS = 120 * 1000;  // 2 dakika — bundan eski lastActiveAt = offline

let _heartbeatTimer = null;
let _appStateSub = null;
let _currentUid = null;

const presenceRef = (uid) => doc(db, "Presence", uid);

// `setDoc(..., { merge: true })` kullandık çünkü Presence doc'u ilk kez
// yazıldığında oluşturulmalı, sonraki yazımlarda merge etmeli.
const writePresence = (uid, partial) => {
  if (!uid) return Promise.resolve();
  return setDoc(presenceRef(uid), partial, { merge: true }).catch(() => {
    // Network drop / permission — sessizce yut.
  });
};

const beat = () => {
  if (!_currentUid) return;
  writePresence(_currentUid, {
    isOnline: true,
    lastActiveAt: serverTimestamp(),
  });
};

const goOffline = () => {
  if (!_currentUid) return;
  writePresence(_currentUid, {
    isOnline: false,
    lastSeen: serverTimestamp(),
  });
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function startPresence(uid) {
  if (!uid) return () => {};
  if (_currentUid === uid && _heartbeatTimer) return stopPresence;

  if (_currentUid && _currentUid !== uid) {
    goOffline();
    _cleanupTimers();
  }

  _currentUid = uid;

  beat();
  _heartbeatTimer = setInterval(beat, HEARTBEAT_MS);

  _appStateSub = AppState.addEventListener("change", (next) => {
    if (next === "active") {
      beat();
    } else {
      goOffline();
    }
  });

  return stopPresence;
}

export function stopPresence() {
  if (_currentUid) goOffline();
  _cleanupTimers();
  _currentUid = null;
}

function _cleanupTimers() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  if (_appStateSub) {
    _appStateSub.remove?.();
    _appStateSub = null;
  }
}

// ─── Stale check helpers ─────────────────────────────────────────────────────

/**
 * Presence dokümanından "gerçekten online mi?" kararı.
 *   - isOnline === false  → offline
 *   - lastActiveAt > 2 dk → offline (heartbeat'ler durmuş, crash/kapanma)
 */
export function isOnlineEffective(presence) {
  if (!presence || presence.isOnline !== true) return false;
  const ms = presence.lastActiveAt?.toMillis?.();
  if (!ms) return false;
  return Date.now() - ms < STALE_WINDOW_MS;
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
  if (!presence?.lastSeen) return t.unknown || "";
  const ms = presence.lastSeen?.toMillis?.();
  if (!ms) return t.unknown || "";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t.now || "az önce";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${t.minute || "dk önce"}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t.hour || "saat önce"}`;
  const d = Math.floor(hr / 24);
  return `${d} ${t.day || "gün önce"}`;
}

// ─── Diğer kullanıcıların presence'ini sorgulama ─────────────────────────────

import { onSnapshot, getDoc } from "firebase/firestore";

/**
 * Tek kullanıcının presence'ini realtime dinle.
 * Profil ekranlarında veya chat'te kullanılır. Liste ekranlarında
 * (örn. arkadaş listesi) AÇMA — N adet listener pahalıdır.
 */
export function subscribeToUserPresence(uid, callback) {
  if (!uid) return () => {};
  return onSnapshot(
    presenceRef(uid),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (err) => __DEV__ && console.warn("subscribeToUserPresence:", err.message),
  );
}

/**
 * Tek seferlik presence çekme (liste ekranlarında uygun).
 */
export async function getUserPresence(uid) {
  if (!uid) return null;
  const snap = await getDoc(presenceRef(uid));
  return snap.exists() ? snap.data() : null;
}
