// Davet + promosyon kodu — GERÇEK Firestore (emülatör) üzerinde uçtan uca.
//
// `npm test` içinde ATLANIR (emülatör yoksa); çalıştırmak için kökten:
//   export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" PATH="$JAVA_HOME/bin:$PATH"
//   npx firebase emulators:exec --only firestore --project demo-referral \
//     "node --test functions/referral.integration.test.js"
//
// Neyi kanıtlar: transaction'ların gerçekten çalıştığı (sayaçlar, tek kullanım, tavan),
// webhook'un promosyonu SİLMEDİĞİ, ödülün tekrar eden olayda iki kez verilmediği ve
// süpürmenin dolan ayı temizlediği. Saf kurallar referral.test.js'te.

const test = require("node:test");
const assert = require("node:assert/strict");

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const skip = emulator ? false : "FIRESTORE_EMULATOR_HOST yok (emülatör gerekir)";

if (!skip) {
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-referral";
  process.env.REVENUECAT_WEBHOOK_AUTH = "test-secret";
  process.env.REVENUECAT_SECRET_API_KEY = "test-key";
}

const DAY = 24 * 60 * 60 * 1000;
const ENTITLEMENT = "com.smlztrk.seelogd Pro";

let fns;
let db;
let FieldValue;
let revenueCatState = null;

function setRevenueCat(state) {
  // RevenueCat REST cevabının yalnız kullanılan kısmı.
  revenueCatState = state;
}

test.before(async () => {
  if (skip) return;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      subscriber: {
        entitlements: revenueCatState
          ? {
              [ENTITLEMENT]: {
                product_identifier: revenueCatState.productId,
                expires_date: new Date(Date.now() + 20 * DAY).toISOString(),
              },
            }
          : {},
        subscriptions: {},
      },
    }),
  });
  fns = require("./index");
  const firestore = require("firebase-admin/firestore");
  db = firestore.getFirestore();
  FieldValue = firestore.FieldValue;
});

async function resetData() {
  for (const name of [
    "Users",
    "ReferralCodes",
    "ReferralAccounts",
    "Referrals",
    "PromoCodes",
    "RevenueCatWebhookEvents",
  ]) {
    await db.recursiveDelete(db.collection(name));
  }
  setRevenueCat(null);
}

const mkUser = (uid, extra = {}) =>
  db.doc(`Users/${uid}`).set({ displayName: `Kisi ${uid}`, username: uid, avatarIndex: 1, ...extra });

const call = (fn, uid, data = {}) => fn.run({ auth: { uid }, data });

async function reasonOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error.details?.reason || error.message;
  }
  return null;
}

async function webhook(event) {
  // onRequest işleyicisi express benzeri req/res bekler (res.on("finish") dahil).
  const { EventEmitter } = require("node:events");
  const req = Object.assign(new EventEmitter(), {
    method: "POST",
    get: (name) => (name.toLowerCase() === "authorization" ? "Bearer test-secret" : undefined),
    body: { event },
  });
  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });
  const res = Object.assign(new EventEmitter(), {
    code: 200,
    body: null,
    set() {
      return this;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      finish();
    },
    send(body) {
      this.body = body;
      finish();
    },
  });
  // onRequest işleyicisi doğrudan çağrılabilir (callable gibi .run yok).
  await fns.revenueCatWebhook(req, res);
  await done;
  return res;
}

const purchase = (id, uid, extra = {}) => ({
  id,
  type: "INITIAL_PURCHASE",
  app_user_id: uid,
  entitlement_ids: [ENTITLEMENT],
  environment: "PRODUCTION",
  period_type: "NORMAL",
  price: 1.99,
  store: "PLAY_STORE",
  ...extra,
});

test("davet kodu üretilir, ikinci çağrıda aynı kod döner", { skip }, async () => {
  await resetData();
  await mkUser("inviter");
  const first = await call(fns.getReferralOverview, "inviter");
  const second = await call(fns.getReferralOverview, "inviter");
  assert.match(first.code, /^[A-Z2-9]{8}$/);
  assert.equal(second.code, first.code);
  assert.equal(first.displayCode, `${first.code.slice(0, 4)}-${first.code.slice(4)}`);
  assert.equal((await db.doc(`ReferralCodes/${first.code}`).get()).get("ownerUid"), "inviter");
  assert.equal(first.invitees.length, 0);
  assert.equal(first.invitedBy, null);
});

test("promosyon kodu: kişi sınırı, hesap başına tek kullanım, plan ve sayaç", { skip }, async () => {
  await resetData();
  await db.doc("PromoCodes/FREEMNTH").set({
    days: 30,
    maxRedemptions: 2,
    redeemedCount: 0,
    active: true,
  });
  for (const uid of ["u1", "u2", "u3"]) await mkUser(uid);

  const before = Date.now();
  const result = await call(fns.redeemCode, "u1", { code: "free-mnth" }); // küçük harf + tire
  assert.equal(result.kind, "promo");
  assert.ok(result.untilMs >= before + 30 * DAY - 5000);

  const entitlements = (await db.doc("Users/u1").get()).get("entitlements");
  assert.equal(entitlements.premium, true);
  assert.equal(entitlements.premiumPlan, "premium");
  assert.equal(entitlements.premiumSource, "promo");
  assert.equal(entitlements.promoUntil.toMillis(), result.untilMs);
  assert.equal((await db.doc("PromoCodes/FREEMNTH").get()).get("redeemedCount"), 1);

  // Aynı hesap ikinci kez kullanamaz ve sayaç artmaz.
  assert.equal(await reasonOf(call(fns.redeemCode, "u1", { code: "FREEMNTH" })), "already-redeemed");
  assert.equal((await db.doc("PromoCodes/FREEMNTH").get()).get("redeemedCount"), 1);

  await call(fns.redeemCode, "u2", { code: "FREEMNTH" });
  // Sınır doldu: üçüncü kişi alamaz, plan değişmez.
  assert.equal(await reasonOf(call(fns.redeemCode, "u3", { code: "FREEMNTH" })), "code-exhausted");
  assert.equal((await db.doc("PromoCodes/FREEMNTH").get()).get("redeemedCount"), 2);
  assert.equal((await db.doc("Users/u3").get()).get("entitlements"), undefined);
});

test("promosyon kodu: yok, pasif, süresi dolmuş, mağaza aboneliği varken", { skip }, async () => {
  await resetData();
  await db.doc("PromoCodes/PASIFKOD").set({ days: 30, maxRedemptions: 5, redeemedCount: 0, active: false });
  await db.doc("PromoCodes/ESKIKOD1").set({
    days: 30,
    maxRedemptions: 5,
    redeemedCount: 0,
    active: true,
    expiresAt: new Date(Date.now() - DAY),
  });
  await db.doc("PromoCodes/ACIKKOD1").set({ days: 30, maxRedemptions: 5, redeemedCount: 0, active: true });
  await mkUser("a");
  await mkUser("paid", { entitlements: { premium: true, premiumPlan: "premium", premiumSource: "revenuecat" } });

  assert.equal(await reasonOf(call(fns.redeemCode, "a", { code: "YOKBOYLEKOD" })), "code-not-found");
  assert.equal(await reasonOf(call(fns.redeemCode, "a", { code: "PASIFKOD" })), "code-inactive");
  assert.equal(await reasonOf(call(fns.redeemCode, "a", { code: "ESKIKOD1" })), "code-expired");
  assert.equal(await reasonOf(call(fns.redeemCode, "a", { code: "!" })), "code-not-found");
  assert.equal(await reasonOf(call(fns.redeemCode, "paid", { code: "ACIKKOD1" })), "store-subscription-active");
  // Reddedilen denemelerde sayaç artmamalı.
  assert.equal((await db.doc("PromoCodes/ACIKKOD1").get()).get("redeemedCount"), 0);
});

test("yanlış kod denemesi günlük tavana takılır", { skip }, async () => {
  await resetData();
  await mkUser("guesser");
  for (let i = 0; i < 10; i += 1) {
    assert.equal(await reasonOf(call(fns.redeemCode, "guesser", { code: `YANLIS${i}XX` })), "code-not-found");
  }
  assert.equal(await reasonOf(call(fns.redeemCode, "guesser", { code: "YANLISSON" })), "rate-limited");
});

test("davet: kod girişi, kurallar ve iki tarafın ekranı", { skip }, async () => {
  await resetData();
  await mkUser("inviter");
  await mkUser("friend");
  await mkUser("late");
  const { code } = await call(fns.getReferralOverview, "inviter");

  assert.equal(await reasonOf(call(fns.redeemCode, "inviter", { code })), "own-code");

  const redeemed = await call(fns.redeemCode, "friend", { code });
  assert.equal(redeemed.kind, "referral");
  assert.equal(redeemed.inviterName, "Kisi inviter");
  assert.deepEqual(redeemed.discount, { percent: 30, offerId: "referral-30-1m" });
  // Davetli başına tek kayıt: ikinci kod (kendi kodu da olsa) reddedilir.
  assert.equal(await reasonOf(call(fns.redeemCode, "friend", { code })), "already-redeemed");

  const inviterView = await call(fns.getReferralOverview, "inviter");
  assert.equal(inviterView.invitees.length, 1);
  assert.equal(inviterView.invitees[0].uid, "friend");
  assert.equal(inviterView.invitees[0].status, "registered");
  assert.deepEqual(inviterView.counts, { registered: 1, subscribed: 0, rewarded: 0 });

  const friendView = await call(fns.getReferralOverview, "friend");
  assert.equal(friendView.invitedBy.name, "Kisi inviter");
  assert.equal(friendView.invitedBy.discount.percent, 30);

  // Satın alma geçmişi olan kullanıcı davet indirimi alamaz.
  await db.doc("Users/late/private/entitlements").set({ productId: "premium_monthly" });
  assert.equal(await reasonOf(call(fns.redeemCode, "late", { code })), "already-purchased");
});

test("webhook: abone işareti + davet edene TEK ödül, olay tekrarında ve yenilemede yok", { skip }, async () => {
  await resetData();
  await mkUser("inviter");
  await mkUser("friend");
  const { code } = await call(fns.getReferralOverview, "inviter");
  await call(fns.redeemCode, "friend", { code });

  setRevenueCat({ productId: "premium_monthly" });
  const res = await webhook(purchase("evt-1", "friend"));
  assert.equal(res.code, 200);

  const referral = await db.doc("Referrals/friend").get();
  assert.ok(referral.get("subscribedAt"));
  assert.ok(referral.get("rewardedAt"));
  assert.equal((await db.doc("ReferralAccounts/inviter").get()).get("creditMonths"), 1);
  assert.equal((await db.doc("Users/friend").get()).get("entitlements.premiumSource"), "revenuecat");

  // Aynı olay tekrar gelirse (RevenueCat yeniden dener) ödül ikilenmez.
  const replay = await webhook(purchase("evt-1", "friend"));
  assert.equal(replay.body.duplicate, true);
  // Sonraki dönemin yenilemesi de yeni ödül değildir.
  await webhook(purchase("evt-2", "friend", { type: "RENEWAL" }));
  const account = await db.doc("ReferralAccounts/inviter").get();
  assert.equal(account.get("creditMonths"), 1);
  assert.equal(account.get("earnedMonths"), 1);

  const view = await call(fns.getReferralOverview, "inviter");
  assert.equal(view.invitees[0].status, "rewarded");
  assert.equal(view.creditMonths, 1);
  // İndirim hakkı abone olunca kapanır.
  assert.equal((await call(fns.getReferralOverview, "friend")).invitedBy.discount, null);
});

test("webhook: deneme ve sandbox satın alması ödül vermez", { skip }, async () => {
  await resetData();
  await mkUser("inviter");
  await mkUser("friend");
  await mkUser("friend2");
  const { code } = await call(fns.getReferralOverview, "inviter");
  await call(fns.redeemCode, "friend", { code });
  await call(fns.redeemCode, "friend2", { code });

  setRevenueCat({ productId: "premium_monthly" });
  await webhook(purchase("evt-t", "friend", { period_type: "TRIAL" }));
  await webhook(purchase("evt-s", "friend2", { environment: "SANDBOX" }));
  assert.equal((await db.doc("ReferralAccounts/inviter").get()).get("creditMonths") || 0, 0);
  // Deneme "abone oldu" sayılır; sandbox hiç sayılmaz.
  assert.ok((await db.doc("Referrals/friend").get()).get("subscribedAt"));
  assert.equal((await db.doc("Referrals/friend").get()).get("rewardedAt"), null);
  assert.equal((await db.doc("Referrals/friend2").get()).get("subscribedAt"), null);
  // Denemenin ücretliye dönüşü (RENEWAL) ödülü verir.
  await webhook(purchase("evt-r", "friend", { type: "RENEWAL" }));
  assert.equal((await db.doc("ReferralAccounts/inviter").get()).get("creditMonths"), 1);
});

test("ödül tavanı: MAX_REWARD_MONTHS dolunca yeni ödül yazılmaz", { skip }, async () => {
  await resetData();
  await mkUser("inviter");
  await mkUser("friend");
  const { code } = await call(fns.getReferralOverview, "inviter");
  await db.doc("ReferralAccounts/inviter").set({ earnedMonths: 12, creditMonths: 0 }, { merge: true });
  await call(fns.redeemCode, "friend", { code });
  setRevenueCat({ productId: "premium_monthly" });
  await webhook(purchase("evt-cap", "friend"));
  const account = await db.doc("ReferralAccounts/inviter").get();
  assert.equal(account.get("creditMonths"), 0);
  assert.equal(account.get("earnedMonths"), 12);
  assert.ok((await db.doc("Referrals/friend").get()).get("subscribedAt"));
});

test("ödülü başlat: 1 ay açılır, ikinci kez başlatılamaz, webhook ayı SİLMEZ", { skip }, async () => {
  await resetData();
  await mkUser("inviter");
  await db.doc("ReferralAccounts/inviter").set({ code: "CODEXXXX", creditMonths: 1, earnedMonths: 1 });

  assert.equal(await reasonOf(call(fns.claimReferralReward, "nobody")), "Profile required");

  const before = Date.now();
  const { untilMs } = await call(fns.claimReferralReward, "inviter");
  assert.ok(untilMs >= before + 30 * DAY - 5000 && untilMs <= Date.now() + 30 * DAY + 5000);
  assert.equal((await db.doc("ReferralAccounts/inviter").get()).get("creditMonths"), 0);
  assert.equal(await reasonOf(call(fns.claimReferralReward, "inviter")), "no-credit");

  const ent = (await db.doc("Users/inviter").get()).get("entitlements");
  assert.equal(ent.premium, true);
  assert.equal(ent.premiumSource, "promo");

  // KRİTİK: mağazada abonelik yok (RevenueCat free). Bu olay entitlements'ı yeniden yazar;
  // ücretsiz ay yine de ayakta kalmalı.
  setRevenueCat(null);
  await webhook({
    id: "evt-exp",
    type: "EXPIRATION",
    app_user_id: "inviter",
    entitlement_ids: [ENTITLEMENT],
  });
  const after = (await db.doc("Users/inviter").get()).get("entitlements");
  assert.equal(after.premium, true);
  assert.equal(after.premiumSource, "promo");
  assert.equal(after.promoUntil.toMillis(), untilMs);

  // Ödül açıkken ikinci ay, açık ayın ÜSTÜNE eklenir.
  await db.doc("ReferralAccounts/inviter").set({ creditMonths: 1 }, { merge: true });
  const second = await call(fns.claimReferralReward, "inviter");
  assert.equal(second.untilMs, untilMs + 30 * DAY);
});

test("mağaza aboneliği sürerken ödül başlatılamaz", { skip }, async () => {
  await resetData();
  await mkUser("payer", { entitlements: { premium: true, premiumPlan: "premium", premiumSource: "revenuecat" } });
  await db.doc("ReferralAccounts/payer").set({ creditMonths: 1 });
  assert.equal(await reasonOf(call(fns.claimReferralReward, "payer")), "store-subscription-active");
  assert.equal((await db.doc("ReferralAccounts/payer").get()).get("creditMonths"), 1);
});

test("mağaza planı promosyondan yüksekse mağaza kazanır, promosyon bekler", { skip }, async () => {
  await resetData();
  await mkUser("maxer");
  await db.doc("Users/maxer").set(
    { entitlements: { promoUntil: new Date(Date.now() + 10 * DAY), premiumSource: "promo", premium: true } },
    { merge: true },
  );
  setRevenueCat({ productId: "max_monthly" });
  await webhook(purchase("evt-max", "maxer"));
  const ent = (await db.doc("Users/maxer").get()).get("entitlements");
  assert.equal(ent.premiumPlan, "unlimited");
  assert.equal(ent.premiumSource, "revenuecat");
  assert.ok(ent.promoUntil, "bekleyen promosyon silinmemeli");
});

test("süpürme: dolan ücretsiz ay temizlenir, plan Free'ye döner", { skip }, async () => {
  await resetData();
  await mkUser("expired", {
    entitlements: {
      premium: true,
      premiumPlan: "premium",
      premiumSource: "promo",
      promoUntil: new Date(Date.now() - 60 * 1000),
    },
  });
  await mkUser("active", {
    entitlements: {
      premium: true,
      premiumPlan: "premium",
      premiumSource: "promo",
      promoUntil: new Date(Date.now() + DAY),
    },
  });
  setRevenueCat(null);
  await fns.expirePromoGrants.run();
  const expired = (await db.doc("Users/expired").get()).get("entitlements");
  assert.equal(expired.premium, false);
  assert.equal(expired.premiumPlan, "free");
  assert.equal(expired.promoUntil, undefined);
  const active = (await db.doc("Users/active").get()).get("entitlements");
  assert.equal(active.premium, true);
  assert.ok(active.promoUntil);
});

test("hesap silinince davet verisi temizlenir", { skip }, async () => {
  await resetData();
  await mkUser("inviter");
  await mkUser("friend");
  const { code } = await call(fns.getReferralOverview, "inviter");
  await call(fns.redeemCode, "friend", { code });
  await fns.cleanupReferralOnUserDeleted.run({ params: { uid: "inviter" }, data: {} });
  assert.equal((await db.doc(`ReferralCodes/${code}`).get()).exists, false);
  assert.equal((await db.doc("ReferralAccounts/inviter").get()).exists, false);
  assert.equal((await db.doc("Referrals/friend").get()).exists, false);
});

test.after(() => {
  // index.js açık kalan gRPC bağlantıları süreci tutmasın.
  setTimeout(() => process.exit(process.exitCode || 0), 200).unref();
});
