// services/matchOptIn.js
//
// Zevk Çemberleri — bayrak (AppConfig/match) ve katılım belgesi (Users/{uid}/private/match). Faz 4.
// Saf kararlar utils/matchFeature.js'te. Kural: firestore.rules → matchDocOk (yalnız sahibi).
//
// OKUMA BÜTÇESİ: bayrak cihazda 6 saat önbelleklenir (oturum başına en çok bir okuma). Katılım belgesi
// YALNIZ bayrak açık ve kullanıcı 18+ iken dinlenir (useMatchFeature) → özellik kapalıyken sıfır ek okuma.
// Faz 5 sunucusu bu belgeyi okuyup MatchProfiles üretir; ayrılınca (belge silinince) profil de silinir.

import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getCachedValue, setCachedValue } from "../utils/apiCache";
import { optInPayload, parseMatchConfig } from "../utils/matchFeature";

const CONFIG_CACHE_KEY = "appconfig_match_v1";
const CONFIG_TTL = 6 * 60 * 60 * 1000;

const matchDocRef = (uid) => doc(db, "Users", uid, "private", "match");

/** AppConfig/match → { enabled }. Okunamazsa kapalı (varsayılan false). */
export async function fetchMatchConfig() {
  try {
    const cached = await getCachedValue(CONFIG_CACHE_KEY, CONFIG_TTL);
    if (cached && typeof cached === "object") return parseMatchConfig(cached);
  } catch {
    // önbellek okunamadı → ağdan dene
  }
  try {
    const snap = await getDoc(doc(db, "AppConfig", "match"));
    const config = parseMatchConfig(snap.exists() ? snap.data() : null);
    setCachedValue(CONFIG_CACHE_KEY, config);
    return config;
  } catch {
    return parseMatchConfig(null);
  }
}

/** Katılım belgesini dinler. `onData(data|null)`. */
export function subscribeMatchOptIn(uid, onData, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    matchDocRef(uid),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (error) => (onError ? onError(error) : onData(null)),
  );
}

/** Seçilen kulvarlarla katıl (ya da kulvarları güncelle). Boş kulvar = ayrıl. */
export async function saveMatchOptIn(uid, lanes) {
  const payload = optInPayload(lanes);
  if (!payload.optIn) return leaveMatch(uid);
  await setDoc(matchDocRef(uid), { ...payload, updatedAt: serverTimestamp() });
  return payload;
}

/** Ayrıl: belge silinir (sunucu tarafı özet profil Faz 5'te bu silinmeyi izler). */
export async function leaveMatch(uid) {
  await deleteDoc(matchDocRef(uid));
  return optInPayload([]);
}
