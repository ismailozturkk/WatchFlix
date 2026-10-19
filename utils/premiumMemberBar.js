// utils/premiumMemberBar.js
//
// Ayarlar ana ekranındaki "Seelogd Premium" alanının ABONE hâli: Premium ya da Premium Max
// planındaki kullanıcıya büyük satış vitrini (PremiumSettingsCard) yerine küçük bir "Aboneliği
// yönet" çubuğu gösterilir (components/settings/PremiumMemberBar.js). Bu dosya çubuğun saf
// kararlarını tutar: kime gösterilir, nereye gider, hangi renk/ikon/metin. Böylece çizim
// bileşeni ince kalır ve kurallar bileşen çizilmeden test edilir.
//
// Neden ayrı bir görünüm: vitrin (üç avantaj karosu + dolu CTA) HENÜZ satın almamış birine
// satış yapar; satın almış birine aynı büyüklükte satış göstermek hem yer kaplar hem anlamsız.
// Abone için asıl iş "planım ne, ne kadarını kullandım, nasıl yönetirim" — çubuk bunu tek
// dokunuşla açar.

import { PREMIUM_PLAN, getPremiumPlanDisplayName } from "./premium";

/** Çubuğun açtığı ekran: Ayarlar > Kullanım ve haklar (limitler + aboneliği yönet). */
export const MEMBER_BAR_ROUTE = "PremiumUsageScreen";

/** Premium Max'in kimlik renkleri (altın → gül). Premium tema vurgusunu kullanır. */
export const MAX_GOLD = "#F59E0B";
export const MAX_ROSE = "#F43F5E";

/** Çubuk yalnız ücretli planda çizilir (Free büyük vitrini görür). */
export const shouldShowMemberBar = (plan) =>
  plan === PREMIUM_PLAN.PREMIUM || plan === PREMIUM_PLAN.UNLIMITED;

/**
 * Plana özel görünüm. Renkler:
 *   • Premium  → tema vurgusu + mor (vitrin kartıyla aynı dil: "bu kartın abonesi")
 *   • Max      → altın + gül: Premium'dan bir bakışta ayrılsın, "bir üst kat" hissi versin
 * `from`/`to` degrade uçları (sabit, her temada aynı kimlik); `ink` küçük METİN rengi — açık
 * temada altın okunmaz, bu yüzden Max'te tema turuncusuna (açıkta koyulaşan) bağlanır.
 */
export function memberBarLook(plan, theme) {
  const max = plan === PREMIUM_PLAN.UNLIMITED;
  const purple = theme?.colors?.purple || "#8B5CF6";
  const accent = theme?.accent || "#6366F1";
  return {
    max,
    icon: max ? "infinite" : "diamond",
    planName: getPremiumPlanDisplayName(max ? PREMIUM_PLAN.UNLIMITED : PREMIUM_PLAN.PREMIUM),
    from: max ? MAX_GOLD : accent,
    to: max ? MAX_ROSE : purple,
    ink: max ? theme?.colors?.orange || MAX_GOLD : accent,
  };
}

/** Çubuğun başlığı ("Aboneliği yönet"). `language`: tr | en | es | pt (bilinmeyen → en). */
export function memberBarTitle(language) {
  if (language === "tr") return "Aboneliği yönet";
  if (language === "es") return "Gestionar suscripción";
  if (language === "pt") return "Gerenciar assinatura";
  return "Manage subscription";
}

/** Ekran okuyucu etiketi: plan + eylem + nereye gittiği. */
export function memberBarAccessibilityLabel(plan, language) {
  const name = getPremiumPlanDisplayName(
    plan === PREMIUM_PLAN.UNLIMITED ? PREMIUM_PLAN.UNLIMITED : PREMIUM_PLAN.PREMIUM,
  );
  const tail =
    language === "tr"
      ? "plan, kullanım ve limitler"
      : language === "es"
        ? "plan, uso y límites"
        : language === "pt" ? "plano, uso e limites" : "plan, usage and limits";
  return `${name}, ${memberBarTitle(language)}, ${tail}`;
}
