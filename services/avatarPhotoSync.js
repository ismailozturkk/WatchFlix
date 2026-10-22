// services/avatarPhotoSync.js
//
// Bağlı hesap (Google…) fotoğraflarının deposu ve profil avatarıyla eşlemesi.
//
//   1) DEPO — `getLinkedPhotosState()`: oturumdaki kullanıcının bağlı
//      hesaplarından kullanılabilecek fotoğraflar. Kaynak `providerData`
//      (Firebase'in son girişte gördüğü kopya) + sağlayıcının kendi SDK'sından
//      okunan güncel fotoğraf. Bağlama/kaldırma `user` nesnesini yerinde
//      değiştirdiği için React bunu göremez; depo abonelikle yayınlar
//      (useSyncExternalStore).
//   2) EŞLEME — `reconcileAvatarPhoto(uid, profile)`: fotoğraf avatarı kullanan
//      profilde sağlayıcıdaki resim değiştiyse Users/{uid}.photoURL tazelenir
//      (Cloud Function tüm kopyalara yayar); fotoğrafın hesabı bağlantıdan
//      kaldırıldıysa avatar hazır bir avatara döner. Kararlar saf:
//      utils/avatarPhotos.js → planAvatarPhotoSync.
//
// Tetikleyiciler context/ProfileUiContext.js'te: açılış (etkileşim bitince),
// uygulama öne geldiğinde (FRESH_TTL_MS kısmalı) ve Ayarlar > Bağlı hesaplar'da
// bağlama/kaldırma sonrası (zorla).

import { auth } from "../firebase";
import { getSilentGoogleProfile } from "./googleAuthService";
import { refreshAvatarPhoto, setAvatarIndex } from "./userService";
import {
  getLinkedPhotos,
  linkedProviderIds,
  planAvatarPhotoSync,
  samePhoto,
} from "../utils/avatarPhotos";
import { randomAvatarIndex } from "../utils/avatars";

// Sağlayıcıya sessiz sorgu en fazla bu sıklıkta (uygulama öne geldikçe).
export const FRESH_TTL_MS = 30 * 60 * 1000;

const EMPTY = Object.freeze({ uid: null, providerIds: [], linkedPhotos: [] });

let state = EMPTY;
// Sağlayıcı SDK'sından okunan güncel fotoğraflar: providerId → { uri, accountId }.
let fresh = {};
let freshUid = null;
let lastFetchAt = 0;
let fetching = null;
const listeners = new Set();
const inFlight = new Set();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Bir abonenin hatası diğerlerini durdurmasın.
    }
  });
}

function sameState(a, b) {
  if (a.uid !== b.uid) return false;
  if (a.providerIds.join("|") !== b.providerIds.join("|")) return false;
  if (a.linkedPhotos.length !== b.linkedPhotos.length) return false;
  return a.linkedPhotos.every(
    (p, i) =>
      p.providerId === b.linkedPhotos[i].providerId &&
      p.uri === b.linkedPhotos[i].uri &&
      !!p.fresh === !!b.linkedPhotos[i].fresh,
  );
}

export function subscribeLinkedPhotos(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLinkedPhotosState() {
  return state;
}

/**
 * Depoyu `auth.currentUser`dan yeniden kurar (ağ yok). Hesap değiştiyse önceki
 * kullanıcının güncel fotoğrafları atılır.
 */
export function refreshLinkedPhotos() {
  const user = auth.currentUser;
  const uid = user?.uid || null;
  if (uid !== freshUid) {
    fresh = {};
    freshUid = uid;
    lastFetchAt = 0;
  }
  const providerData = user?.providerData || [];
  const next = uid
    ? {
        uid,
        providerIds: linkedProviderIds(providerData),
        linkedPhotos: getLinkedPhotos(providerData, fresh),
      }
    : EMPTY;
  if (!sameState(state, next)) {
    state = next;
    emit();
  }
  return state;
}

/**
 * Bağlı sağlayıcılardan güncel fotoğrafı sor (şimdilik yalnız Google; Apple
 * fotoğraf vermez). `force` kısmayı atlar — bağlama sonrası gibi.
 */
export async function fetchFreshProviderPhotos({ force = false } = {}) {
  refreshLinkedPhotos();
  const user = auth.currentUser;
  if (!user) return state;
  const google = (user.providerData || []).find((p) => p?.providerId === "google.com");
  if (!google) return state;
  if (!force && Date.now() - lastFetchAt < FRESH_TTL_MS) return state;
  if (fetching) return fetching;

  const uid = user.uid;
  fetching = (async () => {
    const googleProfile = await getSilentGoogleProfile();
    lastFetchAt = Date.now();
    // Sorgu sürerken hesap değiştiyse sonucu yeni kullanıcıya yazma.
    if (auth.currentUser?.uid !== uid || freshUid !== uid) return state;
    if (googleProfile?.photo) {
      fresh = {
        ...fresh,
        "google.com": { uri: googleProfile.photo, accountId: googleProfile.id },
      };
    }
    return refreshLinkedPhotos();
  })().finally(() => {
    fetching = null;
  });
  return fetching;
}

/**
 * Profil avatarını bağlı hesaplarla uyumlu hâle getir. Aynı karar için ikinci
 * çağrı (profil anlık görüntüsü yazım bitmeden tekrar gelirse) yazım yapmaz.
 *
 * @returns {Promise<{action:string}>} uygulanan plan
 */
export async function reconcileAvatarPhoto(uid, profile) {
  const none = { action: "none" };
  if (!uid || !profile || profile.uid !== uid) return none;
  const current = state.uid === uid ? state : refreshLinkedPhotos();
  if (current.uid !== uid) return none;

  const plan = planAvatarPhotoSync({
    profile,
    providerIds: current.providerIds,
    linkedPhotos: current.linkedPhotos,
  });
  if (plan.action === "none") return plan;

  const key = `${uid}|${plan.action}|${plan.photoURL || ""}|${plan.photoSource || ""}`;
  if (inFlight.has(key)) return none;
  inFlight.add(key);
  try {
    if (plan.action === "update") {
      await refreshAvatarPhoto(uid, {
        photoURL: plan.photoURL,
        photoSource: plan.photoSource,
        photoChanged: !samePhoto(plan.photoURL, profile.photoURL),
      });
    } else if (plan.action === "revert") {
      await setAvatarIndex(uid, randomAvatarIndex());
    }
    return plan;
  } finally {
    inFlight.delete(key);
  }
}

/** Yalnız testler için: modül durumunu sıfırla. */
export function __resetAvatarPhotoSyncForTests() {
  state = EMPTY;
  fresh = {};
  freshUid = null;
  lastFetchAt = 0;
  fetching = null;
  listeners.clear();
  inFlight.clear();
}
