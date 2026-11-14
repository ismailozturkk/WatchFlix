// __tests__/siteAdminStats.test.js
//
// Site yönetim panelinin saf hesapları (website/admin-stats.js): parça belgelerini günlere katlama, en büyük
// girdiler, süre biçimi, CSV kaçışı. Sunucu tarafı (functions/siteStats.js) kendi node:test dosyasında.

const S = require("../website/admin-stats.js");

test("gün aralığı İstanbul takvimiyle, eskiden yeniye ve bugünü içerir", () => {
  const now = new Date("2026-11-03T22:30:00Z"); // İstanbul'da 4 Kasım 01:30
  expect(S.istanbulDay(now)).toBe("2026-11-04");
  expect(S.dayRange(3, now)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
  expect(S.dayRange(1, now)).toEqual(["2026-11-04"]);
});

test("aynı günün parçaları toplanır; aralık dışı ve bozuk belgeler atlanır", () => {
  const days = ["2026-11-03", "2026-11-04"];
  const docs = [
    { day: "2026-11-04", views: 3, visitors: 2, sessions: 2, engagedSec: 40, countries: { TR: 2 }, refs: { google: 1 } },
    { day: "2026-11-04", views: 1, visitors: 1, sessions: 1, engagedSec: 20, countries: { TR: 1, DE: 1 }, hours: { "09": 1 } },
    { day: "2026-11-03", views: 5, newcomers: 2 },
    { day: "2026-10-01", views: 100 },
    { views: 7 },
    { day: "2026-11-03", views: "x", countries: { BR: "y" } },
  ];
  const { byDay, total } = S.mergeStats(docs, days);
  expect(byDay["2026-11-04"]).toMatchObject({ views: 4, visitors: 3, sessions: 3, engagedSec: 60, countries: { TR: 3, DE: 1 } });
  expect(byDay["2026-11-03"]).toMatchObject({ views: 5, newcomers: 2, countries: {} });
  expect(total).toMatchObject({ views: 9, visitors: 3, newcomers: 2, refs: { google: 1 }, hours: { "09": 1 } });
  expect(Object.keys(byDay)).toEqual(days);
});

test("en büyük girdiler + 'diğerleri' satırı ve paylar", () => {
  const rows = S.topEntries({ TR: 6, DE: 2, BR: 1, US: 1, XX: 0 }, 2);
  expect(rows.map((r) => r.key)).toEqual(["TR", "DE", "__other"]);
  expect(rows.map((r) => r.value)).toEqual([6, 2, 2]);
  expect(rows[0].share).toBeCloseTo(0.6);
  expect(S.topEntries({}, 5)).toEqual([]);
});

test("süre, bayrak ve CSV biçimleri", () => {
  expect(S.formatDuration(0)).toBe("0 sn");
  expect(S.formatDuration(9.4)).toBe("9 sn");
  expect(S.formatDuration(83)).toBe("1 dk 23 sn");
  expect(S.formatDuration(605)).toBe("10 dk 05 sn");
  expect(S.flagOf("TR")).toBe("🇹🇷");
  expect(S.flagOf("XX")).toBe("🌐");
  expect(S.toCsv([["email", "not"], ["a@b.co", 'x,"y"'], ["=HYPERLINK(1)", "-2"]])).toBe(
    'email,not\r\na@b.co,"x,""y"""\r\n\'=HYPERLINK(1),\'-2',
  );
});

test("liste arama, tarih, platform ve sıralaması mevcut veriyi değiştirmez", () => {
  const rows = [
    { email: "z@example.com", platform: "ios", queueNo: 3, at: new Date("2026-11-05T10:00:00Z") },
    { email: "a@example.com", platform: "android", queueNo: 1, at: new Date("2026-10-01T10:00:00Z") },
    { email: "b@example.com", platform: "ios", queueNo: 2, at: new Date("2026-11-06T10:00:00Z") },
  ];
  const now = new Date("2026-11-07T08:00:00Z");
  expect(S.selectRows(rows, { platform: "ios", period: "7", sort: "old" }, now).map((r) => r.email)).toEqual(["z@example.com", "b@example.com"]);
  expect(S.selectRows(rows, { search: "EXAMPLE", sort: "queue" }, now).map((r) => r.queueNo)).toEqual([1, 2, 3]);
  expect(S.selectRows(rows, { period: "7", search: "a@" }, now)).toEqual([]);
  expect(rows.map((r) => r.email)).toEqual(["z@example.com", "a@example.com", "b@example.com"]);
});

test("dönem kıyası ve güvenli oran", () => {
  expect(S.delta(120, 100)).toEqual({ diff: 20, ratio: 0.2, dir: "up" });
  expect(S.delta(5, 0)).toEqual({ diff: 5, ratio: null, dir: "up" });
  expect(S.delta(0, 0).dir).toBe("flat");
  expect(S.delta(50, 100).dir).toBe("down");
  expect(S.rate(1, 4)).toBe(0.25);
  expect(S.rate(3, 0)).toBe(0);
});

test("gün × saat ısı haritası haftanın gününe göre toplar", () => {
  // 2026-11-09 Pazartesi, 2026-11-16 Pazartesi, 2026-11-15 Pazar
  expect(S.weekdayOf("2026-11-09")).toBe(0);
  expect(S.weekdayOf("2026-11-15")).toBe(6);
  const byDay = {
    "2026-11-09": { hours: { "09": 2, 21: 1 } },
    "2026-11-16": { hours: { "09": 3 } },
    "2026-11-15": { hours: { 23: 4, 99: 7 } },
  };
  const m = S.weekHourMatrix(byDay, ["2026-11-09", "2026-11-15", "2026-11-16"]);
  expect(m.grid[0][9]).toBe(5);
  expect(m.grid[0][21]).toBe(1);
  expect(m.grid[6][23]).toBe(4);
  expect(m.max).toBe(5);
});

test("kayıtları gün ve alan bazında sayar", () => {
  const rows = [
    { platform: "ios", lang: "tr", at: new Date("2026-11-13T22:30:00Z") }, // İstanbul 14 Kas 01:30
    { platform: "android", lang: "", at: new Date("2026-11-13T10:00:00Z") },
    { platform: "android", at: null },
  ];
  expect(S.countByDay(rows, ["2026-11-13", "2026-11-14"])).toEqual({ "2026-11-13": 1, "2026-11-14": 1 });
  expect(S.countBy(rows, "platform")).toEqual({ ios: 1, android: 2 });
  expect(S.countBy(rows, "lang")).toEqual({ tr: 1, xx: 2 });
});

test("kaynak tablosu ve dönüşüm hunisi", () => {
  const total = {
    visitors: 100, engagedSessions: 40, signups: 6,
    refs: { google: 50, direct: 30 }, engagedRefs: { google: 25, direct: 6 }, convRefs: { google: 4, instagram: 2 },
    actions: { waitlist_try: 5, beta_try: 5 },
  };
  const rows = S.sourceTable(total);
  expect(rows.map((r) => r.key)).toEqual(["google", "direct", "instagram"]);
  expect(rows[0]).toEqual({ key: "google", sessions: 50, engaged: 25, signups: 4, engagedRate: 0.5, convRate: 0.08 });
  expect(rows[2].convRate).toBe(0); // oturumu sayılmamış kaynak: oran 0, satır yine görünür
  const f = S.funnel(total);
  expect(f.map((s) => s.value)).toEqual([100, 40, 10, 6]);
  expect(f[3].ofPrev).toBeCloseTo(0.6);
  expect(f[3].ofFirst).toBeCloseTo(0.06);
  expect(S.funnel({}).every((s) => s.value === 0)).toBe(true);
});
