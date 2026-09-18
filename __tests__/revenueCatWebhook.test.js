const {
  LEGACY_PUBLIC_ENTITLEMENT_FIELDS,
  buildEntitlementDocuments,
  getTransferChanges,
  isFirebaseUserId,
  parseRevenueCatPremiumState,
  resolveFirebaseUserId,
  resolvePremiumWebhookState,
} = require("../functions/revenueCatWebhook");

describe("RevenueCat webhook helpers", () => {
  test("purchase activates and expiration revokes premium", () => {
    expect(
      resolvePremiumWebhookState({
        type: "INITIAL_PURCHASE",
        entitlement_ids: ["com.smlztrk.seelogd Pro"],
      })
    ).toBe(true);
    expect(
      resolvePremiumWebhookState({
        type: "EXPIRATION",
        entitlement_ids: ["com.smlztrk.seelogd Pro"],
      })
    ).toBe(false);
  });

  test("the configured Pro entitlement is handled", () => {
    expect(
      resolvePremiumWebhookState({
        type: "INITIAL_PURCHASE",
        entitlement_ids: ["com.smlztrk.seelogd Pro"],
      })
    ).toBe(true);
  });

  test("cancellation keeps access until expiration", () => {
    expect(
      resolvePremiumWebhookState({
        type: "CANCELLATION",
        entitlement_ids: ["com.smlztrk.seelogd Pro"],
      })
    ).toBe(true);
  });

  test("unrelated entitlements are ignored", () => {
    expect(
      resolvePremiumWebhookState({
        type: "RENEWAL",
        entitlement_ids: ["supporter"],
      })
    ).toBeNull();
  });

  test("temporary outage grants activate premium", () => {
    expect(
      resolvePremiumWebhookState({ type: "TEMPORARY_ENTITLEMENT_GRANT" })
    ).toBe(true);
  });

  test("Firebase identity can be recovered from aliases", () => {
    expect(
      resolveFirebaseUserId({
        app_user_id: "$RCAnonymousID:abc",
        aliases: ["firebase-uid", "$RCAnonymousID:def"],
      })
    ).toBe("firebase-uid");
  });

  test("transfer excludes anonymous RevenueCat aliases", () => {
    expect(isFirebaseUserId("firebase-uid")).toBe(true);
    expect(isFirebaseUserId("$RCAnonymousID:abc")).toBe(false);
    expect(
      getTransferChanges({
        type: "TRANSFER",
        transferred_from: ["old-uid", "$RCAnonymousID:old"],
        transferred_to: ["new-uid"],
      })
    ).toEqual([
      { uid: "old-uid", premium: false },
      { uid: "new-uid", premium: true },
    ]);
  });

  test("server customer info decides active and expired entitlement state", () => {
    expect(
      parseRevenueCatPremiumState(
        {
          subscriber: {
            entitlements: {
              "com.smlztrk.seelogd Pro": {
                product_identifier: "yearly",
                expires_date: "2030-01-01T00:00:00Z",
              },
            },
          },
        },
        Date.parse("2029-01-01T00:00:00Z")
      )
    ).toMatchObject({
      premium: true,
      productId: "yearly",
    });

    expect(
      parseRevenueCatPremiumState(
        {
          subscriber: {
            entitlements: {
              "com.smlztrk.seelogd Pro": {
                expires_date: "2020-01-01T00:00:00Z",
              },
            },
          },
        },
        Date.parse("2021-01-01T00:00:00Z")
      ).premium
    ).toBe(false);
  });

  test("unlimited customer info sets both compatibility and plan fields", () => {
    expect(
      parseRevenueCatPremiumState(
        {
          subscriber: {
            entitlements: {
              "com.smlztrk.seelogd Pro": {
                product_identifier: "monthly",
                expires_date: "2030-01-01T00:00:00Z",
              },
            },
          },
        },
        Date.parse("2029-01-01T00:00:00Z")
      )
    ).toMatchObject({
      premium: true,
      premiumUnlimited: true,
      premiumPlan: "unlimited",
      productId: "monthly",
    });
  });

  test("store product identifiers are classified by plan", () => {
    const planOf = (productId) =>
      parseRevenueCatPremiumState(
        {
          subscriber: {
            entitlements: {
              "com.smlztrk.seelogd Pro": {
                product_identifier: productId,
                expires_date: "2030-01-01T00:00:00Z",
              },
            },
          },
        },
        Date.parse("2029-01-01T00:00:00Z")
      ).premiumPlan;
    expect(planOf("max_monthly")).toBe("unlimited");
    expect(planOf("max_yearly:p1y")).toBe("unlimited");
    expect(planOf("premium_monthly")).toBe("premium");
    expect(planOf("premium_yearly:p1y")).toBe("premium");
  });

  test("Unlimited yearly customer info is classified as Unlimited", () => {
    expect(
      parseRevenueCatPremiumState(
        {
          subscriber: {
            entitlements: {
              "com.smlztrk.seelogd Pro": {
                product_identifier: "unlimited_yearly",
                expires_date: "2030-01-01T00:00:00Z",
              },
            },
          },
        },
        Date.parse("2029-01-01T00:00:00Z")
      )
    ).toMatchObject({
      premium: true,
      premiumUnlimited: true,
      premiumPlan: "unlimited",
    });
  });
});

describe("abonelik belgeleri", () => {
  const future = Date.parse("2029-01-01T00:00:00Z");

  test("mağaza bilgisi abonelik haritasından okunur (Play taban planı dahil)", () => {
    const payload = (productId, subscriptionKey) => ({
      subscriber: {
        entitlements: {
          "com.smlztrk.seelogd Pro": {
            product_identifier: productId,
            expires_date: "2030-01-01T00:00:00Z",
          },
        },
        subscriptions: { [subscriptionKey]: { store: "play_store" } },
      },
    });
    expect(parseRevenueCatPremiumState(payload("yearly", "yearly"), future).store).toBe("play_store");
    expect(parseRevenueCatPremiumState(payload("monthly", "monthly:p1m"), future)).toMatchObject({
      premiumPlan: "unlimited",
      store: "play_store",
    });
  });

  test("Play taban planlı Premium Max ürünü Max sayılır", () => {
    const state = parseRevenueCatPremiumState(
      {
        subscriber: {
          entitlements: {
            "com.smlztrk.seelogd Pro": {
              product_identifier: "unlimited_yearly:p1y",
              expires_date: "2030-01-01T00:00:00Z",
            },
          },
        },
      },
      future,
    );
    expect(state.premiumPlan).toBe("unlimited");
  });

  test("herkese açık belgede yalnız plan, ayrıntılar özel belgede", () => {
    const { publicEntitlements, privateEntitlements } = buildEntitlementDocuments(
      {
        premium: true,
        premiumUnlimited: false,
        premiumPlan: "premium",
        productId: "yearly",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        store: "play_store",
      },
      { source: "revenuecat" },
    );
    expect(publicEntitlements).toEqual({
      premium: true,
      premiumUnlimited: false,
      premiumPlan: "premium",
      premiumSource: "revenuecat",
    });
    for (const field of LEGACY_PUBLIC_ENTITLEMENT_FIELDS) {
      expect(publicEntitlements).not.toHaveProperty(field);
    }
    expect(privateEntitlements).toMatchObject({
      premiumPlan: "premium",
      productId: "yearly",
      store: "play_store",
      source: "revenuecat",
    });
  });

  test("olay mağazası, ayrıştırılan mağazaya göre önceliklidir", () => {
    const { privateEntitlements } = buildEntitlementDocuments(
      { premium: false, premiumPlan: "free", store: "app_store" },
      { store: "PLAY_STORE" },
    );
    expect(privateEntitlements.store).toBe("PLAY_STORE");
  });
});
