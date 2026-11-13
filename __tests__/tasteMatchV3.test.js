// Zevk eşleşmesi v3 çekirdeği — on değişmez kural (D1–D10) ve tavan tabloları.
// Kaynak: docs/ozellikler/ZEVK_ESLESMESI_ALGORITMA.md §1.1, §7, §14.

import {
  DEFAULTS,
  buildContext,
  buildProfile,
  scorePair,
  experienceCap,
  evidenceCap,
  laneOf,
  implicitKindOf,
  verdictOf,
} from "../utils/tasteMatchV3";
import { createWorld } from "./helpers/tasteSynth";

const NOW = Date.UTC(2026, 10, 13);
const DAY = 86400000;

const W = createWorld({ seed: 7, titles: 2000 });
const CENTERS = W.centers(8);
// D6 için "herkesin izleyip sevdiği" 50 yapım: puan veren HERKES 8–10 veriyor, TMDB ortalaması yüksek.
const HITS = Array.from({ length: 50 }, (_, i) => ({ key: `hit:${i}`, voteAverage: 8.6, voteCount: 30000, features: W.catalog[i].features }));
const population = [];
for (let i = 0; i < 100; i += 1) {
  const spread = i % 2 ? 0.25 : 0.9;
  const n = Math.round(Math.max(40, Math.min(500, Math.exp(4.9 + 0.7 * W.gauss()))));
  const u = W.makeUser(W.near(CENTERS[i % 8], spread), n, { silent: i % 4 === 0 });
  if (!u.silent) u.items = u.items.concat(HITS.map((h) => ({ ...h, rating: 8 + Math.floor(W.rnd() * 3) })));
  population.push(u);
}
const ctx = buildContext(population, { k3Mode: "full", now: NOW });
const prof = (u) => buildProfile(u, ctx, { now: NOW });
const score = (a, b) => scorePair(prof(a), prof(b), ctx);
const twinPair = (n = 200, opts = {}) => {
  const t = W.near(CENTERS[3], 0.15);
  return [W.makeUser(t, n, { rateShare: 0.85, ...opts }), W.makeUser(W.near(t, 0.1), n, { rateShare: 0.85, ...opts })];
};
const clone = (u, map) => ({ ...u, items: u.items.map((it) => map({ ...it })) });

describe("tasteMatchV3 — değişmez kurallar", () => {
  test("D1 simetri", () => {
    for (let i = 0; i < 10; i += 1) {
      const a = prof(population[i]);
      const b = prof(population[i + 37]);
      expect(scorePair(a, b, ctx).score).toBe(scorePair(b, a, ctx).score);
    }
  });

  test("D2 rastgele çiftlerin medyanı ≈ 0", () => {
    const profiles = population.map(prof);
    const scores = [];
    for (let i = 0; i < population.length; i += 1) {
      for (let j = i + 1; j < population.length; j += 1) {
        if (W.cos(population[i].taste, population[j].taste) < 0.3) scores.push(scorePair(profiles[i], profiles[j], ctx).score);
      }
    }
    scores.sort((x, y) => x - y);
    expect(scores.length).toBeGreaterThan(200);
    expect(Math.abs(scores[Math.floor(scores.length / 2)])).toBeLessThan(10);
    expect(scores[Math.floor(scores.length * 0.99)]).toBeLessThanOrEqual(50);
  });

  test("D3 ölçek bağımsızlığı: tüm puanlar 2 düşünce skor ~aynı", () => {
    const [a, raw] = twinPair(200);
    // Kademe kaybı olmasın: 3'ün altındaki puanlı kayıtlar çıkarılır, kalanlar 2 düşürülür → sıralar aynı.
    const b = { ...raw, items: raw.items.filter((it) => !(typeof it.rating === "number" && it.rating < 3)) };
    const shifted = clone(b, (it) => (typeof it.rating === "number" ? { ...it, rating: it.rating - 2 } : it));
    expect(Math.abs(score(a, b).score - score(a, shifted).score)).toBeLessThan(3);
  });

  test("D4 alt küme tuzağı: 100 ⊂ 1000 ikiz değil", () => {
    const t = W.near(CENTERS[3], 0.15);
    const big = W.makeUser(t, 1000, { rateShare: 0.8 });
    const small = { taste: t, items: big.items.slice(0, 100).map((it) => ({ ...it, favorite: false })) };
    const r = score(small, big);
    expect(r.score).toBeLessThanOrEqual(78);
    expect(r.caps.experience).toBeLessThanOrEqual(0.76);
  });

  test("D5 az veri: iki ortak filme 10 vermek eşleşme değildir", () => {
    const a = W.makeUser(W.near(CENTERS[1], 0.3), 40, { rateShare: 0.1 });
    const b = W.makeUser(W.near(CENTERS[6], 0.3), 40, { rateShare: 0.1 });
    for (const title of W.catalog.slice(1500, 1502)) {
      const it = { key: title.key, rating: 10, voteAverage: title.voteAverage, voteCount: title.voteCount, features: title.features };
      a.items.push({ ...it });
      b.items.push({ ...it });
    }
    expect(score(a, b).score).toBeLessThan(40);
  });

  test("D6 popülerlik bağışıklığı: aynı 50 gişe filmi skoru az oynatır", () => {
    let total = 0;
    for (let k = 0; k < 4; k += 1) {
      const a = W.makeUser(W.near(CENTERS[2], 0.4), 150, { rateShare: 0.8 });
      const b = W.makeUser(W.near(CENTERS[2], 0.8), 150, { rateShare: 0.8 });
      const add = (u) => ({ ...u, items: [...u.items, ...HITS.map((h) => ({ ...h, rating: 9 }))] });
      total += score(add(a), add(b)).score - score(a, b).score;
    }
    expect(total / 4).toBeLessThan(5);
  });

  test("D7 zıtlık: aynı yapımlar, ters puanlar → düşük", () => {
    const [a] = twinPair(200, { rateShare: 0.9 });
    const b = clone(a, (it) => ({ ...it, favorite: false, watchCount: undefined, tv: undefined, rating: typeof it.rating === "number" ? 11 - it.rating : undefined }));
    expect(score(a, b).score).toBeLessThan(20);
  });

  test("D8 sessiz adalet: puanlar silinince skor çökmez ama yükselmez", () => {
    const [a, b] = twinPair(300);
    const before = score(a, b).score;
    const strip = (u) => clone(u, (it) => ({ ...it, rating: undefined }));
    const after = score(strip(a), strip(b)).score;
    expect(after).toBeGreaterThan(40);
    expect(after).toBeLessThanOrEqual(before + 0.5);
  });

  test("D9 kesinlik üstünlüğü: yalnız örtük görüş kanıt tavanını aşamaz", () => {
    const [a, b] = twinPair(300, { silent: true });
    const r = score(a, b);
    expect(r.score).toBeLessThanOrEqual(100 * evidenceCap(r.E1) + 1e-6);
    expect(r.flags.implicitHeavy).toBe(true);
  });

  test("D10 kopyaya direnç: aynı gün kopyalanan 300 kayıt ikiz üretmez", () => {
    const [a] = twinPair(300);
    const dated = clone(a, (it) => ({ ...it, addedAt: NOW - (Math.abs(hashKey(it.key)) % 400) * DAY }));
    const copy = clone(a, (it) => ({ ...it, addedAt: NOW - 3600000 }));
    const r = score(dated, copy);
    expect(r.score).toBeLessThan(DEFAULTS.twinThreshold);
    expect(r.flags.immature).toBe(true);
    expect(prof(copy).hygiene.bulk).toBe(300 - DEFAULTS.bulkPerDay);
  });
});

function hashKey(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe("tasteMatchV3 — tavan tabloları (§7)", () => {
  test.each([
    [1.1, 99], [1.5, 96], [2, 92], [2.5, 90], [3, 88], [5, 83], [10, 75], [100, 60],
  ])("deneyim tavanı oran %p → %p", (ratio, expected) => {
    expect(Math.round(100 * experienceCap(100 * ratio, 100))).toBe(expected);
  });

  test.each([
    [0, 70], [10, 82], [22, 90], [30, 93], [40, 96], [60, 98.5],
  ])("kanıt tavanı E1 %p → %p", (e1, expected) => {
    expect(100 * evidenceCap(e1)).toBeCloseTo(expected, 0);
  });
});

describe("tasteMatchV3 — yardımcılar", () => {
  test("belirlenimli ve JSON'a çevrilebilir profil", () => {
    const [a, b] = twinPair(150);
    const pa = prof(a);
    const pb = prof(b);
    const roundTrip = (p) => JSON.parse(JSON.stringify(p));
    expect(scorePair(roundTrip(pa), roundTrip(pb), ctx).score).toBe(scorePair(pa, pb, ctx).score);
    expect(prof(a)).toEqual(pa);
  });

  test("puan çeşitliliği kapısı: her şeye 10 veren açık görüş sayılmaz", () => {
    const u = { items: W.catalog.slice(0, 40).map((t) => ({ key: t.key, rating: 10 })) };
    const p = buildProfile(u, ctx, { now: NOW });
    expect(p.hygiene.ratingsDiverse).toBe(false);
    expect(Object.values(p.sig).every((g) => g.x === 0)).toBe(true);
  });

  test("örtük sinyal önceliği", () => {
    expect(implicitKindOf({ favorite: true, watchCount: 3 })).toBe("favorite");
    expect(implicitKindOf({ watchCount: 2 })).toBe("rewatch");
    expect(implicitKindOf({ tv: { finished: true, nextSeason: true } })).toBe("nextSeason");
    expect(implicitKindOf({ tv: { dropped: true } })).toBe("dropped");
    expect(implicitKindOf({ watchCount: 1 })).toBe(null);
  });

  test("kulvar: anime = animasyon + Japonca", () => {
    expect(laneOf({ type: "tv", genres: ["Animasyon", "Dram"] }, "ja")).toBe("anime");
    expect(laneOf({ type: "tv", genres: ["Animation"] }, "en")).toBe("tv");
    expect(laneOf({ type: "movie", genres: ["Dram"] }, "ja")).toBe("movie");
  });

  test("varsayılan bağlamla da çalışır (küçük havuz) ve görüntü skoru 0–100", () => {
    const [a, b] = twinPair(120);
    const r = scorePair(buildProfile(a, {}, { now: NOW }), buildProfile(b, {}, { now: NOW }), {});
    expect(r.display).toBeGreaterThanOrEqual(0);
    expect(r.display).toBeLessThanOrEqual(100);
    expect(["twin", "near", "guide", "none"]).toContain(verdictOf(r));
  });

  test("boş profil → null", () => {
    expect(scorePair(buildProfile({ items: [] }, ctx), prof(population[0]), ctx)).toBe(null);
  });
});
