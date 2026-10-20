import {
  AI_PLAN_LIMITS,
  getPackagesForTier,
  getPackageDisplayProduct,
  getPackageIntroOffer,
  getPackageMonthlyEquivalent,
  getPackageRegularPrice,
  getPackagePeriodKey,
  getPackageSavings,
  getPackageTierKey,
  getPremiumPlan,
  getPremiumPlanDisplayName,
  hasActivePremiumEntitlement,
  PREMIUM_PLAN,
  baseProductIdentifier,
  getStoreProductChange,
  resolveServerPlan,
  selectPreferredPackage,
} from "../utils/premium";

const { AI_PLAN_LIMITS: SERVER_AI_PLAN_LIMITS } = require("../functions/aiQuota");

describe("premium helpers", () => {
  test("keeps client plan labels and quotas aligned with the server", () => {
    expect(getPremiumPlanDisplayName(PREMIUM_PLAN.PREMIUM)).toBe("Premium");
    expect(getPremiumPlanDisplayName(PREMIUM_PLAN.UNLIMITED)).toBe(
      "Premium Max"
    );
    expect(AI_PLAN_LIMITS).toEqual(SERVER_AI_PLAN_LIMITS);
  });

  test("active entitlement is the only premium source", () => {
    expect(
      hasActivePremiumEntitlement({
        entitlements: {
          active: {
            "com.smlztrk.seelogd Pro": {
              identifier: "com.smlztrk.seelogd Pro",
              productIdentifier: "monthly_2",
            },
          },
        },
      })
    ).toBe(true);
    expect(hasActivePremiumEntitlement({ entitlements: { active: {} } })).toBe(
      false
    );
  });

  test("the monthly product maps the Pro entitlement to Unlimited", () => {
    const info = {
      entitlements: {
        active: {
          "com.smlztrk.seelogd Pro": {
            identifier: "com.smlztrk.seelogd Pro",
            productIdentifier: "monthly",
          },
        },
      },
    };
    expect(getPremiumPlan(info)).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(hasActivePremiumEntitlement(info)).toBe(true);
  });

  test("the Unlimited yearly product maps to Unlimited", () => {
    expect(
      getPremiumPlan({
        entitlements: {
          active: {
            "com.smlztrk.seelogd Pro": {
              productIdentifier: "unlimited_yearly",
            },
          },
        },
      })
    ).toBe(PREMIUM_PLAN.UNLIMITED);
  });

  test("store product identifiers map to the correct tier", () => {
    const tierOf = (identifier) => getPackageTierKey({ product: { identifier } });
    expect(tierOf("premium_monthly")).toBe(PREMIUM_PLAN.PREMIUM);
    expect(tierOf("premium_yearly:p1y")).toBe(PREMIUM_PLAN.PREMIUM);
    expect(tierOf("max_monthly:p1m")).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(tierOf("max_yearly")).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(
      getPremiumPlan({
        entitlements: {
          active: { "com.smlztrk.seelogd Pro": { productIdentifier: "max_monthly:p1m" } },
        },
      })
    ).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(
      getPremiumPlan({
        entitlements: {
          active: { "com.smlztrk.seelogd Pro": { productIdentifier: "premium_yearly" } },
        },
      })
    ).toBe(PREMIUM_PLAN.PREMIUM);
  });

  test("legacy Test Store identifiers still map to the correct tier", () => {
    const premium = {
      identifier: "premium_monthly",
      product: { identifier: "monthly_2" },
    };
    const unlimited = {
      identifier: "unlimited_monthly",
      product: { identifier: "monthly" },
    };
    const unlimitedYearly = {
      identifier: "unlimited_yearly",
      product: { identifier: "unlimited_yearly" },
    };
    expect(getPackageTierKey(premium)).toBe(PREMIUM_PLAN.PREMIUM);
    expect(getPackageTierKey(unlimited)).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(getPackageTierKey(unlimitedYearly)).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(
      getPackagesForTier([premium, unlimited], PREMIUM_PLAN.UNLIMITED)
    ).toEqual([unlimited]);
  });

  test("annual package is preferred regardless of dashboard order", () => {
    const monthly = { identifier: "$rc_monthly", packageType: "MONTHLY" };
    const annual = { identifier: "$rc_annual", packageType: "ANNUAL" };
    expect(selectPreferredPackage([monthly, annual])).toBe(annual);
  });

  test("store period wins over a contradicting RevenueCat package type", () => {
    // Panelde "annual" paket, mağazada aylık base plan: fatura aylık kesilir.
    const mislabeled = {
      identifier: "$rc_annual",
      packageType: "ANNUAL",
      product: { identifier: "max_yearly:p1y", subscriptionPeriod: "P1M" },
    };
    expect(getPackagePeriodKey(mislabeled)).toBe("monthly");
    const realAnnual = {
      identifier: "unlimited_yearly",
      packageType: "CUSTOM",
      product: { identifier: "max_yearly:yearly", subscriptionPeriod: "P1Y" },
    };
    expect(getPackagePeriodKey(realAnnual)).toBe("annual");
    expect(selectPreferredPackage([mislabeled, realAnnual])).toBe(realAnnual);
  });

  test("subscription period is used as a package fallback", () => {
    expect(
      getPackagePeriodKey({ product: { subscriptionPeriod: "P1Y" } })
    ).toBe("annual");
    expect(
      getPackagePeriodKey({ product: { subscriptionPeriod: "P1M" } })
    ).toBe("monthly");
  });

  test("annual savings use real monthly and annual store prices", () => {
    const monthly = {
      identifier: "premium_monthly",
      packageType: "MONTHLY",
      product: { identifier: "monthly_2", price: 79.99, currencyCode: "TRY" },
    };
    const annual = {
      identifier: "premium_yearly",
      packageType: "ANNUAL",
      product: { identifier: "yearly", price: 599.99, currencyCode: "TRY" },
    };

    const savings = getPackageSavings(annual, [monthly, annual], "tr");
    expect(savings.percent).toBe(37);
    expect(savings.originalPrice).toContain("959,88");
    expect(getPackageSavings(monthly, [monthly, annual], "tr")).toBeNull();
  });

  test("annual savings hide incomparable store currencies", () => {
    const monthly = {
      packageType: "MONTHLY",
      product: { identifier: "monthly_2", price: 3.99, currencyCode: "USD" },
    };
    const annual = {
      packageType: "ANNUAL",
      product: { identifier: "yearly", price: 599.99, currencyCode: "TRY" },
    };
    expect(getPackageSavings(annual, [monthly, annual], "tr")).toBeNull();
  });

  test("test store uses launch prices while production keeps store prices", () => {
    const aPackage = {
      product: {
        identifier: "premium_monthly",
        price: 1,
        priceString: "$1.00",
        currencyCode: "USD",
      },
    };

    const testProduct = getPackageDisplayProduct(aPackage, {
      usingTestStore: true,
      language: "tr",
    });
    expect(testProduct.price).toBe(59.99);
    expect(testProduct.currencyCode).toBe("TRY");
    expect(testProduct.priceString).toContain("59,99");
    expect(
      getPackageDisplayProduct(
        { product: { identifier: "max_monthly", price: 1, currencyCode: "USD" } },
        { usingTestStore: true, language: "en" }
      ).price
    ).toBe(4.99);
    expect(
      getPackageDisplayProduct(aPackage, {
        usingTestStore: false,
        language: "tr",
      })
    ).toBe(aPackage.product);
  });

  test("calculates monthly equivalent price for annual packages", () => {
    const annual = {
      packageType: "ANNUAL",
      product: { identifier: "yearly", price: 599.99, currencyCode: "TRY" },
    };
    const monthly = {
      packageType: "MONTHLY",
      product: { identifier: "monthly_2", price: 79.99, currencyCode: "TRY" },
    };
    const monthlyEquivalent = getPackageMonthlyEquivalent(annual, "tr");
    expect(monthlyEquivalent).toContain("50");
    expect(getPackageMonthlyEquivalent(monthly, "tr")).toBeNull();
  });
});

// Lansman teklifi: Play'de defaultOption bir teklifse (base plan değilse) ilk
// fazı; App Store'da introPrice yalnız uygunluk doğrulanınca. Sahte indirim yok.
describe("giriş teklifi (lansman indirimi)", () => {
  const phase = (amount, unit, cycles, value = 1) => ({
    billingPeriod: { unit, value, iso8601: `P${value}${unit[0]}` },
    billingCycleCount: cycles,
    price: {
      amountMicros: Math.round(amount * 1000000),
      formatted: `₺${amount.toFixed(2).replace(".", ",")}`,
      currencyCode: "TRY",
    },
  });
  const playPackage = ({ offer = true, full = 59.99, intro = 29.99, unit = "MONTH", cycles = 3 } = {}) => {
    const fullPricePhase = phase(full, unit, null);
    const introPhase = phase(intro, unit, cycles);
    return {
      packageType: unit === "YEAR" ? "ANNUAL" : "MONTHLY",
      product: {
        identifier: "premium_monthly:p1m",
        // Play'de product.price varsayılan seçeneğin (teklifin) fiyatı olabilir.
        price: offer ? intro : full,
        priceString: offer ? introPhase.price.formatted : fullPricePhase.price.formatted,
        currencyCode: "TRY",
        defaultOption: offer
          ? { isBasePlan: false, introPhase, freePhase: null, fullPricePhase }
          : { isBasePlan: true, introPhase: fullPricePhase, freePhase: null, fullPricePhase },
      },
    };
  };

  test("Play teklifi: ilk 3 ay %50, normal fiyat tam fiyat fazından", () => {
    const offer = getPackageIntroOffer(playPackage());
    expect(offer).toMatchObject({ price: 29.99, cycles: 3, unit: "month", percent: 50, free: false });
    expect(offer.regularPriceString).toBe("₺59,99");
    expect(getPackageRegularPrice(playPackage()).price).toBe(59.99);
  });

  test("Play yıllık teklif: ilk yıl %20", () => {
    const offer = getPackageIntroOffer(
      playPackage({ full: 449.99, intro: 359.99, unit: "YEAR", cycles: 1 })
    );
    expect(offer).toMatchObject({ cycles: 1, unit: "year", percent: 20 });
  });

  test("uygun teklif yoksa (base plan) teklif gösterilmez", () => {
    expect(getPackageIntroOffer(playPackage({ offer: false }))).toBeNull();
  });

  test("teklif normal fiyattan ucuz değilse sahte indirim üretilmez", () => {
    expect(getPackageIntroOffer(playPackage({ intro: 59.99 }))).toBeNull();
  });

  test("App Store introPrice yalnız uygunluk doğrulanınca gösterilir", () => {
    const iosPackage = {
      packageType: "MONTHLY",
      product: {
        identifier: "premium_monthly",
        price: 59.99,
        priceString: "₺59,99",
        currencyCode: "TRY",
        defaultOption: null,
        introPrice: {
          price: 29.99,
          priceString: "₺29,99",
          cycles: 3,
          period: "P1M",
          periodUnit: "MONTH",
          periodNumberOfUnits: 1,
        },
      },
    };
    expect(getPackageIntroOffer(iosPackage)).toBeNull();
    expect(getPackageIntroOffer(iosPackage, { iosIntroEligible: true })).toMatchObject({
      percent: 50,
      cycles: 3,
      unit: "month",
    });
  });

  test("yıllık tasarruf teklif fiyatına değil normal fiyatlara göre hesaplanır", () => {
    const monthly = playPackage();
    const annual = playPackage({ full: 449.99, intro: 359.99, unit: "YEAR", cycles: 1 });
    annual.product.identifier = "premium_yearly:p1y";
    expect(getPackageSavings(annual, [monthly, annual], "tr").percent).toBe(37);
  });
});

// Google Play abonelik kimlikleri "abonelikId:tabanPlan" biçiminde gelir; kademe
// tespiti ve ürün değişimi bununla da doğru çalışmalı.
describe("Play ürün kimlikleri ve ürün değişimi", () => {
  const entitlementId = "com.smlztrk.seelogd Pro";
  const pkg = (identifier, packageType) => ({
    identifier: `pkg_${identifier}`,
    packageType,
    product: { identifier },
  });
  const activeOn = (productIdentifier, store = "PLAY_STORE") => ({
    entitlements: {
      active: { [entitlementId]: { productIdentifier, store } },
    },
  });

  test("taban plan eki ayıklanır", () => {
    expect(baseProductIdentifier("monthly:p1m")).toBe("monthly");
    expect(baseProductIdentifier("yearly")).toBe("yearly");
    expect(baseProductIdentifier(null)).toBe(null);
  });

  test("Play kimlikli paketler doğru kademeye düşer", () => {
    expect(getPackageTierKey(pkg("monthly:p1m", "MONTHLY"))).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(getPackageTierKey(pkg("unlimited_yearly:p1y", "ANNUAL"))).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(getPackageTierKey(pkg("monthly_2:p1m", "MONTHLY"))).toBe(PREMIUM_PLAN.PREMIUM);
    expect(getPackageTierKey(pkg("yearly:p1y", "ANNUAL"))).toBe(PREMIUM_PLAN.PREMIUM);
  });

  test("sunucu planı entitlements alanından çözülür", () => {
    expect(resolveServerPlan(undefined)).toBe(PREMIUM_PLAN.FREE);
    expect(resolveServerPlan({ premium: false, premiumPlan: "free" })).toBe(PREMIUM_PLAN.FREE);
    expect(resolveServerPlan({ premium: true, premiumPlan: "premium" })).toBe(PREMIUM_PLAN.PREMIUM);
    expect(resolveServerPlan({ premium: true, premiumUnlimited: true })).toBe(PREMIUM_PLAN.UNLIMITED);
  });

  test("iOS'ta ve aktif abonelik yokken değişim bilgisi verilmez", () => {
    const target = pkg("monthly:p1m", "MONTHLY");
    expect(getStoreProductChange({ customerInfo: activeOn("monthly_2"), entitlementId, aPackage: target, platform: "ios" })).toBe(null);
    expect(getStoreProductChange({ customerInfo: { entitlements: { active: {} } }, entitlementId, aPackage: target, platform: "android" })).toBe(null);
    // Test Store / App Store kaynaklı abonelik Play değişimi değildir.
    expect(getStoreProductChange({ customerInfo: activeOn("monthly_2", "TEST_STORE"), entitlementId, aPackage: target, platform: "android" })).toBe(null);
    // Aynı ürün: değişim yok.
    expect(getStoreProductChange({ customerInfo: activeOn("monthly"), entitlementId, aPackage: target, platform: "android" })).toBe(null);
  });

  test("Premium → Premium Max anında, kalan süre orantılı iade", () => {
    expect(
      getStoreProductChange({
        customerInfo: activeOn("monthly_2"),
        entitlementId,
        aPackage: pkg("monthly:p1m", "MONTHLY"),
        platform: "android",
      }),
    ).toEqual({ oldProductIdentifier: "monthly_2", replacementMode: "WITH_TIME_PRORATION" });
  });

  test("yeni kimliklerle Premium → Max anında, Max → Premium dönem sonunda", () => {
    const change = (from, target) =>
      getStoreProductChange({ customerInfo: activeOn(from), entitlementId, aPackage: target, platform: "android" });
    expect(change("premium_monthly:p1m", pkg("max_monthly:p1m", "MONTHLY"))).toEqual({
      oldProductIdentifier: "premium_monthly",
      replacementMode: "WITH_TIME_PRORATION",
    });
    expect(change("max_yearly:p1y", pkg("premium_yearly:p1y", "ANNUAL")).replacementMode).toBe("DEFERRED");
    expect(change("premium_monthly", pkg("premium_yearly:p1y", "ANNUAL")).replacementMode).toBe("WITH_TIME_PRORATION");
  });

  test("aylıktan yıllığa anında; yıllıktan aylığa ve Max'ten Premium'a dönem sonunda", () => {
    const change = (from, target) =>
      getStoreProductChange({ customerInfo: activeOn(from), entitlementId, aPackage: target, platform: "android" });
    expect(change("monthly_2", pkg("yearly:p1y", "ANNUAL")).replacementMode).toBe("WITH_TIME_PRORATION");
    expect(change("yearly", pkg("monthly_2:p1m", "MONTHLY")).replacementMode).toBe("DEFERRED");
    expect(change("monthly", pkg("monthly_2:p1m", "MONTHLY")).replacementMode).toBe("DEFERRED");
  });
});
