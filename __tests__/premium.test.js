import {
  getPackagesForTier,
  getPackageDisplayProduct,
  getPackagePeriodKey,
  getPackageSavings,
  getPackageTierKey,
  getPremiumPlan,
  hasActivePremiumEntitlement,
  PREMIUM_PLAN,
  selectPreferredPackage,
} from "../utils/premium";

describe("premium helpers", () => {
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

  test("configured product identifiers map to the correct tier", () => {
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
        identifier: "monthly_2",
        price: 1,
        priceString: "$1.00",
        currencyCode: "USD",
      },
    };

    const testProduct = getPackageDisplayProduct(aPackage, {
      usingTestStore: true,
      language: "tr",
    });
    expect(testProduct.price).toBe(79.99);
    expect(testProduct.currencyCode).toBe("TRY");
    expect(testProduct.priceString).toContain("79,99");
    expect(
      getPackageDisplayProduct(aPackage, {
        usingTestStore: false,
        language: "tr",
      })
    ).toBe(aPackage.product);
  });
});
