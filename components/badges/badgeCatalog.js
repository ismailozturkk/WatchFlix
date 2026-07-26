// components/badges/badgeCatalog.js
//
// KİMLİK rozetleri: kullanıcının "kim olduğunu" söyleyen, profilinde taşınan
// rozetler. Başarım rozetlerinden (screens/game/gameRegistry.js) ayrı durur
// çünkü kaynakları farklı: başarım oynayarak kazanılır, kimlik satın alınır
// ya da bir kere verilir.
//
// KURUCU ROZETİ GERİ ALINAMAZ BİR KAMU VAADİDİR. Landing page "profilinde
// sonsuza dek" diyor. Bu yüzden İSTEMCİDE HESAPLANMAZ: Users/{uid}.badges.founder
// alanından okunur ve o alan firestore.rules'ta istemciye kapalı olmalıdır
// (entitlements için yapılanın aynısı) — aksi halde herkes kendine kurucu
// rozeti yazabilir.

import { RARITY } from "@theme/badgeTokens";

export const IDENTITY_BADGES = Object.freeze({
  founder: {
    id: "founder",
    glyph: "ribbon-outline",
    glyphSolid: "ribbon",
    rarity: RARITY.legendary,
    ornate: true,
    tr: "Kurucu",
    en: "Founder",
    descTr: "Lansman öncesi katıldın",
    descEn: "Joined before launch",
  },
  premium: {
    id: "premium",
    glyph: "diamond-outline",
    glyphSolid: "diamond",
    rarity: RARITY.epic,
    ornate: true,
    tr: "Premium",
    en: "Premium",
    descTr: "Seelogd Premium abonesi",
    descEn: "Seelogd Premium subscriber",
  },
  unlimited: {
    id: "unlimited",
    glyph: "infinite-outline",
    glyphSolid: "infinite",
    rarity: RARITY.legendary,
    ornate: true,
    tr: "Unlimited",
    en: "Premium Unlimited",
    descTr: "Sınırsız CineMatch AI",
    descEn: "Unlimited CineMatch AI",
  },
});

export const badgeLabel = (badge, lang) => (lang === "tr" ? badge?.tr : badge?.en) || badge?.en || "";
export const badgeDesc = (badge, lang) => (lang === "tr" ? badge?.descTr : badge?.descEn) || badge?.descEn || "";

/**
 * Profilde gösterilecek kimlik rozetleri, önem sırasına göre.
 * Premium ve Unlimited AYNI ANDA verilmez — Unlimited üst kademe olduğu için
 * onu bastırır (PremiumScreen'deki tier mantığıyla aynı).
 *
 * @param {object} opts
 * @param {boolean} opts.founder    Users/{uid}.badges.founder (SUNUCUDAN)
 * @param {boolean} opts.isPremium  usePremium().isPremium
 * @param {boolean} opts.isUnlimited usePremium().isUnlimited
 */
export function getIdentityBadges({ founder = false, isPremium = false, isUnlimited = false } = {}) {
  const out = [];
  if (founder) out.push(IDENTITY_BADGES.founder);
  if (isUnlimited) out.push(IDENTITY_BADGES.unlimited);
  else if (isPremium) out.push(IDENTITY_BADGES.premium);
  return out;
}
