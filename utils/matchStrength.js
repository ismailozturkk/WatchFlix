// utils/matchStrength.js
//
// Zevk Çemberleri — kulvar başına EŞLEŞME GÜCÜ (Faz 4; docs/ozellikler/ZEVK_ESLESMESI.md §4,
// algoritma §7 ve §10). SAF: RN/Firebase importu yok; girdi uygulamanın ZATEN yüklediği veridir
// (ListStatusContext listeleri + activityIndex + profil fourFavorites) → yeni Firestore okuması yok.
//
// güç = Σ ağırlık × min(1, değer / tam_güç)
//   izlenen 30→150 (0.25) · puanlanan 20→100 (0.35) · yorum 3→20 (0.15) · dört favori 2→4 (0.10)
//   · son 30 gün etkinlik 1→8 (0.15)
// Havuza giriş iki yoldan:
//   PUAN YOLU  : tüm asgariler + puan çeşitliliği kapısı (≥ 4 kademe, std ≥ 1.0) + güç ≥ 0.45
//   İZLEME YOLU: 60 izleme + 2 favori + son 30 günde etkinlik; güç en çok 0.70
// Her iki yolda: kayıtlar ≥ 14 farklı güne yayılmış olmalı (tarihli kayıt yarıdan azsa yargılanmaz).
//
// İstemcide anime kulvarı YOK (köken dili liste kaydında tutulmuyor): kulvarlar film ve dizi.

export const STRENGTH_LANES = Object.freeze(["movie", "tv"]);

export const STRENGTH_RULES = Object.freeze({
  watched: { min: 30, full: 150, weight: 0.25 },
  rated: { min: 20, full: 100, weight: 0.35 },
  comments: { min: 3, full: 20, weight: 0.15 },
  favorites: { min: 2, full: 4, weight: 0.1 },
  recent: { min: 1, full: 8, weight: 0.15 },
});
export const MIN_STRENGTH = 0.45;
export const WATCH_PATH = Object.freeze({ watched: 60, favorites: 2, recent: 1, maxStrength: 0.7 });
export const DIVERSITY = Object.freeze({ levels: 4, std: 1.0 });
export const MIN_SPREAD_DAYS = 14;
export const RECENT_DAYS = 30;
/** İkiz olabilmek için kabaca gereken veri (algoritma §7: "100+ yapım ve 25+ ortak görüş"). */
export const TWIN_READY = Object.freeze({ watched: 100, rated: 25 });
/** Algoritma §7 tablosu: kulvarda izlenen → bütün bileşenler kusursuzken ulaşılabilir en yüksek skor. */
export const REACHABLE = Object.freeze([
  [0, 0],
  [40, 75],
  [80, 89],
  [120, 95],
  [200, 98],
]);

const DAY = 86400000;
const asArray = (v) => (Array.isArray(v) ? v : []);
const validId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function toMs(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? (value > 1e12 ? value : value * 1000) : null;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (isNum(value.seconds)) return value.seconds * 1000;
  return null;
}

/** Bir kaydın bilinen tüm tarihleri (ekleme + izleme olayları). */
function datesOf(item) {
  const out = [];
  const added = toMs(item?.dateAdded ?? item?.addedShowDate);
  if (added !== null) out.push(added);
  for (const ev of asArray(item?.watchEvents)) {
    const t = toMs(ev?.watchedAt ?? ev?.recordedAt);
    if (t !== null) out.push(t);
  }
  return out;
}

/** Ulaşılabilir en yüksek skor (doğrusal ara değer). */
export function reachableScore(watched) {
  const w = Math.max(0, Number(watched) || 0);
  for (let i = 1; i < REACHABLE.length; i += 1) {
    const [x1, y1] = REACHABLE[i];
    if (w <= x1) {
      const [x0, y0] = REACHABLE[i - 1];
      return Math.round(y0 + ((y1 - y0) * (w - x0)) / (x1 - x0));
    }
  }
  return REACHABLE[REACHABLE.length - 1][1];
}

/** Puan çeşitliliği: farklı kademe sayısı ve standart sapma. */
export function ratingDiversity(values) {
  const list = values.filter((v) => isNum(v) && v > 0);
  if (!list.length) return { levels: 0, std: 0, ok: false };
  const levels = new Set(list.map((v) => Math.round(v * 2) / 2)).size;
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  const std = Math.sqrt(list.reduce((a, v) => a + (v - mean) ** 2, 0) / list.length);
  return { levels, std: Math.round(std * 100) / 100, ok: levels >= DIVERSITY.levels && std >= DIVERSITY.std };
}

const part = (id, value) => {
  const rule = STRENGTH_RULES[id];
  return { id, value, min: rule.min, full: rule.full, weight: rule.weight, ratio: Math.min(1, value / rule.full) };
};

/**
 * Tek kulvarın gücü.
 * @param {{ items: Array<object>, ratings?: Record<string, number>, commentKeys?: string[],
 *   fourFavorites?: number, now?: number, lane: "movie"|"tv" }} input
 */
export function laneStrength({ items, ratings = {}, commentKeys = [], fourFavorites = 0, now = Date.now(), lane }) {
  const prefix = lane === "tv" ? "tv_" : "movie_";
  const seen = new Set();
  const lanesItems = [];
  for (const it of asArray(items)) {
    if (!it || !validId(it.id)) continue;
    const key = `${prefix}${Number(it.id)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lanesItems.push({ key, it });
  }
  const ratingValues = [];
  for (const { key } of lanesItems) {
    const r = Number(ratings?.[key]);
    if (Number.isFinite(r) && r > 0) ratingValues.push(r);
  }
  const comments = new Set(asArray(commentKeys).filter((k) => typeof k === "string" && seen.has(k))).size;

  const since = now - RECENT_DAYS * DAY;
  let recent = 0;
  let dated = 0;
  const days = new Set();
  for (const { it } of lanesItems) {
    const ds = datesOf(it);
    if (ds.length) dated += 1;
    for (const t of ds) days.add(Math.floor(t / DAY));
    if (ds.some((t) => t >= since && t <= now + DAY)) recent += 1;
  }
  const watched = lanesItems.length;
  // Tarihli kayıt yarıdan azsa (eski hesap) yayılım yargılanamaz → geçer sayılır (algoritma §10).
  const spreadKnown = watched > 0 && dated >= watched / 2;
  const spreadOk = !spreadKnown || days.size >= MIN_SPREAD_DAYS;

  const diversity = ratingDiversity(ratingValues);
  const parts = [
    part("watched", watched),
    part("rated", ratingValues.length),
    part("comments", comments),
    part("favorites", Math.max(0, Number(fourFavorites) || 0)),
    part("recent", recent),
  ];
  const raw = parts.reduce((a, p) => a + p.weight * p.ratio, 0);
  const minsMet = parts.every((p) => p.value >= p.min);
  const ratingPath = minsMet && diversity.ok && raw >= MIN_STRENGTH && spreadOk;
  const watchPath =
    watched >= WATCH_PATH.watched && fourFavorites >= WATCH_PATH.favorites && recent >= WATCH_PATH.recent && spreadOk;
  const path = ratingPath ? "rating" : watchPath ? "watch" : null;
  const strength = path === "watch" ? Math.min(raw, WATCH_PATH.maxStrength) : raw;

  return {
    lane,
    watched,
    rated: ratingValues.length,
    comments,
    favorites: Math.max(0, Number(fourFavorites) || 0),
    recent,
    spreadDays: days.size,
    spreadOk,
    diversity,
    parts,
    strength: Math.round(strength * 100),
    eligible: path !== null,
    path,
    reachable: reachableScore(watched),
    next: nextStep({ watched, rated: ratingValues.length, comments, favorites: fourFavorites, recent, diversity, spreadOk, raw, path, spreadDays: days.size }),
  };
}

/**
 * TEK sonraki adım (arayüz bir görev gösterir). `need` = eksik adet.
 * Havuz dışındayken en kısa giriş yolu; içerideyken ikiz için gereken veri.
 */
export function nextStep(s) {
  const R = STRENGTH_RULES;
  if (!s.path) {
    if (s.rated >= R.rated.min && !s.diversity.ok) return { id: "diversify" };
    if (s.watched < R.watched.min) return { id: "watch", need: R.watched.min - s.watched };
    if (s.favorites < R.favorites.min) return { id: "favorites", need: R.favorites.min - s.favorites };
    if (s.recent < R.recent.min) return { id: "recent", need: R.recent.min - s.recent };
    if (s.rated < R.rated.min) {
      // Puan vermeyen: izleme yolu daha yakınsa onu söyle (zorlama yok, §4).
      const watchGap = WATCH_PATH.watched - s.watched;
      const rateGap = R.rated.min - s.rated;
      if (s.rated === 0 && watchGap > 0 && watchGap < rateGap) return { id: "watch", need: watchGap };
      return { id: "rate", need: rateGap };
    }
    if (s.comments < R.comments.min) return { id: "comment", need: R.comments.min - s.comments };
    if (!s.spreadOk) return { id: "spread", need: MIN_SPREAD_DAYS - s.spreadDays };
    return { id: "rate", need: Math.max(1, Math.ceil(((MIN_STRENGTH - s.raw) / R.rated.weight) * R.rated.full)) };
  }
  if (s.watched < TWIN_READY.watched) return { id: "twinWatch", need: TWIN_READY.watched - s.watched };
  if (s.rated < TWIN_READY.rated) return { id: "twinRate", need: TWIN_READY.rated - s.rated };
  return { id: "ready" };
}

/**
 * Tüm kulvarlar. `side` = FriendProfileScreen `mySide` şekli; `commentKeys` = activityIndex.comments;
 * `fourFavorites` = profil alanı ({ movies, shows }).
 */
export function computeMatchStrength({ side, commentKeys = [], fourFavorites = null, now = Date.now() } = {}) {
  const s = side || {};
  const fav = fourFavorites && typeof fourFavorites === "object" ? fourFavorites : {};
  return {
    movie: laneStrength({
      lane: "movie",
      items: s.watchedMovies,
      ratings: s.ratings,
      commentKeys,
      fourFavorites: asArray(fav.movies).length,
      now,
    }),
    tv: laneStrength({
      lane: "tv",
      items: s.watchedShows,
      ratings: s.ratings,
      commentKeys,
      fourFavorites: asArray(fav.shows).length,
      now,
    }),
  };
}
