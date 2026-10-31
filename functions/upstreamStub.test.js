const test = require("node:test");
const assert = require("node:assert/strict");
const aiProxy = require("./aiProxy");
const externalRatings = require("./externalRatings");
const { parseRevenueCatPremiumState } = require("./revenueCatWebhook");
const {
  PROD_PROJECT_ID,
  stubMode,
  stubResponseFor,
  installFetchStub,
  wrapExpo,
  setupUpstreamStub,
} = require("./upstreamStub");

test("bayrak yoksa kapalı; prod'da bayrak yok sayılır", () => {
  assert.equal(stubMode({ GCLOUD_PROJECT: "seelogd-staging" }).enabled, false);
  assert.deepEqual(stubMode({ FUNCTIONS_TEST: "1", GCLOUD_PROJECT: PROD_PROJECT_ID }), {
    enabled: false,
    reason: "prod-refused",
  });
  assert.deepEqual(
    stubMode({ FUNCTIONS_TEST: "1", FIREBASE_CONFIG: JSON.stringify({ projectId: PROD_PROJECT_ID }) }),
    { enabled: false, reason: "prod-refused" },
  );
  assert.equal(stubMode({ FUNCTIONS_TEST: "1" }).enabled, false, "proje bilinmiyorsa kapalı");
  assert.equal(stubMode({ FUNCTIONS_TEST: "1", GCLOUD_PROJECT: "seelogd-staging" }).enabled, true);
});

test("prod'da kurulum fetch'e ve Expo'ya dokunmaz", () => {
  const before = globalThis.fetch;
  const expo = { sendPushNotificationsAsync: () => "gerçek" };
  const errors = [];
  setupUpstreamStub({
    expo,
    env: { FUNCTIONS_TEST: "1", GCLOUD_PROJECT: PROD_PROJECT_ID },
    log: { warn() {}, error: (m) => errors.push(m) },
  });
  assert.equal(globalThis.fetch, before);
  assert.equal(expo.sendPushNotificationsAsync(), "gerçek");
  assert.equal(errors.length, 1);
});

test("sahte yanıtlar gerçek ayrıştırıcılardan geçiyor", () => {
  const gemini = stubResponseFor("https://generativelanguage.googleapis.com/v1beta/models/x:generateContent");
  assert.equal(aiProxy.classifyResponse(gemini.body), "ok");

  const title = stubResponseFor("https://www.omdbapi.com/?i=tt1&apikey=k");
  assert.equal(externalRatings.parseTitleResponse(title.body).imdbRating, 7.5);
  const season = stubResponseFor("https://www.omdbapi.com/?i=tt1&Season=1&apikey=k");
  assert.equal(externalRatings.parseSeasonResponse(season.body).length, 1);

  const rc = stubResponseFor("https://api.revenuecat.com/v1/subscribers/u1");
  assert.ok(parseRevenueCatPremiumState(rc.body));

  assert.equal(stubResponseFor("https://oauth2.googleapis.com/tokeninfo?id_token=x").status, 400);
  assert.equal(stubResponseFor("https://firestore.googleapis.com/v1/x"), null, "bilinmeyen host gerçek ağa");
});

test("fetch sarmalayıcısı bilinen host'u keser, gerisini gerçeğe geçirir", async () => {
  const calls = [];
  const target = { fetch: async (url) => (calls.push(String(url)), new Response("gerçek")) };
  const restore = installFetchStub(target);
  const stubbed = await target.fetch("https://api.themoviedb.org/3/movie/1");
  assert.equal(stubbed.status, 200);
  assert.deepEqual(await stubbed.json(), { id: 0, results: {} });
  assert.equal(await (await target.fetch("https://example.com/")).text(), "gerçek");
  assert.deepEqual(calls, ["https://example.com/"]);
  restore();
  await target.fetch("https://api.themoviedb.org/3/movie/1");
  assert.equal(calls.length, 2, "geri alınınca gerçek fetch");
});

test("iptal edilmiş istek AbortError atar (zaman aşımı yolu korunur)", async () => {
  const target = { fetch: async () => new Response("") };
  installFetchStub(target);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    target.fetch("https://www.omdbapi.com/?i=tt1", { signal: controller.signal }),
    (err) => err.name === "AbortError",
  );
});

test("Expo sarmalayıcısı her mesaja ok bileti döner", async () => {
  const expo = wrapExpo({});
  assert.deepEqual(await expo.sendPushNotificationsAsync([{ to: "a" }, { to: "b" }]), [
    { status: "ok", id: "stub" },
    { status: "ok", id: "stub" },
  ]);
});
