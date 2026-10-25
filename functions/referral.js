"use strict";

// Arkadaş daveti + promosyon kodu — SAF mantık (Firestore/ağ yok, testlenebilir).
// Okuma/yazma ve callable'lar functions/index.js'te; kararların hepsi burada.
//
// Veri modeli (hepsi YALNIZ sunucu yazar/okur — firestore.rules'ta kapalı):
//   • ReferralCodes/{KOD}          { ownerUid }          kullanıcının davet kodu
//   • ReferralAccounts/{uid}       { code, creditMonths, earnedMonths, referredBy,
//                                    attempts }          kullanıcının davet hesabı
//   • Referrals/{davetliUid}       { inviterUid, code, createdAt, subscribedAt,
//                                    rewardedAt }        davet kaydı (davetli başına TEK)
//   • PromoCodes/{KOD}             { days, plan, maxRedemptions, redeemedCount,
//                                    expiresAt, active, note }   yönetici kodları
//   • PromoCodes/{KOD}/redemptions/{uid}  { redeemedAt }
//
// Ücretsiz ay (davet ödülü ya da promosyon kodu) mağaza aboneliği DEĞİLDİR: plan
// Users/{uid}.entitlements'a `promoUntil` ile yazılır. RevenueCat webhook'u o belgeyi her
// olayda yeniden yazdığı için etkin plan = max(RevenueCat planı, süren promosyon)
// (`applyPromoToState`); süresi dolanı saatlik süpürme temizler.

const DAY_MS = 24 * 60 * 60 * 1000;

const REFERRAL = Object.freeze({
  // Davet eden: davetlinin ilk ücretli satın alımında kazandığı ücretsiz süre.
  REWARD_DAYS: 30,
  // Bir kullanıcının davetle kazanabileceği toplam ay (kötüye kullanım tavanı).
  MAX_REWARD_MONTHS: 12,
  // Davetli kodu hesabı açtıktan en geç bu kadar gün içinde girebilir.
  REDEEM_WINDOW_DAYS: 14,
  // Davetlinin ilk ay indirimi: mağazada tanımlı teklifin kimliği + gösterilen oran.
  // Mağaza panelinde (Play teklifi / App Store promosyon teklifi) AYNI kimlikle
  // açılmadıkça indirim uygulanmaz; bkz. docs/kurulum/ARKADAS_DAVETI_KURULUM.md.
  INVITEE_DISCOUNT_PERCENT: 30,
  INVITEE_OFFER_ID: "referral-30-1m",
  // Yanlış kod denemesi tavanı (kod tahmin etmeyi pahalılaştırır).
  MAX_ATTEMPTS_PER_DAY: 10,
});

const PROMO_DEFAULT_DAYS = 30;
const PROMO_PLAN = "premium";

// 0/O ve 1/I/L karışmasın: kod elle yazılıyor.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const REFERRAL_CODE_LENGTH = 8;

const PLAN_RANK = Object.freeze({ free: 0, premium: 1, unlimited: 2 });

const REASONS = Object.freeze({
  NOT_FOUND: "code-not-found",
  EXHAUSTED: "code-exhausted",
  EXPIRED: "code-expired",
  INACTIVE: "code-inactive",
  ALREADY_REDEEMED: "already-redeemed",
  OWN_CODE: "own-code",
  WINDOW_CLOSED: "window-closed",
  HAS_PURCHASED: "already-purchased",
  STORE_SUBSCRIBED: "store-subscription-active",
  RATE_LIMITED: "rate-limited",
  NO_CREDIT: "no-credit",
  CAP_REACHED: "reward-cap-reached",
});

/** Kullanıcının yazdığı kodu karşılaştırılabilir biçime çevirir; geçersizse null. */
function normalizeCode(raw) {
  if (typeof raw !== "string") return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, "");
  if (!/^[A-Z0-9]{4,24}$/.test(code)) return null;
  return code;
}

/** "ABCD-EFGH" biçimi (yalnız gösterim; saklanan kod tiresizdir). */
function formatCodeForDisplay(code) {
  if (typeof code !== "string") return "";
  return code.length === REFERRAL_CODE_LENGTH
    ? `${code.slice(0, 4)}-${code.slice(4)}`
    : code;
}

/** `randomInt(max)` verilen kaynaktan 8 karakterlik kod üretir. */
function generateReferralCode(randomInt) {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function planRank(plan) {
  return PLAN_RANK[plan] ?? 0;
}

// Promosyonun verebildiği planlar. "unlimited" = Premium Max (uygulamadaki adı). Bilinmeyen/eksik
// değer "premium" sayılır: `promoPlan` alanı bu özellikten ÖNCE yazılan kayıtlarda yoktur.
const PROMO_PLANS = Object.freeze(["premium", "unlimited"]);

function normalizePromoPlan(plan) {
  return PROMO_PLANS.includes(plan) ? plan : PROMO_PLAN;
}

/** İki promosyon planından yüksek olanı (biri yoksa öteki). */
function higherPromoPlan(a, b) {
  const first = normalizePromoPlan(a);
  if (b === undefined || b === null) return first;
  const second = normalizePromoPlan(b);
  return planRank(second) > planRank(first) ? second : first;
}

/** Süren promosyon varsa {untilMs, plan}, yoksa null. `promoUntil` Timestamp ya da ms. */
function readPromo(entitlements, nowMs) {
  const raw = entitlements?.promoUntil;
  const untilMs =
    typeof raw?.toMillis === "function"
      ? raw.toMillis()
      : Number.isFinite(raw)
        ? raw
        : null;
  if (!Number.isFinite(untilMs)) return null;
  return {
    untilMs,
    plan: normalizePromoPlan(entitlements?.promoPlan),
    active: untilMs > nowMs,
  };
}

/**
 * RevenueCat durumuna süren promosyonu uygular: etkin plan ikisinin YÜKSEĞİ.
 * Mağaza planı promosyondan yüksek ya da eşitse mağaza kazanır (kaynak
 * "revenuecat" kalır, promosyon yalnız bekler); yoksa kaynak "promo" olur.
 *
 * @returns {{state: object, source: "promo"|null}}
 */
function applyPromoToState(state, promo, nowMs) {
  if (!promo || !(promo.untilMs > nowMs)) return { state, source: null };
  if (planRank(state.premiumPlan) >= planRank(promo.plan)) {
    return { state, source: null };
  }
  return {
    state: {
      ...state,
      premium: true,
      premiumUnlimited: promo.plan === "unlimited",
      premiumPlan: promo.plan,
      // Mağaza ayrıntıları gerçek abonelikten kalmadığı için boşaltılır.
      productId: null,
      expiresAt: new Date(promo.untilMs),
    },
    source: "promo",
  };
}

/** Mevcut bitişten (ya da şimdiden, hangisi ileriyse) `days` gün ileri. */
function extendPromoUntil(currentUntilMs, nowMs, days) {
  const base = Number.isFinite(currentUntilMs) && currentUntilMs > nowMs
    ? currentUntilMs
    : nowMs;
  return base + days * DAY_MS;
}

/**
 * Aktif mağaza aboneliği var mı? (promosyon kaynaklı premium sayılmaz)
 * `storeSubscribed`, RevenueCat'in gördüğü gerçek durumdur: daha yüksek bir
 * promosyon planı üste çıkıp `premiumSource`'u "promo" yaptığında da abonelik
 * görünür kalır (yoksa ödeme yapan kullanıcı promosyon kapılarından geçerdi).
 */
function hasActiveStoreSubscription(entitlements) {
  if (entitlements?.storeSubscribed === true) return true;
  return (
    entitlements?.premium === true && entitlements?.premiumSource !== "promo"
  );
}

/** Promosyon kodu belgesini şimdi kullanılabilir mi diye değerlendirir. */
function evaluatePromoCode(promo, nowMs) {
  if (!promo) return { ok: false, reason: REASONS.NOT_FOUND };
  if (promo.active === false) return { ok: false, reason: REASONS.INACTIVE };
  const expiresMs =
    typeof promo.expiresAt?.toMillis === "function"
      ? promo.expiresAt.toMillis()
      : Number.isFinite(promo.expiresAt)
        ? promo.expiresAt
        : null;
  if (expiresMs !== null && expiresMs <= nowMs) {
    return { ok: false, reason: REASONS.EXPIRED };
  }
  const max = Number.isFinite(promo.maxRedemptions) ? promo.maxRedemptions : 1;
  const used = Number.isFinite(promo.redeemedCount) ? promo.redeemedCount : 0;
  if (used >= max) return { ok: false, reason: REASONS.EXHAUSTED };
  return { ok: true };
}

/**
 * Davet kodunu girmeye çalışan kullanıcı için kural denetimi.
 * `account*` alanları Auth kaydından gelir (kayıt tarihi), `purchased` private/
 * entitlements'ta ürün kaydı olup olmadığıdır.
 */
function evaluateReferralRedemption({
  ownerUid,
  redeemerUid,
  existingReferral,
  accountCreatedMs,
  nowMs,
  purchased,
  storeSubscribed,
}) {
  if (!ownerUid) return { ok: false, reason: REASONS.NOT_FOUND };
  if (ownerUid === redeemerUid) return { ok: false, reason: REASONS.OWN_CODE };
  if (existingReferral) return { ok: false, reason: REASONS.ALREADY_REDEEMED };
  if (storeSubscribed) return { ok: false, reason: REASONS.STORE_SUBSCRIBED };
  if (purchased) return { ok: false, reason: REASONS.HAS_PURCHASED };
  if (
    Number.isFinite(accountCreatedMs) &&
    nowMs - accountCreatedMs > REFERRAL.REDEEM_WINDOW_DAYS * DAY_MS
  ) {
    return { ok: false, reason: REASONS.WINDOW_CLOSED };
  }
  return { ok: true };
}

/**
 * Bu RevenueCat olayı davet edene ödül kazandırır mı?
 * Yalnız GERÇEK, ÜCRETLİ ilk dönem: deneme (TRIAL), sandbox ve 0 fiyatlı
 * (promosyon/ücretsiz) satın alma sayılmaz; yoksa test hesaplarıyla ödül
 * üretilirdi. Fiyat alanı hiç yoksa ücretli kabul edilir (RevenueCat mağazaya göre
 * bazen göndermez); sıfır AÇIKÇA yazılıysa sayılmaz.
 */
function isRewardablePurchase(event) {
  if (!event || typeof event !== "object") return false;
  if (event.type !== "INITIAL_PURCHASE" && event.type !== "RENEWAL") return false;
  if (event.environment === "SANDBOX") return false;
  if (event.period_type === "TRIAL") return false;
  const price = event.price_in_purchased_currency ?? event.price;
  if (typeof price === "number" && price <= 0) return false;
  return true;
}

/** Olay aboneliğin başladığını gösterir mi? ("abone oldu" işareti için; deneme dahil) */
function isSubscriptionStartEvent(event) {
  return (
    Boolean(event) &&
    (event.type === "INITIAL_PURCHASE" || event.type === "RENEWAL") &&
    event.environment !== "SANDBOX"
  );
}

/**
 * Bir davet kaydı + olaydan, kaydın nasıl değişeceğini ve davet edene ödül
 * verilip verilmeyeceğini hesaplar. `inviterEarnedMonths` ödül tavanı içindir.
 */
function planReferralUpdate({ referral, event, inviterEarnedMonths, nowMs }) {
  if (!referral || !referral.inviterUid) return null;
  const patch = {};
  if (!referral.subscribedAt && isSubscriptionStartEvent(event)) {
    patch.subscribedAt = nowMs;
  }
  let reward = false;
  let capped = false;
  if (!referral.rewardedAt && isRewardablePurchase(event)) {
    if ((inviterEarnedMonths || 0) >= REFERRAL.MAX_REWARD_MONTHS) {
      capped = true;
    } else {
      patch.rewardedAt = nowMs;
      reward = true;
    }
  }
  if (!Object.keys(patch).length) return null;
  return { patch, reward, capped };
}

/** Davetlinin indirim hakkı: kodu girdi, henüz abone olmadı. */
function inviteeDiscountFor(referral) {
  if (!referral || referral.subscribedAt) return null;
  return {
    percent: REFERRAL.INVITEE_DISCOUNT_PERCENT,
    offerId: REFERRAL.INVITEE_OFFER_ID,
  };
}

/** Davet edenin listesinde bir davetlinin durumu. */
function inviteeStatus(referral) {
  if (referral.rewardedAt) return "rewarded";
  if (referral.subscribedAt) return "subscribed";
  return "registered";
}

/**
 * Günlük yanlış deneme sayacı. `attempts` = { day: "2026-10-19", count }.
 * Şimdi denenebilir mi, ve başarısız denemeden sonraki sayaç.
 */
function checkAttemptBudget(attempts, dayKey) {
  const count = attempts?.day === dayKey ? attempts.count || 0 : 0;
  return {
    allowed: count < REFERRAL.MAX_ATTEMPTS_PER_DAY,
    next: { day: dayKey, count: count + 1 },
  };
}

module.exports = {
  DAY_MS,
  REFERRAL,
  REASONS,
  PROMO_DEFAULT_DAYS,
  PROMO_PLAN,
  PROMO_PLANS,
  CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  normalizePromoPlan,
  higherPromoPlan,
  normalizeCode,
  formatCodeForDisplay,
  generateReferralCode,
  readPromo,
  applyPromoToState,
  extendPromoUntil,
  hasActiveStoreSubscription,
  evaluatePromoCode,
  evaluateReferralRedemption,
  isRewardablePurchase,
  isSubscriptionStartEvent,
  planReferralUpdate,
  inviteeDiscountFor,
  inviteeStatus,
  checkAttemptBudget,
};
