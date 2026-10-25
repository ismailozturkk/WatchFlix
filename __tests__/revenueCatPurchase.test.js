// Davet indirimiyle satın alma (services/revenueCatService.purchaseRevenueCatPackage).
// Apple'da promosyon teklifi alınamazsa satın alma sessizce TAM FİYATA geçmemeli:
// ekran indirim vaat etti, kullanıcıya sorulur (REFERRAL_OFFER_UNAVAILABLE).

const mockPurchases = {
  getPromotionalOffer: jest.fn(),
  purchaseDiscountedPackage: jest.fn(),
  purchasePackage: jest.fn(),
  purchaseStoreProduct: jest.fn(),
  purchaseSubscriptionOption: jest.fn(),
  STORE_REPLACEMENT_MODE: {},
};

jest.mock("react-native", () => ({ Platform: { OS: "ios" }, Linking: {} }));
jest.mock("react-native-purchases", () => ({ __esModule: true, default: mockPurchases, LOG_LEVEL: {} }));
jest.mock("react-native-purchases-ui", () => ({}));
jest.mock("firebase/functions", () => ({ httpsCallable: jest.fn() }));
jest.mock("../firebase", () => ({ fns: {} }));
jest.mock("../services/analytics", () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));

const {
  purchaseRevenueCatPackage,
  REFERRAL_OFFER_UNAVAILABLE,
} = require("../services/revenueCatService");

const aPackage = { identifier: "$rc_monthly", product: { identifier: "premium_monthly", price: 1.99 } };
const appleHandle = { kind: "apple", discount: { identifier: "referral-30-1m" } };

beforeEach(() => {
  Object.values(mockPurchases).forEach((fn) => typeof fn === "function" && fn.mockReset());
});

describe("Apple davet indirimi", () => {
  test("teklif varsa indirimli satın alır", async () => {
    mockPurchases.getPromotionalOffer.mockResolvedValue({ identifier: "signed" });
    mockPurchases.purchaseDiscountedPackage.mockResolvedValue({ customerInfo: {} });

    await purchaseRevenueCatPackage(aPackage, { referralHandle: appleHandle });

    expect(mockPurchases.purchaseDiscountedPackage).toHaveBeenCalledWith(aPackage, { identifier: "signed" });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  test("teklif boş dönerse tam fiyata GEÇMEZ, özel hata fırlatır", async () => {
    mockPurchases.getPromotionalOffer.mockResolvedValue(undefined);

    await expect(
      purchaseRevenueCatPackage(aPackage, { referralHandle: appleHandle }),
    ).rejects.toMatchObject({ code: REFERRAL_OFFER_UNAVAILABLE });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    expect(mockPurchases.purchaseDiscountedPackage).not.toHaveBeenCalled();
  });

  test("teklif alınırken hata olursa da aynı özel hata (satın alma düşmez, sorulur)", async () => {
    mockPurchases.getPromotionalOffer.mockRejectedValue(new Error("signature"));

    await expect(
      purchaseRevenueCatPackage(aPackage, { referralHandle: appleHandle }),
    ).rejects.toMatchObject({ code: REFERRAL_OFFER_UNAVAILABLE });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  test("davet olmadan normal satın alma değişmedi", async () => {
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: {} });

    await purchaseRevenueCatPackage(aPackage, {});

    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(aPackage, null, null);
    expect(mockPurchases.getPromotionalOffer).not.toHaveBeenCalled();
  });
});
