// utils/top100.js
//
// "Seelogd Top 100" sıralamasının SAF çekirdeği (ağ/React yok, testli: __tests__/top100.test.js).
//
// MODEL — EN ÇOK OY ALAN EN ÜSTTE (puan ortalaması değil):
//   • Oy = "hype": puansız, tek dokunuşluk destek. Kullanıcı başına yapım başına TEK oy; geri alınabilir.
//   • Uygulama yeni olduğu için TMDB'deki DEĞERLENDİRME SAYISI (vote_count) da oy sayılır: çok değerlendirilen
//     yapım çok ilgi görmüştür.
//   • Hibrit oy = TMDB değerlendirme sayısı + Seelogd oyu × SEELOGD_VOTE_WEIGHT. Ağırlık olmasaydı on binlerce
//     TMDB değerlendirmesinin yanında Seelogd oyları sırayı hiç oynatamazdı; topluluk büyüdükçe ağırlığı
//     düşürmek tek sabit değişikliğidir.
//
// Varsayılan liste (hiç Seelogd oyu yokken) = TMDB'de en çok değerlendirilen film + diziler, karışık.

export const TOP100_SIZE = 100;
/** Liste olarak kaydet / sohbete gönder'de seçilebilen uzunluklar. */
export const TOP100_PICK_COUNTS = Object.freeze([20, 50, 70, 100]);
/** Bir Seelogd oyu kaç TMDB değerlendirmesi değerinde. */
export const SEELOGD_VOTE_WEIGHT = 100;
/** Toplam Seelogd oyu bu sayının altındayken gösterilmez (küçük sayı listeyi boş gösterirdi). */
export const MIN_SHOWN_TOTAL_VOTES = 100;

const MEDIA_KEY_RE = /^(movie|tv)_([1-9][0-9]{0,8})$/;

const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const whole = (value) => Math.max(0, Math.trunc(finite(value)));

export const showsTotalVotes = (total) => finite(total) >= MIN_SHOWN_TOTAL_VOTES;

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

/** Sıralamayı belirleyen hibrit oy sayısı. */
export function hybridVotes({ tmdbCount = 0, count = 0 } = {}) {
  return whole(tmdbCount) + whole(count) * SEELOGD_VOTE_WEIGHT;
}

/** 34215 → "34.215" (sep ".") / "34,215" (sep ","). */
export function groupDigits(value, sep = ".") {
  return String(whole(value)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Ham TMDB sonucu (discover / search / detay) → havuz öğesi. Film/dizi olmayan ya da afişsiz kayıt null.
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
    tmdbCount: whole(raw.vote_count),
  };
}

/** Sunucu sayaç dokümanı → { count } (bozuk alan 0). */
export function asCounter(data) {
  return { count: whole(data?.count) };
}

/** Havuz öğesi + sayaç → satır (sırasız). */
export function decorateItem(item, counter) {
  const { count } = asCounter(counter);
  return { ...item, count, votes: hybridVotes({ tmdbCount: item.tmdbCount, count }) };
}

/**
 * Havuz + topluluk sayaçları → hibrit oy sayısına göre sıralı liste.
 *
 * @param {object[]} pool                 toPoolItem çıktıları (tekrarlar elenir; ilki kazanır)
 * @param {Record<string,{count:number}>} [counters]  mediaKey → sayaç
 * @param {{ limit?: number }} [options]
 * @returns {Array<object & { count:number, votes:number, rank:number }>}
 */
export function rankTop100(pool, counters = {}, { limit = TOP100_SIZE } = {}) {
  const seen = new Set();
  const rows = [];
  (Array.isArray(pool) ? pool : []).forEach((item) => {
    if (!item?.key || seen.has(item.key)) return;
    seen.add(item.key);
    rows.push(decorateItem(item, counters?.[item.key]));
  });
  rows.sort(
    (a, b) =>
      b.votes - a.votes ||
      b.count - a.count ||
      b.tmdbAvg - a.tmdbAvg ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  return rows.slice(0, Math.max(0, limit)).map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Oy aç/kapa'nın sayaca etkisi (iyimser güncelleme ve sunucu yazımıyla AYNI aritmetik). */
export function applyHype(counter, wasHyped, nextHyped) {
  const { count } = asCounter(counter);
  if (!!wasHyped === !!nextHyped) return { count };
  return { count: nextHyped ? count + 1 : Math.max(0, count - 1) };
}

/** Cihazdaki oy kaydı (Keys.top100Hype) → { mediaKey: true } — bozuk girdiler düşer. */
export function normalizeMyHype(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  Object.keys(raw).forEach((key) => {
    if (parseMediaKey(key) && raw[key] === true) out[key] = true;
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
    ...(row.tmdbAvg > 0 ? { vote_average: Math.round(row.tmdbAvg * 10) / 10 } : {}),
  }));
}

/** Seçici çipleri: listede o kadar öğe yoksa (havuz eksik yüklendi) seçenek pasif. */
export function pickableCounts(total) {
  const size = whole(total);
  return TOP100_PICK_COUNTS.map((count) => ({ count, enabled: size >= count }));
}
