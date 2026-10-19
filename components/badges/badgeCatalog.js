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
import { copyLanguage } from "../../utils/appLanguages";

export const IDENTITY_BADGES = Object.freeze({
  founder: {
    id: "founder",
    glyph: "ribbon-outline",
    glyphSolid: "ribbon",
    rarity: RARITY.legendary,
    ornate: true,
    tr: "Kurucu",
    en: "Founder", es: "Fundador", pt: "Fundador",
    descTr: "Lansman öncesi katıldın",
    descEn: "Joined before launch", descEs: "Se unió antes del lanzamiento", descPt: "Entrou antes do lançamento",
  },
  premium: {
    id: "premium",
    glyph: "diamond-outline",
    glyphSolid: "diamond",
    rarity: RARITY.epic,
    ornate: true,
    tr: "Premium",
    en: "Premium", es: "Premium", pt: "Premium",
    descTr: "Seelogd Premium abonesi",
    descEn: "Seelogd Premium subscriber", descEs: "Suscripción a Seelogd Premium", descPt: "Assinatura do Seelogd Premium",
  },
  unlimited: {
    id: "unlimited",
    glyph: "infinite-outline",
    glyphSolid: "infinite",
    rarity: RARITY.legendary,
    ornate: true,
    tr: "Premium Max",
    en: "Premium Max", es: "Premium Max", pt: "Premium Max",
    descTr: "Günde 50, ayda 900 CineMatch AI mesajı",
    descEn: "50 CineMatch AI messages per day, 900 per month", descEs: "50 mensajes de IA de CineMatch al día, 900 al mes", descPt: "50 mensagens de IA do CineMatch por dia, 900 por mês",
  },
});

export const badgeLabel = (badge, lang) =>
  badge?.[copyLanguage(lang, ["tr", "en", "es", "pt"])] || badge?.en || "";
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
