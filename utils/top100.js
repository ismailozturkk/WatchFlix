// utils/top100.js
//
// "Seelogd Top 100" sıralamasının SAF çekirdeği (ağ/React yok, testli: __tests__/top100.test.js).
//
// PUAN MODELİ — Seelogd oyu TMDB oylamasına EKLENİR:
//   • Her yapımın TMDB ortalaması (vote_average) bir "ön oy kütlesi" gibi davranır. Kütlenin ağırlığı TMDB oy sayısının
//     LOGARİTMASIYLA büyür (TMDB_WEIGHT_PER_DECADE × log10(n+1), üstte TMDB_WEIGHT_CAP): 30 bin oylu bir film ~90
//     Seelogd oyu ağırlığında sayılır, 500 oylu bir dizi ~54. Ham sayı kullanılsaydı (on binlerce) Seelogd oyları
//     sıralamayı hiç oynatamazdı; log ölçek "çok oylanan daha güvenilir" bilgisini korur ama topluluğa söz bırakır.
//   • Birleşik ortalama = (tmdbAvg × w + seelogdToplam) / (w + seelogdSayı).
//   • Sıra puanı = Bayes ağırlıklı puan (IMDb Top 250 formülü): az oylu yapım tek bir 10'la zirveye fırlamasın diye
//     birleşik ortalama, PRIOR_WEIGHT kadar sanal oyla PRIOR_MEAN'e çekilir.
//
// Varsayılan liste (hiç Seelogd oyu yokken) = TMDB'nin en çok oylanan film + dizileri bu puanla karışık sıralanmış hali.

export const TOP100_SIZE = 100;
/** Liste olarak kaydet / sohbete gönder'de seçilebilen uzunluklar. */
export const TOP100_PICK_COUNTS = Object.freeze([20, 50, 70, 100]);
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

export const TMDB_WEIGHT_PER_DECADE = 20;
export const TMDB_WEIGHT_CAP = 100;
export const PRIOR_MEAN = 7;
export const PRIOR_WEIGHT = 25;
/** Havuza girmek için en az TMDB oy sayısı (Seelogd oyu olan yapım bu sınırdan muaf). */
export const MIN_TMDB_VOTES = 300;

const MEDIA_KEY_RE = /^(movie|tv)_([1-9][0-9]{0,8})$/;

const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export function mediaKeyOf(type, id) {
  const numeric = Math.trunc(Number(id));
  if ((type !== "movie" && type !== "tv") || !Number.isFinite(numeric) || numeric <= 0) return null;
  const key = `${type}_${numeric}`;
  return MEDIA_KEY_RE.test(key) ? key : null;
}

/** "movie_550" → { type: "movie", id: 550 } | null */
export function parseMediaKey(key) {
  const match = MEDIA_KEY_RE.exec(String(key || ""));
  return match ? { type: match[1], id: Number(match[2]) } : null;
}

export const isValidScore = (score) =>
  Number.isInteger(score) && score >= MIN_SCORE && score <= MAX_SCORE;

/** TMDB oy sayısının "ön oy kütlesi" ağırlığı. */
export function tmdbWeight(tmdbCount) {
  const count = Math.max(0, finite(tmdbCount));
  if (count === 0) return 0;
  return Math.min(TMDB_WEIGHT_CAP, Math.log10(count + 1) * TMDB_WEIGHT_PER_DECADE);
}

/**
 * @param {{ tmdbAvg?: number, tmdbCount?: number, sum?: number, count?: number }} entry
 * @returns {{ avg: number, score: number, weight: number }} avg: birleşik ortalama (0–10), score: sıra puanı
 */
export function combinedScore({ tmdbAvg = 0, tmdbCount = 0, sum = 0, count = 0 } = {}) {
  const avgTmdb = Math.max(0, Math.min(MAX_SCORE, finite(tmdbAvg)));
  const w = avgTmdb > 0 ? tmdbWeight(tmdbCount) : 0;
  const votes = Math.max(0, Math.trunc(finite(count)));
  const total = votes > 0 ? Math.max(0, finite(sum)) : 0;
  const mass = w + votes;
  if (mass <= 0) return { avg: 0, score: 0, weight: 0 };
  const avg = (avgTmdb * w + total) / mass;
  const score = (avg * mass + PRIOR_MEAN * PRIOR_WEIGHT) / (mass + PRIOR_WEIGHT);
  return { avg, score, weight: mass };
}

/** Ekranda gösterilen tek ondalık puan ("8.6"). */
export const formatScore = (value) => (finite(value) > 0 ? (Math.round(finite(value) * 10) / 10).toFixed(1) : "–");

/**
 * Ham TMDB sonucu (discover / top_rated / search / detay) → havuz öğesi. Film/dizi olmayan ya da afişsiz kayıt null.
 * @param {object} raw
 * @param {"movie"|"tv"} [fallbackType]  Uç tür bilgisini taşımıyorsa (discover/movie).
 */
export function toPoolItem(raw, fallbackType) {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.media_type === "movie" || raw.media_type === "tv" ? raw.media_type : fallbackType;
  const key = mediaKeyOf(type, raw.id);
  if (!key || !raw.poster_path) return null;
  const title = String(raw.title || raw.name || "").trim();
  if (!title) return null;
  const date = String(raw.release_date || raw.first_air_date || "");
  const year = /^\d{4}/.test(date) ? date.slice(0, 4) : "";
  return {
    key,
    id: Math.trunc(Number(raw.id)),
    media_type: type,
    title,
    poster_path: raw.poster_path,
    year,
    adult: raw.adult === true,
    tmdbAvg: Math.max(0, finite(raw.vote_average)),
    tmdbCount: Math.max(0, Math.trunc(finite(raw.vote_count))),
  };
}

/** Sunucu sayaç dokümanı → { sum, count } (bozuk alanlar 0). */
export function asCounter(data) {
  const count = Math.max(0, Math.trunc(finite(data?.count)));
  const sum = count > 0 ? Math.max(0, Math.trunc(finite(data?.sum))) : 0;
  return { sum: Math.min(sum, count * MAX_SCORE), count };
}

/**
 * Havuz + topluluk sayaçları → sıralı liste.
 *
 * @param {object[]} pool                 toPoolItem çıktıları (tekrarlar elenir; ilki kazanır)
 * @param {Record<string,{sum:number,count:number}>} [counters]  mediaKey → sayaç
 * @param {{ limit?: number }} [options]
 * @returns {Array<object & { sum:number, count:number, avg:number, score:number, rank:number }>}
 */
export function rankTop100(pool, counters = {}, { limit = TOP100_SIZE } = {}) {
  const seen = new Set();
  const rows = [];
  (Array.isArray(pool) ? pool : []).forEach((item) => {
    if (!item?.key || seen.has(item.key)) return;
    const counter = asCounter(counters?.[item.key]);
    // Az oylu TMDB kaydı ancak Seelogd'da oy aldıysa yarışır.
    if (item.tmdbCount < MIN_TMDB_VOTES && counter.count === 0) return;
    seen.add(item.key);
    const { avg, score } = combinedScore({ ...item, ...counter });
    rows.push({ ...item, ...counter, avg, score });
  });
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.count - a.count ||
      b.tmdbCount - a.tmdbCount ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  return rows.slice(0, Math.max(0, limit)).map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Bir oyun sayaca etkisi (iyimser güncelleme ve sunucu yazımıyla AYNI aritmetik).
 * @param {{sum:number,count:number}} counter
 * @param {number|null} previous  Bu kullanıcının önceki oyu (yoksa null)
 * @param {number} next
 */
export function applyVote(counter, previous, next) {
  const base = asCounter(counter);
  if (!isValidScore(next)) return base;
  if (isValidScore(previous)) return { sum: base.sum - previous + next, count: Math.max(1, base.count) };
  return { sum: base.sum + next, count: base.count + 1 };
}

/** Cihazdaki oy kaydı (Keys.top100Votes) → { mediaKey: puan } — bozuk girdiler düşer. */
export function normalizeMyVotes(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  Object.keys(raw).forEach((key) => {
    const score = raw[key];
    if (parseMediaKey(key) && isValidScore(score)) out[key] = score;
  });
  return out;
}

/** Sıralı listeden ilk `count` öğe → liste kaydı / sohbet paylaşımının beklediği medya şekli. */
export function top100MediaList(ranked, count) {
  return (Array.isArray(ranked) ? ranked : []).slice(0, Math.max(0, count)).map((row) => ({
    id: row.id,
    media_type: row.media_type,
    title: row.title,
    poster_path: row.poster_path,
    ...(row.year ? { release_date: `${row.year}-01-01` } : {}),
    vote_average: Math.round(row.avg * 10) / 10,
  }));
}

/** Seçici çipleri: listede o kadar öğe yoksa (havuz eksik yüklendi) seçenek pasif. */
export function pickableCounts(total) {
  const size = Math.max(0, Math.trunc(finite(total)));
  return TOP100_PICK_COUNTS.map((count) => ({ count, enabled: size >= count }));
}
