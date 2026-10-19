"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  addDays,
  buildDigestMessage,
  dayInZone,
  pickDigestItems,
  releaseInWindow,
  weekWindow,
  weekdayLabel,
} = require("./weeklyDigest");

// 18 Ekim 2026 Pazar. 21:30 UTC = 00:30 TR (ertesi gün 19 Ekim) → TR gününe göre pencere 19'unda başlar.
test("dayInZone saat dilimine göre takvim gününü verir (UTC kayması yok)", () => {
  assert.equal(dayInZone(new Date("2026-10-18T07:00:00Z")), "2026-10-18");
  assert.equal(dayInZone(new Date("2026-10-18T21:30:00Z")), "2026-10-19");
  assert.equal(dayInZone(new Date("2026-10-18T21:30:00Z"), "UTC"), "2026-10-18");
});

test("addDays ay / yıl sınırını geçer", () => {
  assert.equal(addDays("2026-10-28", 7), "2026-11-04");
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDays("2028-02-27", 2), "2028-02-29"); // artık yıl
  assert.equal(addDays("2026-10-18", 0), "2026-10-18");
});

test("weekWindow bugün dahil 7 gün", () => {
  assert.deepEqual(weekWindow(new Date("2026-10-18T07:00:00Z")), { from: "2026-10-18", to: "2026-10-24" });
  assert.deepEqual(weekWindow(new Date("2026-10-18T21:30:00Z")), { from: "2026-10-19", to: "2026-10-25" });
});

const window = { from: "2026-10-18", to: "2026-10-24" };

test("releaseInWindow film: sınırlar dahil, dışı null", () => {
  assert.deepEqual(releaseInWindow("movie", { release_date: "2026-10-18" }, window), { date: "2026-10-18", kind: "movie" });
  assert.deepEqual(releaseInWindow("movie", { release_date: "2026-10-24" }, window), { date: "2026-10-24", kind: "movie" });
  assert.equal(releaseInWindow("movie", { release_date: "2026-10-17" }, window), null);
  assert.equal(releaseInWindow("movie", { release_date: "2026-10-25" }, window), null);
  assert.equal(releaseInWindow("movie", { release_date: "" }, window), null);
  assert.equal(releaseInWindow("movie", { release_date: "N/A" }, window), null);
});

test("releaseInWindow dizi: yeni bölüm önce, yoksa prömiyer", () => {
  const ep = releaseInWindow(
    "tv",
    { next_episode_to_air: { air_date: "2026-10-20", season_number: 2, episode_number: 5 }, first_air_date: "2020-01-01" },
    window,
  );
  assert.deepEqual(ep, { date: "2026-10-20", kind: "episode", season: 2, episode: 5 });
  assert.deepEqual(releaseInWindow("tv", { first_air_date: "2026-10-22" }, window), { date: "2026-10-22", kind: "premiere" });
  // Yeni bölüm pencere dışı, prömiyer geçmiş → yok.
  assert.equal(
    releaseInWindow("tv", { next_episode_to_air: { air_date: "2026-11-01" }, first_air_date: "2020-01-01" }, window),
    null,
  );
  assert.equal(releaseInWindow("tv", null, window), null);
  assert.equal(releaseInWindow("tv", {}, window), null);
});

test("pickDigestItems tekilleştirir ve tarih → ad sırasına koyar", () => {
  const e = (key, title, date) => ({ key, title, type: "movie", release: { date } });
  const out = pickDigestItems([
    e("movie_2", "Beta", "2026-10-20"),
    e("movie_1", "Alfa", "2026-10-20"),
    e("movie_3", "Gama", "2026-10-19"),
    e("movie_1", "Alfa (kopya)", "2026-10-20"),
    { key: "x", title: "", release: { date: "2026-10-20" } },
    null,
  ]);
  assert.deepEqual(out.map((i) => i.title), ["Gama", "Alfa", "Beta"]);
  assert.deepEqual(pickDigestItems(undefined), []);
});

test("weekdayLabel dile göre kısa gün adı (tarih-yalnız, kayma yok)", () => {
  // 18 Ekim 2026 Pazar
  assert.match(weekdayLabel("2026-10-18", "tr"), /^Paz/);
  assert.match(weekdayLabel("2026-10-18", "en"), /^Sun/);
  assert.match(weekdayLabel("2026-10-18", "es"), /^dom/i);
  assert.match(weekdayLabel("2026-10-18", "pt"), /^dom/i);
  assert.match(weekdayLabel("2026-10-19", "tr"), /^Pzt/);
  assert.match(weekdayLabel("2026-10-18", "xx"), /^Sun/); // bilinmeyen dil İngilizce
});

test("buildDigestMessage: ilk 3 yapım + kalan sayısı; boşsa null", () => {
  const items = ["A", "B", "C", "D", "E"].map((title, i) => ({ title, release: { date: `2026-10-${19 + i}` } }));
  const msg = buildDigestMessage("tr", items);
  assert.equal(msg.title, "Bu hafta çıkacaklar (5)");
  assert.match(msg.body, /^Pzt: A · Sal: B · Çar: C \+2$/);
  assert.equal(buildDigestMessage("en", items.slice(0, 2)).body, "Mon: A · Tue: B");
  assert.equal(buildDigestMessage("es", items.slice(0, 1)).title, "Esta semana llega (1)");
  assert.equal(buildDigestMessage("pt", items.slice(0, 1)).title, "Estreias da semana (1)");
  assert.equal(buildDigestMessage("tr", []), null);
  assert.equal(buildDigestMessage("tr", undefined), null);
});
