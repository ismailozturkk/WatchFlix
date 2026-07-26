const {
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
