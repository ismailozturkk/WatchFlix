const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_BODY,
  MAX_ENGAGED_SEC,
  countryFromTimeZone,
  isBot,
  istanbulClock,
  normalizeRef,
  parseBeacon,
  shardDocId,
  statsPatch,
  normalizeCampaign,
  returnGapBucket,
} = require("./siteStats");

const inc = (n) => ({ inc: n });
const view = (extra = {}) => ({ t: "v", p: "index", r: "", tz: "Europe/Istanbul", l: "tr-TR", d: "mobile", o: "ios", ...extra });

test("saat dilimi ülkeye çevrilir; bilinmeyen ve UTC → XX", () => {
  assert.equal(countryFromTimeZone("Europe/Istanbul"), "TR");
  assert.equal(countryFromTimeZone("America/Sao_Paulo"), "BR");
  assert.equal(countryFromTimeZone("Asia/Calcutta"), "IN");
  assert.equal(countryFromTimeZone("Etc/UTC"), "XX");
  assert.equal(countryFromTimeZone(undefined), "XX");
  assert.equal(countryFromTimeZone("__proto__"), "XX");
});

test("yönlendiren: utm önce, bilinen alanlar gruplanır, kendi site ve boş → direct", () => {
  assert.equal(normalizeRef("utm:Instagram Story"), "instagram-story");
  assert.equal(normalizeRef("www.google.com.tr"), "google");
  assert.equal(normalizeRef("l.instagram.com"), "instagram");
  assert.equal(normalizeRef("t.co"), "x");
  assert.equal(normalizeRef("seelogd.com"), "direct");
  assert.equal(normalizeRef(""), "direct");
  assert.equal(normalizeRef("blog.example.org"), "blog_example_org");
  assert.equal(normalizeRef("a".repeat(200) + ".com").length <= 32, true);
});

test("görüntüleme olayı doğrulanır; bilinmeyen değerler güvenli varsayılana düşer", () => {
  assert.deepEqual(parseBeacon(JSON.stringify(view({ s: true, n: true, f: false }))), {
    type: "view", page: "index", ref: "direct", country: "TR", lang: "tr", device: "mobile", os: "ios",
    newSession: true, newToday: true, firstEver: false,
    browser: "other", screen: null, siteLang: null, campaign: null, returnGap: null,
  });
  const odd = parseBeacon(view({ p: "../admin", d: "fridge", o: "beos", l: "!!", s: "yes" }));
  assert.equal(odd.page, "other");
  assert.equal(odd.device, "desktop");
  assert.equal(odd.os, "other");
  assert.equal(odd.lang, "xx");
  assert.equal(odd.newSession, false);
});

test("geçersiz gövdeler reddedilir; süre olayı tavanlanır", () => {
  assert.equal(parseBeacon("{bozuk"), null);
  assert.equal(parseBeacon("x".repeat(MAX_BODY + 1)), null);
  assert.equal(parseBeacon([]), null);
  assert.equal(parseBeacon({ t: "?" }), null);
  assert.equal(parseBeacon({ t: "e", sec: 0 }), null);
  assert.deepEqual(parseBeacon(Buffer.from('{"t":"e","sec":42.9}')), { type: "engaged", sec: 42 });
  assert.equal(parseBeacon({ t: "e", sec: 999999 }).sec, MAX_ENGAGED_SEC);
});

test("botlar ve boş tarayıcı kimliği sayılmaz", () => {
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBot("facebookexternalhit/1.1"), true);
  assert.equal(isBot(""), true);
  assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1"), false);
});

test("gün ve saat İstanbul saatiyle; parça kimliği", () => {
  assert.deepEqual(istanbulClock(new Date("2026-11-03T21:30:00Z")), { day: "2026-11-04", hour: "00" });
  assert.deepEqual(istanbulClock(new Date("2026-11-04T08:05:00Z")), { day: "2026-11-04", hour: "11" });
  assert.equal(shardDocId("2026-11-04", 3), "2026-11-04_3");
});

test("artış nesnesi: oturum girişi yönlendireni, günün ilk ziyareti ülke/cihazı sayar", () => {
  const clock = { day: "2026-11-04", hour: "11" };
  const plain = statsPatch(parseBeacon(view()), clock, inc);
  assert.deepEqual(plain, { day: "2026-11-04", views: { inc: 1 }, pages: { index: { inc: 1 } }, hours: { 11: { inc: 1 } } });

  const first = statsPatch(parseBeacon(view({ r: "l.instagram.com", s: true, n: true, f: true })), clock, inc);
  assert.deepEqual(first.refs, { instagram: { inc: 1 } });
  assert.deepEqual(first.countries, { TR: { inc: 1 } });
  assert.deepEqual(first.devices, { mobile: { inc: 1 } });
  assert.deepEqual(first.os, { ios: { inc: 1 } });
  assert.deepEqual(first.langs, { tr: { inc: 1 } });
  assert.deepEqual([first.sessions, first.visitors, first.newcomers], [{ inc: 1 }, { inc: 1 }, { inc: 1 }]);

  assert.deepEqual(statsPatch({ type: "engaged", sec: 30 }, clock, inc), { day: "2026-11-04", engagedSec: { inc: 30 } });
});

test("yeni görüntüleme alanları: tarayıcı, ekran, site dili, kampanya ve geri dönüş aralığı", () => {
  const ev = parseBeacon(view({ r: "utm:TikTok", c: "Launch Week", b: "safari", w: "s", sl: "ja", g: 5, s: true, n: true }));
  assert.equal(ev.browser, "safari");
  assert.equal(ev.screen, "s");
  assert.equal(ev.siteLang, "ja");
  assert.equal(ev.campaign, "tiktok~launch-week");
  assert.equal(ev.returnGap, "w1");
  const odd = parseBeacon(view({ b: "netscape", w: "xl", sl: "kl", g: "x", f: true }));
  assert.deepEqual([odd.browser, odd.screen, odd.siteLang, odd.returnGap], ["other", null, null, null]);
  assert.equal(normalizeCampaign("x", ""), null);
  assert.deepEqual([1, 6, 20, 90].map(returnGapBucket), ["d1", "w1", "m1", "old"]);

  const patch = statsPatch(ev, { day: "2026-11-14", hour: "10" }, inc);
  assert.deepEqual(patch.campaigns, { "tiktok~launch-week": { inc: 1 } });
  assert.deepEqual(patch.browsers, { safari: { inc: 1 } });
  assert.deepEqual(patch.siteLangs, { ja: { inc: 1 } });
  assert.deepEqual(patch.screens, { s: { inc: 1 } });
  assert.deepEqual(patch.returnGap, { w1: { inc: 1 } });
});

test("etkileşim olayları: yalnız izinli adlar; kayıt dönüşüm kırılımlarını yazar", () => {
  const clock = { day: "2026-11-14", hour: "10" };
  assert.equal(parseBeacon({ t: "a", a: "drop_table" }), null);
  assert.equal(parseBeacon({ t: "a", a: "__proto__" }), null);
  assert.deepEqual(statsPatch(parseBeacon({ t: "a", a: "faq_open" }), clock, inc), { day: "2026-11-14", actions: { faq_open: { inc: 1 } } });

  const ok = statsPatch(parseBeacon({ t: "a", a: "beta_ok_ios", r: "utm:instagram", tz: "Europe/Berlin", d: "mobile", l: "de" }), clock, inc);
  assert.deepEqual(ok.signups, { inc: 1 });
  assert.deepEqual(ok.convRefs, { instagram: { inc: 1 } });
  assert.deepEqual(ok.convCountries, { DE: { inc: 1 } });
  assert.deepEqual(ok.convDevices, { mobile: { inc: 1 } });
  assert.deepEqual(ok.convLangs, { de: { inc: 1 } });
});

test("etkileşimli oturum ve kaydırma derinliği", () => {
  const clock = { day: "2026-11-14", hour: "10" };
  assert.deepEqual(statsPatch(parseBeacon({ t: "g", r: "t.co" }), clock, inc), { day: "2026-11-14", engagedSessions: { inc: 1 }, engagedRefs: { x: { inc: 1 } } });
  assert.deepEqual(statsPatch(parseBeacon({ t: "s", d: 75 }), clock, inc), { day: "2026-11-14", scroll: { 75: { inc: 1 } } });
  assert.equal(parseBeacon({ t: "s", d: 33 }), null);
});
