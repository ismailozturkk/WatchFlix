// Callable sözleşme testleri (T2.3) — GERÇEK Firestore (emülatör) üzerinde.
// Dış servisler (Gemini, OMDb, Google tokeninfo, RevenueCat) global.fetch ile taklit
// edilir; gerçek anahtar kullanılmaz.
//
// Kökten çalıştırma (referral/accountPurge testleriyle birlikte, SIRAYLA):
//   npx firebase emulators:exec --only firestore,auth --project demo-callables \
//     "cd functions && node --test --test-concurrency=1 *.integration.test.js"
//
// Neyi kanıtlar: oturumsuz çağrıların reddi, girdi doğrulama, taze kimlik şartı,
// AI kotasının SUNUCUDA ve eşzamanlı çağrıda da aşılamaması, OMDb önbellek ve hız
// sınırı, Google kimlik doğrulaması, abonelik eşitlemenin kısma ve hata yolları.

const test = require("node:test");
const assert = require("node:assert/strict");

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const skip = emulator ? false : "FIRESTORE_EMULATOR_HOST yok (emülatör gerekir)";

if (!skip) {
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-callables";
  process.env.REVENUECAT_WEBHOOK_AUTH = "test-secret";
  process.env.REVENUECAT_SECRET_API_KEY = "test-key";
  process.env.GEMINI_API_KEY = "test-gemini";
  process.env.OMDB_API_KEY = "test-omdb";
}

const ENTITLEMENT = "com.smlztrk.seelogd Pro";
const calls = { gemini: 0, omdb: 0, tokeninfo: 0, revenuecat: 0 };
const fake = { omdb: null, tokeninfo: null, revenuecat: null, gemini: null };
const geminiUrls = [];

let fns;
let db;

const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });

test.before(async () => {
  if (skip) return;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("generativelanguage.googleapis.com")) {
      calls.gemini += 1;
      geminiUrls.push(u);
      // fake.gemini: sırayla dönülecek yanıtlar ("503" | "empty" | undefined=başarılı)
      const step = Array.isArray(fake.gemini) ? fake.gemini.shift() : undefined;
      if (step === "503") return json({ error: { status: "UNAVAILABLE" } }, false, 503);
      if (step === "empty") return json({ candidates: [{ finishReason: "OTHER", content: { parts: [] } }] });
      return json({ candidates: [{ content: { parts: [{ text: "merhaba" }] }, finishReason: "STOP" }], usageMetadata: {} });
    }
    if (u.includes("omdbapi.com")) {
      calls.omdb += 1;
      return json(fake.omdb);
    }
    if (u.includes("oauth2.googleapis.com/tokeninfo")) {
      calls.tokeninfo += 1;
      return json(fake.tokeninfo || {});
    }
    if (u.includes("api.revenuecat.com")) {
      calls.revenuecat += 1;
      if (fake.revenuecat === "fail") return json({}, false, 503);
      return json({
        subscriber: {
          entitlements: fake.revenuecat
            ? { [ENTITLEMENT]: { product_identifier: fake.revenuecat, expires_date: new Date(Date.now() + 86400000).toISOString() } }
            : {},
          subscriptions: {},
        },
      });
    }
    throw new Error(`beklenmeyen fetch: ${u}`);
  };
  fns = require("./index");
  db = require("firebase-admin/firestore").getFirestore();
});

async function reset() {
  for (const name of ["Users", "AiUsage"]) await db.recursiveDelete(db.collection(name));
  Object.keys(calls).forEach((k) => (calls[k] = 0));
  Object.keys(fake).forEach((k) => (fake[k] = null));
  geminiUrls.length = 0;
}

const nowSec = () => Math.floor(Date.now() / 1000);
const call = (fn, uid, data = {}, token = {}) =>
  fn.run({ auth: uid ? { uid, token: { auth_time: nowSec(), ...token } } : undefined, data });

async function codeOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error.code;
  }
  return "ok";
}

const mkUser = (uid, extra = {}) => db.doc(`Users/${uid}`).set({ displayName: uid, ...extra });
const ai = (msg = "öneri ver") => ({ mode: "chat", userMessage: msg, systemInstruction: "Sen bir film asistanısın." });

test("oturumsuz çağrılar reddedilir", { skip }, async () => {
  await reset();
  for (const name of [
    "redeemCode",
    "claimReferralReward",
    "getReferralOverview",
    "syncPremiumStatus",
    "getExternalRatings",
    "deleteAccountData",
    "callGemini",
  ]) {
    assert.equal(await codeOf(call(fns[name], null, {})), "unauthenticated", name);
  }
  assert.equal(calls.gemini + calls.omdb + calls.revenuecat, 0);
});

test("deleteAccountData: eski oturum belirteciyle ve bilinmeyen aşamayla çalışmaz", { skip }, async () => {
  await reset();
  await mkUser("del");
  const stale = { auth_time: nowSec() - 60 * 60 };
  assert.equal(await codeOf(call(fns.deleteAccountData, "del", {}, stale)), "unauthenticated");
  assert.equal(await codeOf(call(fns.deleteAccountData, "del", { phase: "everything" })), "invalid-argument");
  assert.equal((await db.doc("Users/del").get()).exists, true, "hiçbir şey silinmemeli");
});

test("callGemini: girdi doğrulama Gemini'ye gitmeden reddeder", { skip }, async () => {
  await reset();
  await mkUser("u1");
  assert.equal(await codeOf(call(fns.callGemini, "u1", { ...ai(), mode: "free-text" })), "invalid-argument");
  assert.equal(await codeOf(call(fns.callGemini, "u1", ai("x".repeat(4001)))), "invalid-argument");
  assert.equal(await codeOf(call(fns.callGemini, "u1", { ...ai(), systemInstruction: "" })), "invalid-argument");
  assert.equal(calls.gemini, 0);
});

test("callGemini: Free günlük kota sunucuda uygulanır (3 çağrı, 4. reddedilir)", { skip }, async () => {
  await reset();
  await mkUser("free1");
  for (let i = 0; i < 3; i += 1) assert.equal(await codeOf(call(fns.callGemini, "free1", ai())), "ok");
  assert.equal(await codeOf(call(fns.callGemini, "free1", ai())), "resource-exhausted");
  assert.equal(calls.gemini, 3);
  const usage = (await db.doc("AiUsage/free1").get()).data();
  assert.equal(usage.dailyCount, 3);
  assert.equal(usage.plan, "free");
});

test("callGemini: eşzamanlı çağrılarla kota aşılamaz (transaction)", { skip }, async () => {
  await reset();
  await mkUser("racer");
  const results = await Promise.all(Array.from({ length: 6 }, () => codeOf(call(fns.callGemini, "racer", ai()))));
  assert.equal(results.filter((r) => r === "ok").length, 3, results.join(","));
  assert.equal((await db.doc("AiUsage/racer").get()).get("dailyCount"), 3);
});

test("callGemini: plan istemciden değil sunucudaki entitlements'tan okunur", { skip }, async () => {
  await reset();
  await mkUser("prem", { entitlements: { premium: true, premiumPlan: "premium" } });
  assert.equal(await codeOf(call(fns.callGemini, "prem", { ...ai(), plan: "unlimited" })), "ok");
  assert.equal((await db.doc("AiUsage/prem").get()).get("plan"), "premium");
});

test("callGemini: birincil model 503 verince yedek modelle cevap döner, tek hak harcanır", { skip }, async () => {
  await reset();
  await mkUser("fallback1");
  fake.gemini = ["503"];
  const res = await call(fns.callGemini, "fallback1", ai());
  assert.equal(res.data.candidates[0].content.parts[0].text, "merhaba");
  assert.equal(calls.gemini, 2);
  assert.ok(geminiUrls[1].includes("gemini-2.5-flash-lite"), geminiUrls[1]);
  assert.ok(geminiUrls.every((u) => !u.includes("key=")), "anahtar URL'de olmamalı");
  assert.equal(res.model, "gemini-2.5-flash-lite");
  assert.equal((await db.doc("AiUsage/fallback1").get()).get("dailyCount"), 1);
});

test("callGemini: model iki kez boş dönerse hak iade edilir", { skip }, async () => {
  await reset();
  await mkUser("empty1");
  fake.gemini = ["empty", "empty"];
  let error;
  try {
    await call(fns.callGemini, "empty1", ai());
  } catch (e) {
    error = e;
  }
  assert.equal(error?.code, "unavailable");
  assert.equal(error?.details?.reason, "EMPTY_RESPONSE");
  const usage = (await db.doc("AiUsage/empty1").get()).data();
  assert.equal(usage.dailyCount, 0);
  assert.equal(usage.monthlyCount, 0);
});

test("callGemini: dakikalık patlama freni kotadan önce devreye girer", { skip }, async () => {
  await reset();
  await mkUser("burst", { entitlements: { premium: true, premiumPlan: "unlimited" } });
  for (let i = 0; i < 8; i += 1) assert.equal(await codeOf(call(fns.callGemini, "burst", ai())), "ok");
  let error;
  try {
    await call(fns.callGemini, "burst", ai());
  } catch (e) {
    error = e;
  }
  assert.equal(error?.code, "resource-exhausted");
  assert.equal(error?.details?.reason, "BURST_LIMIT");
  assert.equal((await db.doc("AiUsage/burst").get()).get("dailyCount"), 8, "frenlenen çağrı hak yakmaz");
});

test("getExternalRatings: kimlik doğrulama, geçici hata önbelleğe girmez, kesin 'yok' girer", { skip }, async () => {
  await reset();
  await mkUser("r1");
  assert.equal(await codeOf(call(fns.getExternalRatings, "r1", { imdbId: "../etc" })), "invalid-argument");

  fake.omdb = { Response: "False", Error: "Invalid API key!" };
  const first = await call(fns.getExternalRatings, "r1", { imdbId: "tt0133093" });
  assert.deepEqual(first, { found: false, reason: "unavailable" });
  await call(fns.getExternalRatings, "r1", { imdbId: "tt0133093" });
  assert.equal(calls.omdb, 2, "geçici hata önbelleğe girmemeli");

  fake.omdb = { Response: "False", Error: "Movie not found!" };
  const miss = await call(fns.getExternalRatings, "r1", { imdbId: "tt9999990" });
  assert.deepEqual(miss, { found: false, reason: "not-found" });
  await call(fns.getExternalRatings, "r1", { imdbId: "tt9999990" });
  assert.equal(calls.omdb, 3, "kesin 'yok' önbellekten dönmeli");
});

test("getExternalRatings: kullanıcı başına dakikada 60 çağrı sınırı", { skip }, async () => {
  await reset();
  await mkUser("spam");
  fake.omdb = { Response: "True", imdbRating: "8.7", imdbVotes: "2,000,000", Metascore: "73", Ratings: [] };
  for (let i = 0; i < 60; i += 1) await call(fns.getExternalRatings, "spam", { imdbId: "tt0133093" });
  assert.equal(await codeOf(call(fns.getExternalRatings, "spam", { imdbId: "tt0133093" })), "resource-exhausted");
});

test("checkGoogleSignInEligibility: kısa belirteç ve yanlış kitleli belirteç reddedilir", { skip }, async () => {
  await reset();
  assert.equal(await codeOf(call(fns.checkGoogleSignInEligibility, null, { idToken: "kisa" })), "invalid-argument");
  fake.tokeninfo = { aud: "baska-uygulama", sub: "1", email: "x@example.com", email_verified: true };
  assert.equal(
    await codeOf(call(fns.checkGoogleSignInEligibility, null, { idToken: "x".repeat(200) })),
    "unauthenticated",
  );
});

test("syncPremiumStatus: profil şartı, RevenueCat hatası, başarı ve kısma", { skip }, async () => {
  await reset();
  assert.equal(await codeOf(call(fns.syncPremiumStatus, "noprofile")), "failed-precondition");

  await mkUser("sub");
  fake.revenuecat = "fail";
  assert.equal(await codeOf(call(fns.syncPremiumStatus, "sub")), "unavailable");

  fake.revenuecat = "premium_monthly";
  const ok = await call(fns.syncPremiumStatus, "sub");
  assert.deepEqual(ok, { plan: "premium", throttled: false });
  const ent = (await db.doc("Users/sub").get()).get("entitlements");
  assert.equal(ent.premiumPlan, "premium");
  assert.equal(ent.storeSubscribed, true);

  const again = await call(fns.syncPremiumStatus, "sub");
  assert.equal(again.throttled, true);
  assert.equal(calls.revenuecat, 2, "kısılan çağrı RevenueCat'e gitmemeli");
});
