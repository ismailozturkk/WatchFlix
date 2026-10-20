// utils/referral.js
//
// Arkadaş daveti ekranının SAF kararları (RN içe aktarması yok → testlenebilir).
// Kuralların kendisi sunucudadır (functions/referral.js); burası yalnız sunucunun döndürdüğü
// özeti ekranın durumuna çevirir.

/**
 * Paylaşım mesajına eklenen bağlantılar. Mağaza bağlantıları yayına çıkınca buraya eklenir
 * (şimdilik yalnız site: mağaza sayfası herkese açık değil).
 */
// (Site adresi utils/legalLinks.js LEGAL_SITE ile aynı; o dosya RN modülü çektiği için burada kopya.)
export const REFERRAL_SHARE_LINKS = Object.freeze(["https://seelogd.com"]);

export function buildReferralShareMessage(copy, { displayCode, percent }) {
  return copy.shareMessage(displayCode, percent, REFERRAL_SHARE_LINKS.join("\n"));
}

/**
 * Kazanılan ücretsiz ayların ekran durumu:
 *   • "active"    ücretsiz Premium şu an açık (bitiş tarihiyle gösterilir)
 *   • "available" birikmiş ay var ve başlatılabilir
 *   • "blocked"   birikmiş ay var ama mağaza aboneliği sürüyor (başlatmak boşa giderdi)
 *   • "none"      ay yok
 * Başlatma, açık bir ücretsiz ayın üstüne eklenir; "active" ile "available" birlikte
 * olabilir, bu yüzden düğme durumu `canStart` ile ayrıca verilir.
 */
export function rewardState({ creditMonths = 0, promoUntilMs = null, storeSubscribed = false }, nowMs = Date.now()) {
  const active = Number.isFinite(promoUntilMs) && promoUntilMs > nowMs;
  const hasCredit = creditMonths > 0;
  const canStart = hasCredit && !storeSubscribed;
  const status = canStart
    ? "available"
    : hasCredit && storeSubscribed
      ? "blocked"
      : active
        ? "active"
        : "none";
  return { status, active, hasCredit, canStart };
}

/** Davet edenin listesindeki satırın rozeti: renk anahtarı + metin anahtarı. */
export function inviteeStatusLook(status) {
  if (status === "rewarded") return { tone: "success", icon: "gift" };
  if (status === "subscribed") return { tone: "success", icon: "checkmark-circle" };
  return { tone: "neutral", icon: "person-add" };
}

/** Kod alanına yapıştırılan metinden olası kodu ayıklar ("kodum: ABCD-EFGH" → "ABCDEFGH"). */
export function extractCodeFromText(text) {
  if (typeof text !== "string") return "";
  const match = text.toUpperCase().match(/[A-Z0-9]{4}[-\s]?[A-Z0-9]{4}/);
  return match ? match[0].replace(/[-\s]/g, "") : text.toUpperCase().replace(/[\s-]/g, "").slice(0, 24);
}
