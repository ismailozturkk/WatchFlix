// utils/titleTasteFit.js
//
// Film/dizi detayındaki "Zevk uyumunu değerlendir" — bu yapım KULLANICININ zevkine ne kadar uyar?
// SAF çekirdek: RN/Firebase importu yok, jest kapsamında. Metinler utils/titleTasteFitCopy.js'te.
//
// YAKLAŞIM (v2, 12 Kas):
//   1) Kütüphane hazırlanır: izlenen film + diziler, tür adları kanonik id'ye (genreCanon.kanonikTur — dil
//      bağımsız), her kayıt izleme tarihine göre AĞIRLIKLANIR (yakın zamanda izlenen daha çok sayılır;
//      tarihsiz kayıt nötr ağırlık alır).
//   2) Kullanıcının puanlama alışkanlığı çıkarılır (ortalama + sapma): sert puanlayan biri için 7 "iyi",
//      cömert biri için "orta" olabilir. Puanlar z-skora çevrilerek karşılaştırılır.
//   3) On iki bileşen hesaplanır; her biri 0–1. Yeterli verisi olmayan bileşen DÜŞER (ağırlıklar kalanlara
//      göre yeniden normalleşir) — "bilinmiyor"u sıfır saymayız. Az örnekli bileşenler 0.5'e doğru
//      ÇEKİLİR (küçültme / shrinkage): 2 kayıttan çıkan %100, 40 kayıttan çıkan %100 kadar güçlü değildir.
//        predicted (.26) Tahmini puanın: tür benzerliği (Jaccard) + TMDB benzerlik listesiyle ağırlıklı,
//                        yakın komşu tahmini; puanlar kişisel ortalama/sapmaya göre normalize.
//        genres    (.16) Tür eğilimi: hedefin türleri izlediklerinde ne kadar yer tutuyor (zaman ağırlıklı).
//        recent    (.06) Son dönem: son izlediklerinde bu türlerin payı.
//        genreRate (.12) Tür puanların: bu türlere verdiğin ortalama + genel ortalamandan farkı.
//        combo     (.06) Tür karışımı: hedefle aynı tür KOMBİNASYONUNU (Jaccard ≥ 0.5) ne sıklıkla izliyorsun.
//        likes     (.09) Beğenilerin: favorilerin ve 8+ puanlılarının ne kadarı bu türlerde.
//        avoid     (.06) Kaçındıkların: bu türlerde düşük puan (≤ 4.5) verdiklerinin oranı (ters ölçek).
//        similar   (.18) Benzer yapımlar: TMDB'nin önerdiklerinden izlediklerin ve onlara puanın.
//        interest  (.04) İlgin: izleme listendekilerin ne kadarı bu türlerde (niyet sinyali).
//        format    (.04) Film/dizi tercihi: bu biçimi ne kadar izliyorsun.
//        runtime   (.04) Süre uyumu (yalnız film): süresi izlediğin filmlerin ortanca süresine yakınlığı.
//        public    (.07) Genel beğeni: TMDB ortalaması (yeterli oy varsa).
//   4) Ayarlar: izleme listendeyse +3; yapımı ZATEN puanladıysan sonuç %60 kendi puanına çekilir.
//   5) Güven ve AZ VERİ: kayıt sayısı, puan sayısı ve hesaba giren çekirdek bileşen oranından "güven"
//      çıkar; az veride `lowData` bayrağı kalkar ve arayüz "değerlerde yanılma olabilir" uyarısı gösterir.
//
// TÜR SAYISI FARKI (12 Kas): içerikler 1–4 türle etiketlenir. genreCanon.weightedGenres her içeriğe toplam 1 tür
// ağırlığı verir (ana tür önde, sıraya göre azalan). Böylece 4 türlü içerik profili şişirmez; hedef yapımın
// ANA türüne uymak yan türüne uymaktan değerlidir (`hitOf`: eşleşen hedef ağırlığı / ana tür ağırlığı, ≤ 1);
// komşu benzerliği ağırlık örtüşmesi + küme kapsaması ortalamasıdır (tek türlü hedef, o türü içeren çok türlü
// içeriği "tamamen farklı" saymaz).
//
// Bu bir HEURİSTİKTİR; eşikler ve ağırlıklar aşağıda sabit, testle kilitli.

import { genreRelation, weightedGenres } from "./genreCanon";

export const MIN_WATCHED = 5;
export const LOW_DATA_WATCHED = 20;
export const LOW_DATA_RATED = 8;
export const MIN_GENRE_RATED = 3;
export const MIN_PREDICT_NEIGHBORS = 3;
export const MIN_LIKES = 3;
export const MIN_RUNTIME_SAMPLES = 5;
export const MIN_PUBLIC_VOTES = 30;
export const MIN_INTEREST = 5;
export const MIN_FORMAT_WATCHED = 10;
export const MIN_COMBO_WATCHED = 10;
export const RECENT_WINDOW = 15;
export const MIN_RECENT_DATED = 8;
export const LOVED_RATING = 8;
export const DISLIKED_RATING = 4.5;
export const WATCHLIST_BONUS = 3;
/** Kendi puanın varsa sonucun bu kadarı o puandan gelir. */
export const OWN_RATING_PULL = 0.6;
/** Yakınlık yarı-ömrü (gün): bu kadar önce izlenen kayıt ağırlığının ~%63'ünü kaybeder. */
export const RECENCY_DAYS = 540;
export const MAX_SIMILAR_SHOWN = 8;
export const MAX_INSIGHTS = 7;
// Öteki biçimin (film↔dizi) ağırlığı: aynı biçimde hiç kayıt yoksa 0.85, her 40 kayıtta 1 azalır, en az 0.35.
export const CROSS_TYPE_MAX = 0.85;
export const CROSS_TYPE_MIN = 0.35;
export const CROSS_TYPE_SPAN = 40;
// Öteki biçimde hedef tür yoksa akraba türden (Gerilim ↔ Suç/Gizem) taşınan payın çarpanı.
export const BRIDGE_FACTOR = 0.8;

export const WEIGHTS = Object.freeze({
  predicted: 0.26,
  genres: 0.16,
  recent: 0.06,
  genreRate: 0.12,
  combo: 0.06,
  likes: 0.09,
  avoid: 0.06,
  similar: 0.18,
  interest: 0.04,
  format: 0.04,
  runtime: 0.04,
  public: 0.07,
});
export const COMPONENT_ORDER = Object.freeze([
  "predicted", "genres", "recent", "genreRate", "combo", "likes", "avoid", "similar", "interest", "format", "runtime", "public",
]);
const CORE = ["predicted", "genres", "genreRate", "likes", "similar"];

export const TIERS = Object.freeze([
  { id: "love", min: 82 },
  { id: "like", min: 68 },
  { id: "maybe", min: 52 },
  { id: "mixed", min: 38 },
  { id: "skip", min: 0 },
]);
export const tierOf = (score) => (score == null ? null : TIERS.find((tier) => score >= tier.min).id);

const asArray = (value) => (Array.isArray(value) ? value : []);
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const validId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const keyOf = (type, id) => `${type === "tv" ? "tv" : "movie"}_${Number(id)}`;
const round1 = (n) => Math.round(n * 10) / 10;
/** Puanı 4–9 aralığından 0–1'e taşır (4 altı "sevmedi", 9 üstü "bayıldı"). */
const normRating = (r) => clamp01((r - 4) / 5);
/** Az örnekli skoru nötre (0.5) çeker: n örnek, k "sahte nötr örnek". */
export const shrink = (score, n, k) => 0.5 + (score - 0.5) * (n / (n + k));

/** Tarih → ms. Sayı (ms/sn), ISO metni, Firestore Timestamp ({seconds} / toMillis). */
export function timeOf(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value.seconds)) return value.seconds * 1000;
  return null;
}

function indexList(list, forcedType, into, now) {
  for (const item of asArray(list)) {
    if (!item || !validId(item.id)) continue;
    const type = forcedType || (item.type === "tv" || item.media_type === "tv" ? "tv" : "movie");
    const key = keyOf(type, item.id);
    if (into.has(key)) continue;
    const minutes = Number(item.minutes ?? item.runtime);
    const time = timeOf(item.dateAdded ?? item.watchedAt ?? item.addedDate ?? item.lastWatchedAt);
    const days = time == null ? null : Math.max(0, (now - time) / 864e5);
    const gw = weightedGenres(item.genres);
    into.set(key, {
      key,
      id: Number(item.id),
      type,
      name: item.name || item.title || "",
      imagePath: item.imagePath || item.poster_path || null,
      genres: new Set(gw.keys()),
      gw,
      // Ana türün ağırlığı: bir türün bu içerikteki merkeziliği = ağırlığı / maxGw (ana tür 1, yan türler < 1).
      maxGw: gw.size ? Math.max(...gw.values()) : 1,
      minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
      time,
      // Tarihsiz kayıt nötr (0.75); taze kayıt 1'e, çok eski kayıt 0.45'e yaklaşır.
      recency: days == null ? 0.75 : 0.45 + 0.55 * Math.exp(-days / RECENCY_DAYS),
    });
  }
  return into;
}

const ratingOf = (ratings, key) => {
  const n = Number(ratings?.[key]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const overlapCount = (a, b) => {
  let n = 0;
  for (const g of a) if (b.has(g)) n += 1;
  return n;
};
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  const inter = overlapCount(a, b);
  return inter / (a.size + b.size - inter);
};

function insufficient(base) {
  return {
    ...base,
    state: "insufficient",
    needed: MIN_WATCHED,
    score: null,
    tier: null,
    confidence: null,
    lowData: true,
    predictedRating: null,
    breakdown: [],
    insights: [],
    similarWatched: [],
  };
}

/**
 * @param {object} params
 * @param {{ type: "movie"|"tv", id: number, genres: Array<string|{name:string}>, runtime?: number,
 *   voteAverage?: number, voteCount?: number, similar?: Array<{id:number, media_type?:string}> }} params.target
 * @param {{ watchedMovies?: Array, watchedShows?: Array, watchList?: Array, favorites?: Array,
 *   ratings?: Record<string, number> }} params.library
 * @param {number} [params.now] test için sabit zaman (ms)
 */
export function computeTitleTasteFit({ target, library, now = Date.now() } = {}) {
  const t = target || {};
  const lib = library || {};
  const type = t.type === "tv" ? "tv" : "movie";
  const targetKey = validId(t.id) ? keyOf(type, t.id) : null;
  const targetW = weightedGenres(t.genres);
  const targetGenres = new Set(targetW.keys());
  const primaryGenre = targetGenres.size ? [...targetGenres][0] : null;
  const primaryW = primaryGenre ? targetW.get(primaryGenre) : 1;
  const ratings = lib.ratings && typeof lib.ratings === "object" ? lib.ratings : {};

  const watched = new Map();
  indexList(lib.watchedMovies, "movie", watched, now);
  indexList(lib.watchedShows, "tv", watched, now);

  // ── Biçim ağırlığı: hedef film ise filmler, dizi ise diziler esas alınır ──
  // Film ve dizi tür sözlükleri farklıdır (dizide Gerilim/Korku/Romantik yok; Aksiyon & Macera birleşik).
  // Aynı biçimde yeterli kayıt varsa öteki biçim az sayılır; azsa ondan daha çok "ödünç" alınır.
  let sameTypeCount = 0;
  let otherTypeCount = 0;
  for (const item of watched.values()) {
    if (!item.genres.size || item.key === targetKey) continue;
    if (item.type === type) sameTypeCount += 1;
    else otherTypeCount += 1;
  }
  const crossWeight = Math.max(CROSS_TYPE_MIN, Math.min(CROSS_TYPE_MAX, CROSS_TYPE_MAX - sameTypeCount / CROSS_TYPE_SPAN));
  const twOf = (item) => (item.type === type ? 1 : crossWeight);
  const weightOf = (item) => item.recency * twOf(item);

  /**
   * İçerik, hedefin `g` türüne ne kadar uyar (0–1)? İçerikte g varsa MERKEZİLİĞİ (ana türse 1, 3 türlünün
   * sonuncusuysa ~0.5): üç türlü bir aksiyon-macera-komediyi sevmek, saf bir komediyi sevmek demek değildir.
   * İçerik ÖTEKİ biçimdense ve g'yi içermiyorsa akraba türden kısmi köprü (dizide olmayan Gerilim ↔ Suç/Gizem).
   */
  const matchOf = (item, g) => {
    const w = item.gw.get(g);
    if (w) return w / item.maxGw;
    if (item.type === type) return 0;
    let best = 0;
    for (const [h, hw] of item.gw) best = Math.max(best, genreRelation(g, h) * (hw / item.maxGw));
    return best * BRIDGE_FACTOR;
  };
  /** İçeriğin hedefle tür eşleşmesi 0–1: hedefin ana türünü ana türü olarak taşıyan 1, yan türde daha az. */
  const hitOf = (item) => {
    let w = 0;
    for (const [g, tw] of targetW) w += tw * matchOf(item, g);
    return Math.min(1, w / primaryW);
  };
  /** Komşu benzerliği: tür ağırlıkları örtüşmesi (Σ min) ile merkeziliğe göre eşleşmenin ortalaması. */
  const simOf = (item) => {
    if (!item.genres.size || !targetGenres.size) return 0;
    let soft = 0;
    for (const [g, w] of item.gw) soft += Math.min(w, targetW.get(g) || 0);
    return 0.5 * soft + 0.5 * hitOf(item);
  };
  const own = targetKey
    ? { watched: watched.has(targetKey), rating: ratingOf(ratings, targetKey) }
    : { watched: false, rating: null };
  // Hedefin kendisi zevk ölçümünde kullanılmaz (döngüsel olur); kendi puanı ayrıca çekilir.
  if (targetKey) watched.delete(targetKey);

  const favorites = indexList(lib.favorites, null, new Map(), now);
  const watchList = indexList(lib.watchList, null, new Map(), now);
  const inWatchlist = !!targetKey && watchList.has(targetKey);

  const withGenres = [...watched.values()].filter((item) => item.genres.size > 0);
  const rated = withGenres
    .map((item) => ({ item, rating: ratingOf(ratings, item.key) }))
    .filter((r) => r.rating != null);

  const base = {
    type,
    own,
    inWatchlist,
    watchedCount: watched.size,
    targetGenres: [...targetGenres],
    stats: {
      watched: withGenres.length,
      rated: rated.length,
      likes: 0,
      similarPool: 0,
      sameType: sameTypeCount,
      otherType: otherTypeCount,
      crossWeight: Math.round(crossWeight * 100) / 100,
    },
  };
  if (withGenres.length < MIN_WATCHED) return insufficient(base);

  const components = {};
  const insights = [];
  const add = (id, score) => {
    if (Number.isFinite(score)) components[id] = clamp01(score);
  };

  // ── Puan alışkanlığı (z-skor için) ─────────────────────────────────────
  const mean = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : null;
  const std = rated.length >= 3
    ? Math.max(0.8, Math.sqrt(rated.reduce((a, r) => a + (r.rating - mean) ** 2, 0) / rated.length))
    : 1.5;

  // ── Benzer yapımlar havuzu (TMDB önerileri) ────────────────────────────
  const similar = [];
  const similarSet = new Set();
  for (const s of asArray(t.similar)) {
    if (!s || !validId(s.id)) continue;
    const key = keyOf(s.media_type === "tv" || s.media_type === "movie" ? s.media_type : type, s.id);
    if (key === targetKey || similarSet.has(key)) continue;
    similarSet.add(key);
    similar.push(key);
  }
  base.stats.similarPool = similar.length;

  // ── Tahmini puan (yakın komşu) ─────────────────────────────────────────
  let predictedRating = null;
  if (rated.length > 0 && targetGenres.size > 0) {
    let num = 0;
    let den = 0;
    let neighbors = 0;
    for (const r of rated) {
      let sim = simOf(r.item);
      if (similarSet.has(r.item.key)) sim = Math.min(1, Math.max(sim, 0.5) + 0.35);
      if (sim < 0.35) continue;
      const w = sim * sim * weightOf(r.item);
      num += w * ((r.rating - mean) / std);
      den += w;
      neighbors += 1;
    }
    if (neighbors >= MIN_PREDICT_NEIGHBORS && den > 0) {
      // Toplam ağırlık küçükse tahmin kişinin kendi ortalamasına çekilir.
      const z = (num / den) * (den / (den + 1.5));
      predictedRating = Math.max(1, Math.min(10, mean + z * std));
      add("predicted", normRating(predictedRating));
      insights.push({
        kind: "predicted",
        tone: predictedRating >= 7 ? "pos" : predictedRating < 5.5 ? "neg" : "neutral",
        weight: 12,
        rating: round1(predictedRating),
        neighbors,
      });
    }
  }

  // ── Tür eğilimi (zaman ağırlıklı) ──────────────────────────────────────
  const counts = new Map();
  const rawCounts = new Map();
  let totalW = 0;
  for (const item of withGenres) {
    const iw = weightOf(item);
    totalW += iw;
    for (const g of item.genres) {
      counts.set(g, (counts.get(g) || 0) + iw * (item.gw.get(g) || 0));
      rawCounts.set(g, (rawCounts.get(g) || 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const maxCount = ranked[0]?.[1] || 1;
  const genreStats = [...targetGenres].map((g) => {
    const count = rawCounts.get(g) || 0;
    const rank = ranked.findIndex(([id]) => id === g);
    return {
      id: g,
      count,
      share: (counts.get(g) || 0) / totalW,
      rank: rank >= 0 ? rank + 1 : null,
      rel: (counts.get(g) || 0) / maxCount,
    };
  });
  const weightedAvgHit = (items) => {
    let num = 0;
    let den = 0;
    for (const i of items) {
      num += hitOf(i) * twOf(i);
      den += twOf(i);
    }
    return den ? num / den : 0;
  };
  const overallTargetShare = weightedAvgHit(withGenres);
  if (genreStats.length > 0) {
    // Hedefin tür ağırlıklarıyla ortalama + ana türün kendi payı: yan türü az izlenmesi sonucu ezmesin.
    const weighted = genreStats.reduce((a, s) => a + targetW.get(s.id) * Math.sqrt(s.rel), 0);
    const primaryRel = Math.sqrt(genreStats[0].rel);
    add("genres", shrink(0.6 * weighted + 0.4 * primaryRel, withGenres.length, 6));
    const top = genreStats.filter((s) => s.rank && s.rank <= 3).sort((a, b) => a.rank - b.rank)[0];
    if (top) insights.push({ kind: "topGenre", tone: "pos", weight: 9, genre: top.id, rank: top.rank, share: top.share });
    const fresh = genreStats.filter((s) => s.count <= 1).sort((a, b) => a.count - b.count)[0];
    if (fresh) insights.push({ kind: "newGenre", tone: genreStats.length === 1 ? "neg" : "neutral", weight: 6, genre: fresh.id });
  }

  // ── Son dönem eğilimi ──────────────────────────────────────────────────
  const dated = withGenres.filter((i) => i.time != null).sort((a, b) => b.time - a.time);
  if (dated.length >= MIN_RECENT_DATED && targetGenres.size > 0) {
    const recentItems = dated.slice(0, RECENT_WINDOW);
    const recentShare = weightedAvgHit(recentItems);
    add("recent", shrink(clamp01(Math.sqrt(recentShare / 0.5)), recentItems.length, 4));
    const drift = recentShare - overallTargetShare;
    if (drift >= 0.15) insights.push({ kind: "trendUp", tone: "pos", weight: 6, share: recentShare });
    else if (drift <= -0.2) insights.push({ kind: "trendDown", tone: "neutral", weight: 5, share: recentShare });
  }

  // ── Tür puanların + kaçındıkların ──────────────────────────────────────
  if (rated.length > 0 && targetGenres.size > 0) {
    let wSum = 0;
    let wTotal = 0;
    let matched = 0;
    let hitSum = 0; // etkin örnek: yan türde eşleşen içerik tam örnek sayılmaz
    let low = 0;
    for (const r of rated) {
      const hit = hitOf(r.item);
      if (!hit) continue;
      const w = hit * weightOf(r.item);
      wSum += r.rating * w;
      wTotal += w;
      matched += 1;
      hitSum += hit;
      if (r.rating <= DISLIKED_RATING) low += hit;
    }
    if (matched >= MIN_GENRE_RATED && wTotal > 0) {
      const genreAvg = wSum / wTotal;
      const diff = genreAvg - mean;
      add("genreRate", shrink(0.55 * normRating(genreAvg) + 0.45 * clamp01(0.5 + diff / (2 * std)), hitSum, 3));
      insights.push({
        kind: "genreRating",
        tone: diff >= 0.25 ? "pos" : diff <= -0.4 ? "neg" : "neutral",
        weight: 8,
        avg: round1(genreAvg),
        overall: round1(mean),
        count: matched,
      });
      const lowFrac = low / matched;
      add("avoid", shrink(1 - clamp01(lowFrac / 0.5), matched, 3));
      if (low >= 2 && lowFrac >= 0.25) insights.push({ kind: "dislikes", tone: "neg", weight: 8, count: Math.round(low), total: matched });
    }
  }

  // ── Saf tür: tek türlü hedefte, o türü ANA tür olarak mı yoksa yan tür olarak mı seviyorsun? ──
  // Aksiyon-macera-komedileri seven biri saf bir komediyi sevmeyebilir; tür merkeziliği zaten hitOf'ta
  // indirimli sayılıyor, burada kullanıcıya açıkça söylenir.
  if (targetGenres.size === 1) {
    const g = primaryGenre;
    let asPrimary = 0;
    let asSide = 0;
    const primaryRatings = [];
    const sideRatings = [];
    for (const item of withGenres) {
      const w = item.gw.get(g);
      if (!w) continue;
      const lead = w / item.maxGw >= 0.999;
      if (lead) asPrimary += 1;
      else asSide += 1;
      const rating = ratingOf(ratings, item.key);
      if (rating != null) (lead ? primaryRatings : sideRatings).push(rating);
    }
    const total = asPrimary + asSide;
    const avgOf = (list) => list.reduce((a, v) => a + v, 0) / list.length;
    if (primaryRatings.length >= 2 && sideRatings.length >= 2) {
      const pAvg = avgOf(primaryRatings);
      const sAvg = avgOf(sideRatings);
      if (pAvg - sAvg <= -1) {
        insights.push({ kind: "primaryLower", tone: "neg", weight: 9, genre: g, primaryAvg: round1(pAvg), sideAvg: round1(sAvg) });
      } else if (pAvg - sAvg >= 1) {
        insights.push({ kind: "primaryHigher", tone: "pos", weight: 7, genre: g, primaryAvg: round1(pAvg), sideAvg: round1(sAvg) });
      }
    }
    if (total >= 3 && asPrimary / total < 0.35) {
      insights.push({ kind: "sideGenre", tone: "neutral", weight: 7, genre: g, side: asSide, total });
    }
  }

  // ── Biçim tabanı: analiz hangi biçimdeki kayıtlara dayanıyor? ──
  if (otherTypeCount > 0) {
    insights.push({
      kind: "typeBasis",
      tone: "neutral",
      weight: 2,
      type,
      sameType: sameTypeCount,
      otherType: otherTypeCount,
      borrowed: crossWeight >= 0.6,
    });
  }

  // ── Tür karışımı ───────────────────────────────────────────────────────
  if (targetGenres.size >= 2 && withGenres.length >= MIN_COMBO_WATCHED) {
    const comboItems = withGenres.filter((i) => jaccard(i.genres, targetGenres) >= 0.5);
    const comboShare = comboItems.length / withGenres.length;
    add("combo", shrink(clamp01(Math.sqrt(comboShare / 0.15)), withGenres.length, 8));
    if (comboItems.length >= 3) insights.push({ kind: "combo", tone: comboShare >= 0.08 ? "pos" : "neutral", weight: 5, count: comboItems.length });
  }

  // ── Beğenilerin (favoriler + yüksek puanlılar) ─────────────────────────
  const likes = new Map();
  for (const [key, item] of favorites) {
    if (key === targetKey) continue;
    // Favori kaydında tür yoksa izlenen kopyasındaki türü kullan.
    const source = item.genres.size ? item : watched.get(key);
    if (source?.genres.size) likes.set(key, source);
  }
  const lovedCut = mean == null ? LOVED_RATING : Math.max(7, Math.min(LOVED_RATING, mean + 0.75 * std));
  for (const r of rated) if (r.rating >= lovedCut) likes.set(r.item.key, r.item);
  base.stats.likes = likes.size;
  if (likes.size >= MIN_LIKES && targetGenres.size > 0) {
    let hits = 0;
    let hitWeight = 0;
    for (const item of likes.values()) {
      const h = hitOf(item);
      hitWeight += h;
      if (h > 0) hits += 1;
    }
    const fraction = hitWeight / likes.size;
    // Taban oran: bu türler izlediklerinin zaten ne kadarı? Beğenilerdeki pay bundan yüksekse ekstra sinyal.
    const lift = overallTargetShare > 0 ? fraction / overallTargetShare : 1;
    add("likes", shrink(clamp01(0.7 * Math.sqrt(fraction / 0.6) + 0.3 * clamp01(lift / 1.5)), likes.size, 3));
    if (hits > 0) insights.push({ kind: "likesHit", tone: fraction >= 0.35 ? "pos" : "neutral", weight: 7, count: hits, total: likes.size });
  }

  // ── Benzer yapımlar ────────────────────────────────────────────────────
  const similarWatched = [];
  for (const key of similar) {
    const item = watched.get(key);
    if (!item) continue;
    similarWatched.push({
      key,
      id: item.id,
      type: item.type,
      name: item.name,
      imagePath: item.imagePath,
      rating: ratingOf(ratings, key),
      favorite: favorites.has(key),
    });
  }
  if (similarWatched.length > 0) {
    const coverage = clamp01(similarWatched.length / Math.min(Math.max(similar.length, 1), 6));
    const ratedSimilar = similarWatched.filter((s) => s.rating != null);
    const favBoost = similarWatched.some((s) => s.favorite) ? 0.08 : 0;
    let score;
    let avg = null;
    if (ratedSimilar.length > 0) {
      avg = ratedSimilar.reduce((a, s) => a + s.rating, 0) / ratedSimilar.length;
      // Hem mutlak puan hem kişinin kendi ortalamasına göre fark.
      const rel = mean == null ? 0.5 : clamp01(0.5 + (avg - mean) / (2 * std));
      score = 0.5 * normRating(avg) + 0.25 * rel + 0.25 * coverage;
    } else {
      score = 0.55 + 0.4 * coverage;
    }
    add("similar", shrink(clamp01(score + favBoost), similarWatched.length, 1.5));
    insights.push({
      kind: "similar",
      tone: avg == null ? "pos" : avg >= 7 ? "pos" : avg < 5.5 ? "neg" : "neutral",
      weight: 10,
      count: similarWatched.length,
      avg: avg == null ? null : round1(avg),
    });
  } else if (similar.length >= 5 && watched.size >= 40) {
    insights.push({ kind: "similarNone", tone: "neutral", weight: 3 });
  }

  // ── İlgin (izleme listesi) ─────────────────────────────────────────────
  const listGenres = [...watchList.values()].filter((i) => i.key !== targetKey && i.genres.size > 0);
  if (listGenres.length >= MIN_INTEREST && targetGenres.size > 0) {
    const share = listGenres.reduce((a, i) => a + hitOf(i), 0) / listGenres.length;
    add("interest", shrink(clamp01(Math.sqrt(share / 0.5)), listGenres.length, 4));
  }

  // ── Film/dizi tercihi ──────────────────────────────────────────────────
  if (watched.size >= MIN_FORMAT_WATCHED) {
    const typeShare = [...watched.values()].filter((i) => i.type === type).length / watched.size;
    add("format", clamp01(0.35 + typeShare));
    if (typeShare < 0.15) insights.push({ kind: "formatRare", tone: "neutral", weight: 4 });
  }

  // ── Süre uyumu (film) ─────────────────────────────────────────────────
  const runtime = Number(t.runtime);
  if (type === "movie" && Number.isFinite(runtime) && runtime > 0) {
    const samples = [...watched.values()].filter((i) => i.type === "movie" && i.minutes).map((i) => i.minutes);
    if (samples.length >= MIN_RUNTIME_SAMPLES) {
      const med = median(samples);
      const ratio = runtime / med;
      add("runtime", 1 - Math.abs(Math.log(ratio)) / Math.log(2.2));
      if (ratio >= 1.3) insights.push({ kind: "runtimeLong", tone: "neg", weight: 4, runtime, median: Math.round(med) });
      else if (ratio <= 0.7) insights.push({ kind: "runtimeShort", tone: "neutral", weight: 3, runtime, median: Math.round(med) });
    }
  }

  // ── Genel beğeni ───────────────────────────────────────────────────────
  const voteAverage = Number(t.voteAverage);
  const voteCount = Number(t.voteCount);
  if (Number.isFinite(voteAverage) && voteAverage > 0 && Number(voteCount) >= MIN_PUBLIC_VOTES) {
    // Az oylu yapımın ortalaması güvenilmez: oy sayısıyla nötre çek.
    add("public", shrink((voteAverage - 5) / 3.5, Math.log10(voteCount), 1));
    if (voteAverage >= 7.5) insights.push({ kind: "publicHigh", tone: "pos", weight: 5, avg: round1(voteAverage) });
    else if (voteAverage < 6) insights.push({ kind: "publicLow", tone: "neg", weight: 5, avg: round1(voteAverage) });
  }

  const present = COMPONENT_ORDER.filter((id) => components[id] != null);
  if (present.length === 0) return insufficient(base);

  const totalWeight = present.reduce((a, id) => a + WEIGHTS[id], 0);
  const model = present.reduce((a, id) => a + components[id] * WEIGHTS[id], 0) / totalWeight;
  let score = 5 + model * 93;
  if (inWatchlist) {
    score += WATCHLIST_BONUS;
    insights.push({ kind: "inWatchlist", tone: "pos", weight: 4 });
  }
  if (own.rating != null) {
    score = OWN_RATING_PULL * own.rating * 10 + (1 - OWN_RATING_PULL) * score;
    insights.push({ kind: "ownRating", tone: own.rating >= 7 ? "pos" : own.rating < 5 ? "neg" : "neutral", weight: 13, rating: own.rating });
  }
  score = Math.round(Math.max(3, Math.min(98, score)));

  // ── Güven + az veri ────────────────────────────────────────────────────
  const coreFraction = CORE.filter((id) => components[id] != null).length / CORE.length;
  const evidence =
    0.4 * Math.min(1, withGenres.length / 60) + 0.35 * Math.min(1, rated.length / 30) + 0.25 * coreFraction;
  const confidence = evidence >= 0.7 ? "high" : evidence >= 0.4 ? "medium" : "low";
  const lowData = withGenres.length < LOW_DATA_WATCHED || rated.length < LOW_DATA_RATED || confidence === "low";

  insights.sort((a, b) => b.weight - a.weight);

  return {
    ...base,
    state: "ok",
    score,
    tier: tierOf(score),
    confidence,
    evidence: Math.round(evidence * 100),
    lowData,
    predictedRating: predictedRating == null ? null : round1(predictedRating),
    breakdown: present.map((id) => ({
      id,
      score: Math.round(components[id] * 100),
      weight: WEIGHTS[id] / totalWeight,
    })),
    genreStats,
    insights: insights.slice(0, MAX_INSIGHTS),
    similarWatched: similarWatched
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, MAX_SIMILAR_SHOWN),
  };
}
