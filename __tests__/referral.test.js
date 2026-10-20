// __tests__/referral.test.js
//
// Arkadaş daveti + promosyon kodu — istemci tarafı: saf kararlar, plan çözümü, mağaza teklifi
// seçimi ve ekranlar arası bağların kaynak bekçisi. Sunucu kuralları functions/referral.test.js'te,
// güvenlik kuralları __tests__/rules'ta.

const fs = require("fs");
const path = require("path");

jest.mock("../firebase", () => ({ fns: {} }));
jest.mock("firebase/functions", () => ({ httpsCallable: jest.fn() }));

const {
  resolveServerPlan,
  getPackageReferralOffer,
  pickBetterOffer,
  PREMIUM_PLAN,
} = require("../utils/premium");
const {
  rewardState,
  inviteeStatusLook,
  extractCodeFromText,
  buildReferralShareMessage,
} = require("../utils/referral");
const { REFERRAL_COPY, getReferralCopy } = require("../utils/referralCopy");
const { referralErrorReason } = require("../services/referralService");

const read = (...parts) => fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");
const NOW = Date.UTC(2026, 9, 19, 12);

describe("resolveServerPlan: ücretsiz ay (promosyon) süresi", () => {
  const promo = (untilMs) => ({
    premium: true,
    premiumPlan: "premium",
    premiumSource: "promo",
    promoUntil: { toMillis: () => untilMs },
  });

  it("süren promosyon Premium sayılır", () => {
    expect(resolveServerPlan(promo(NOW + 1000), NOW)).toBe(PREMIUM_PLAN.PREMIUM);
  });

  it("süresi dolmuş promosyon, sunucu temizlemeden önce bile Free sayılır", () => {
    expect(resolveServerPlan(promo(NOW - 1), NOW)).toBe(PREMIUM_PLAN.FREE);
  });

  it("mağaza aboneliği kaynaklı plan promoUntil kalıntısından etkilenmez", () => {
    const paid = {
      premium: true,
      premiumPlan: "premium",
      premiumSource: "revenuecat",
      promoUntil: NOW - 5,
    };
    expect(resolveServerPlan(paid, NOW)).toBe(PREMIUM_PLAN.PREMIUM);
  });

  it("eski belge (kaynak yok) aynen çözülür", () => {
    expect(resolveServerPlan({ premium: true }, NOW)).toBe(PREMIUM_PLAN.PREMIUM);
    expect(resolveServerPlan({ premiumUnlimited: true }, NOW)).toBe(PREMIUM_PLAN.UNLIMITED);
    expect(resolveServerPlan(undefined, NOW)).toBe(PREMIUM_PLAN.FREE);
  });
});

describe("rewardState", () => {
  it("birikmiş ay + mağaza aboneliği yok → başlatılabilir", () => {
    expect(rewardState({ creditMonths: 2 }, NOW)).toMatchObject({
      status: "available",
      canStart: true,
    });
  });

  it("birikmiş ay ama mağaza aboneliği sürüyor → bekler, başlatılamaz", () => {
    expect(rewardState({ creditMonths: 1, storeSubscribed: true }, NOW)).toMatchObject({
      status: "blocked",
      canStart: false,
    });
  });

  it("ücretsiz ay açık, birikmiş yok → active", () => {
    expect(rewardState({ creditMonths: 0, promoUntilMs: NOW + 1 }, NOW).status).toBe("active");
  });

  it("hiçbiri yok → none; dolmuş bitiş active sayılmaz", () => {
    expect(rewardState({}, NOW).status).toBe("none");
    expect(rewardState({ promoUntilMs: NOW - 1 }, NOW).status).toBe("none");
  });

  it("açık ay üstüne birikmiş ay varsa ikisi birlikte: durum available, active işareti de açık", () => {
    const state = rewardState({ creditMonths: 1, promoUntilMs: NOW + 1000 }, NOW);
    expect(state.status).toBe("available");
    expect(state.active).toBe(true);
  });
});

describe("küçük yardımcılar", () => {
  it("inviteeStatusLook: ödül/abone başarı, kayıt nötr", () => {
    expect(inviteeStatusLook("rewarded").tone).toBe("success");
    expect(inviteeStatusLook("subscribed").tone).toBe("success");
    expect(inviteeStatusLook("registered").tone).toBe("neutral");
  });

  it("extractCodeFromText: mesajın içinden kodu çıkarır", () => {
    expect(extractCodeFromText("kodum: abcd-efgh bak")).toBe("ABCDEFGH");
    expect(extractCodeFromText("abcd efgh")).toBe("ABCDEFGH");
    expect(extractCodeFromText(null)).toBe("");
  });

  it("referralErrorReason: sunucu gerekçesini okur, ağ hatasını tanımaz", () => {
    expect(referralErrorReason({ details: { reason: "code-exhausted" } })).toBe("code-exhausted");
    expect(referralErrorReason({ message: "own-code" })).toBe("own-code");
    expect(referralErrorReason({ message: "internal" })).toBeNull();
    expect(referralErrorReason({ message: "Network request failed" })).toBeNull();
    expect(referralErrorReason(null)).toBeNull();
  });

  it("paylaşım mesajı kodu, oranı ve bağlantıyı taşır (üç dilde)", () => {
    for (const language of ["tr", "en", "es", "pt"]) {
      const message = buildReferralShareMessage(getReferralCopy(language), {
        displayCode: "ABCD-EFGH",
        percent: 30,
      });
      expect(message).toContain("ABCD-EFGH");
      expect(message).toContain("30");
      expect(message).toContain("https://");
    }
  });

  it("bilinmeyen dil İngilizce metne düşer", () => {
    expect(getReferralCopy("xx")).toBe(REFERRAL_COPY.en);
  });

  it("her red gerekçesinin üç dilde metni var", () => {
    const reasons = [
      "code-not-found",
      "code-exhausted",
      "code-expired",
      "code-inactive",
      "already-redeemed",
      "own-code",
      "window-closed",
      "already-purchased",
      "store-subscription-active",
      "rate-limited",
      "no-credit",
    ];
    for (const language of ["tr", "en", "es", "pt"]) {
      for (const reason of reasons) {
        expect(REFERRAL_COPY[language].errors[reason]).toBeTruthy();
      }
    }
  });
});

describe("davet teklifi (mağaza)", () => {
  const phase = (micros, cycles = 1) => ({
    price: { amountMicros: micros, formatted: `₺${micros / 1e6}`, currencyCode: "TRY" },
    billingCycleCount: cycles,
    billingPeriod: { unit: "MONTH", value: 1 },
  });
  const playPackage = (offerPhase) => ({
    product: {
      identifier: "premium_monthly",
      price: 59.99,
      priceString: "₺59,99",
      currencyCode: "TRY",
      subscriptionPeriod: "P1M",
      defaultOption: { isBasePlan: true, fullPricePhase: phase(59990000, 0) },
      subscriptionOptions: [
        { id: "p1m", isBasePlan: true, fullPricePhase: phase(59990000, 0) },
        {
          id: "p1m:referral-30-1m",
          isBasePlan: false,
          introPhase: offerPhase,
          fullPricePhase: phase(59990000, 0),
        },
      ],
    },
  });

  it("Play: kimliği eşleşen teklifi bulur, yüzdeyi hesaplar", () => {
    const found = getPackageReferralOffer(playPackage(phase(41990000)), "referral-30-1m", {
      platform: "android",
    });
    expect(found.handle.kind).toBe("play");
    expect(found.offer.percent).toBe(30);
    expect(found.offer.cycles).toBe(1);
  });

  it("mağazada teklif tanımlı değilse null (sahte indirim gösterilmez)", () => {
    const pkg = playPackage(phase(41990000));
    pkg.product.subscriptionOptions = [pkg.product.subscriptionOptions[0]];
    expect(getPackageReferralOffer(pkg, "referral-30-1m", { platform: "android" })).toBeNull();
    expect(getPackageReferralOffer(null, "referral-30-1m")).toBeNull();
    expect(getPackageReferralOffer(playPackage(phase(41990000)), null)).toBeNull();
  });

  it("normal fiyattan pahalı/eşit teklif reddedilir", () => {
    expect(
      getPackageReferralOffer(playPackage(phase(59990000)), "referral-30-1m", {
        platform: "android",
      }),
    ).toBeNull();
  });

  it("App Store: promosyon indirimi kimlikle bulunur", () => {
    const pkg = {
      product: {
        identifier: "premium_monthly",
        price: 59.99,
        priceString: "₺59,99",
        currencyCode: "TRY",
        subscriptionPeriod: "P1M",
        discounts: [
          {
            identifier: "referral-30-1m",
            price: 41.99,
            priceString: "₺41,99",
            cycles: 1,
            periodUnit: "MONTH",
            periodNumberOfUnits: 1,
          },
        ],
      },
    };
    const found = getPackageReferralOffer(pkg, "referral-30-1m", { platform: "ios" });
    expect(found.handle.kind).toBe("apple");
    expect(found.offer.percent).toBe(30);
  });

  it("pickBetterOffer: toplam tasarrufu yüksek olan kazanır; eşitlikte davet", () => {
    const launch = { regularPrice: 60, price: 30, cycles: 3 }; // 90 kazanç
    const referral = { regularPrice: 60, price: 42, cycles: 1 }; // 18 kazanç
    expect(pickBetterOffer(launch, referral)).toEqual({ offer: launch, useReferral: false });
    expect(pickBetterOffer(null, referral)).toEqual({ offer: referral, useReferral: true });
    expect(pickBetterOffer(referral, referral).useReferral).toBe(true);
    expect(pickBetterOffer(launch, null)).toEqual({ offer: launch, useReferral: false });
    expect(pickBetterOffer(null, null)).toEqual({ offer: null, useReferral: false });
  });
});

describe("bağlar (kaynak bekçisi)", () => {
  it("ReferralScreen kayıtlı, Ayarlar Premium bölümünden ulaşılıyor", () => {
    expect(read("App.js")).toMatch(/name="ReferralScreen"/);
    expect(read("screens", "tabs", "SettingsScreen.js")).toContain('navigate("ReferralScreen")');
  });

  it("Premium sayfası: kod girişi var ve satın alma davet teklifini taşıyor", () => {
    const src = read("screens", "premium", "PremiumScreen.js");
    expect(src).toContain("<RedeemCodeSheet");
    expect(src).toMatch(/purchasePackage\(selectedPackage,\s*\{\s*referralHandle:/);
  });

  it("webhook ve plan yazımı promosyonu korur (currentEntitlements geçiyor)", () => {
    const src = read("functions", "index.js");
    expect(src).toMatch(
      /source: "revenuecat",\s*currentEntitlements: userSnaps\[index\]\.get\("entitlements"\)/,
    );
    expect(src).toMatch(
      /source: "revenuecat_sync",\s*extraPrivate:[\s\S]*?currentEntitlements: userSnap\.get\("entitlements"\)/,
    );
  });

  it("sunucuya ait koleksiyonlar kurallarda açıkça kapalı", () => {
    const rules = read("firestore.rules");
    for (const name of ["ReferralCodes", "ReferralAccounts", "Referrals", "PromoCodes"]) {
      expect(rules).toMatch(
        new RegExp(`match /${name}/\\{[A-Za-z]+\\} \\{\\s*allow read, write: if false;`),
      );
    }
  });
});
