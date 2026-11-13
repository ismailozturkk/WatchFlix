// scripts/sim/titleFitBacktest.sim.js
//
// "Zevk uyumunu değerlendir" geri testi (Zevk eşleşmesi Faz 3, rehber §5). Çekirdek: utils/titleFitBacktest.js.
// `npm test` bunu ÇALIŞTIRMAZ. Elle:
//
//   GERÇEK kütüphane (kullanıcının KENDİ dışa aktarımı, onayıyla; dosyayı depoya KOYMA):
//     BACKTEST_FILE="C:/yol/seelogd-kutuphane.json" npx jest --rootDir . --testMatch "**/scripts/sim/titleFit*.sim.js" --testPathIgnorePatterns "/node_modules/"
//   Dosya yoksa SENTETİK kütüphanelerle çalışır (aracın kendisini sınar; gerçek sonucun yerini tutmaz).
//   Ağırlık denemesi: BACKTEST_WEIGHTS='{"genres":0.2,"predicted":0.3}' (WEIGHTS üzerine yazılır → `alt`).
//
// TMDB verisi yok: `similar` ve `public` bileşenleri bu testte kapalı (rapora yazılır).

import fs from "fs";
import { WEIGHTS } from "../../utils/titleTasteFit";
import { genreParts } from "../../utils/genreCanon";
import { exportToLibrary, runTitleFitBacktest } from "../../utils/titleFitBacktest";
import { createWorld } from "../../__tests__/helpers/tasteSynth";

const NOW = Date.UTC(2026, 10, 13);
const DAY = 86400000;
const GENRE_NAMES = [
  "Aksiyon", "Macera", "Animasyon", "Komedi", "Suç", "Belgesel", "Dram", "Aile", "Fantastik",
  "Tarih", "Korku", "Müzik", "Gizem", "Romantik", "Bilim-Kurgu", "Gerilim", "Savaş", "Vahşi Batı",
];
const ALT = process.env.BACKTEST_WEIGHTS ? { ...WEIGHTS, ...JSON.parse(process.env.BACKTEST_WEIGHTS) } : null;

/** Sentetik dünyadan titleTasteFit kütüphanesi: görünür özellikler → TMDB tür adları (en çok 3). */
function syntheticLibrary(W, taste, n) {
  const u = W.makeUser(taste, n, { rateShare: 0.85 });
  const watchedMovies = [];
  const watchedShows = [];
  const favorites = [];
  const ratings = {};
  for (const it of u.items) {
    const idx = Number(it.key.split(":")[1]) - 1;
    const title = W.catalog[idx];
    const genres = it.features
      .filter((f) => f.startsWith("f:") && Number(f.slice(2)) < GENRE_NAMES.length)
      .slice(0, 3)
      .map((f) => GENRE_NAMES[Number(f.slice(2))]);
    if (!genres.length) genres.push("Dram");
    const type = title.isSeries ? "tv" : "movie";
    const rec = {
      id: idx + 1,
      type,
      name: it.key,
      genres,
      minutes: type === "movie" ? 85 + Math.round(40 * Math.abs(title.v[0])) : undefined,
      dateAdded: new Date(NOW - Math.floor(W.rnd() * 900) * DAY).toISOString(),
    };
    (type === "tv" ? watchedShows : watchedMovies).push(rec);
    if (it.favorite) favorites.push(rec);
    if (typeof it.rating === "number") ratings[`${type}_${idx + 1}`] = it.rating;
  }
  return { watchedMovies, watchedShows, watchList: [], favorites, ratings };
}

const line = (r) =>
  `n=${r.n} ρ=${r.spearman} artış=${r.monotonic ? "evet" : "HAYIR"} | ` +
  r.bands.map((b) => `${b.id}: ${b.n ? `${b.meanRating} (${b.n})` : "–"}`).join(" · ");

test("titleTasteFit geri testi", () => {
  const unknown = GENRE_NAMES.filter((g) => genreParts(g).includes("other"));
  expect(unknown).toEqual([]);

  const file = process.env.BACKTEST_FILE;
  const runs = [];
  if (file) {
    const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
    runs.push({ label: "gerçek kütüphane", res: runTitleFitBacktest(exportToLibrary(snapshot), { now: NOW, weights: ALT }) });
  } else {
    for (const seed of [7, 11, 23]) {
      const W = createWorld({ seed, titles: 3000 });
      const [c] = W.centers(1);
      for (const n of [80, 300]) {
        runs.push({ label: `sentetik tohum ${seed}, ${n} yapım`, res: runTitleFitBacktest(syntheticLibrary(W, c, n), { now: NOW, weights: ALT }) });
      }
    }
  }
  const out = [];
  for (const { label, res } of runs) {
    out.push(`── ${label} (atlanan ${res.skipped}, tahmini puan MAE ${res.predictedMae} / ${res.predictedN})`);
    out.push(`   mevcut: ${line(res)}`);
    if (res.alt) out.push(`   deneme: ${line(res.alt)}`);
    out.push(
      `   bileşen ρ: ${res.components
        .sort((a, b) => (b.spearman ?? -9) - (a.spearman ?? -9))
        .map((c) => `${c.id} ${c.spearman} (n${c.n}, ağ ${c.meanWeight})`)
        .join(" · ")}`,
    );
  }
  out.push(`   kapalı bileşenler: ${runs[0].res.disabled.join(", ")} (TMDB verisi yok)`);
  // eslint-disable-next-line no-console
  console.log(out.join("\n"));
  for (const { res } of runs) expect(res.n).toBeGreaterThan(0);
}, 600000);
