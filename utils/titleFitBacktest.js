// utils/titleFitBacktest.js
//
// "Zevk uyumunu değerlendir" (utils/titleTasteFit.js) GERİ TESTİ — Zevk eşleşmesi Faz 3
// (docs/planlama/ZEVK_ESLESMESI_UYGULAMA_REHBERI.md §5). SAF; uygulama kodu bunu içe aktarmaz.
//
// Yöntem: puanlanmış her izlenen yapım sırayla GİZLENİR (puanı, favorisi, izleme listesi kaydı silinir;
// computeTitleTasteFit hedefi izlenenlerden kendisi çıkarır), kalan kütüphaneyle tahmin yapılır ve
// tahmin GERÇEK puanla karşılaştırılır.
//
// SINIR: dışa aktarım TMDB verisi taşımaz → `similar` (benzer yapımlar) ve `public` (genel beğeni)
// bileşenleri bu testte HİÇ çalışmaz. Ölçülen, kalan on bileşenli modeldir; uygulamadaki skor bu iki
// bileşenle birlikte hesaplanır. Ağ isteği yapılmaz.

import { WEIGHTS, computeTitleTasteFit } from "./titleTasteFit";

const asArray = (v) => (Array.isArray(v) ? v : []);
const keyOf = (type, id) => `${type === "tv" ? "tv" : "movie"}_${Number(id)}`;

export const BACKTEST_BANDS = Object.freeze([
  { id: "0-40", min: 0, max: 40 },
  { id: "40-55", min: 40, max: 55 },
  { id: "55-70", min: 55, max: 70 },
  { id: "70-85", min: 70, max: 85 },
  { id: "85+", min: 85, max: 101 },
]);
/** Kesintisiz artış denetiminde bandın sayılması için gereken en az örnek. */
export const MIN_BAND_SAMPLES = 5;

/** Kütüphane dışa aktarım JSON'u (utils/libraryExport.js) → computeTitleTasteFit `library` şekli. */
export function exportToLibrary(snapshot) {
  const s = snapshot || {};
  const entry = (e, forcedType) =>
    e && Number(e.tmdbId) > 0
      ? {
          id: Number(e.tmdbId),
          type: forcedType || (e.type === "tv" ? "tv" : "movie"),
          name: e.title || "",
          genres: asArray(e.genres),
          minutes: e.minutes ?? undefined,
          dateAdded: e.addedAt || asArray(e.watchedDates).slice(-1)[0] || null,
        }
      : null;
  const ratings = {};
  for (const r of asArray(s.ratings)) {
    const n = Number(r?.rating);
    if (Number(r?.tmdbId) > 0 && Number.isFinite(n) && n > 0) ratings[keyOf(r.type, r.tmdbId)] = n;
  }
  return {
    watchedMovies: asArray(s.watchedMovies).map((e) => entry(e, "movie")).filter(Boolean),
    watchedShows: asArray(s.watchedShows).map((e) => entry(e, "tv")).filter(Boolean),
    watchList: asArray(s.watchList).map((e) => entry(e)).filter(Boolean),
    favorites: asArray(s.favorites).map((e) => entry(e)).filter(Boolean),
    ratings,
  };
}

/** Ortalama sıralı Spearman (bağlar ortalama sıra alır). n < 3 → null. */
export function spearman(xs, ys) {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const out = new Array(n);
    for (let i = 0; i < n; ) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j += 1;
      const r = (i + j) / 2;
      for (let k = i; k <= j; k += 1) out[idx[k][1]] = r;
      i = j + 1;
    }
    return out;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (rx[i] - mx) * (ry[i] - my);
    sxx += (rx[i] - mx) ** 2;
    syy += (ry[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

const round = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Bileşen dökümünden başka ağırlıklarla skor (computeTitleTasteFit formülü; bonus/kendi puanı yok). */
export function rescore(breakdown, weights = WEIGHTS) {
  let wSum = 0;
  let acc = 0;
  for (const b of breakdown) {
    const w = weights[b.id] ?? 0;
    wSum += w;
    acc += w * (b.score / 100);
  }
  if (!wSum) return null;
  return Math.round(Math.max(3, Math.min(98, 5 + (acc / wSum) * 93)));
}

function withoutTarget(library, key) {
  const drop = (list) => asArray(list).filter((it) => keyOf(it.type === "tv" || it.media_type === "tv" ? "tv" : "movie", it.id) !== key);
  const ratings = { ...(library.ratings || {}) };
  delete ratings[key];
  return { ...library, favorites: drop(library.favorites), watchList: drop(library.watchList), ratings };
}

/** Tahmin/gerçek çiftlerinden bant tablosu + sıra korelasyonu. */
export function summarizeSamples(samples) {
  const bands = BACKTEST_BANDS.map((b) => {
    const inBand = samples.filter((s) => s.score >= b.min && s.score < b.max);
    const mean = inBand.length ? inBand.reduce((a, s) => a + s.rating, 0) / inBand.length : null;
    return { id: b.id, n: inBand.length, meanRating: round(mean, 2) };
  });
  const counted = bands.filter((b) => b.n >= MIN_BAND_SAMPLES);
  let monotonic = counted.length >= 2;
  for (let i = 1; i < counted.length; i += 1) if (counted[i].meanRating < counted[i - 1].meanRating) monotonic = false;
  return {
    n: samples.length,
    bands,
    monotonic,
    spearman: round(spearman(samples.map((s) => s.score), samples.map((s) => s.rating))),
  };
}

/**
 * @param {object} library computeTitleTasteFit `library` şekli
 * @param {{ now?: number, weights?: Record<string, number>|null }} [options]
 *   `weights` verilirse aynı örneklerde o ağırlıklarla da sonuç (`alt`) hesaplanır.
 */
export function runTitleFitBacktest(library, { now = Date.now(), weights = null, keepSamples = false } = {}) {
  const lib = library || {};
  const ratings = lib.ratings || {};
  const targets = [];
  for (const m of asArray(lib.watchedMovies)) targets.push({ ...m, type: "movie" });
  for (const t of asArray(lib.watchedShows)) targets.push({ ...t, type: "tv" });

  const samples = [];
  let skipped = 0;
  const seen = new Set();
  for (const item of targets) {
    const key = keyOf(item.type, item.id);
    const rating = Number(ratings[key]);
    if (seen.has(key) || !Number.isFinite(rating) || rating <= 0) continue;
    seen.add(key);
    const res = computeTitleTasteFit({
      target: { type: item.type, id: Number(item.id), genres: item.genres || [], runtime: item.minutes },
      library: withoutTarget(lib, key),
      now,
    });
    if (res.state !== "ok" || res.score == null) {
      skipped += 1;
      continue;
    }
    samples.push({ key, rating, score: res.score, predictedRating: res.predictedRating, breakdown: res.breakdown });
  }

  const ids = [...new Set(samples.flatMap((s) => s.breakdown.map((b) => b.id)))];
  const components = ids.map((id) => {
    const rows = samples.map((s) => ({ s, b: s.breakdown.find((x) => x.id === id) })).filter((r) => r.b);
    return {
      id,
      n: rows.length,
      spearman: round(spearman(rows.map((r) => r.b.score), rows.map((r) => r.s.rating))),
      meanWeight: round(rows.reduce((a, r) => a + r.b.weight, 0) / Math.max(1, rows.length)),
    };
  });
  const pred = samples.filter((s) => s.predictedRating != null);
  const mae = pred.length ? pred.reduce((a, s) => a + Math.abs(s.predictedRating - s.rating), 0) / pred.length : null;

  const out = {
    ...summarizeSamples(samples),
    skipped,
    predictedMae: round(mae, 2),
    predictedN: pred.length,
    components,
    disabled: ["similar", "public"],
  };
  if (weights) out.alt = summarizeSamples(samples.map((s) => ({ ...s, score: rescore(s.breakdown, weights) })));
  if (keepSamples) out.samples = samples;
  return out;
}
