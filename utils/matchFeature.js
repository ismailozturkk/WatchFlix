// utils/matchFeature.js
//
// Zevk Çemberleri — özelliğin bu kullanıcıya AÇIK olup olmadığı (Faz 4). SAF.
//
// Kapı iki katmanlıdır ve ikisi de geçmeden ekranda HİÇBİR eşleşme öğesi çizilmez, katılım belgesi
// (Users/{uid}/private/match) OKUNMAZ:
//   1. Bayrak: AppConfig/match.enabled (varsayılan false). Geliştirici derlemesinde (__DEV__) zorla açık.
//   2. Yaş: doğum tarihi 18+ olduğunu KANITLAMALI (utils/ageGate.isAdultBirthDate). Tarih yoksa → kapalı.
//
// Katılım belgesi şekli (firestore.rules matchDocOk): { optIn, lanes[], consentVersion, updatedAt }.

import { isAdultBirthDate } from "./ageGate";

/** Onay metni her değiştiğinde artar; eski sürümle katılmış kullanıcıdan yeniden onay istenir. */
export const MATCH_CONSENT_VERSION = 1;
/** İstemcinin seçtirebildiği kulvarlar (anime için köken dili istemcide yok → Faz 5 sonrası). */
export const MATCH_LANES = Object.freeze(["movie", "tv"]);

/** AppConfig/match belgesinden yalnız tanınan alanlar; bozuk değer kapalı sayılır. */
export function parseMatchConfig(data) {
  return { enabled: data?.enabled === true };
}

/**
 * @param {{ config?: object|null, isDev?: boolean, birthDate?: any, now?: Date }} input
 * @returns {{ flag: boolean, adult: boolean, available: boolean }}
 */
export function resolveMatchFeature({ config = null, isDev = false, birthDate = null, now } = {}) {
  const flag = isDev || parseMatchConfig(config).enabled;
  const adult = isAdultBirthDate(birthDate, now);
  return { flag, adult, available: flag && adult };
}

/** Okunan katılım belgesi → arayüz durumu. Eski onay sürümü katılmamış sayılır (yeniden onay). */
export function readOptIn(data) {
  if (!data || data.optIn !== true) return { optedIn: false, lanes: [], needsConsent: false };
  const lanes = Array.isArray(data.lanes) ? data.lanes.filter((l) => MATCH_LANES.includes(l)) : [];
  const stale = !(Number(data.consentVersion) >= MATCH_CONSENT_VERSION);
  return { optedIn: !stale && lanes.length > 0, lanes, needsConsent: stale };
}

/** Yazılacak belge (updatedAt çağıranda serverTimestamp). Kulvar yoksa katılım kapanır. */
export function optInPayload(lanes) {
  const clean = [...new Set((Array.isArray(lanes) ? lanes : []).filter((l) => MATCH_LANES.includes(l)))];
  return { optIn: clean.length > 0, lanes: clean, consentVersion: MATCH_CONSENT_VERSION };
}

/** Güç kademesi (ölçüm ve kart rengi için): low < 45 ≤ mid; havuzdaysa ready. */
export const strengthTier = (laneInfo) => (laneInfo?.eligible ? "ready" : (laneInfo?.strength ?? 0) >= 45 ? "mid" : "low");
