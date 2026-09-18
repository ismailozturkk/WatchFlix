const PREMIUM_ENTITLEMENT_ID = "com.smlztrk.seelogd Pro";
// İstemci aynası: utils/premium.js. `monthly` ve `unlimited_yearly` Eylül 2026
// öncesi Test Store kimlikleri (gerçek satış olmadı); test abonelikleri bitince
// silinecek.
const UNLIMITED_PRODUCT_IDS = new Set([
  "max_monthly",
  "max_yearly",
  "monthly",
  "unlimited_yearly",
]);

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
  // Google Play kimliği "abonelikId:tabanPlan" biçiminde gelebilir.
  const baseProductId = premium.productId
    ? String(premium.productId).split(":")[0]
    : null;
  const premiumUnlimited =
    premium.active && UNLIMITED_PRODUCT_IDS.has(baseProductId);

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
    store: findSubscriptionStore(payload, premium.productId),
  };
}

/** subscriber.subscriptions haritasından ürünün mağazası ("play_store"...). */
function findSubscriptionStore(payload, productId) {
  if (!productId) return null;
  const subscriptions = payload?.subscriber?.subscriptions || {};
  const direct = subscriptions[productId];
  if (direct?.store) return direct.store;
  const base = String(productId).split(":")[0];
  const match = Object.keys(subscriptions).find(
    (key) => key === base || key.startsWith(`${base}:`),
  );
  return match ? subscriptions[match]?.store || null : null;
}

/**
 * Sunucunun yazdığı iki belge:
 *   • Users/{uid}.entitlements (HERKESE AÇIK profil belgesi): yalnız plan.
 *     AI kotası ve arkadaş profilindeki rozet bunu okur.
 *   • Users/{uid}/private/entitlements (yalnız sahibi okur): ürün, mağaza,
 *     bitiş tarihi. Başka kullanıcıların birinin aboneliğinin ne zaman
 *     bittiğini görmesi gerekmez.
 * Zaman damgaları ve eski alanların silinmesi çağıranda (FieldValue).
 */
function buildEntitlementDocuments(state, { store = null, source = "revenuecat" } = {}) {
  return {
    publicEntitlements: {
      premium: Boolean(state.premium),
      premiumUnlimited: Boolean(state.premiumUnlimited),
      premiumPlan: state.premiumPlan || "free",
      premiumSource: source,
    },
    privateEntitlements: {
      premium: Boolean(state.premium),
      premiumPlan: state.premiumPlan || "free",
      productId: state.productId || null,
      store: store || state.store || null,
      expiresAt: state.expiresAt || null,
      source,
    },
  };
}

// Eskiden herkese açık belgeye yazılan ayrıntı alanları (artık private'ta).
const LEGACY_PUBLIC_ENTITLEMENT_FIELDS = Object.freeze([
  "premiumProductId",
  "premiumStore",
  "premiumExpiresAt",
]);

module.exports = {
  PREMIUM_ENTITLEMENT_ID,
  LEGACY_PUBLIC_ENTITLEMENT_FIELDS,
  isFirebaseUserId,
  resolveFirebaseUserId,
  resolvePremiumWebhookState,
  getTransferChanges,
  parseRevenueCatPremiumState,
  buildEntitlementDocuments,
};
