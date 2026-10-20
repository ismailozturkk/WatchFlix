"use strict";

// Sunucuda zorlanan premium limitleri.
//
// İstemci aynası utils/premiumFeatures.js'tir (ödeme ekranı metni oradan
// üretilir). İki taraf ayrışırsa kullanıcıya satılan ile verilen farklılaşır;
// eşitliği __tests__/premiumFeatures.test.js doğrular. AI kotası kendi
// modülündedir (aiQuota.js) ve aynı testle korunur.

const { resolveAiPlan } = require("./aiQuota");

// Platform bildirimleri: izleme listesinde takip edilen başlık tavanı.
const STREAMING_ALERT_LIMITS = Object.freeze({
  free: 10,
  premium: 100,
  unlimited: 100,
});

/** Users/{uid}.entitlements → "free" | "premium" | "unlimited". */
const resolvePremiumPlan = resolveAiPlan;

function getStreamingAlertLimit(entitlements) {
  return (
    STREAMING_ALERT_LIMITS[resolvePremiumPlan(entitlements)] ??
    STREAMING_ALERT_LIMITS.free
  );
}

/**
 * Takip edilecek başlıklar: izleme listesine EN SON eklenen/güncellenen
 * `limit` tanesi (updatedAt yoksa en eski sayılır). Kullanıcıya verilen söz
 * "son eklediğin N başlık"; belge kimliği sırası (movie_…, tv_…) keyfî olurdu.
 *
 * @param {Array<{updatedAtMs?: number}>} entries
 */
function pickTrackedTitles(entries, limit) {
  if (!Array.isArray(entries) || !(limit > 0)) return [];
  return [...entries]
    .sort((a, b) => (b?.updatedAtMs || 0) - (a?.updatedAtMs || 0))
    .slice(0, limit);
}

module.exports = {
  STREAMING_ALERT_LIMITS,
  resolvePremiumPlan,
  getStreamingAlertLimit,
  pickTrackedTitles,
};
