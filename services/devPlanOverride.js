// services/devPlanOverride.js
//
// Geliştirme build'inde premium kapılarını denemek için "plan simülatörü".
//
// NEDEN: Free / Premium / Max davranışı kapılara, limitlere ve kilitli ekranlara
// dağılmış durumda. Her birini görmek için mağaza satın alması yapıp iptal etmek
// yerine etkin plan buradan anında değiştirilir.
//
// SINIR: yalnız İSTEMCİ kapılarını etkiler. Sunucu (AI günlük kotası, yayın
// bildirimi limiti) Users/{uid}.entitlements'taki GERÇEK plana göre çalışır;
// simülatör onu değiştiremez ve değiştirmemeli.
//
// RELEASE GÜVENLİĞİ: her giriş noktası `isDevPlanSimulatorAvailable()` ile kapılı.
// Release'de `__DEV__` false olduğu için kayıtlı bir değer olsa bile okunmaz,
// yazma da reddedilir; `applyDevPlanOverride` gerçek planı aynen döner.
import { useSyncExternalStore } from "react";
import { Keys, get, set } from "./storage";
import { normalizePlan } from "../utils/premiumFeatures";

/** "real" = simülasyon kapalı, gerçek plan geçerli. */
export const DEV_PLAN_REAL = "real";
export const DEV_PLAN_CHOICES = Object.freeze([
  DEV_PLAN_REAL,
  "free",
  "premium",
  "unlimited",
]);

/** `__DEV__` çağrı anında okunur (test, bayrağı modül yüklemeden sonra çevirebilsin). */
export function isDevPlanSimulatorAvailable() {
  return typeof __DEV__ !== "undefined" && __DEV__ === true;
}

function normalizeChoice(value) {
  return DEV_PLAN_CHOICES.includes(value) ? value : DEV_PLAN_REAL;
}

let choice = isDevPlanSimulatorAvailable()
  ? normalizeChoice(get(Keys.devPlanOverride))
  : DEV_PLAN_REAL;
const listeners = new Set();

export function getDevPlanOverride() {
  return isDevPlanSimulatorAvailable() ? choice : DEV_PLAN_REAL;
}

/** @returns {boolean} değer uygulandı mı (release'de ya da geçersiz değerde false) */
export function setDevPlanOverride(next) {
  if (!isDevPlanSimulatorAvailable()) return false;
  if (!DEV_PLAN_CHOICES.includes(next)) return false;
  if (next === choice) return true;
  choice = next;
  set(Keys.devPlanOverride, next);
  for (const listener of listeners) listener(next);
  return true;
}

export function subscribeDevPlanOverride(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDevPlanOverride() {
  return useSyncExternalStore(
    subscribeDevPlanOverride,
    getDevPlanOverride,
    getDevPlanOverride,
  );
}

/**
 * Etkin planı hesaplar. Simülatör kapalıysa (release, ya da "real" seçili)
 * gerçek plan DEĞİŞMEDEN döner.
 */
export function applyDevPlanOverride(realPlan, selected = getDevPlanOverride()) {
  if (!isDevPlanSimulatorAvailable()) return realPlan;
  if (selected === DEV_PLAN_REAL || !DEV_PLAN_CHOICES.includes(selected)) {
    return realPlan;
  }
  return normalizePlan(selected);
}
