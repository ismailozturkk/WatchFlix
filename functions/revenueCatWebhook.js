const PREMIUM_ENTITLEMENT_ID = "com.smlztrk.seelogd Pro";
const UNLIMITED_PRODUCT_IDS = new Set(["monthly", "unlimited_yearly"]);

const ACTIVE_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);

function isFirebaseUserId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.startsWith("$RCAnonymousID:")
  );
}

function resolvePremiumWebhookState(event) {
  if (!event || typeof event !== "object") return null;
  if (event.type === "TEMPORARY_ENTITLEMENT_GRANT") return true;
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
    : [];
  if (!entitlementIds.includes(PREMIUM_ENTITLEMENT_ID)) return null;

  if (event.type === "EXPIRATION") return false;
  if (event.type === "CANCELLATION" || event.type === "BILLING_ISSUE") {
    // İptal, mevcut dönemin hemen bittiği anlamına gelmez. RevenueCat
    // gerçek bitişte ayrıca EXPIRATION gönderir.
    return true;
  }
  if (ACTIVE_EVENT_TYPES.has(event.type)) return true;
  return null;
}

function resolveFirebaseUserId(event) {
  if (isFirebaseUserId(event?.app_user_id)) return event.app_user_id;
  return (event?.aliases || []).find(isFirebaseUserId) || null;
}

function getTransferChanges(event) {
  if (event?.type !== "TRANSFER") return [];
  const from = (event.transferred_from || [])
    .filter(isFirebaseUserId)
    .map((uid) => ({ uid, premium: false }));
  const to = (event.transferred_to || [])
    .filter(isFirebaseUserId)
    .map((uid) => ({ uid, premium: true }));
  return [...from, ...to];
}

function parseRevenueCatPremiumState(payload, nowMs = Date.now()) {
  const entitlements = payload?.subscriber?.entitlements || {};

  function parseEntitlement(entitlement) {
    if (!entitlement) {
      return { active: false, productId: null, expiresAt: null };
    }

    const expiresAtMs = entitlement.expires_date
      ? Date.parse(entitlement.expires_date)
      : null;
    const graceAtMs = entitlement.grace_period_expires_date
      ? Date.parse(entitlement.grace_period_expires_date)
      : null;
    const effectiveExpiry = Math.max(
      Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
      Number.isFinite(graceAtMs) ? graceAtMs : 0
    );
    const lifetime = !entitlement.expires_date;

    return {
      active: lifetime || effectiveExpiry > nowMs,
      productId: entitlement.product_identifier || null,
      expiresAt:
        lifetime || !effectiveExpiry ? null : new Date(effectiveExpiry),
    };
  }

  const premium = parseEntitlement(entitlements[PREMIUM_ENTITLEMENT_ID]);
  const premiumUnlimited =
    premium.active && UNLIMITED_PRODUCT_IDS.has(premium.productId);

  return {
    premium: premium.active,
    premiumUnlimited,
    premiumPlan: premiumUnlimited
      ? "unlimited"
      : premium.active
      ? "premium"
      : "free",
    productId: premium.productId,
    expiresAt: premium.expiresAt,
  };
}

module.exports = {
  PREMIUM_ENTITLEMENT_ID,
  isFirebaseUserId,
  resolveFirebaseUserId,
  resolvePremiumWebhookState,
  getTransferChanges,
  parseRevenueCatPremiumState,
};
