const test = require("node:test");
const assert = require("node:assert/strict");
const { isBetaActive, needsBetaGrant, betaGrantUntilMs, shouldRevokeBetaGrant, BETA_ACCESS } = require("./betaAccess");

const NOW = Date.UTC(2026, 10, 10);
const CFG = { open: true, untilMs: Date.UTC(2027, 1, 1), plan: "unlimited" };
const FREE = { premium: false, premiumUnlimited: false, premiumPlan: "free" };

test("varsayılan beta 1 Şubat 2027'ye kadar açık", () => {
  assert.equal(BETA_ACCESS.open, true);
  assert.equal(new Date(BETA_ACCESS.untilMs).toISOString().slice(0, 10), "2027-02-01");
});

test("kapalı ya da tarihi geçmiş beta aktif değil", () => {
  assert.equal(isBetaActive(CFG, NOW), true);
  assert.equal(isBetaActive({ ...CFG, open: false }, NOW), false);
  assert.equal(isBetaActive(CFG, CFG.untilMs + 1), false);
});

test("Free hesaba verilir, mağaza Max'ine ve zaten tam promosyonuna verilmez", () => {
  assert.equal(needsBetaGrant(FREE, CFG, NOW), true);
  assert.equal(needsBetaGrant(undefined, CFG, NOW), true);
  assert.equal(
    needsBetaGrant({ premium: true, premiumPlan: "unlimited", premiumUnlimited: true, premiumSource: "revenuecat" }, CFG, NOW),
    false,
  );
  assert.equal(
    needsBetaGrant(
      { premium: true, premiumPlan: "unlimited", premiumSource: "promo", promoPlan: "unlimited", promoUntil: CFG.untilMs },
      CFG,
      NOW,
    ),
    false,
  );
});

test("Premium mağaza aboneliği ve Premium promosyon Max'e yükseltilir", () => {
  assert.equal(needsBetaGrant({ premium: true, premiumPlan: "premium", premiumSource: "revenuecat" }, CFG, NOW), true);
  assert.equal(
    needsBetaGrant({ premium: true, premiumPlan: "premium", promoPlan: "premium", promoUntil: CFG.untilMs, premiumSource: "promo" }, CFG, NOW),
    true,
  );
});

test("bitiş: daha uzun süren promosyon korunur", () => {
  assert.equal(betaGrantUntilMs(FREE, CFG, NOW), CFG.untilMs);
  const longer = CFG.untilMs + 86400000 * 30;
  assert.equal(betaGrantUntilMs({ promoUntil: longer, promoPlan: "premium" }, CFG, NOW), longer);
});

test("geri alma yalnız betanın yazdığı bitiş aynıysa", () => {
  const grant = { untilMs: CFG.untilMs };
  assert.equal(shouldRevokeBetaGrant(grant, { promoUntil: CFG.untilMs }, NOW), true);
  assert.equal(shouldRevokeBetaGrant(grant, { promoUntil: CFG.untilMs + 1000 }, NOW), false);
  assert.equal(shouldRevokeBetaGrant(grant, {}, NOW), false);
});
