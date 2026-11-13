// scripts/sim/tasteMatchV3.sim.js
//
// Zevk eşleşmesi v3 — tam ölçekli sentetik simülasyon, GERÇEK çekirdekle (utils/tasteMatchV3.js).
// docs/ozellikler/ZEVK_ESLESMESI_ALGORITMA.md §12 tablosunun regresyon ölçümü: bir formül değişikliği
// buradaki kesinlik oranlarını düşürüyorsa kabul edilmez (§14).
//
// `npm test` bunu ÇALIŞTIRMAZ (yavaş; __tests__ dışında). Elle:
//   npx jest --rootDir . --testMatch "**/scripts/sim/*.sim.js" --testPathIgnorePatterns "/node_modules/"
// Tohum seçmek için: SIM_SEEDS=7,11,23 (varsayılan). Sabit denemesi: SIM_CONFIG='{"scale":1.2}'.

import { buildContext, buildProfile, scorePair } from "../../utils/tasteMatchV3";
import { createWorld } from "../../__tests__/helpers/tasteSynth";

const NOW = Date.UTC(2026, 10, 13);
const SEEDS = (process.env.SIM_SEEDS || "7,11,23").split(",").map(Number);
// Sabit denemesi için: SIM_CONFIG='{"scale":1.2}' (DEFAULTS üzerine yazılır).
const CONFIG = process.env.SIM_CONFIG ? JSON.parse(process.env.SIM_CONFIG) : undefined;
const q = (arr, p) => {
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.floor(p * (s.length - 1))];
};

function runWorld(seed) {
  const W = createWorld({ seed, titles: 4000 });
  const centers = W.centers(14);
  const users = [];
  for (let i = 0; i < 320; i += 1) {
    const c = centers[Math.floor(W.rnd() * centers.length)];
    const spread = W.rnd() < 0.5 ? 0.25 : 0.9;
    const n = Math.round(Math.max(40, Math.min(1200, Math.exp(4.9 + 0.8 * W.gauss()))));
    users.push(W.makeUser(c.map((x) => x + spread * W.gauss()), n, { silent: W.rnd() < 0.25 }));
  }
  const t0 = Date.now();
  const ctx = buildContext(users, { k3Mode: "full", now: NOW, config: CONFIG });
  const profiles = users.map((u) => buildProfile(u, ctx, { now: NOW }));
  const t1 = Date.now();
  const pairs = [];
  for (let i = 0; i < users.length; i += 1) {
    for (let j = i + 1; j < users.length; j += 1) {
      const r = scorePair(profiles[i], profiles[j], ctx);
      pairs.push({
        t: W.cos(users[i].taste, users[j].taste),
        s: r.score,
        ratio: Math.max(users[i].n, users[j].n) / Math.min(users[i].n, users[j].n),
        silent: (users[i].silent ? 1 : 0) + (users[j].silent ? 1 : 0),
      });
    }
  }
  const t2 = Date.now();

  const random = pairs.filter((p) => p.t < 0.3).map((p) => p.s);
  const twins = pairs.filter((p) => p.t >= 0.93);
  const at = (th) => {
    const hit = pairs.filter((p) => p.s >= th);
    return {
      n: hit.length,
      good80: hit.length ? hit.filter((p) => p.t >= 0.8).length / hit.length : null,
      good90: hit.length ? hit.filter((p) => p.t >= 0.9).length / hit.length : null,
      recall: twins.filter((p) => p.s >= th).length / Math.max(1, twins.length),
    };
  };
  const twinMed = (k) => {
    const arr = twins.filter((p) => p.silent === k && p.ratio <= 2).map((p) => p.s);
    return arr.length ? `${q(arr, 0.5).toFixed(1)} (${arr.length})` : "-";
  };

  // §12 senaryoları (12 tekrar ortalaması)
  const avg = (f) => {
    const xs = Array.from({ length: 12 }, f);
    return `${(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1)} [${Math.min(...xs).toFixed(1)}…${Math.max(...xs).toFixed(1)}]`;
  };
  const P = (u) => buildProfile(u, ctx, { now: NOW });
  const S = (a, b) => scorePair(P(a), P(b), ctx).score;
  const T = () => centers[3].map((x) => x + 0.15 * W.gauss());
  const near = (t) => W.near(t, 0.1);
  const scen = {
    "ikiz 200/200 puanlı": avg(() => { const t = T(); return S(W.makeUser(t, 200, { rateShare: 0.8 }), W.makeUser(near(t), 200, { rateShare: 0.8 })); }),
    "ikiz 40/40 puanlı": avg(() => { const t = T(); return S(W.makeUser(t, 40, { rateShare: 0.8 }), W.makeUser(near(t), 40, { rateShare: 0.8 })); }),
    "ikiz 200/200 sessiz": avg(() => { const t = T(); return S(W.makeUser(t, 200, { silent: true }), W.makeUser(near(t), 200, { silent: true })); }),
    "ikiz 400/400 sessiz": avg(() => { const t = T(); return S(W.makeUser(t, 400, { silent: true }), W.makeUser(near(t), 400, { silent: true })); }),
    "100 ⊂ 1000": avg(() => { const big = W.makeUser(T(), 1000, { rateShare: 0.8 }); return S({ items: big.items.slice(0, 100).map((it) => ({ ...it, favorite: false })) }, big); }),
    "aynı 200 yapım, ters puan": avg(() => {
      const a = W.makeUser(T(), 200, { rateShare: 0.9 });
      const b = { items: a.items.map((it) => ({ ...it, favorite: false, watchCount: undefined, tv: undefined, rating: typeof it.rating === "number" ? 11 - it.rating : undefined })) };
      return S(a, b);
    }),
    "rastgele 200/200": avg(() => S(W.makeUser(W.near(centers[1], 0.3), 200, { rateShare: 0.8 }), W.makeUser(W.near(centers[8], 0.3), 200, { rateShare: 0.8 }))),
  };

  return {
    seed,
    ms: { context: t1 - t0, pairs: t2 - t1, perPairUs: Math.round(((t2 - t1) * 1000) / pairs.length) },
    pairs: pairs.length,
    random: { median: q(random, 0.5), p99: q(random, 0.99) },
    twins: twins.length,
    at85: at(85),
    at90: at(90),
    at93: at(93),
    twinMedians: { rated: twinMed(0), mixed: twinMed(1), silent: twinMed(2) },
    scen,
  };
}

test("tasteMatchV3 tam ölçek simülasyonu (§12)", () => {
  const results = SEEDS.map(runWorld);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(results, null, 1));
  for (const r of results) {
    // §12 kabul ölçütleri (rehber Faz 1)
    expect(Math.abs(r.random.median)).toBeLessThan(10);
    expect(r.random.p99).toBeLessThanOrEqual(45);
    if (r.at90.n >= 10) expect(r.at90.good80).toBeGreaterThanOrEqual(0.97);
  }
}, 600000);
