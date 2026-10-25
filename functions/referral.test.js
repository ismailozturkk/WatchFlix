const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DAY_MS,
  REFERRAL,
  REASONS,
  CODE_ALPHABET,
  normalizeCode,
  formatCodeForDisplay,
  generateReferralCode,
  readPromo,
  normalizePromoPlan,
  higherPromoPlan,
  applyPromoToState,
  extendPromoUntil,
  hasActiveStoreSubscription,
  evaluatePromoCode,
  evaluateReferralRedemption,
  isRewardablePurchase,
  planReferralUpdate,
  inviteeDiscountFor,
  inviteeStatus,
  checkAttemptBudget,
} = require("./referral");

const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);
const FREE = {
  premium: false,
  premiumUnlimited: false,
  premiumPlan: "free",
  productId: null,
  expiresAt: null,
};

test("normalizeCode: büyük harf, boşluk ve tireyi atar; bozuk girdiyi reddeder", () => {
  assert.equal(normalizeCode(" abcd-efgh "), "ABCDEFGH");
  assert.equal(normalizeCode("abcd efgh"), "ABCDEFGH");
  assert.equal(normalizeCode("ab"), null);
  assert.equal(normalizeCode("abc$def"), null);
  assert.equal(normalizeCode(null), null);
  assert.equal(normalizeCode("x".repeat(40)), null);
});

test("generateReferralCode: 8 karakter, karışan harf yok, normalize ile uyumlu", () => {
  let n = 0;
  const code = generateReferralCode((max) => n++ % max);
  assert.equal(code.length, 8);
  for (const ch of code) assert.ok(CODE_ALPHABET.includes(ch));
  assert.equal(normalizeCode(code), code);
  assert.ok(!/[01OIL]/.test(CODE_ALPHABET));
  assert.equal(formatCodeForDisplay("ABCDEFGH"), "ABCD-EFGH");
});

test("readPromo: Timestamp ve ms okur, active süreye göre", () => {
  assert.equal(readPromo({}, NOW), null);
  assert.equal(readPromo({ promoUntil: NOW + 1000 }, NOW).active, true);
  assert.equal(readPromo({ promoUntil: NOW - 1 }, NOW).active, false);
  const ts = { toMillis: () => NOW + 5 };
  assert.equal(readPromo({ promoUntil: ts }, NOW).untilMs, NOW + 5);
});

test("applyPromoToState: mağaza Free ise promosyon planı verir", () => {
  const promo = readPromo({ promoUntil: NOW + DAY_MS }, NOW);
  const { state, source } = applyPromoToState(FREE, promo, NOW);
  assert.equal(source, "promo");
  assert.equal(state.premium, true);
  assert.equal(state.premiumPlan, "premium");
  assert.equal(state.premiumUnlimited, false);
  assert.equal(state.expiresAt.getTime(), NOW + DAY_MS);
});

test("applyPromoToState: mağaza planı eşit/yüksekse mağaza kazanır, dolmuş promosyon yok sayılır", () => {
  const promo = readPromo({ promoUntil: NOW + DAY_MS }, NOW);
  const paid = { ...FREE, premium: true, premiumPlan: "premium", productId: "premium_monthly" };
  assert.equal(applyPromoToState(paid, promo, NOW).source, null);
  assert.equal(applyPromoToState(paid, promo, NOW).state, paid);
  const max = { ...paid, premiumPlan: "unlimited", premiumUnlimited: true };
  assert.equal(applyPromoToState(max, promo, NOW).state, max);
  const expired = readPromo({ promoUntil: NOW - 1 }, NOW);
  assert.equal(applyPromoToState(FREE, expired, NOW).source, null);
  assert.equal(applyPromoToState(FREE, null, NOW).state, FREE);
});

test("normalizePromoPlan: yalnız premium/unlimited; eksik ve bozuk değer premium sayılır", () => {
  assert.equal(normalizePromoPlan("premium"), "premium");
  assert.equal(normalizePromoPlan("unlimited"), "unlimited");
  for (const bad of [undefined, null, "", "max", "free", "UNLIMITED", 5, {}]) {
    assert.equal(normalizePromoPlan(bad), "premium");
  }
});

test("higherPromoPlan: yüksek olanı seçer, ikinci değer yoksa birincisini döner", () => {
  assert.equal(higherPromoPlan("premium", "unlimited"), "unlimited");
  assert.equal(higherPromoPlan("unlimited", "premium"), "unlimited");
  assert.equal(higherPromoPlan("premium", "premium"), "premium");
  assert.equal(higherPromoPlan("unlimited"), "unlimited");
  assert.equal(higherPromoPlan("unlimited", null), "unlimited");
  assert.equal(higherPromoPlan(undefined, undefined), "premium");
});

test("readPromo: promoPlan okunur; alan yoksa (eski kayıt) premium", () => {
  assert.equal(readPromo({ promoUntil: NOW + 1000 }, NOW).plan, "premium");
  assert.equal(readPromo({ promoUntil: NOW + 1000, promoPlan: "unlimited" }, NOW).plan, "unlimited");
  assert.equal(readPromo({ promoUntil: NOW + 1000, promoPlan: "bozuk" }, NOW).plan, "premium");
});

test("applyPromoToState: Max promosyonu Free'ye Max, Premium aboneliğe karşı Max verir", () => {
  const promo = readPromo({ promoUntil: NOW + DAY_MS, promoPlan: "unlimited" }, NOW);
  const free = applyPromoToState(FREE, promo, NOW);
  assert.equal(free.source, "promo");
  assert.equal(free.state.premiumPlan, "unlimited");
  assert.equal(free.state.premiumUnlimited, true);
  assert.equal(free.state.premium, true);
  // Mağazada Premium varken daha yüksek olan Max promosyonu kazanır.
  const paid = { ...FREE, premium: true, premiumPlan: "premium", productId: "premium_monthly" };
  const upgraded = applyPromoToState(paid, promo, NOW);
  assert.equal(upgraded.source, "promo");
  assert.equal(upgraded.state.premiumPlan, "unlimited");
  // Mağazada Max varsa mağaza kazanır.
  const paidMax = { ...paid, premiumPlan: "unlimited", premiumUnlimited: true };
  assert.equal(applyPromoToState(paidMax, promo, NOW).source, null);
});

test("extendPromoUntil: süren promosyonun üstüne ekler, dolmuşsa şimdiden başlar", () => {
  assert.equal(extendPromoUntil(null, NOW, 30), NOW + 30 * DAY_MS);
  assert.equal(extendPromoUntil(NOW - DAY_MS, NOW, 30), NOW + 30 * DAY_MS);
  assert.equal(extendPromoUntil(NOW + 10 * DAY_MS, NOW, 30), NOW + 40 * DAY_MS);
});

test("hasActiveStoreSubscription: promosyon kaynaklı premium mağaza aboneliği sayılmaz", () => {
  assert.equal(hasActiveStoreSubscription({ premium: true, premiumSource: "revenuecat" }), true);
  assert.equal(hasActiveStoreSubscription({ premium: true, premiumSource: "promo" }), false);
  assert.equal(hasActiveStoreSubscription({ premium: false }), false);
  assert.equal(hasActiveStoreSubscription(undefined), false);
  // Promosyon üste çıktığında da gerçek mağaza aboneliği görünür kalır.
  assert.equal(hasActiveStoreSubscription({ premium: true, premiumSource: "promo", storeSubscribed: true }), true);
  assert.equal(hasActiveStoreSubscription({ premium: true, premiumSource: "promo", storeSubscribed: false }), false);
});

test("evaluatePromoCode: yok / pasif / süresi dolmuş / tükenmiş / uygun", () => {
  assert.equal(evaluatePromoCode(null, NOW).reason, REASONS.NOT_FOUND);
  assert.equal(evaluatePromoCode({ active: false }, NOW).reason, REASONS.INACTIVE);
  assert.equal(evaluatePromoCode({ expiresAt: NOW - 1 }, NOW).reason, REASONS.EXPIRED);
  assert.equal(
    evaluatePromoCode({ maxRedemptions: 3, redeemedCount: 3 }, NOW).reason,
    REASONS.EXHAUSTED,
  );
  // maxRedemptions yazılmamış kod tek kullanımlıktır (güvenli varsayılan).
  assert.equal(evaluatePromoCode({ redeemedCount: 1 }, NOW).reason, REASONS.EXHAUSTED);
  assert.equal(evaluatePromoCode({ maxRedemptions: 5, redeemedCount: 4 }, NOW).ok, true);
  assert.equal(evaluatePromoCode({ expiresAt: { toMillis: () => NOW + 1 } }, NOW).ok, true);
});

test("evaluateReferralRedemption: kurallar sırasıyla", () => {
  const base = {
    ownerUid: "inviter",
    redeemerUid: "me",
    existingReferral: null,
    accountCreatedMs: NOW - 2 * DAY_MS,
    nowMs: NOW,
    purchased: false,
    storeSubscribed: false,
  };
  assert.equal(evaluateReferralRedemption(base).ok, true);
  assert.equal(evaluateReferralRedemption({ ...base, ownerUid: null }).reason, REASONS.NOT_FOUND);
  assert.equal(evaluateReferralRedemption({ ...base, ownerUid: "me" }).reason, REASONS.OWN_CODE);
  assert.equal(
    evaluateReferralRedemption({ ...base, existingReferral: { inviterUid: "x" } }).reason,
    REASONS.ALREADY_REDEEMED,
  );
  assert.equal(
    evaluateReferralRedemption({ ...base, storeSubscribed: true }).reason,
    REASONS.STORE_SUBSCRIBED,
  );
  assert.equal(evaluateReferralRedemption({ ...base, purchased: true }).reason, REASONS.HAS_PURCHASED);
  assert.equal(
    evaluateReferralRedemption({
      ...base,
      accountCreatedMs: NOW - (REFERRAL.REDEEM_WINDOW_DAYS + 1) * DAY_MS,
    }).reason,
    REASONS.WINDOW_CLOSED,
  );
  // Kayıt tarihi bilinmiyorsa pencere uygulanmaz (reddetmek yerine izin verilir).
  assert.equal(evaluateReferralRedemption({ ...base, accountCreatedMs: null }).ok, true);
});

test("isRewardablePurchase: yalnız gerçek ücretli ilk dönem", () => {
  const paid = { type: "INITIAL_PURCHASE", environment: "PRODUCTION", period_type: "NORMAL", price: 1.99 };
  assert.equal(isRewardablePurchase(paid), true);
  assert.equal(isRewardablePurchase({ ...paid, type: "RENEWAL" }), true);
  assert.equal(isRewardablePurchase({ ...paid, type: "CANCELLATION" }), false);
  assert.equal(isRewardablePurchase({ ...paid, environment: "SANDBOX" }), false);
  assert.equal(isRewardablePurchase({ ...paid, period_type: "TRIAL" }), false);
  assert.equal(isRewardablePurchase({ ...paid, price: 0 }), false);
  assert.equal(isRewardablePurchase({ ...paid, price: undefined }), true);
  assert.equal(isRewardablePurchase({ ...paid, price: undefined, price_in_purchased_currency: 0 }), false);
  assert.equal(isRewardablePurchase(null), false);
});

test("planReferralUpdate: abone işareti ve ödül tek seferlik", () => {
  const paid = { type: "INITIAL_PURCHASE", environment: "PRODUCTION", period_type: "NORMAL", price: 1 };
  const fresh = { inviterUid: "inviter" };
  const first = planReferralUpdate({ referral: fresh, event: paid, inviterEarnedMonths: 0, nowMs: NOW });
  assert.deepEqual(first, { patch: { subscribedAt: NOW, rewardedAt: NOW }, reward: true, capped: false });

  // Yenileme ödülü ikinci kez vermez.
  const done = { inviterUid: "inviter", subscribedAt: 1, rewardedAt: 2 };
  assert.equal(planReferralUpdate({ referral: done, event: paid, inviterEarnedMonths: 1, nowMs: NOW }), null);

  // Deneme: abone işaretlenir ama ödül yok; dönüşümde ödül gelir.
  const trial = { ...paid, period_type: "TRIAL" };
  const afterTrial = planReferralUpdate({ referral: fresh, event: trial, inviterEarnedMonths: 0, nowMs: NOW });
  assert.deepEqual(afterTrial, { patch: { subscribedAt: NOW }, reward: false, capped: false });
  const converted = planReferralUpdate({
    referral: { inviterUid: "inviter", subscribedAt: NOW },
    event: { ...paid, type: "RENEWAL" },
    inviterEarnedMonths: 0,
    nowMs: NOW,
  });
  assert.equal(converted.reward, true);

  // İlgisiz olay / davet kaydı yok.
  assert.equal(planReferralUpdate({ referral: fresh, event: { type: "EXPIRATION" }, nowMs: NOW }), null);
  assert.equal(planReferralUpdate({ referral: null, event: paid, nowMs: NOW }), null);
});

test("planReferralUpdate: ödül tavanı dolunca ödül verilmez ama abone işaretlenir", () => {
  const paid = { type: "INITIAL_PURCHASE", environment: "PRODUCTION", price: 1 };
  const result = planReferralUpdate({
    referral: { inviterUid: "inviter" },
    event: paid,
    inviterEarnedMonths: REFERRAL.MAX_REWARD_MONTHS,
    nowMs: NOW,
  });
  assert.deepEqual(result, { patch: { subscribedAt: NOW }, reward: false, capped: true });
});

test("inviteeDiscountFor / inviteeStatus", () => {
  assert.deepEqual(inviteeDiscountFor({ inviterUid: "a" }), {
    percent: 30,
    offerId: "referral-30-1m",
  });
  assert.equal(inviteeDiscountFor({ inviterUid: "a", subscribedAt: 1 }), null);
  assert.equal(inviteeDiscountFor(null), null);
  assert.equal(inviteeStatus({}), "registered");
  assert.equal(inviteeStatus({ subscribedAt: 1 }), "subscribed");
  assert.equal(inviteeStatus({ subscribedAt: 1, rewardedAt: 2 }), "rewarded");
});

test("checkAttemptBudget: gün değişince sıfırlanır, tavanda durur", () => {
  assert.deepEqual(checkAttemptBudget(undefined, "d1"), {
    allowed: true,
    next: { day: "d1", count: 1 },
  });
  const full = { day: "d1", count: REFERRAL.MAX_ATTEMPTS_PER_DAY };
  assert.equal(checkAttemptBudget(full, "d1").allowed, false);
  assert.equal(checkAttemptBudget(full, "d2").allowed, true);
  assert.equal(checkAttemptBudget(full, "d2").next.count, 1);
});
