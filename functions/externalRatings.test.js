"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildOmdbUrl,
  createRateLimiter,
  createTtlCache,
  isQuotaResponse,
  parseSeasonResponse,
  parseTitleResponse,
  validateRatingsRequest,
} = require("./externalRatings");

test("validateRatingsRequest yalnız IMDb kimliği ve geçerli sezon kabul eder", () => {
  assert.deepEqual(validateRatingsRequest({ imdbId: "tt0944947" }), { ok: true, kind: "title", imdbId: "tt0944947", season: null });
  assert.deepEqual(validateRatingsRequest({ imdbId: " tt0944947 ", season: 3 }), { ok: true, kind: "season", imdbId: "tt0944947", season: 3 });
  assert.deepEqual(validateRatingsRequest({ imdbId: "tt0944947", season: "2" }), { ok: true, kind: "season", imdbId: "tt0944947", season: 2 });
});

test("validateRatingsRequest keyfi sorguyu ve bozuk girdiyi reddeder", () => {
  for (const imdbId of ["", "tt1", "0944947", "tt0944947&t=hile", "tt0944947 ", "../x", undefined, null, 5, {}]) {
    const out = validateRatingsRequest({ imdbId });
    // Baştaki/sondaki boşluk kırpıldığı için "tt0944947 " geçerli sayılır.
    if (imdbId === "tt0944947 ") assert.equal(out.ok, true);
    else assert.deepEqual(out, { ok: false, reason: "invalid-imdb-id" });
  }
  for (const season of [0, -1, 100, 1.5, "x", NaN]) {
    assert.deepEqual(validateRatingsRequest({ imdbId: "tt0944947", season }), { ok: false, reason: "invalid-season" });
  }
  assert.deepEqual(validateRatingsRequest(null), { ok: false, reason: "invalid-imdb-id" });
  assert.deepEqual(validateRatingsRequest(undefined), { ok: false, reason: "invalid-imdb-id" });
});

test("buildOmdbUrl anahtarı ve parametreleri doğru kodlar", () => {
  const url = new URL(buildOmdbUrl({ imdbId: "tt0944947", apiKey: "abc 123" }));
  assert.equal(url.hostname, "www.omdbapi.com");
  assert.equal(url.searchParams.get("i"), "tt0944947");
  assert.equal(url.searchParams.get("apikey"), "abc 123");
  assert.equal(url.searchParams.has("Season"), false);
  assert.equal(new URL(buildOmdbUrl({ imdbId: "tt0944947", season: 4, apiKey: "k" })).searchParams.get("Season"), "4");
});

test("parseTitleResponse puanları sayıya çevirir; N/A ve eksik alan null", () => {
  const out = parseTitleResponse({
    Response: "True",
    imdbRating: "9.2",
    imdbVotes: "2,345,678",
    Metascore: "80",
    Ratings: [{ Source: "Internet Movie Database", Value: "9.2/10" }, { Source: "Rotten Tomatoes", Value: "93%" }],
  });
  assert.deepEqual(out, { imdbRating: 9.2, imdbVotes: 2345678, metascore: 80, rottenTomatoes: 93 });
  assert.deepEqual(parseTitleResponse({ Response: "True", imdbRating: "N/A", imdbVotes: "N/A", Metascore: "N/A" }), {
    imdbRating: null,
    imdbVotes: null,
    metascore: null,
    rottenTomatoes: null,
  });
  assert.equal(parseTitleResponse({ Response: "False", Error: "Incorrect IMDb ID." }), null);
  assert.equal(parseTitleResponse(null), null);
});

test("parseSeasonResponse bölüm puanlarını verir; geçersiz bölümü atar", () => {
  const out = parseSeasonResponse({
    Response: "True",
    Episodes: [
      { Episode: "1", imdbRating: "8.9" },
      { Episode: "2", imdbRating: "N/A" },
      { Episode: "x", imdbRating: "7" },
      null,
    ],
  });
  assert.deepEqual(out, [
    { episode: 1, imdbRating: 8.9 },
    { episode: 2, imdbRating: null },
  ]);
  assert.equal(parseSeasonResponse({ Response: "False" }), null);
  assert.equal(parseSeasonResponse({ Response: "True" }), null);
});

test("isQuotaResponse OMDb kota mesajını tanır", () => {
  assert.equal(isQuotaResponse({ Response: "False", Error: "Request limit reached!" }), true);
  assert.equal(isQuotaResponse({ Response: "False", Error: "Incorrect IMDb ID." }), false);
  assert.equal(isQuotaResponse(null), false);
});

test("createTtlCache süre dolunca düşer ve üst sınırda en eskiyi atar", () => {
  let t = 1000;
  const cache = createTtlCache({ ttlMs: 100, maxEntries: 2, now: () => t });
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.get("a"), 1);
  cache.set("c", 3); // a atılır
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  t += 101;
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("c"), undefined); // c de aynı pencerede yazılmıştı
});

test("createRateLimiter pencere içinde sınırı uygular, pencere geçince açar, kullanıcıları ayırır", () => {
  let t = 0;
  const allow = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
  assert.equal(allow("u1"), true);
  assert.equal(allow("u1"), true);
  assert.equal(allow("u1"), false);
  assert.equal(allow("u2"), true);
  t += 1001;
  assert.equal(allow("u1"), true);
});
