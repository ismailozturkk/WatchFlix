// utils/leagueVisuals.js
//
// Haftalık Lig'in görsel kimliği ve ekran hesapları (saf; RN importu yok): lig başına gradyan + madalya rengi + simge,
// kalan süre ve tablo bölgeleri. Kurallar utils/leagueRules.js'te.

import { MIN_PROMOTE_XP, TIERS, clampTier, weekEndMs, zoneCounts } from "./leagueRules";

/** TIERS sırasıyla. colors: kart gradyanı (koyuya), medal: rozet/vurgu, icon: Ionicons. */
export const TIER_VISUALS = Object.freeze([
  { id: "bronze", colors: ["#C2410C", "#7C2D12", "#431407"], medal: "#F0A15E", icon: "shield-outline" },
  { id: "silver", colors: ["#94A3B8", "#475569", "#1E293B"], medal: "#E5E7EB", icon: "shield-half" },
  { id: "gold", colors: ["#F59E0B", "#B45309", "#78350F"], medal: "#FFD76A", icon: "shield" },
  { id: "diamond", colors: ["#22D3EE", "#0E7490", "#164E63"], medal: "#A5F3FC", icon: "diamond" },
  { id: "legend", colors: ["#C084FC", "#7E22CE", "#3B0764"], medal: "#F0ABFC", icon: "trophy" },
]);

export const tierVisual = (tier) => TIER_VISUALS[clampTier(tier)];

/** Haftanın bitmesine kalan: { days, hours } (days ≥ 1 ise gün gösterilir, yoksa saat; 0 saat = son saat). */
export function timeLeft(weekId, nowMs = Date.now()) {
  const left = Math.max(0, weekEndMs(weekId) - nowMs);
  const hours = Math.floor(left / 3600000);
  return { days: Math.floor(hours / 24), hours };
}

/** Kalan süre metni (copy: utils/leagueCopy). */
export function timeLeftLabel(copy, weekId, nowMs = Date.now()) {
  const { days, hours } = timeLeft(weekId, nowMs);
  if (days >= 1) return copy.daysLeft(days);
  if (hours >= 1) return copy.hoursLeft(hours);
  return copy.lastHour;
}

/**
 * Tablo satırının bölgesi: "up" (yükselme), "down" (düşme), null. Ekran, hafta sonu kuralıyla AYNI sonucu
 * göstersin diye outcome mantığının görsel karşılığıdır (yükselme bölgesi XP eşiğinden bağımsız çizilir,
 * eşik ayrıca yazılır).
 */
export function zoneOf({ tier, rank, size }) {
  const t = clampTier(tier);
  const { promote, demote } = zoneCounts(size);
  if (rank <= promote && t < TIERS.length - 1) return "up";
  if (demote > 0 && rank > size - demote && t > 0) return "down";
  return null;
}

/** Tablonun alt notu: hangi kural bu grupta geçerli. */
export function tableNotes(copy, { tier, size }) {
  const notes = [];
  if (clampTier(tier) === TIERS.length - 1) notes.push(copy.topTier);
  else notes.push(copy.promoteNeeds(MIN_PROMOTE_XP));
  if (clampTier(tier) > 0 && zoneCounts(size).demote === 0) notes.push(copy.noDemote);
  return notes;
}

/** Geçen haftanın sonuç satırı (yoksa null). */
export function lastResultLine(copy, lastResult) {
  if (!lastResult || !lastResult.outcome) return null;
  const league = copy.league(copy.tiers[clampTier(lastResult.toTier)]);
  if (lastResult.outcome === "up") return copy.resultUp(league);
  if (lastResult.outcome === "down") return copy.resultDown(league);
  return copy.resultStay(league);
}
