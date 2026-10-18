// utils/yearlyGoal.js
//
// "Yıllık izleme hedefi" (profil başlığındaki halka düğmesi + hedef sayfası) — SAF hesap
// çekirdeği. Burada RN/Firebase importu YOK (jest yalnız saf modülleri test edebiliyor).
//
// İKİ AYRI HEDEF HATTI (kullanıcı birini, ikisini ya da hiçbirini DEĞİL — en az birini açar):
//   • FİLM  (`movies`) : o yıl en az bir izleme olayı olan FARKLI film. Aynı filmi yıl içinde
//             üç kez izlemek bir sayılır (hedef "kaç eser", "kaç izleme" değil).
//   • DİZİ  (`shows`)  : iki ÖLÇÜDEN biriyle (`measure`):
//       "shows"    → o yıl en az bir bölümü izlenen FARKLI dizi. "Bitirdi" demek değil —
//                    uygulamada bir dizinin bitip bitmediğini söyleyen güvenilir bilgi yok
//                    (yayındaki dizi hiç bitmez); "izlemeye başladı/sürdürdü" tek tutarlı ölçü.
//       "episodes" → o yıl izlenen FARKLI bölüm. Aynı bölümü yeniden izlemek bir sayılır.
// Sayılan şeyin adı `kind`: "movies" | "shows" | "episodes" (limitler, hazır değerler ve adım
// buna göre değişir: yılda 500 bölüm olağan, 500 film değil).
//
// Yıl, izleme TARİHİNDEN gelir (kayıt tarihinden değil): geçmiş bir filmi bugün "izledim" diye
// işaretleyip tarihini 2019 yapan kullanıcı 2026 hedefini şişirmez. Tarih ayrıştırıcısı Wrapped
// ile aynıdır (utils/wrapped.js `toDate`, YEREL takvim): 1 Ocak'ta izlenen film negatif UTC
// ofsetinde önceki yıla düşmez.
//
// SAKLAMA: { "2026": { movies: { target }, shows: { target, measure } }, … } — yıl başına ayrı
// kayıt (yıl dönünce geçen yılın hedefi kaybolmaz), kapalı hat ANAHTARI hiç yazılmaz.
// ESKİ BİÇİM ({ target, unit }) okunurken çevrilir (bkz. normalizeYearEntry).
//
// DÜĞMEDEKİ YÜZDE: açık hatların oranlarının ORTALAMASI (film %60, dizi %40 → %50). Toplam adet
// toplanmaz: "50 film" ile "500 bölüm" aynı birimde değil, büyük hedef ortalamayı ezerdi.

import { toDate } from "./wrapped";

/** Hat adları (film, dizi). */
export const TRACKS = Object.freeze(["movies", "shows"]);
/** Dizi hattının ölçüleri. */
export const SHOW_MEASURES = Object.freeze(["shows", "episodes"]);
export const DEFAULT_SHOW_MEASURE = "shows";
/** Sayılan şeyin türü (limit/adım/hazır değer anahtarı). */
export const GOAL_KINDS = Object.freeze(["movies", "shows", "episodes"]);

export const GOAL_MIN = 1;
export const GOAL_LIMITS = Object.freeze({
  movies: Object.freeze({ min: GOAL_MIN, max: 999 }),
  shows: Object.freeze({ min: GOAL_MIN, max: 999 }),
  episodes: Object.freeze({ min: GOAL_MIN, max: 9999 }),
});
/** Sayfadaki hazır çipler. Film: ayda 1 / 2 / haftada 1 / ~2. Dizi: ayda ½ / 1 / 2 / haftada 1. */
export const GOAL_PRESETS = Object.freeze({
  movies: Object.freeze([12, 24, 52, 100]),
  shows: Object.freeze([6, 12, 24, 52]),
  episodes: Object.freeze([100, 250, 500, 1000]),
});
/** Tek dokunuş adımı (bölümde 1'er saymak anlamsız). Basılı tutunca hızlanma = adım × 5. */
export const GOAL_STEPS = Object.freeze({ movies: 1, shows: 1, episodes: 5 });
/** Hiçbir veri/öneri yokken başlangıç hedefi. */
export const GOAL_DEFAULTS = Object.freeze({ movies: 24, shows: 12, episodes: 250 });
/** Saklanan en fazla yıl: geçmiş hedefler "kaçırdım/tuttum" bilgisi taşır, sonsuz büyümesin. */
export const MAX_STORED_YEARS = 10;
/** Yıl sonu tahmini bu kadar günden önce yapılmaz (1 Ocak'ta 1 film → "yılda 365" saçmalığı). */
export const PROJECTION_MIN_DAYS = 28;
const YEAR_MIN = 1990;
const YEAR_MAX = 2100;

/**
 * Yüzde (aşağı yuvarlanır). Küçük bir pay eklenir: kayan nokta yüzünden `0.29 * 100` =
 * 28,999999999999996 → 28 çıkardı (29/100 hedefte "%28"). 99,5 → 99 davranışı korunur.
 */
const floorPercent = (ratio) => Math.floor(ratio * 100 + 1e-9);

const isPlain = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const isYear = (year) => Number.isInteger(year) && year >= YEAR_MIN && year <= YEAR_MAX;

export const isShowMeasure = (measure) => SHOW_MEASURES.includes(measure);

/** Hat + (dizi için) ölçüden sayılan şeyin türü. */
export const kindOf = (track, measure) =>
  track === "movies" ? "movies" : measure === "episodes" ? "episodes" : "shows";

/**
 * Hedef sayısını türün [min, max] tam sayısına çeker; sayı değilse null.
 * Yalnız sayı ya da sayısal METİN kabul edilir: `Number(null)`, `Number("")` ve
 * `Number(true)` sessizce 0/1 verip bozuk bir kaydı "hedef 1" yapardı.
 */
export function clampTarget(value, kind = "movies") {
  if (typeof value === "string" ? !value.trim() : typeof value !== "number") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const { min, max } = GOAL_LIMITS[kind] || GOAL_LIMITS.movies;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/* ───────────────────────── Kayıt ───────────────────────── */

function normalizeMovies(raw) {
  if (!isPlain(raw)) return null;
  const target = clampTarget(raw.target, "movies");
  return target === null ? null : { target };
}

function normalizeShows(raw) {
  if (!isPlain(raw)) return null;
  const measure = isShowMeasure(raw.measure) ? raw.measure : DEFAULT_SHOW_MEASURE;
  const target = clampTarget(raw.target, kindOf("shows", measure));
  return target === null ? null : { target, measure };
}

/**
 * Bir yılın kaydı → { movies?, shows? } ya da null (hiç geçerli hat yoksa).
 *
 * ESKİ BİÇİM: { target, unit: "movie" | "tv" | "all" } (tek sayı, tek birim). Film → film hattı,
 * dizi → dizi hattı (ölçü "shows"), "all" → hedef ikiye bölünür (film yukarı yuvarlanır): eski
 * "toplam eser" sayısı yeni modelde iki hatta karşılık gelir.
 */
function normalizeYearEntry(raw) {
  if (!isPlain(raw)) return null;
  let source = raw;
  if (!("movies" in raw) && !("shows" in raw) && "target" in raw) {
    const total = clampTarget(raw.target, "movies");
    if (total === null) return null;
    if (raw.unit === "movie") source = { movies: { target: total } };
    else if (raw.unit === "tv") source = { shows: { target: total, measure: DEFAULT_SHOW_MEASURE } };
    else {
      const films = Math.ceil(total / 2);
      source = { movies: { target: films } };
      // Kalan 0 ise dizi hattı AÇILMAZ: clampTarget(0) onu 1'e çekip sahte bir hedef üretirdi.
      if (total - films >= 1) source.shows = { target: total - films, measure: DEFAULT_SHOW_MEASURE };
    }
  }
  const movies = normalizeMovies(source.movies);
  const shows = normalizeShows(source.shows);
  if (!movies && !shows) return null;
  const out = {};
  if (movies) out.movies = movies;
  if (shows) out.shows = shows;
  return out;
}

/**
 * Depodan okunan ham değeri güvenli biçime çevirir; bozuk/eksik/eski kayıt asla hata vermez.
 * Geçersiz yıl ve hatlar atılır, hiç geçerli hattı kalmayan yıl düşer, en yeni MAX_STORED_YEARS
 * yıl kalır, anahtarlar artan yıl sırasındadır (aynı küme = aynı JSON).
 *
 * @returns {Record<string, { movies?: {target: number}, shows?: {target: number, measure: string} }>}
 */
export function normalizeYearlyGoals(raw) {
  if (!isPlain(raw)) return {};
  const years = Object.keys(raw)
    .filter((key) => /^\d{4}$/.test(key) && isYear(Number(key)))
    .map(Number)
    .sort((a, b) => a - b);
  const out = {};
  for (const year of years.slice(-MAX_STORED_YEARS)) {
    const entry = normalizeYearEntry(raw[year]);
    if (entry) out[year] = entry;
  }
  return out;
}

/**
 * Yılın hedefi: { movies: {target}|null, shows: {target, measure}|null } ya da hiç hedef yoksa null.
 * (Kopya döner; dışarıdan değiştirilemez.)
 */
export function getYearlyGoal(goals, year) {
  const entry = normalizeYearlyGoals(goals)[Number(year)];
  if (!entry) return null;
  return {
    movies: entry.movies ? { ...entry.movies } : null,
    shows: entry.shows ? { ...entry.shows } : null,
  };
}

/**
 * Yeni, normalize nesne döner. `goal` = { movies?, shows? } (kapalı hat null/yok). Yıl geçersizse ya da
 * hiç geçerli hat kalmıyorsa mevcut kaydı DEĞİŞTİRMEDEN normalize eder.
 */
export function setYearlyGoal(goals, year, goal = {}) {
  const current = normalizeYearlyGoals(goals);
  const entry = normalizeYearEntry(goal);
  if (!isYear(Number(year)) || !entry) return current;
  return normalizeYearlyGoals({ ...current, [Number(year)]: entry });
}

export function clearYearlyGoal(goals, year) {
  const current = normalizeYearlyGoals(goals);
  delete current[Number(year)];
  return current;
}

/** Depoya yazılacak değer: hiç hedef yoksa `null` (anahtar silinir; diskte boş nesne dolaşmaz). */
export function toStoredYearlyGoals(goals) {
  const normalized = normalizeYearlyGoals(goals);
  return Object.keys(normalized).length ? normalized : null;
}

/**
 * Açık hatların listesi (film önce): [{ track, kind, target, measure? }].
 * `goal` getYearlyGoal çıktısıdır; null/boş → [].
 */
export function activeTracks(goal) {
  const out = [];
  if (goal?.movies) out.push({ track: "movies", kind: "movies", target: goal.movies.target });
  if (goal?.shows) {
    out.push({
      track: "shows",
      kind: kindOf("shows", goal.shows.measure),
      target: goal.shows.target,
      measure: goal.shows.measure,
    });
  }
  return out;
}

/** İki hedef AYNI mı (kaydet düğmesinin "değişti mi" kararı)? Kapalı hat = yok. */
export function sameGoal(a, b) {
  const left = JSON.stringify(activeTracks(a));
  const right = JSON.stringify(activeTracks(b));
  return left === right;
}

/* ───────────────────────── Sayım ───────────────────────── */

const yearOf = (value) => {
  const date = toDate(value);
  return date ? date.getFullYear() : null;
};

// Dizi kimliği: showId, yoksa ad. Bölümün kendi `id`si ASLA kullanılmaz — olay başına tekildir,
// her bölüm ayrı dizi sayılırdı (utils/wrapped.js showKeyOf ile aynı gerekçe).
const showKeyOf = (episode) => episode?.showId ?? episode?.showName ?? null;

// Bölüm kimliği: dizi + sezon + bölüm. Sezon/bölüm numarası yoksa kayıt kendi kimliği olur
// (hepsi tek bölüme çökmesin).
function episodeKeyOf(episode, index) {
  const show = showKeyOf(episode);
  const season = episode?.seasonNumber;
  const number = episode?.episodeNumber;
  if (show == null || (season == null && number == null)) return `#${index}`;
  return `${show}|${season ?? "?"}|${number ?? "?"}`;
}

/**
 * Yılın sayıları; üç tür birden: { movies, shows, episodes }.
 *
 * @param {object} args
 * @param {Array} args.movieEntries izleme OLAYI başına film kaydı (`dateAdded` = izleme günü,
 *        `id` = film kimliği) — ProfileStatsContext.movieHistoryItems
 * @param {Array} args.episodes     izleme olayı başına bölüm (`episodeWatchTime`, `showId`,
 *        `seasonNumber`, `episodeNumber`) — ProfileStatsContext.flatEpisodesTv
 * @param {number} args.year
 */
export function countYearTitles({ movieEntries = [], episodes = [], year }) {
  const films = new Set();
  movieEntries.forEach((entry, index) => {
    if (yearOf(entry?.dateAdded) !== year) return;
    // Kimliksiz eski kayıt indeksle ayrışır; aksi halde hepsi tek filme çökerdi
    // (utils/watchHistory.countMovieWatchStats ile aynı kural).
    films.add(String(entry?.id ?? `#${index}`));
  });
  const shows = new Set();
  const distinctEpisodes = new Set();
  episodes.forEach((episode, index) => {
    if (yearOf(episode?.episodeWatchTime) !== year) return;
    const show = showKeyOf(episode);
    if (show != null) shows.add(String(show));
    distinctEpisodes.add(episodeKeyOf(episode, index));
  });
  return { movies: films.size, shows: shows.size, episodes: distinctEpisodes.size };
}

/** Türe göre sayı. */
export const countForKind = (counts, kind) => counts?.[kind] || 0;

/**
 * Aylık dağılım (Ocak→Aralık, 12 elemanlı): her şey, o yıl İLK görüldüğü ayda bir kez sayılır
 * (bir filmi Ocak'ta iki kez izlemek ve Mart'ta üçüncü kez izlemek Ocak'a yazılır). Toplam,
 * `countYearTitles` ile aynıdır.
 *
 * @returns {{ movies: number[], shows: number[], episodes: number[] }}
 */
export function monthlyYearTitles({ movieEntries = [], episodes = [], year }) {
  const first = { movies: new Map(), shows: new Map(), episodes: new Map() };
  const note = (map, key, date) => {
    const time = date.getTime();
    if (!map.has(key) || time < map.get(key).time) map.set(key, { time, month: date.getMonth() });
  };
  movieEntries.forEach((entry, index) => {
    const date = toDate(entry?.dateAdded);
    if (!date || date.getFullYear() !== year) return;
    note(first.movies, String(entry?.id ?? `#${index}`), date);
  });
  episodes.forEach((episode, index) => {
    const date = toDate(episode?.episodeWatchTime);
    if (!date || date.getFullYear() !== year) return;
    const show = showKeyOf(episode);
    if (show != null) note(first.shows, String(show), date);
    note(first.episodes, episodeKeyOf(episode, index), date);
  });
  const fold = (map) => {
    const months = Array.from({ length: 12 }, () => 0);
    map.forEach(({ month }) => { months[month] += 1; });
    return months;
  };
  return { movies: fold(first.movies), shows: fold(first.shows), episodes: fold(first.episodes) };
}

/* ───────────────────────── İlerleme ───────────────────────── */

// Yılın kaçıncı günü (1 Ocak = 1). Date.UTC: yerel DST geçişi 23/25 saatlik günler
// üretip indeksi kaydırmasın (utils/wrapped.js dayOfYearIndex ile aynı gerekçe).
const dayOfYear = (date) =>
  Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 1)) / 86400000,
  ) + 1;

const daysInYearOf = (year) => ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365);

/**
 * Yılın saati: geçen/kalan gün ve yüzde (hedeften bağımsız). Gelecek yılda 0 gün geçmiştir,
 * geçmiş yılda hepsi.
 *
 * @returns {{ total: number, elapsed: number, daysLeft: number, percent: number, ratio: number }}
 */
export function computeYearClock({ year, now = new Date() }) {
  const total = daysInYearOf(year);
  const currentYear = now.getFullYear();
  let elapsed;
  if (year < currentYear) elapsed = total;
  else if (year > currentYear) elapsed = 0;
  else elapsed = Math.min(total, dayOfYear(now));
  return {
    total,
    elapsed,
    daysLeft: total - elapsed,
    ratio: elapsed / total,
    percent: floorPercent(elapsed / total),
  };
}

/**
 * Bir hattın hedefe göre durumu.
 *
 *   pace:
 *     "done"      hedefe ulaşıldı
 *     "ahead"     bu tarihte olması gerekenin en az 1 önünde
 *     "onTrack"   beklenene ±1 içinde
 *     "behind"    beklenenin en az 1 gerisinde
 *     "missed"    yıl bitti, hedefe ulaşılamadı
 *     "upcoming"  yıl henüz başlamadı
 *
 * `expected` = hedef × (geçen gün / yıl günü): düz çizgi plan. İzleme gerçekte düzgün dağılmaz; bu
 * yüzden ±1 "tempoda" sayılır, her dalgalanma "geride" demez. (Bölüm hedefinde ±1 bölüm çok sıkı
 * olurdu; ölçek hedefle büyür: tolerans = max(1, hedefin %2'si).)
 *
 * PLAN ALANLARI
 *   planToday      : bugün olması gereken sayı (yuvarlanmış)
 *   perWeekPlan    : tüm yıl için haftalık ortalama (hedef × 7 / yıl günü)
 *   perMonthPlan   : aylık ortalama (hedef / 12)
 *   perWeekNeeded  : KALAN için haftalık gereken (yukarı yuvarlanır, 0,1 hassasiyet); yılın son
 *                    haftasında kesir patlamasın diye alt sınır 1 hafta
 *   perMonthNeeded : kalan için aylık gereken (aynı kural)
 *   projected      : şimdiki tempo yıl sonuna kadar sürerse tahmini toplam (en az
 *                    PROJECTION_MIN_DAYS gün geçmişse; yoksa null)
 *
 * @returns {object}
 */
export function computeGoalProgress({ count = 0, target, year, now = new Date() }) {
  const goal = Math.max(GOAL_MIN, Number(target) || GOAL_MIN);
  const done = count >= goal;
  const ratio = Math.min(1, Math.max(0, count / goal));
  const remaining = Math.max(0, goal - count);
  const clock = computeYearClock({ year, now });
  const currentYear = now.getFullYear();

  const expected = goal * clock.ratio;
  const tolerance = Math.max(1, goal * 0.02);
  const paceDelta = Math.round(count - expected);
  const diff = count - expected;

  let pace;
  if (done) pace = "done";
  else if (year < currentYear) pace = "missed";
  else if (year > currentYear) pace = "upcoming";
  else if (diff >= tolerance) pace = "ahead";
  else if (diff <= -tolerance) pace = "behind";
  else pace = "onTrack";

  let perWeekNeeded = null;
  let perMonthNeeded = null;
  if (!done && clock.daysLeft > 0 && year === currentYear) {
    const weeks = Math.max(1, clock.daysLeft / 7);
    const months = Math.max(1, clock.daysLeft / (clock.total / 12));
    perWeekNeeded = Math.ceil((remaining / weeks) * 10) / 10;
    perMonthNeeded = Math.ceil((remaining / months) * 10) / 10;
  }

  let projected = null;
  if (year === currentYear && clock.elapsed >= PROJECTION_MIN_DAYS && count > 0) {
    projected = Math.round((count * clock.total) / clock.elapsed);
  }

  return {
    ratio,
    // 99,6 → 99: "%100" yalnız hedefe gerçekten ulaşılınca yazılır.
    percent: done ? 100 : floorPercent(ratio),
    remaining,
    over: Math.max(0, count - goal),
    done,
    pace,
    paceDelta,
    expected,
    planToday: Math.round(expected),
    // Planın çubuktaki yeri (0–1): yılın ne kadarının geçtiği.
    expectedRatio: Math.min(1, clock.ratio),
    daysLeft: clock.daysLeft,
    perWeekPlan: (goal * 7) / clock.total,
    perMonthPlan: goal / 12,
    perWeekNeeded,
    perMonthNeeded,
    projected,
  };
}

/**
 * Açık hatların ilerlemelerini tek özete indirir (düğmedeki yüzde + sayfadaki özet).
 *
 *   ratio / percent : hat oranlarının ORTALAMASI (başa bakın); `percent` hepsi tamamsa 100
 *   done            : TÜM hatlar tamam
 *   pace            : done > behind (herhangi biri geride) > ahead (tamamlanmamış hepsi önde) > onTrack
 *
 * @param {Array<{progress: object}>} tracks
 * @returns {{ ratio: number, percent: number, done: boolean, pace: string, count: number } | null}
 */
export function combineProgress(tracks) {
  const list = (tracks || []).map((t) => t?.progress).filter(Boolean);
  if (!list.length) return null;
  const ratio = list.reduce((sum, p) => sum + p.ratio, 0) / list.length;
  const done = list.every((p) => p.done);
  const open = list.filter((p) => !p.done);
  let pace;
  if (done) pace = "done";
  else if (open.some((p) => p.pace === "behind" || p.pace === "missed")) pace = "behind";
  else if (open.every((p) => p.pace === "ahead")) pace = "ahead";
  else pace = "onTrack";
  return { ratio, percent: done ? 100 : floorPercent(ratio), done, pace, count: list.length };
}

/**
 * Hedefin (kaydedilmiş ya da taslak) her açık hattı için sayı + ilerleme.
 * @returns {Array<{ track, kind, target, measure?, count, progress }>}
 */
export function buildTrackProgress({ goal, counts, year, now }) {
  return activeTracks(goal).map((track) => {
    const count = countForKind(counts, track.kind);
    return { ...track, count, progress: computeGoalProgress({ count, target: track.target, year, now }) };
  });
}

/* ───────────────────────── Taslak (sayfadaki düzenleme) ───────────────────────── */
//
// TASLAK: { movies: { on, target }, shows: { on, measure, targets: { shows, episodes } } }.
// Kapalı hat da bir hedef sayısı TAŞIR (açılınca son değerle gelir) ve dizi hattı iki ölçünün
// sayısını AYRI tutar: "dizi sayısı"ndan "bölüm sayısı"na geçip dönen kullanıcının 12'si 250'ye
// ezilmez. Hepsi saf: sayfa yalnız bunları çağırır.

/** @param {number} previous geçen yıl sayı @param {number} min taban @param {string} kind @param {number} round */
function suggestFromPrevious(previous, min, kind, round = 5) {
  return clampTarget(Math.max(min, Math.ceil((previous * 1.1) / round) * round), kind);
}

/**
 * Hedefi olmayan yıl için ayar sayfasının önerdiği başlangıç taslağı.
 *   1) geçen yılın hedefi (hatları ve ölçüsüyle),
 *   2) yoksa geçen yıl izlenenin %10 fazlası (5'e; bölümde 25'e yuvarlı, tabanlı) — yalnız
 *      geçen yıl o türden izleme VARSA o hat açık gelir,
 *   3) hiç veri yoksa iki hat da açık, ayda 2 film / ayda 1 dizi.
 *
 * @param {{ goals: object, year: number, previous?: {movies?: number, shows?: number, episodes?: number} }} args
 */
export function suggestDraft({ goals, year, previous = {} }) {
  const draft = {
    movies: { on: true, target: GOAL_DEFAULTS.movies },
    shows: {
      on: true,
      measure: DEFAULT_SHOW_MEASURE,
      targets: { shows: GOAL_DEFAULTS.shows, episodes: GOAL_DEFAULTS.episodes },
    },
  };
  const last = getYearlyGoal(goals, Number(year) - 1);
  if (last) {
    draft.movies.on = !!last.movies;
    if (last.movies) draft.movies.target = last.movies.target;
    draft.shows.on = !!last.shows;
    if (last.shows) {
      draft.shows.measure = last.shows.measure;
      draft.shows.targets[last.shows.measure] = last.shows.target;
    }
    return draft;
  }
  const films = previous.movies || 0;
  const series = previous.shows || 0;
  const eps = previous.episodes || 0;
  if (films > 0 || series > 0) {
    draft.movies.on = films > 0;
    draft.shows.on = series > 0;
    if (films > 0) draft.movies.target = suggestFromPrevious(films, 12, "movies");
    if (series > 0) {
      draft.shows.targets.shows = suggestFromPrevious(series, 6, "shows");
      draft.shows.targets.episodes = suggestFromPrevious(eps, 100, "episodes", 25);
    }
  }
  return draft;
}

/** Kaydedilmiş hedeften taslak; hedef yoksa öneri. */
export function draftFromGoal(goal, suggestion) {
  const base = suggestion || suggestDraft({ goals: {}, year: 0 });
  if (!goal || (!goal.movies && !goal.shows)) return structuredCloneDraft(base);
  const draft = structuredCloneDraft(base);
  draft.movies.on = !!goal.movies;
  if (goal.movies) draft.movies.target = goal.movies.target;
  draft.shows.on = !!goal.shows;
  if (goal.shows) {
    draft.shows.measure = goal.shows.measure;
    draft.shows.targets[goal.shows.measure] = goal.shows.target;
  }
  return draft;
}

function structuredCloneDraft(draft) {
  return {
    movies: { ...draft.movies },
    shows: { ...draft.shows, targets: { ...draft.shows.targets } },
  };
}

/** Taslak → kaydedilecek hedef { movies, shows } (kapalı hat null). Hiç hat açık değilse null. */
export function goalFromDraft(draft) {
  const movies = draft?.movies?.on ? normalizeMovies({ target: draft.movies.target }) : null;
  const measure = isShowMeasure(draft?.shows?.measure) ? draft.shows.measure : DEFAULT_SHOW_MEASURE;
  const shows = draft?.shows?.on
    ? normalizeShows({ target: draft.shows.targets?.[measure], measure })
    : null;
  return movies || shows ? { movies, shows } : null;
}

/** Hattın taslaktaki geçerli türü ve hedefi. */
export function draftTrack(draft, track) {
  if (track === "movies") {
    return { on: !!draft.movies.on, kind: "movies", target: draft.movies.target };
  }
  const measure = isShowMeasure(draft.shows.measure) ? draft.shows.measure : DEFAULT_SHOW_MEASURE;
  return { on: !!draft.shows.on, kind: kindOf("shows", measure), measure, target: draft.shows.targets[measure] };
}

/** Hattı aç/kapat (yeni taslak döner). */
export function draftToggle(draft, track, on) {
  const next = structuredCloneDraft(draft);
  next[track].on = !!on;
  return next;
}

/** Hattın hedef sayısını ayarlar (türün sınırına oturur). */
export function draftSetTarget(draft, track, target) {
  const next = structuredCloneDraft(draft);
  const { kind } = draftTrack(next, track);
  const clamped = clampTarget(target, kind);
  if (clamped === null) return next;
  if (track === "movies") next.movies.target = clamped;
  else next.shows.targets[draftTrack(next, "shows").measure] = clamped;
  return next;
}

/** Hattın hedefini `delta` kadar oynatır (bölümde adım 5'in katı). */
export function draftStep(draft, track, delta) {
  const { target } = draftTrack(draft, track);
  return draftSetTarget(draft, track, (Number(target) || GOAL_MIN) + delta);
}

/** Dizi hattının ölçüsünü değiştirir; iki ölçünün hedefi ayrı korunur. */
export function draftSetMeasure(draft, measure) {
  if (!isShowMeasure(measure)) return draft;
  const next = structuredCloneDraft(draft);
  next.shows.measure = measure;
  return next;
}
