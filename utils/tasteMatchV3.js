// utils/tasteMatchV3.js
//
// Zevk eşleşmesi v3 — yabancılar (ve arkadaşlar) arası benzerlik ÇEKİRDEĞİ.
//
// BAĞLAYICI KURALLAR: docs/ozellikler/ZEVK_ESLESMESI_ALGORITMA.md (§ numaraları oraya göndermedir).
// Uygulama sırası ve kabul ölçütleri: docs/planlama/ZEVK_ESLESMESI_UYGULAMA_REHBERI.md (Faz 1).
// Formüllerin ilk çalışan hâli: docs/ozellikler/ZEVK_ESLESMESI_SIM.js (scoreV3/prepare/parts3).
//
// SAF MODÜL: React / Firebase / alias importu YOK; yalnız ./genreCanon. Sunucu aynası
// functions/tasteMatchCore.js (Faz 5) bu dosyanın CommonJS kopyası olacak ve eşitliği
// __tests__/tasteMatchV3.parity.test.js denetleyecek — birini değiştiren ikisini de değiştirir.
//
// ÜÇ KATMAN
//   buildContext(users, config) → nüfustan öğrenilen tablolar (yoksa §13 varsayılanları).
//   buildProfile(user, ctx)     → tek kullanıcının kulvar özeti; düz JSON (MatchProfiles belgesi).
//   scorePair(a, b, ctx)        → { score (ham, <0 olabilir), display (0–100), K1, K2, K3, … }.
//
// KULLANICI GİRDİSİ (kulvara süzülmüş; adaptör ayrı yazılır):
//   { items: [{
//       key: "movie:123",            // tekil yapım anahtarı
//       rating?: number,             // 0–10 açık puan (yoksa null/undefined)
//       favorite?: boolean,          // dört favoride
//       watchCount?: number,         // izleme olayı sayısı (≥2 → tekrar izleme)
//       tv?: { finished?, nextSeason?, dropped? },   // dizi ilerleme sinyalleri (TitleFeatures ister)
//       addedAt?: number|string,     // ilk kayıt zamanı (ms ya da ISO) — veri hijyeni (§10)
//       voteAverage?: number,        // TMDB oy ortalaması → genel kanı (§3.3)
//       voteCount?: number,          // TMDB oy sayısı → nüfus küçükken nadirlik (§4)
//       genres?: string[],           // liste kaydındaki tür adları (her dilde; genreCanon çözer)
//       year?: number, minutes?: number, type?: "movie"|"tv",
//       features?: string[],         // TAM kip özellikleri ("kw:123", "lang:ja", "studio:…")
//   }] }
//
// Belirlenimli: Math.random yok; aynı girdi her zaman aynı sonucu verir.

import { genreParts, weightedGenres } from "./genreCanon";

// ── §13 sabitleri ────────────────────────────────────────────────────────────
export const DEFAULTS = Object.freeze({
  // §3.1 açık puan
  ownRatingPull: 10, // λ = n/(n+10)
  minRatingLevels: 4, // §10 puan çeşitliliği kapısı
  // §3.2 örtük sinyal başlangıç tablosu (K-2a ile veriden öğrenilir)
  // "watched" = yalnız izlendi (başka davranış yok). Karşılaştırma tabanıdır: o olmadan filmlerde
  // yalnız olumlu sinyal (tekrar/favori) kalır ve rastgele iki sessiz kullanıcı bile uyumlu görünür.
  implicit: Object.freeze({ favorite: 0.6, rewatch: 0.45, nextSeason: 0.3, finished: 0.1, dropped: -0.6, watched: -0.05 }),
  implicitWatchedWeight: 0.25, // "yalnız izlendi" sinyalinin örtük ağırlığa oranı (kanıtı şişirmesin)
  implicitMinSamples: 300,
  implicitMean: 0.05, // örtük sinyallerin nüfus ortalaması (merkezleme; öğrenilir)
  // §3.3
  gamma: 0.45,
  // Nüfus içi genel kanı yalnız GENİŞ izlenen yapımlarda: az izlenen yapımın puanlayanları zaten onu
  // sevmeye yatkın kişilerdir (seçim yanlılığı); onların ortalamasını çıkarmak ikizlerin gerçek ortak
  // zevkini siler (sentetik ölçüm: ikiz K1 0.67 → 0.47). Herkesin izlediği yapımda ise ortalama
  // gerçekten "herkesin kanısı"dır (D6). Eşik: en az 20 puanlayan VE puan veren nüfusun %20'si.
  crowdMinRaters: 20,
  crowdMinShare: 0.2,
  crowdPrior: 20, // nüfus kanısının TMDB tahminine çekilme gücü
  // §5.1 aynı kişinin yeniden ölçüm tutarlılığı; karışık çift tavanı r_ie
  relExplicit: 0.75,
  rIE: 0.41, // q_örtük = (r_ie / R_E)^2 ≈ 0.30
  // beklenen sinyal büyüklüğü önceli (8 sözde gözlem)
  m0Explicit: 0.3,
  m0Implicit: 0.12,
  mPriorObs: 8,
  // §4 nadirlik
  idfMin: 0.15,
  idfMax: 2.2,
  idfMinPool: 200, // altında TMDB oy sayısı yüzdeliği kullanılır
  // §5.2 seçim benzerliği şans dağılımı (ln n_g doğrusu); null → küçük havuz geçici kuralı
  zRef: 9,
  selection: null, // { ma, mb, da, db } — buildContext öğrenir
  selFallbackSlope: 0.09,
  selMinPairs: 2000,
  selMaxRatio: 1.6,
  // §5.3 içerik profili
  relMin: 0.3,
  relMax: 0.98,
  // §6 birleştirme
  wOpinion: 0.45,
  wSelection: 0.25,
  wContent: 0.3,
  shrinkOpinion: 6,
  shrinkSelection: 3,
  shrinkContent: 3,
  selEvidencePerTitle: 0.12,
  contentEvidenceMax: 25,
  opinionPriorShare: 0.5,
  // §7 tavanlar
  scale: 1.1,
  expCapSlope: 0.25,
  expCapMin: 0.6,
  evCapDrop: 0.3,
  evCapTau: 20,
  opinionGateEvidence: 6,
  opinionGateK1: 0.6,
  opinionGateCap: 0.85,
  // §10 veri hijyeni
  bulkPerDay: 50,
  bulkWeight: 0.5,
  bulkWindowDays: 14,
  matureDays: 14,
  immatureCap: 0.85,
  // §8 karar eşikleri
  twinThreshold: 90,
  nearThreshold: 80,
});

const DAY = 86400000;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const cfgOf = (ctx) => (ctx && ctx.config) || DEFAULTS;

/** Sıralı dizide orta-sıra yüzdeliği (0…1). */
function midPercentile(sorted, value) {
  if (!sorted || sorted.length === 0) return null;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  const below = lo;
  let eqEnd = lo;
  while (eqEnd < sorted.length && sorted[eqEnd] === value) eqEnd += 1;
  return (below + (eqEnd - below) / 2) / sorted.length;
}

/** Belirlenimli dize özeti (yarı-bölme için). */
function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dayOf(value) {
  const t = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? Math.floor(t / DAY) : null;
}

// ── kulvar ve içerik özellikleri ─────────────────────────────────────────────

/** §2: Film / Dizi / Anime. Anime = animasyon türü + Japonca köken dili (TitleFeatures). */
export function laneOf(item, originalLanguage = item?.originalLanguage) {
  const animated = (item?.genres || []).some((g) => genreParts(g).includes("animation"));
  if (animated && originalLanguage === "ja") return "anime";
  return item?.type === "tv" ? "tv" : "movie";
}

/** §5.3 "lite" kip: yalnız liste kaydındaki tür + on yıl + süre kovası. */
export function liteFeatures(item) {
  const out = new Map();
  for (const [gid, w] of weightedGenres(item?.genres || [])) out.set(`g:${gid}`, w);
  if (isNum(item?.year) && item.year > 1800) out.set(`y:${Math.floor(item.year / 10) * 10}`, 0.5);
  if (isNum(item?.minutes) && item.minutes > 0) {
    const m = item.minutes;
    const bucket = item.type === "tv" ? (m < 30 ? "s" : m < 50 ? "m" : "l") : m < 95 ? "s" : m < 130 ? "m" : "l";
    out.set(`rt:${bucket}`, 0.35);
  }
  return out;
}

function featuresOf(item, mode) {
  const out = liteFeatures(item);
  if (mode === "full" && Array.isArray(item?.features)) {
    for (const f of item.features) if (typeof f === "string" && f) out.set(f, Math.max(out.get(f) || 0, 1));
  }
  return out;
}

// ── §3 tercih puanı s ────────────────────────────────────────────────────────

const IMPLICIT_ORDER = ["favorite", "rewatch", "nextSeason", "finished", "dropped", "watched"];

/** Kaydın örtük sinyal türü (öncelik sırasıyla ilk eşleşen) ya da null. */
export function implicitKindOf(item) {
  if (item?.favorite) return "favorite";
  if (isNum(item?.watchCount) && item.watchCount >= 2) return "rewatch";
  if (item?.tv?.nextSeason) return "nextSeason";
  if (item?.tv?.finished) return "finished";
  if (item?.tv?.dropped) return "dropped";
  return null;
}

function globalRatingS(rating, ctx) {
  const p = midPercentile(ctx?.ratingSorted, rating);
  if (p != null) return 2 * p - 1;
  return clamp((rating - 6.2) / 3.2, -1, 1);
}

/** Kullanıcının açık puanlarını §3.1'e göre s'ye çevirir. Puan çeşitliliği kapısı burada (§10). */
function explicitScores(items, ctx) {
  const cfg = cfgOf(ctx);
  const rated = items.filter((it) => isNum(it.rating));
  const levels = new Set(rated.map((it) => it.rating));
  const out = new Map();
  if (rated.length === 0 || levels.size < cfg.minRatingLevels) return { scores: out, diverse: levels.size >= cfg.minRatingLevels };
  const sorted = rated.map((it) => it.rating).sort((a, b) => a - b);
  const lam = rated.length / (rated.length + cfg.ownRatingPull);
  for (const it of rated) {
    const own = 2 * midPercentile(sorted, it.rating) - 1;
    out.set(it.key, lam * own + (1 - lam) * globalRatingS(it.rating, ctx));
  }
  return { scores: out, diverse: true };
}

/**
 * Yapımın genel kanısı (−1…1). Nüfusta yeterli açık puan varsa onların ortalama s'i (TMDB tahminine
 * çekilmiş), yoksa TMDB oy ortalamasının yüzdeliği. Döndürülen değer doğrudan "beklenen s"dir.
 */
function expectedS(item, ctx) {
  const cfg = cfgOf(ctx);
  const gamma = isNum(ctx?.gamma) ? ctx.gamma : cfg.gamma;
  const tmdb = gamma * crowdOf(item, ctx);
  const pop = ctx?.crowdS?.[item.key];
  if (!pop) return tmdb;
  const [mean, n] = pop;
  return (n * mean + cfg.crowdPrior * tmdb) / (n + cfg.crowdPrior);
}

function crowdOf(item, ctx) {
  if (!isNum(item.voteAverage) || (isNum(item.voteCount) && item.voteCount < 5)) return 0;
  const p = midPercentile(ctx?.voteAvgSorted, item.voteAverage);
  if (p != null) return 2 * p - 1;
  return clamp((item.voteAverage - 6.6) / 1.4, -1, 1);
}

// ── §4 nadirlik ──────────────────────────────────────────────────────────────

/** Yapımın nadirlik ağırlığı. Havuz büyükse izleyen sayısından, küçükse TMDB oy sayısından. */
export function rarityOf(key, ctx, item) {
  const cfg = cfgOf(ctx);
  const n = ctx?.poolSize || 0;
  if (n >= cfg.idfMinPool && ctx.watchers) {
    const c = ctx.watchers[key] || 0;
    return clamp(Math.log(1 + n / (1 + c)) / Math.log(1 + n / 2), cfg.idfMin, cfg.idfMax);
  }
  const vc = item?.voteCount ?? ctx?.voteCountOf?.[key];
  const pop = isNum(vc) ? midPercentile(ctx?.voteCountSorted, vc) : null;
  if (pop == null) return 1;
  return 0.25 + 1.5 * (1 - pop) ** 1.5;
}

// ── profil ───────────────────────────────────────────────────────────────────

function normalize(map) {
  let s = 0;
  for (const v of map.values()) s += v * v;
  const n = Math.sqrt(s) || 1;
  const out = {};
  for (const [k, v] of map) if (v !== 0) out[k] = v / n;
  return out;
}

function center(vec, mean) {
  const out = { ...vec };
  if (mean) for (const k of Object.keys(mean)) out[k] = (out[k] || 0) - mean[k];
  return out;
}

function dot(a, b) {
  const [s, l] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  let d = 0;
  for (const k of Object.keys(s)) if (l[k] !== undefined) d += s[k] * l[k];
  return d;
}

function cosine(a, b) {
  const na = Math.sqrt(dot(a, a));
  const nb = Math.sqrt(dot(b, b));
  return na && nb ? dot(a, b) / (na * nb) : 0;
}

/**
 * §3–§5 tek kullanıcı özeti. Çıktı düz JSON: `MatchProfiles/{uid}.lanes[lane]`.
 * @param {{ items: Array<object> }} user
 * @param {object} [ctx] buildContext çıktısı; yoksa varsayılanlar.
 */
export function buildProfile(user, ctx = {}, { now = Date.now() } = {}) {
  const cfg = cfgOf(ctx);
  const items = [];
  const seen = new Set();
  for (const it of user?.items || []) {
    if (!it || typeof it.key !== "string" || seen.has(it.key)) continue;
    seen.add(it.key);
    items.push(it);
  }
  const mode = ctx.k3Mode || "lite";
  const implicit = { ...DEFAULTS.implicit, ...(ctx.implicit || {}) };
  const qImplicit = ((isNum(ctx.rIE) ? ctx.rIE : cfg.rIE) / cfg.relExplicit) ** 2;
  const implicitMean = isNum(ctx.implicitMean) ? ctx.implicitMean : cfg.implicitMean;

  // §10 veri hijyeni: gün başına 50'yi aşan yeni kayıtlar yarı ağırlık; olgunluk = farklı gün sayısı.
  const nowDay = Math.floor(now / DAY);
  const perDay = new Map();
  const bulk = new Set();
  let dated = 0;
  const byDay = items
    .map((it) => ({ it, day: dayOf(it.addedAt) }))
    .filter((x) => x.day != null)
    .sort((x, y) => x.day - y.day || (x.it.key < y.it.key ? -1 : 1));
  for (const { it, day } of byDay) {
    dated += 1;
    const c = (perDay.get(day) || 0) + 1;
    perDay.set(day, c);
    if (c > cfg.bulkPerDay && nowDay - day < cfg.bulkWindowDays) bulk.add(it.key);
  }
  const distinctDays = perDay.size;
  // Tarihi olmayan eski kayıtlar yargılanamaz: kayıtların yarısından azı tarihliyse olgun sayılır.
  const mature = distinctDays >= cfg.matureDays || dated < items.length / 2;

  const { scores: explicit, diverse } = explicitScores(items, ctx);
  const sig = {};
  const rar = {};
  const mSum = { e: 0, en: 0, i: 0, in: 0 };
  const featAll = new Map();
  const featH = [new Map(), new Map()];
  let wSum = 0;
  for (const it of items) {
    const rarity = round4(rarityOf(it.key, ctx, it));
    rar[it.key] = rarity;
    wSum += rarity;
    let s = null;
    let x = 0;
    let kind = null;
    if (explicit.has(it.key)) {
      s = explicit.get(it.key);
      x = 1;
    } else {
      kind = implicitKindOf(it) || "watched";
      s = implicit[kind];
    }
    if (s != null) {
      // §3.3 sapma. Açık puan: genel kanıdan sapma. Örtük sinyal: davranış zaten yapımın genel
      // kanısını içerir (iyi diziyi herkes bitirir); kalabalık terimi ÇIKARILMAZ, yalnız örtük
      // sinyallerin nüfus ortalamasına göre merkezlenir. Aksi hâlde aynı davranışı gösteren iki
      // kişiye aynı −γ·c terimi eklenir ve rastgele çiftte bile sahte görüş uyumu doğar (D8 testi).
      const d = x ? s - expectedS(it, ctx) : s - implicitMean;
      const q = (x ? 1 : qImplicit * (kind === "watched" ? cfg.implicitWatchedWeight : 1)) * (bulk.has(it.key) ? cfg.bulkWeight : 1);
      sig[it.key] = { s: round4(s), d: round4(d), x, q: round4(q) };
      if (x) { mSum.e += d * d; mSum.en += 1; } else { mSum.i += d * d; mSum.in += 1; }
    }
    // §5.3 içerik profili: sevilen ileri, sevilmeyen geri iter; görüşsüz ("yalnız izlendi") kayıt hafif ileri.
    const wt = kind === "watched" ? 0.35 : s >= 0 ? 0.4 + s : 0.6 * s;
    const half = featH[hashOf(it.key) & 1];
    for (const [f, fw] of featuresOf(it, mode)) {
      const v = wt * fw * (ctx.featureIdf?.[f] ?? 1);
      featAll.set(f, (featAll.get(f) || 0) + v);
      half.set(f, (half.get(f) || 0) + v);
    }
  }
  const prior = cfg.mPriorObs;
  const m0e = isNum(ctx.m0Explicit) ? ctx.m0Explicit : cfg.m0Explicit;
  const m0i = isNum(ctx.m0Implicit) ? ctx.m0Implicit : cfg.m0Implicit;
  const prof = normalize(featAll);
  const mean = ctx.meanProfile || null;
  const cv = center(prof, mean);
  const r = cosine(center(normalize(featH[0]), mean), center(normalize(featH[1]), mean));
  const rel = clamp((2 * r) / (1 + Math.max(r, -0.99)), cfg.relMin, cfg.relMax); // Spearman–Brown

  return {
    v: 3,
    n: items.length,
    keys: items.map((it) => it.key),
    wSum: round4(wSum),
    rar,
    sig,
    Me: round4((mSum.e + prior * m0e) / (mSum.en + prior)),
    Mi: round4((mSum.i + prior * m0i) / (mSum.in + prior)),
    prof,
    cv,
    rel: round4(rel),
    k3Mode: mode,
    hygiene: { distinctDays, dated, bulk: bulk.size, mature, ratingsDiverse: diverse },
  };
}

const round4 = (x) => Math.round(x * 1e4) / 1e4;

// Profil başına yeniden kurulan arama yapıları (JSON'a girmez).
const keySetCache = new WeakMap();
function keySet(p) {
  let s = keySetCache.get(p);
  if (!s) { s = new Set(p.keys); keySetCache.set(p, s); }
  return s;
}

// ── §5 bileşenler ────────────────────────────────────────────────────────────

/** K1 görüş uyumu, K2 ham seçim, K3 içerik — tavansız/daraltmasız ham parçalar. */
export function pairParts(a, b, ctx = {}) {
  const cfg = cfgOf(ctx);
  const rIE = isNum(ctx.rIE) ? ctx.rIE : cfg.rIE;
  const rarOf = (key) => a.rar?.[key] ?? b.rar?.[key] ?? 1;
  let num = 0;
  let den = 0;
  let e1 = 0;
  const contrib = [];
  const [sm, lg] = Object.keys(a.sig).length <= Object.keys(b.sig).length ? [a, b] : [b, a];
  for (const key of Object.keys(sm.sig)) {
    const ga = sm.sig[key];
    const gb = lg.sig[key];
    if (!gb) continue;
    const t = ga.x && gb.x ? cfg.relExplicit : ga.x || gb.x ? rIE : cfg.relExplicit;
    // q: açık 1, örtük qI; toplu girişte ayrıca yarı ağırlık (profilde saklanan q).
    const q = Math.sqrt(ga.q * gb.q);
    const w = rarOf(key) * q;
    const prod = ga.d * gb.d;
    num += w * prod;
    den += w * t * Math.sqrt((ga.x ? sm.Me : sm.Mi) * (gb.x ? lg.Me : lg.Mi));
    e1 += q;
    contrib.push({ key, w: w * prod, sa: ga.s, sb: gb.s, both: ga.x && gb.x });
  }
  const K1 = den > 0 ? clamp(num / den, -1, 1) : null;

  const [s2, l2] = a.n <= b.n ? [a, b] : [b, a];
  const big = keySet(l2);
  let common = 0;
  let wc = 0;
  for (const key of s2.keys) {
    if (!big.has(key)) continue;
    common += 1;
    wc += rarOf(key);
  }
  const rawSel = a.wSum > 0 && b.wSum > 0 ? wc / Math.sqrt(a.wSum * b.wSum) : 0;
  const ng = Math.sqrt(Math.max(1, a.n) * Math.max(1, b.n));
  const K3 = clamp(cosine(a.cv, b.cv) / Math.sqrt(a.rel * b.rel), -1, 1);
  return { K1, e1, rawSel, ng, common, K3, contrib };
}

/** §5.2: ham seçim örtüşmesi → K2 (büyüklüğe göre şans z'si; küçük havuzda geçici kural). */
export function selectionScore(rawSel, ng, ctx = {}) {
  const cfg = cfgOf(ctx);
  const sel = ctx.selection || cfg.selection;
  if (sel) {
    const l = Math.log(ng);
    const med = sel.ma + sel.mb * l;
    const mad = Math.max(0.004, sel.da + sel.db * l);
    const z = (rawSel - med) / mad;
    return { K2: clamp(z / cfg.zRef, -0.2, 1), z };
  }
  return { K2: clamp(rawSel / (cfg.selFallbackSlope * Math.log(Math.max(2, ng))), 0, 1), z: null };
}

/** §7 deneyim denkliği tavanı (0–1). */
export const experienceCap = (nA, nB, cfg = DEFAULTS) => {
  const ratio = Math.max(nA, nB) / Math.max(1, Math.min(nA, nB));
  return Math.max(cfg.expCapMin, 1 - cfg.expCapSlope * Math.log10(ratio));
};

/** §7 görüş kanıtı tavanı (0–1). */
export const evidenceCap = (e1, cfg = DEFAULTS) => 1 - cfg.evCapDrop * Math.exp(-(e1 || 0) / cfg.evCapTau);

/**
 * §6–§7 nihai skor.
 * `score` ham (100 ölçekli, negatif olabilir — testler buna bakar); arayüz `display` kullanır.
 */
export function scorePair(a, b, ctx = {}) {
  const cfg = cfgOf(ctx);
  if (!a || !b || !a.n || !b.n) return null;
  const p = pairParts(a, b, ctx);
  const { K2, z } = selectionScore(p.rawSel, p.ng, ctx);
  const rr = Math.sqrt(a.rel * b.rel);
  const E2 = cfg.selEvidencePerTitle * Math.min(a.n, b.n);
  const E3 = Math.min(cfg.contentEvidenceMax, (4 * rr) / (1 - rr));
  const K2s = (E2 * K2) / (E2 + cfg.shrinkSelection);
  const K3s = (E3 * p.K3) / (E3 + cfg.shrinkContent);
  const prior1 = cfg.opinionPriorShare * Math.max(0, Math.min(K2s, K3s));
  const e1 = p.K1 == null ? 0 : p.e1;
  const K1s = (e1 * (p.K1 ?? 0) + cfg.shrinkOpinion * prior1) / (e1 + cfg.shrinkOpinion);
  const blended = cfg.wOpinion * K1s + cfg.wSelection * K2s + cfg.wContent * K3s;

  const capExp = experienceCap(a.n, b.n, cfg);
  const capEv = evidenceCap(e1, cfg);
  const uncappedExp = Math.min(blended * cfg.scale, capEv);
  let sc = Math.min(uncappedExp, capExp);
  const binding = sc >= blended * cfg.scale - 1e-9 ? "none" : sc === capExp ? "experience" : "evidence";
  const flags = { binding, k3Mode: a.k3Mode === "full" && b.k3Mode === "full" ? "full" : "lite" };
  if (p.K1 != null && e1 >= cfg.opinionGateEvidence && p.K1 < cfg.opinionGateK1 && sc > cfg.opinionGateCap) {
    sc = cfg.opinionGateCap;
    flags.opinionGate = true;
  }
  if (!(a.hygiene?.mature ?? true) || !(b.hygiene?.mature ?? true)) {
    if (sc > cfg.immatureCap) sc = cfg.immatureCap;
    flags.immature = true;
  }
  // Rehber (§8): deneyim tavanı uygulanmadan önceki değer ikiz düzeyinde, oran ≥ 3.
  const ratio = Math.max(a.n, b.n) / Math.min(a.n, b.n);
  flags.guide = uncappedExp * 100 >= cfg.twinThreshold && ratio >= 3 && !flags.opinionGate && !flags.immature;
  // Görüş kanıtı ağırlıkla örtükse arayüz "İzleme geçmişinize göre" der.
  flags.implicitHeavy = p.contrib.length > 0 && p.contrib.filter((c) => c.both).length < p.contrib.length / 2;

  const score = 100 * sc;
  return {
    score: Math.round(score * 10) / 10,
    display: Math.round(clamp(score, 0, 100)),
    K1: p.K1, K2, K3: p.K3, z,
    K1s, K2s, K3s,
    E1: e1, E2, E3,
    common: p.common,
    caps: { experience: capExp, evidence: capEv },
    flags,
    explain: explainOf(p.contrib),
  };
}

/** Arayüz için açıklama: ham liste YOK, yalnız ortak yapım anahtarları. */
function explainOf(contrib) {
  const loved = contrib
    .filter((c) => c.sa > 0.3 && c.sb > 0.3)
    .sort((x, y) => y.w - x.w || (x.key < y.key ? -1 : 1))
    .slice(0, 5)
    .map((c) => c.key);
  const split = contrib
    .filter((c) => c.both)
    .map((c) => ({ key: c.key, gap: Math.abs(c.sa - c.sb) }))
    .sort((x, y) => y.gap - x.gap || (x.key < y.key ? -1 : 1))[0];
  return { loved, split: split && split.gap >= 1 ? split.key : null };
}

/** §8 karar etiketi (karşılıklı ilk 10 ve etkinlik şartı çağıranda). */
export function verdictOf(result, ctx = {}) {
  const cfg = cfgOf(ctx);
  if (!result) return "none";
  if (result.flags.guide) return "guide";
  if (result.score >= cfg.twinThreshold) return "twin";
  if (result.score >= cfg.nearThreshold) return "near";
  return "none";
}

// ── nüfustan öğrenme ─────────────────────────────────────────────────────────

function corr(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx } : null;
}

/**
 * Kulvar nüfusundan öğrenilen bağlam (§11.4). Gecelik işte çalışır; sonuç düz JSON.
 * @param {Array<{ items: Array<object> }>} users kulvara süzülmüş kullanıcılar
 * @param {{ config?: object, k3Mode?: "lite"|"full", now?: number }} [options]
 */
export function buildContext(users, { config, k3Mode = "lite", now = Date.now() } = {}) {
  const cfg = { ...DEFAULTS, ...(config || {}) };
  const list = (users || []).filter((u) => Array.isArray(u?.items) && u.items.length > 0);
  const ctx = { config: cfg, k3Mode, poolSize: list.length };

  // nadirlik + genel kanı + oy sayısı dağılımları
  const watchers = {};
  const meta = new Map();
  const ratings = [];
  for (const u of list) {
    const seenKeys = new Set();
    for (const it of u.items) {
      if (!it || typeof it.key !== "string" || seenKeys.has(it.key)) continue;
      seenKeys.add(it.key);
      watchers[it.key] = (watchers[it.key] || 0) + 1;
      if (!meta.has(it.key)) meta.set(it.key, it);
      if (isNum(it.rating)) ratings.push(it.rating);
    }
  }
  ctx.watchers = watchers;
  const metas = [...meta.values()];
  ctx.voteAvgSorted = metas.map((m) => m.voteAverage).filter((v, i) => isNum(v) && !(isNum(metas[i].voteCount) && metas[i].voteCount < 5)).sort((a, b) => a - b);
  ctx.voteCountSorted = metas.map((m) => m.voteCount).filter(isNum).sort((a, b) => a - b);
  ctx.ratingSorted = ratings.sort((a, b) => a - b);
  if (ctx.voteAvgSorted.length < 50) delete ctx.voteAvgSorted;
  if (ctx.voteCountSorted.length < 50) delete ctx.voteCountSorted;
  if (ctx.ratingSorted.length < 200) delete ctx.ratingSorted;

  // K-2a örtük tablo, r_ie, γ: hem puanı hem davranışı olan kayıtlardan
  const byKind = {};
  const pairsS = [];
  const crowdX = [];
  const crowdY = [];
  const crowdAcc = new Map();
  for (const u of list) {
    const { scores } = explicitScores(u.items, ctx);
    for (const it of u.items) {
      const s = scores.get(it?.key);
      if (s == null) continue;
      const c = crowdOf(it, ctx);
      if (c !== 0) { crowdX.push(c); crowdY.push(s); }
      const kind = implicitKindOf(it) || "watched";
      (byKind[kind] = byKind[kind] || []).push(s);
      pairsS.push([kind, s]);
      const acc = crowdAcc.get(it.key) || [0, 0];
      acc[0] += s;
      acc[1] += 1;
      crowdAcc.set(it.key, acc);
    }
  }
  const implicit = { ...cfg.implicit };
  for (const kind of IMPLICIT_ORDER) {
    const arr = byKind[kind];
    if (arr && arr.length >= cfg.implicitMinSamples) implicit[kind] = round4(arr.reduce((s, v) => s + v, 0) / arr.length);
  }
  ctx.implicit = implicit;
  {
    let sum = 0;
    let cnt = 0;
    for (const u of list) for (const it of u.items) {
      if (!it || typeof it.key !== "string") continue;
      const kind = implicitKindOf(it) || "watched";
      const w = kind === "watched" ? cfg.implicitWatchedWeight : 1;
      sum += w * implicit[kind];
      cnt += w;
    }
    if (cnt >= cfg.implicitMinSamples * cfg.implicitWatchedWeight) ctx.implicitMean = round4(sum / cnt);
  }
  // Nüfus içi genel kanı: yeterli açık puanı olan yapımlarda ortalama s.
  const crowdS = {};
  const raters = list.filter((u) => u.items.some((it) => isNum(it?.rating))).length;
  const minRaters = Math.max(cfg.crowdMinRaters, cfg.crowdMinShare * raters);
  for (const [key, [sum, n]] of crowdAcc) if (n >= minRaters) crowdS[key] = [round4(sum / n), n];
  ctx.crowdS = crowdS;
  if (pairsS.length >= cfg.implicitMinSamples) {
    const c = corr(pairsS.map(([k]) => implicit[k]), pairsS.map(([, s]) => s));
    if (c && c.r > 0) ctx.rIE = round4(Math.min(c.r, cfg.relExplicit));
  }
  if (crowdX.length >= cfg.implicitMinSamples) {
    const c = corr(crowdX, crowdY);
    if (c) ctx.gamma = round4(clamp(c.slope, 0, 1));
  }

  // M0 ve içerik özelliği nadirliği için ilk geçiş profilleri
  const titleCount = Math.max(1, meta.size);
  const df = new Map();
  for (const m of metas) for (const f of featuresOf(m, k3Mode).keys()) df.set(f, (df.get(f) || 0) + 1);
  const featureIdf = {};
  for (const [f, c] of df) featureIdf[f] = round4(Math.max(0.05, Math.log(titleCount / c)));
  ctx.featureIdf = featureIdf;

  const first = list.map((u) => buildProfile(u, ctx, { now }));
  let se = 0, ne = 0, si = 0, ni = 0;
  for (const p of first) for (const g of Object.values(p.sig)) {
    if (g.x) { se += g.d * g.d; ne += 1; } else { si += g.d * g.d; ni += 1; }
  }
  if (ne >= 50) ctx.m0Explicit = round4(se / ne);
  if (ni >= 50) ctx.m0Implicit = round4(si / ni);
  const mean = {};
  if (first.length > 0) {
    for (const p of first) for (const [k, v] of Object.entries(p.prof)) mean[k] = (mean[k] || 0) + v / first.length;
    for (const k of Object.keys(mean)) mean[k] = round4(mean[k]);
    ctx.meanProfile = mean;
  }

  // §5.2 şans dağılımı: liste büyüklükleri yakın çiftlerde kova başına medyan ve MAD
  const buckets = new Map();
  let pairCount = 0;
  const step = Math.max(1, Math.floor((first.length * (first.length - 1)) / 2 / 40000));
  let idx = 0;
  for (let i = 0; i < first.length; i += 1) {
    for (let j = i + 1; j < first.length; j += 1) {
      idx += 1;
      if (idx % step) continue;
      const a = first[i];
      const b = first[j];
      if (Math.max(a.n, b.n) / Math.min(a.n, b.n) > cfg.selMaxRatio) continue;
      const pp = pairParts(a, b, ctx);
      const key = Math.round(Math.log2(pp.ng) * 2);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(pp.rawSel);
      pairCount += 1;
    }
  }
  if (pairCount >= cfg.selMinPairs) {
    const pts = [];
    for (const [key, arr] of buckets) {
      if (arr.length < 150) continue;
      arr.sort((x, y) => x - y);
      const med = arr[Math.floor(arr.length / 2)];
      const dev = arr.map((x) => Math.abs(x - med)).sort((x, y) => x - y);
      pts.push([Math.log(2 ** (key / 2)), med, dev[Math.floor(dev.length / 2)]]);
    }
    if (pts.length >= 2) {
      const fit = (j) => {
        const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const my = pts.reduce((s, p) => s + p[j], 0) / pts.length;
        const den = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0) || 1;
        const bb = pts.reduce((s, p) => s + (p[0] - mx) * (p[j] - my), 0) / den;
        return [my - bb * mx, bb];
      };
      const [ma, mb] = fit(1);
      const [da, db] = fit(2);
      ctx.selection = { ma: round4(ma), mb: round4(mb), da: round4(da), db: round4(db) };
    }
  }
  return ctx;
}
