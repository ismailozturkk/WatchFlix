import { intlLocaleOf } from "./appLanguages";

export const PREMIUM_ENTITLEMENT_ID = "com.smlztrk.seelogd Pro";

// Mağaza ürün kimlikleri — Play ve App Store'da AYNI. Kimlik bir kez
// oluşturulunca değişmez, silinse de yeniden kullanılamaz; plan (Premium /
// Max) kimlikten okunduğu için adı planı söylemeli.
export const REVENUECAT_PRODUCT_IDS = Object.freeze({
  PREMIUM_MONTHLY: "premium_monthly",
  PREMIUM_YEARLY: "premium_yearly",
  UNLIMITED_MONTHLY: "max_monthly",
  UNLIMITED_YEARLY: "max_yearly",
});

// Eylül 2026 öncesi yalnız RevenueCat Test Store'da duran kimlikler (gerçek
// satış olmadı; `monthly` Max aylıktı). Test abonelikleri bitince silinecek.
const LEGACY_PREMIUM_PRODUCT_IDS = Object.freeze(["monthly_2", "yearly"]);
const LEGACY_UNLIMITED_PRODUCT_IDS = Object.freeze(["monthly", "unlimited_yearly"]);

const PREMIUM_PRODUCT_IDS = new Set([
  REVENUECAT_PRODUCT_IDS.PREMIUM_MONTHLY,
  REVENUECAT_PRODUCT_IDS.PREMIUM_YEARLY,
  ...LEGACY_PREMIUM_PRODUCT_IDS,
]);
const UNLIMITED_PRODUCT_IDS = new Set([
  REVENUECAT_PRODUCT_IDS.UNLIMITED_MONTHLY,
  REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY,
  ...LEGACY_UNLIMITED_PRODUCT_IDS,
]);

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
  [PREMIUM_PLAN.FREE]: Object.freeze({ daily: 3, monthly: 30 }),
  [PREMIUM_PLAN.PREMIUM]: Object.freeze({ daily: 20, monthly: 300 }),
  [PREMIUM_PLAN.UNLIMITED]: Object.freeze({ daily: 50, monthly: 900 }),
});

export function getPremiumPlanDisplayName(plan) {
  return PREMIUM_PLAN_DISPLAY_NAME[plan] || PREMIUM_PLAN_DISPLAY_NAME.free;
}

// 19 Eylül 2026 kararı. Max 2,5 kat: TR'de ₺119,99'da kotasını dolduran Max
// kullanıcısının AI maliyeti (~₺88) net geliri (~₺85) aşıyordu.
export const RECOMMENDED_LAUNCH_PRICES = Object.freeze({
  [REVENUECAT_PRODUCT_IDS.PREMIUM_MONTHLY]: Object.freeze({
    tr: Object.freeze({ price: 59.99, currencyCode: "TRY" }),
    global: Object.freeze({ price: 1.99, currencyCode: "USD" }),
  }),
  [REVENUECAT_PRODUCT_IDS.PREMIUM_YEARLY]: Object.freeze({
    tr: Object.freeze({ price: 449.99, currencyCode: "TRY" }),
    global: Object.freeze({ price: 14.99, currencyCode: "USD" }),
  }),
  [REVENUECAT_PRODUCT_IDS.UNLIMITED_MONTHLY]: Object.freeze({
    tr: Object.freeze({ price: 149.99, currencyCode: "TRY" }),
    global: Object.freeze({ price: 4.99, currencyCode: "USD" }),
  }),
  [REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY]: Object.freeze({
    tr: Object.freeze({ price: 1099.99, currencyCode: "TRY" }),
    global: Object.freeze({ price: 34.99, currencyCode: "USD" }),
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
  return UNLIMITED_PRODUCT_IDS.has(baseProductIdentifier(identifier));
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
  if (PREMIUM_PRODUCT_IDS.has(productIdentifier)) {
    return PREMIUM_PLAN.PREMIUM;
  }
  const searchable = [
    aPackage?.identifier,
    aPackage?.product?.identifier,
    aPackage?.product?.title,
  ]
    .filter(Boolean)
    .join(" ");
  return /unlimited|\bmax\b|sinirsiz|sınırsız/i.test(searchable)
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
    packages.find((item) => getPackagePeriodKey(item) === "annual") ||
    packages.find((item) =>
      /annual|year|yillik|yıllık/i.test(item?.identifier || "")
    ) ||
    packages.find((item) => getPackagePeriodKey(item) === "monthly") ||
    packages[0]
  );
}

/**
 * Paketin fatura dönemi. Mağazanın bildirdiği süre (subscriptionPeriod) ESAS:
 * RevenueCat paket türü panelde elle seçilir ve ürünle çelişebilir, fatura ise
 * mağazadaki base plan süresine göre kesilir. (19 Eylül 2026: Play'de
 * `max_yearly` base plan'ı yanlışlıkla aylık kurulmuştu; `$rc_annual` gibi bir
 * paket türü bunu "Yıllık" diye gösterip gizleyebilirdi.) Paket türü yalnız
 * mağaza süre vermezse (ör. Test Store) kullanılır.
 */
export function getPackagePeriodKey(aPackage) {
  const period = aPackage?.product?.subscriptionPeriod || "";
  if (/^P(1Y|12M)$/i.test(period)) return "annual";
  if (/^P1M$/i.test(period)) return "monthly";
  if (/^P(1W|7D)$/i.test(period)) return "weekly";
  if (period) return "other";

  const type = aPackage?.packageType;
  if (type === "ANNUAL") return "annual";
  if (type === "MONTHLY") return "monthly";
  if (type === "WEEKLY") return "weekly";
  if (type === "LIFETIME") return "lifetime";
  return "other";
}

export function formatStorePrice(price, currency, language) {
  if (!Number.isFinite(price) || price <= 0 || !currency) return null;
  try {
    return new Intl.NumberFormat(intlLocaleOf(language), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return null;
  }
}

const MICROS_PER_UNIT = 1000000;

const PERIOD_UNIT_KEYS = Object.freeze({
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
});

function pricingPhasePrice(phase) {
  const micros = Number(phase?.price?.amountMicros);
  if (!Number.isFinite(micros) || micros < 0) return null;
  return {
    price: micros / MICROS_PER_UNIT,
    priceString: phase.price.formatted,
    currencyCode: phase.price.currencyCode,
  };
}

/**
 * Paketin teklifsiz (normal) fiyatı. Play'de `product.price` varsayılan
 * seçeneğin — teklif varsa teklifin — fiyatı olabilir; normal fiyat o
 * seçeneğin son (tam fiyat) fazındadır. Tasarruf ve "aya denk gelir"
 * hesapları teklife değil normal fiyata dayanmalı.
 */
export function getPackageRegularPrice(aPackage) {
  const product = aPackage?.product || {};
  const full = pricingPhasePrice(product.defaultOption?.fullPricePhase);
  if (full) return full;
  return {
    price: Number(product.price),
    priceString: product.priceString,
    currencyCode: product.currencyCode,
  };
}

/**
 * Kullanıcının yararlanabileceği giriş teklifi (lansman indirimi / deneme).
 *
 * Play: `defaultOption` base plan değil bir teklifse onun ücretsiz ya da
 * indirimli ilk fazı. Play yalnız kullanıcının uygun olduğu teklifleri
 * döndürür ve RevenueCat satın almada `defaultOption`'ı kullanır; yani burada
 * görünen teklif, tahsil edilecek olanın ta kendisi.
 * App Store: `introPrice`; uygunluğu mağaza söylemez, ayrıca sorulur
 * (`iosIntroEligible`). Uygun olmayana teklif göstermek yanıltıcıdır.
 *
 * Sahte indirim üretmez: teklif fiyatı normal fiyattan düşük değilse null.
 */
export function getPackageIntroOffer(aPackage, { iosIntroEligible = false } = {}) {
  const product = aPackage?.product;
  if (!product) return null;

  let offer = null;
  const option = product.defaultOption;
  if (option && !option.isBasePlan) {
    const phase = option.freePhase || option.introPhase;
    const phasePrice = pricingPhasePrice(phase);
    if (phasePrice) {
      offer = {
        ...phasePrice,
        cycles: phase.billingCycleCount || 1,
        unit: PERIOD_UNIT_KEYS[phase.billingPeriod?.unit] || null,
        unitCount: phase.billingPeriod?.value || 1,
      };
    }
  } else if (!option && product.introPrice && iosIntroEligible) {
    const intro = product.introPrice;
    offer = {
      price: Number(intro.price),
      priceString: intro.priceString,
      currencyCode: product.currencyCode,
      cycles: intro.cycles || 1,
      unit: PERIOD_UNIT_KEYS[intro.periodUnit] || null,
      unitCount: intro.periodNumberOfUnits || 1,
    };
  }
  if (!offer) return null;

  const regular = getPackageRegularPrice(aPackage);
  if (
    !Number.isFinite(offer.price) ||
    !Number.isFinite(regular.price) ||
    regular.price <= 0 ||
    offer.price >= regular.price ||
    (offer.currencyCode && regular.currencyCode && offer.currencyCode !== regular.currencyCode)
  ) {
    return null;
  }

  return {
    ...offer,
    free: offer.price === 0,
    percent: Math.round((1 - offer.price / regular.price) * 100),
    regularPrice: regular.price,
    regularPriceString: regular.priceString,
  };
}

export function getPackageMonthlyEquivalent(aPackage, language = "en") {
  if (getPackagePeriodKey(aPackage) !== "annual") return null;
  const regular = getPackageRegularPrice(aPackage);
  const annualPrice = regular.price;
  const currency = regular.currencyCode;
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
  const annual = getPackageRegularPrice(aPackage);
  const monthly = getPackageRegularPrice(monthlyPackage);
  const annualPrice = annual.price;
  const monthlyPrice = monthly.price;
  const currency = annual.currencyCode;
  const sameCurrency = Boolean(monthlyPackage) && currency === monthly.currencyCode;
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
