export const PREMIUM_ENTITLEMENT_ID = "com.smlztrk.seelogd Pro";

export const REVENUECAT_PRODUCT_IDS = Object.freeze({
  PREMIUM_MONTHLY: "monthly_2",
  PREMIUM_YEARLY: "yearly",
  UNLIMITED_MONTHLY: "monthly",
  UNLIMITED_YEARLY: "unlimited_yearly",
});

export const PREMIUM_PLAN = Object.freeze({
  FREE: "free",
  PREMIUM: "premium",
  UNLIMITED: "unlimited",
});

export const PREMIUM_PLAN_DISPLAY_NAME = Object.freeze({
  [PREMIUM_PLAN.FREE]: "Free",
  [PREMIUM_PLAN.PREMIUM]: "Premium",
  [PREMIUM_PLAN.UNLIMITED]: "Premium Max",
});

export const AI_PLAN_LIMITS = Object.freeze({
  [PREMIUM_PLAN.FREE]: Object.freeze({ daily: 5, monthly: 30 }),
  [PREMIUM_PLAN.PREMIUM]: Object.freeze({ daily: 20, monthly: 300 }),
  [PREMIUM_PLAN.UNLIMITED]: Object.freeze({ daily: 50, monthly: 900 }),
});

export function getPremiumPlanDisplayName(plan) {
  return PREMIUM_PLAN_DISPLAY_NAME[plan] || PREMIUM_PLAN_DISPLAY_NAME.free;
}

export const RECOMMENDED_LAUNCH_PRICES = Object.freeze({
  [REVENUECAT_PRODUCT_IDS.PREMIUM_MONTHLY]: Object.freeze({
    tr: Object.freeze({ price: 79.99, currencyCode: "TRY" }),
    global: Object.freeze({ price: 3.99, currencyCode: "USD" }),
  }),
  [REVENUECAT_PRODUCT_IDS.PREMIUM_YEARLY]: Object.freeze({
    tr: Object.freeze({ price: 599.99, currencyCode: "TRY" }),
    global: Object.freeze({ price: 29.99, currencyCode: "USD" }),
  }),
  [REVENUECAT_PRODUCT_IDS.UNLIMITED_MONTHLY]: Object.freeze({
    tr: Object.freeze({ price: 159.99, currencyCode: "TRY" }),
    global: Object.freeze({ price: 7.99, currencyCode: "USD" }),
  }),
  [REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY]: Object.freeze({
    tr: Object.freeze({ price: 1199.99, currencyCode: "TRY" }),
    global: Object.freeze({ price: 59.99, currencyCode: "USD" }),
  }),
});

export function getPremiumPlan(
  customerInfo,
  entitlementId = PREMIUM_ENTITLEMENT_ID
) {
  const active = customerInfo?.entitlements?.active || {};
  const entitlement = active[entitlementId];
  if (!entitlement) return PREMIUM_PLAN.FREE;
  return isUnlimitedProductIdentifier(entitlement.productIdentifier)
    ? PREMIUM_PLAN.UNLIMITED
    : PREMIUM_PLAN.PREMIUM;
}

export function hasActivePremiumEntitlement(
  customerInfo,
  entitlementId = PREMIUM_ENTITLEMENT_ID
) {
  return getPremiumPlan(customerInfo, entitlementId) !== PREMIUM_PLAN.FREE;
}

/**
 * Google Play abonelik kimliği "abonelikId:tabanPlanId" biçiminde gelebilir
 * (StoreProduct.identifier). Karşılaştırma ve ürün değişimi için abonelik
 * kimliği yeterli.
 */
export function baseProductIdentifier(identifier) {
  if (typeof identifier !== "string" || !identifier) return null;
  return identifier.split(":")[0];
}

export function isUnlimitedProductIdentifier(identifier) {
  const base = baseProductIdentifier(identifier);
  return (
    base === REVENUECAT_PRODUCT_IDS.UNLIMITED_MONTHLY ||
    base === REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY
  );
}

/**
 * Sunucunun yazdığı Users/{uid}.entitlements alanından plan
 * (functions/aiQuota.js resolveAiPlan ile aynı kural).
 */
export function resolveServerPlan(entitlements) {
  if (
    entitlements?.premiumUnlimited === true ||
    entitlements?.premiumPlan === PREMIUM_PLAN.UNLIMITED
  ) {
    return PREMIUM_PLAN.UNLIMITED;
  }
  if (entitlements?.premium === true) return PREMIUM_PLAN.PREMIUM;
  return PREMIUM_PLAN.FREE;
}

const PLAN_RANK = Object.freeze({
  [PREMIUM_PLAN.FREE]: 0,
  [PREMIUM_PLAN.PREMIUM]: 1,
  [PREMIUM_PLAN.UNLIMITED]: 2,
});

/**
 * Android'de aktif Play aboneliğinden BAŞKA bir ürüne geçiş.
 *
 * Google Play, değişim bilgisi verilmeyen satın almayı ikinci ve bağımsız bir
 * abonelik sayar: Premium → Premium Max geçen kullanıcı iki abonelik için
 * birden ödeme yapar. iOS aynı abonelik grubundaki ürünlerde bunu kendisi
 * yönetir; bu yüzden yalnız Android'de ve Play kaynaklı aboneliklerde döner.
 *
 * Üst plana ya da aylıktan yıllığa geçiş anında olur (kalan süre orantılı
 * iade edilir); alt plana veya yıllıktan aylığa geçiş dönem sonunda işler.
 *
 * @returns {{ oldProductIdentifier: string, replacementMode: string } | null}
 */
export function getStoreProductChange({
  customerInfo,
  entitlementId = PREMIUM_ENTITLEMENT_ID,
  aPackage,
  platform,
}) {
  if (platform !== "android") return null;
  const active = customerInfo?.entitlements?.active?.[entitlementId];
  if (!active || active.store !== "PLAY_STORE") return null;

  const oldId = baseProductIdentifier(active.productIdentifier);
  const newId = baseProductIdentifier(aPackage?.product?.identifier);
  if (!oldId || !newId || oldId === newId) return null;

  const oldRank = PLAN_RANK[
    isUnlimitedProductIdentifier(oldId) ? PREMIUM_PLAN.UNLIMITED : PREMIUM_PLAN.PREMIUM
  ];
  const newRank = PLAN_RANK[getPackageTierKey(aPackage)];
  const toAnnual = getPackagePeriodKey(aPackage) === "annual";
  const immediate = newRank > oldRank || (newRank === oldRank && toAnnual);

  return {
    oldProductIdentifier: oldId,
    replacementMode: immediate ? "WITH_TIME_PRORATION" : "DEFERRED",
  };
}

export function getPackageTierKey(aPackage) {
  const productIdentifier = baseProductIdentifier(aPackage?.product?.identifier);
  if (isUnlimitedProductIdentifier(productIdentifier)) {
    return PREMIUM_PLAN.UNLIMITED;
  }
  if (
    productIdentifier === REVENUECAT_PRODUCT_IDS.PREMIUM_MONTHLY ||
    productIdentifier === REVENUECAT_PRODUCT_IDS.PREMIUM_YEARLY
  ) {
    return PREMIUM_PLAN.PREMIUM;
  }
  const searchable = [
    aPackage?.identifier,
    aPackage?.product?.identifier,
    aPackage?.product?.title,
  ]
    .filter(Boolean)
    .join(" ");
  return /unlimited|sinirsiz|sınırsız/i.test(searchable)
    ? PREMIUM_PLAN.UNLIMITED
    : PREMIUM_PLAN.PREMIUM;
}

export function getPackagesForTier(packages = [], tier) {
  if (!Array.isArray(packages)) return [];
  return packages.filter((item) => getPackageTierKey(item) === tier);
}

export function selectPreferredPackage(packages = []) {
  if (!Array.isArray(packages) || packages.length === 0) return null;

  return (
    packages.find((item) => item?.packageType === "ANNUAL") ||
    packages.find((item) =>
      /annual|year|yillik|yıllık/i.test(item?.identifier || "")
    ) ||
    packages.find((item) => item?.packageType === "MONTHLY") ||
    packages[0]
  );
}

export function getPackagePeriodKey(aPackage) {
  const type = aPackage?.packageType;
  if (type === "ANNUAL") return "annual";
  if (type === "MONTHLY") return "monthly";
  if (type === "WEEKLY") return "weekly";
  if (type === "LIFETIME") return "lifetime";

  const period = aPackage?.product?.subscriptionPeriod || "";
  if (/P1Y/i.test(period)) return "annual";
  if (/P1M/i.test(period)) return "monthly";
  if (/P1W/i.test(period)) return "weekly";
  return "other";
}

export function formatStorePrice(price, currency, language) {
  if (!Number.isFinite(price) || price <= 0 || !currency) return null;
  try {
    return new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return null;
  }
}

export function getPackageMonthlyEquivalent(aPackage, language = "en") {
  if (getPackagePeriodKey(aPackage) !== "annual") return null;
  const annualPrice = Number(aPackage?.product?.price);
  const currency = aPackage?.product?.currencyCode;
  if (!Number.isFinite(annualPrice) || annualPrice <= 0 || !currency) return null;
  const monthly = annualPrice / 12;
  return formatStorePrice(monthly, currency, language);
}

/**
 * RevenueCat Test Store para çekmediği için geliştirme ekranında hedef lansman
 * fiyatlarını gösterir. Production mağazalarında her zaman mağazanın imzalı,
 * yerelleştirilmiş ürün fiyatı kullanılır; böylece görünen ve tahsil edilen
 * tutar birbirinden kopmaz.
 */
export function getPackageDisplayProduct(
  aPackage,
  { usingTestStore = false, language = "en" } = {}
) {
  const product = aPackage?.product || {};
  if (!usingTestStore) return product;

  const configured = RECOMMENDED_LAUNCH_PRICES[product.identifier];
  const market = language === "tr" ? configured?.tr : configured?.global;
  if (!market) return product;

  return {
    ...product,
    price: market.price,
    currencyCode: market.currencyCode,
    priceString:
      formatStorePrice(market.price, market.currencyCode, language) ||
      product.priceString,
  };
}

/**
 * Yıllık paketin gerçek avantajını aynı tier'ın mağazadan gelen aylık fiyatına
 * göre hesaplar. Aylık pakette veya karşılaştırılamayan para birimlerinde sahte
 * indirim üretmez.
 */
export function getPackageSavings(aPackage, allPackages = [], language = "en") {
  if (getPackagePeriodKey(aPackage) !== "annual") return null;

  const tier = getPackageTierKey(aPackage);
  const monthlyPackage = allPackages.find(
    (item) =>
      getPackageTierKey(item) === tier &&
      getPackagePeriodKey(item) === "monthly"
  );
  const annualPrice = Number(aPackage?.product?.price);
  const monthlyPrice = Number(monthlyPackage?.product?.price);
  const currency = aPackage?.product?.currencyCode;
  const sameCurrency = currency === monthlyPackage?.product?.currencyCode;
  const monthlyTotal = monthlyPrice * 12;

  if (
    !sameCurrency ||
    !Number.isFinite(annualPrice) ||
    annualPrice <= 0 ||
    !Number.isFinite(monthlyTotal) ||
    monthlyTotal <= annualPrice
  ) {
    return null;
  }

  const percent = Math.round((1 - annualPrice / monthlyTotal) * 100);
  const originalPrice = formatStorePrice(monthlyTotal, currency, language);
  return percent > 0 && originalPrice ? { percent, originalPrice } : null;
}
