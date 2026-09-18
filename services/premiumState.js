// services/premiumState.js
//
// Etkin premium planının React DIŞINDAN da okunabilen kopyası.
//
// NEDEN: tema (ThemeProvider) ağaçta PremiumProvider'ın ÜSTÜNDE, yazı tipi
// tercihi ise React dışı bir store (services/typographySettings.js). İkisi de
// usePremium() çağıramaz. PremiumProvider çözdüğü planı buraya yayınlar;
// tema ve yazı tipi buna abone olur.
//
// Plan diske de yazılır ve modül yüklenirken SENKRON okunur: RevenueCat cevabı
// (≈1 sn) gelene kadar premium kullanıcının özel teması/fontu varsayılana düşüp
// geri gelmez. Yanlış pozitif (abonelik bitmiş, disk hâlâ premium diyor) en
// fazla o bir saniye sürer — PremiumProvider gerçek planı yayınlayınca düzelir.
import { useSyncExternalStore } from "react";
import { Keys, get, set } from "./storage";
import { normalizePlan } from "../utils/premiumFeatures";

let plan = normalizePlan(get(Keys.premiumLastPlan));
const listeners = new Set();

export function getPremiumPlanSnapshot() {
  return plan;
}

/** PremiumProvider çağırır; plan değişmediyse kimseyi uyandırmaz. */
export function publishPremiumPlan(nextPlan) {
  const normalized = normalizePlan(nextPlan);
  if (normalized === plan) return;
  plan = normalized;
  set(Keys.premiumLastPlan, normalized);
  for (const listener of listeners) listener(normalized);
}

export function subscribePremiumPlan(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tema gibi PremiumProvider'ın dışında kalan React ağaçları için. */
export function usePremiumPlanSnapshot() {
  return useSyncExternalStore(
    subscribePremiumPlan,
    getPremiumPlanSnapshot,
    getPremiumPlanSnapshot,
  );
}
