// utils/watchChallenges.js
//
// Meydan Okumalar (Eğlence > Meydan okumalar; belge docs/ozellikler/MEYDAN_OKUMALAR.md) — SAF çekirdek.
// RN/Firebase importu YOK (jest yalnız saf modülleri test edebiliyor).
//
// Hazır, süreli görevler: "52 haftada 52 film", "Her on yıldan bir film", "Ekim: 13 korku filmi", "7 gün 7 film",
// "10 Türk filmi", "Nolan'ın tüm filmleri", "Aamir Khan'ın başrol filmleri"… Kullanıcı KATILIR; ilerleme izleme
// geçmişinden KENDİLİĞİNDEN dolar (elle işaret yok).
//
// KURAL TÜRLERİ (rule.kind):
//   films · genre · genres · long · short     — penceredeki farklı filmler
//   sameDay · streak                          — tek günde en çok film · art arda en uzun gün serisi
//   decades · countries · country · era · recent · gems — film ayrıntısı ister (yıl / ülke / TMDB puanı)
//   episodes · shows · episodeDay             — farklı bölüm · farklı dizi · tek günde en çok bölüm
//   person                                    — yönetmen / oyuncu filmografisi (süresiz, tüm geçmiş)
//
// PENCERE (ne sayılır):
//   • rolling — katıldığın GÜN başlar, `days` gün sürer. Katılmadan önceki izlemeler sayılmaz: "52 haftada 52 film"e
//               bugün katılıp geçen yıl izlediklerinle bitirmek görev değil.
//   • month   — takvim ayı ("Ekim"). Yalnız o ay katılınır ve ayın TAMAMI sayılır (ayın 10'unda katılan, 1'inde
//               izlediğini de sayar — görev "Ekim'de 13 korku filmi", "katıldıktan sonra" değil).
//   • open    — süresiz, tüm geçmiş sayılır (yönetmen filmografisi: "hepsini izledin mi?").
// Tarih, izleme TARİHİNDEN gelir (kayıt tarihinden değil; utils/yearlyGoal.js ile aynı kural, YEREL takvim).
//
// SAYIM: her şey FARKLI eser üzerinden — aynı filmi iki kez izlemek bir sayılır (bölümde: farklı bölüm).
// Tür, saklı ADDAN kanonik id'ye çevrilerek okunur (utils/genreCanon.js): dil değiştiren kullanıcı türü iki kez saymaz.
// On yıl ve ülke izleme kaydında YOK; film ayrıntısından gelir (`meta`, services/watchChallengeMeta.js). Ayrıntısı
// henüz okunmamış film "bekliyor" sayılır, ilerlemeye girmez (yanlış sayıp sonra geri almaktansa).
//
// KAYIT (Keys.watchChallenges): { runs: [{ id, joinedAt: "YYYY-AA-GG", status, endedAt?, count?, target? }] }
//   status: "active" | "done" | "expired". Bırakılan görev kayıttan SİLİNİR (geçmişe "bıraktın" yazılmaz).
//   Biten görev dondurulur: sonradan bir izleme silinse de madalya geri alınmaz.

import { kanonikTur } from "./genreCanon";
import { toDate } from "./wrapped";
import { CHALLENGE_FILMOGRAPHIES } from "../data/challengeFilmographies";

/** Aynı anda en çok kaç görevde olunabilir: odak dağılmasın, Eğlence kartı okunur kalsın. */
export const MAX_ACTIVE_CHALLENGES = 8;
/** Saklanan bitmiş (tamamlanan + süresi dolan) görev sayısı. */
export const MAX_FINISHED_RUNS = 60;
export const RUN_STATUS = Object.freeze({ ACTIVE: "active", DONE: "done", EXPIRED: "expired" });

/** Gruplar ekrandaki sırayla. `directors` / `actors` kişi grupları (data/challengeFilmographies.js). */
export const CHALLENGE_GROUPS = Object.freeze([
  "seasonal",
  "marathon",
  "genres",
  "world",
  "explore",
  "series",
  "directors",
  "actors",
]);
export const PERSON_GROUPS = Object.freeze(["directors", "actors"]);

/** "Her on yıldan bir film" görevinin on yılları. */
export const CHALLENGE_DECADES = Object.freeze([1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]);

/** Bölge kümeleri (ISO 3166-1; filmin BİRİNCİL ülkesi, bkz. services/watchChallengeMeta.js). */
export const REGIONS = Object.freeze({
  europe: Object.freeze([
    "FR", "DE", "IT", "ES", "GB", "IE", "PT", "NL", "BE", "LU", "CH", "AT", "DK", "SE", "NO", "FI", "IS", "PL",
    "CZ", "SK", "HU", "RO", "BG", "GR", "HR", "SI", "RS", "BA", "MK", "AL", "UA", "EE", "LV", "LT", "GE",
  ]),
  asia: Object.freeze([
    "JP", "KR", "CN", "HK", "TW", "IN", "TH", "PH", "ID", "MY", "SG", "VN", "IR", "IL", "LB", "PK", "BD", "LK",
    "KZ", "MN", "AE", "SA", "JO", "PS", "NP", "KH",
  ]),
  latam: Object.freeze(["MX", "AR", "BR", "CL", "CO", "PE", "UY", "CU", "VE", "BO", "EC", "PY", "DO", "GT", "CR"]),
});

const def = (fields) => Object.freeze({ ...fields, rule: Object.freeze(fields.rule), window: Object.freeze(fields.window) });
const month = (id, m, genre, target, icon, colors) =>
  def({
    id,
    group: "seasonal",
    icon,
    colors,
    target,
    rule: genre ? { kind: "genre", genre } : { kind: "films" },
    window: { type: "month", month: m },
  });
const rolling = (days) => ({ type: "rolling", days });

const BASE_CHALLENGES = [
  // ── Mevsimlik: her ayın kendi görevi; yalnız o ayda görünür ve katılınır ──
  month("jan_films", 1, null, 12, "sparkles-outline", ["#60A5FA", "#1E3A8A"]),
  month("feb_romance", 2, "romance", 7, "heart-outline", ["#F472B6", "#9D174D"]),
  month("mar_mystery", 3, "mystery", 6, "search-outline", ["#8B5CF6", "#3B0764"]),
  month("apr_animation", 4, "animation", 8, "color-palette-outline", ["#FBBF24", "#B45309"]),
  month("may_adventure", 5, "adventure", 8, "compass-outline", ["#34D399", "#065F46"]),
  month("jun_action", 6, "action", 10, "flame-outline", ["#EF4444", "#7F1D1D"]),
  month("jul_scifi", 7, "scifi", 8, "planet-outline", ["#22D3EE", "#164E63"]),
  month("aug_comedy", 8, "comedy", 10, "happy-outline", ["#FACC15", "#A16207"]),
  month("sep_crime", 9, "crime", 8, "finger-print-outline", ["#94A3B8", "#1E293B"]),
  month("oct_horror", 10, "horror", 13, "skull-outline", ["#F97316", "#7C2D12"]),
  month("nov_thriller", 11, "thriller", 8, "eye-outline", ["#E11D48", "#4C0519"]),
  month("dec_family", 12, "family", 10, "snow-outline", ["#38BDF8", "#1E3A8A"]),
  // ── Maraton: sayı, tempo, süre ──
  def({ id: "films10_30", group: "marathon", icon: "flash-outline", colors: ["#EAB308", "#854D0E"], target: 10,
    rule: { kind: "films" }, window: rolling(30) }),
  def({ id: "films30_30", group: "marathon", icon: "rocket-outline", colors: ["#F97316", "#9A3412"], target: 30,
    rule: { kind: "films" }, window: rolling(30) }),
  def({ id: "films52", group: "marathon", icon: "calendar-outline", colors: ["#6366F1", "#312E81"], target: 52,
    rule: { kind: "films" }, window: rolling(364) }),
  def({ id: "films100_365", group: "marathon", icon: "trophy-outline", colors: ["#F59E0B", "#7C2D12"], target: 100,
    rule: { kind: "films" }, window: rolling(365) }),
  def({ id: "streak7", group: "marathon", icon: "flame-outline", colors: ["#FB923C", "#B91C1C"], target: 7,
    rule: { kind: "streak" }, window: rolling(30) }),
  def({ id: "movie_day3", group: "marathon", icon: "film-outline", colors: ["#C084FC", "#581C87"], target: 3,
    rule: { kind: "sameDay" }, window: rolling(30) }),
  def({ id: "short10", group: "marathon", icon: "stopwatch-outline", colors: ["#2DD4BF", "#115E59"], target: 10,
    rule: { kind: "short", maxMinutes: 90 }, window: rolling(30) }),
  def({ id: "long5", group: "marathon", icon: "time-outline", colors: ["#0EA5E9", "#0C4A6E"], target: 5,
    rule: { kind: "long", minMinutes: 150 }, window: rolling(60) }),
  def({ id: "epic3", group: "marathon", icon: "hourglass-outline", colors: ["#818CF8", "#1E1B4B"], target: 3,
    rule: { kind: "long", minMinutes: 180 }, window: rolling(90) }),
  // ── Tür maratonları ──
  def({ id: "scifi8", group: "genres", icon: "planet-outline", colors: ["#06B6D4", "#083344"], target: 8,
    rule: { kind: "genre", genre: "scifi" }, window: rolling(60) }),
  def({ id: "animation6", group: "genres", icon: "color-palette-outline", colors: ["#F472B6", "#7E22CE"], target: 6,
    rule: { kind: "genre", genre: "animation" }, window: rolling(30) }),
  def({ id: "comedy10", group: "genres", icon: "happy-outline", colors: ["#FDE047", "#CA8A04"], target: 10,
    rule: { kind: "genre", genre: "comedy" }, window: rolling(30) }),
  def({ id: "doc5", group: "genres", icon: "videocam-outline", colors: ["#4ADE80", "#14532D"], target: 5,
    rule: { kind: "genre", genre: "documentary" }, window: rolling(60) }),
  def({ id: "fantasy6", group: "genres", icon: "sparkles-outline", colors: ["#A78BFA", "#4C1D95"], target: 6,
    rule: { kind: "genre", genre: "fantasy" }, window: rolling(60) }),
  def({ id: "war6", group: "genres", icon: "shield-outline", colors: ["#A3A380", "#3F3F2A"], target: 6,
    rule: { kind: "genre", genre: "war" }, window: rolling(90) }),
  def({ id: "western5", group: "genres", icon: "sunny-outline", colors: ["#D97706", "#78350F"], target: 5,
    rule: { kind: "genre", genre: "western" }, window: rolling(90) }),
  def({ id: "music5", group: "genres", icon: "musical-notes-outline", colors: ["#EC4899", "#500724"], target: 5,
    rule: { kind: "genre", genre: "music" }, window: rolling(60) }),
  // ── Dünya sineması (ülke = filmin birincil ülkesi) ──
  def({ id: "turkish10", group: "world", icon: "flag-outline", colors: ["#EF4444", "#991B1B"], target: 10, flag: "TR",
    rule: { kind: "country", countries: ["TR"] }, window: rolling(60) }),
  def({ id: "korean5", group: "world", icon: "flag-outline", colors: ["#3B82F6", "#1E3A8A"], target: 5, flag: "KR",
    rule: { kind: "country", countries: ["KR"] }, window: rolling(60) }),
  def({ id: "japanese5", group: "world", icon: "flag-outline", colors: ["#F43F5E", "#881337"], target: 5, flag: "JP",
    rule: { kind: "country", countries: ["JP"] }, window: rolling(60) }),
  def({ id: "indian5", group: "world", icon: "flag-outline", colors: ["#F97316", "#15803D"], target: 5, flag: "IN",
    rule: { kind: "country", countries: ["IN"] }, window: rolling(60) }),
  def({ id: "french5", group: "world", icon: "flag-outline", colors: ["#60A5FA", "#1D4ED8"], target: 5, flag: "FR",
    rule: { kind: "country", countries: ["FR"] }, window: rolling(60) }),
  def({ id: "iranian3", group: "world", icon: "flag-outline", colors: ["#22C55E", "#B91C1C"], target: 3, flag: "IR",
    rule: { kind: "country", countries: ["IR"] }, window: rolling(90) }),
  def({ id: "latam5", group: "world", icon: "earth-outline", colors: ["#FACC15", "#15803D"], target: 5,
    rule: { kind: "country", countries: REGIONS.latam }, window: rolling(90) }),
  def({ id: "europe6", group: "world", icon: "earth-outline", colors: ["#3B82F6", "#1E3A8A"], target: 6,
    rule: { kind: "countries", within: REGIONS.europe }, window: rolling(90) }),
  def({ id: "asia5", group: "world", icon: "earth-outline", colors: ["#F43F5E", "#9A3412"], target: 5,
    rule: { kind: "countries", within: REGIONS.asia }, window: rolling(90) }),
  def({ id: "countries10", group: "world", icon: "earth-outline", colors: ["#22C55E", "#14532D"], target: 10,
    rule: { kind: "countries" }, window: rolling(180) }),
  // ── Keşif: çeşitlilik, dönem, az bilinen ──
  def({ id: "decades", group: "explore", icon: "hourglass-outline", colors: ["#A855F7", "#4C1D95"],
    target: CHALLENGE_DECADES.length, rule: { kind: "decades", decades: CHALLENGE_DECADES }, window: rolling(180) }),
  def({ id: "genres10", group: "explore", icon: "shapes-outline", colors: ["#EC4899", "#831843"], target: 10,
    rule: { kind: "genres" }, window: rolling(90) }),
  def({ id: "classics5", group: "explore", icon: "film-outline", colors: ["#A8A29E", "#292524"], target: 5,
    rule: { kind: "era", maxYear: 1969 }, window: rolling(90) }),
  def({ id: "recent10", group: "explore", icon: "newspaper-outline", colors: ["#38BDF8", "#0369A1"], target: 10,
    rule: { kind: "recent", years: 2 }, window: rolling(60) }),
  def({ id: "gems5", group: "explore", icon: "diamond-outline", colors: ["#2DD4BF", "#4338CA"], target: 5,
    rule: { kind: "gems", minRating: 7.3, minVotes: 20, maxVotes: 3000 }, window: rolling(90) }),
  // ── Dizi ──
  def({ id: "episodes100", group: "series", icon: "tv-outline", colors: ["#14B8A6", "#134E4A"], target: 100,
    rule: { kind: "episodes" }, window: rolling(30) }),
  def({ id: "episodes30_7", group: "series", icon: "play-forward-outline", colors: ["#0EA5E9", "#1E3A8A"], target: 30,
    rule: { kind: "episodes" }, window: rolling(7) }),
  def({ id: "binge10", group: "series", icon: "infinite-outline", colors: ["#A855F7", "#BE185D"], target: 10,
    rule: { kind: "episodeDay" }, window: rolling(30) }),
  def({ id: "shows5", group: "series", icon: "albums-outline", colors: ["#84CC16", "#365314"], target: 5,
    rule: { kind: "shows" }, window: rolling(60) }),
];

const PERSON_STYLE = {
  director: { group: "directors", icon: "videocam-outline", colors: ["#F59E0B", "#78350F"] },
  actor: { group: "actors", icon: "person-outline", colors: ["#F43F5E", "#831843"] },
};

/**
 * Kişi görevleri data/challengeFilmographies.js'ten türer (kimlik `director_<kişiId>` / `actor_<kişiId>`).
 * Yönetmen = yönettiği filmler, oyuncu = başrolde olduğu filmler. `capped`: listede en bilinen filmler var.
 */
const PERSON_CHALLENGES = CHALLENGE_FILMOGRAPHIES.map((person) => {
  const role = person.role === "actor" ? "actor" : "director";
  const style = PERSON_STYLE[role];
  return def({
    id: `${role}_${person.id}`,
    group: style.group,
    icon: style.icon,
    colors: style.colors,
    target: person.films.length,
    person: Object.freeze({
      id: person.id,
      name: person.name,
      profilePath: person.profilePath,
      role,
      tr: !!person.tr,
      capped: !!person.capped,
    }),
    films: Object.freeze(person.films.map((film) => Object.freeze({ ...film }))),
    rule: { kind: "person", role, personId: person.id },
    window: { type: "open" },
  });
});

export const CHALLENGES = Object.freeze([...BASE_CHALLENGES, ...PERSON_CHALLENGES]);
const BY_ID = new Map(CHALLENGES.map((challenge) => [challenge.id, challenge]));

export const getChallenge = (id) => BY_ID.get(id) || null;

const META_KINDS = new Set(["decades", "countries", "country", "era", "recent", "gems"]);
/** Film ayrıntısı (yıl / ülke / puan) gerektiren kural mı? */
export const needsMeta = (challenge) => META_KINDS.has(challenge?.rule?.kind);

// ── Takvim ──────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");

/** Yerel takvim günü "YYYY-AA-GG". */
export function dayKeyOf(value) {
  const date = toDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const isDayKey = (value) => typeof value === "string" && DAY_RE.test(value);

function parseDay(key) {
  const m = DAY_RE.exec(key || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** Gün ekler (yaz saati kaymasından etkilenmez: takvim alanlarıyla kurulur). */
export function addDays(key, days) {
  const date = parseDay(key);
  if (!date) return null;
  return dayKeyOf(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** İki gün arasındaki tam gün farkı (b − a). */
export function daysBetween(a, b) {
  const x = parseDay(a);
  const y = parseDay(b);
  if (!x || !y) return 0;
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
}

const lastDayOfMonth = (year, month) => new Date(year, month, 0).getDate();

/**
 * Görevin sayım penceresi. `start`/`end` dahil; `open` görevde ikisi de null (tüm geçmiş).
 * @returns {{ start: string|null, end: string|null }}
 */
export function windowOf(challenge, joinedAt) {
  const window = challenge?.window;
  if (!window || window.type === "open") return { start: null, end: null };
  if (window.type === "month") {
    const year = parseDay(joinedAt)?.getFullYear();
    if (!year) return { start: null, end: null };
    return {
      start: `${year}-${pad(window.month)}-01`,
      end: `${year}-${pad(window.month)}-${pad(lastDayOfMonth(year, window.month))}`,
    };
  }
  return { start: joinedAt, end: addDays(joinedAt, window.days - 1) };
}

const inWindow = (day, { start, end }) => !!day && (!start || day >= start) && (!end || day <= end);

/** Mevsimlik görev bugün katılınabilir mi (kendi ayında mı)? Diğerleri her zaman. */
export function isInSeason(challenge, today) {
  if (challenge?.window?.type !== "month") return true;
  return parseDay(today)?.getMonth() + 1 === challenge.window.month;
}

// ── İlerleme ────────────────────────────────────────────────────────────────

const movieKeyOf = (entry) => (entry?.id == null ? null : String(entry.id));

/** Penceredeki filmler: kimlik → { id, name, imagePath, day (pencerede İLK izleme), minutes, genres }. */
function filmsInWindow(movies, window) {
  const films = new Map();
  for (const entry of movies || []) {
    const key = movieKeyOf(entry);
    if (!key) continue;
    const day = dayKeyOf(entry.dateAdded);
    if (!inWindow(day, window)) continue;
    const seen = films.get(key);
    if (seen && seen.day <= day) continue;
    films.set(key, {
      key,
      id: entry.id,
      name: entry.name || "",
      imagePath: entry.imagePath || null,
      day,
      minutes: Number(entry.minutes) || 0,
      genres: Array.isArray(entry.genres) ? entry.genres : [],
    });
  }
  return [...films.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

const genreIdsOf = (film) => new Set(film.genres.map(kanonikTur).filter((id) => id && id !== "other"));

/** ISO 3166-1 ülke kodundan bayrak emojisi ("TR" → 🇹🇷); geçersizde boş. Ülke adı tablosu yok, bayrak dilden bağımsız. */
export function flagOf(code) {
  const value = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return "";
  return String.fromCodePoint(...[...value].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Yapım yılının on yılı (1994 → 1990). */
export const decadeOf = (year) => (Number.isInteger(year) && year > 1800 ? Math.floor(year / 10) * 10 : null);

/**
 * Bir sayaç: her "kova" (tür, on yıl, ülke) için penceredeki İLK film kovayı doldurur.
 * @returns {Array<object>} doldurulan kovalar (film + `label`)
 */
function fillBuckets(films, bucketsOf) {
  const filled = new Map();
  for (const film of films) {
    for (const bucket of bucketsOf(film)) {
      if (!filled.has(bucket)) filled.set(bucket, { ...film, label: bucket });
    }
  }
  return [...filled.values()];
}

/** Tek günde en çok film: o günün filmleri (eşitlikte en erken gün). `films` güne göre sıralı. */
function bestDayOf(films) {
  let best = [];
  let current = [];
  for (const film of films) {
    if (current.length && current[0].day !== film.day) current = [];
    current.push(film);
    if (current.length > best.length) best = [...current];
  }
  return best;
}

/** Art arda en uzun gün serisi: serinin her gününün İLK filmi (eşitlikte en erken seri). `films` güne göre sıralı. */
function longestStreakOf(films) {
  let best = [];
  let current = [];
  for (const film of films) {
    const last = current[current.length - 1];
    if (last && last.day === film.day) continue;
    if (last && addDays(last.day, 1) === film.day) current.push(film);
    else current = [film];
    if (current.length > best.length) best = [...current];
  }
  return best;
}

/**
 * Görevin ilerlemesi.
 *
 * @param {object} challenge  CHALLENGES öğesi
 * @param {string|null} joinedAt "YYYY-AA-GG" (katılınmamış görevin önizlemesi için bugün verilir)
 * @param {object} data
 * @param {Array} data.movies    düzleştirilmiş film izlemeleri (ProfileStatsContext.movieHistoryItems)
 * @param {Array} data.episodes  düzleştirilmiş bölüm izlemeleri (flatEpisodesTv)
 * @param {Object<string,{year?:number,country?:string}>} [data.meta] film kimliği → ayrıntı
 * @returns {{ count: number, target: number, ratio: number, matches: Array, pending: Array<number|string>,
 *             window: {start,end}, slots?: Array }}
 */
export function challengeProgress(challenge, joinedAt, { movies = [], episodes = [], meta = {} } = {}) {
  const target = Math.max(1, challenge?.target || 1);
  const window = windowOf(challenge, joinedAt);
  const rule = challenge?.rule || {};
  let matches = [];
  let pending = [];
  let count = 0;
  let slots;

  if (rule.kind === "episodes" || rule.kind === "shows" || rule.kind === "episodeDay") {
    // Farklı bölümler (pencerede İLK izlendiği gün) → dizi özetleri.
    const firstDay = new Map();
    const meta = new Map();
    for (const episode of episodes || []) {
      const day = dayKeyOf(episode?.episodeWatchTime);
      if (!inWindow(day, window) || episode?.showId == null) continue;
      const key = `${episode.showId}_${episode.seasonNumber}_${episode.episodeNumber}`;
      if (!firstDay.has(key) || day < firstDay.get(key)) firstDay.set(key, day);
      if (!meta.has(String(episode.showId))) meta.set(String(episode.showId), episode);
    }
    let picked = [...firstDay.entries()];
    if (rule.kind === "episodeDay") {
      // Tek günde en çok bölüm: o günün bölümleri sayılır.
      const perDay = new Map();
      for (const [, day] of picked) perDay.set(day, (perDay.get(day) || 0) + 1);
      let bestDay = null;
      for (const [day, n] of perDay) if (!bestDay || n > perDay.get(bestDay)) bestDay = day;
      picked = picked.filter(([, day]) => day === bestDay);
    }
    const shows = new Map();
    for (const [key, day] of picked) {
      const showKey = key.slice(0, key.indexOf("_"));
      const source = meta.get(showKey);
      const show = shows.get(showKey) || {
        key: showKey,
        id: source.showId,
        name: source.showName || "",
        imagePath: source.showImage || null,
        day,
        episodes: 0,
      };
      show.episodes += 1;
      if (day < show.day) show.day = day;
      shows.set(showKey, show);
    }
    matches = [...shows.values()].sort((a, b) => b.episodes - a.episodes || (a.day < b.day ? -1 : 1));
    count = rule.kind === "shows" ? matches.length : picked.length;
  } else if (rule.kind === "person") {
    const watched = new Map();
    for (const entry of movies || []) {
      const key = movieKeyOf(entry);
      const day = dayKeyOf(entry?.dateAdded);
      if (!key) continue;
      if (!watched.has(key) || (day && day < watched.get(key))) watched.set(key, day);
    }
    slots = (challenge.films || []).map((film) => ({
      ...film,
      key: String(film.id),
      watched: watched.has(String(film.id)),
      day: watched.get(String(film.id)) || null,
    }));
    matches = slots.filter((slot) => slot.watched);
    count = matches.length;
  } else {
    const films = filmsInWindow(movies, window);
    if (rule.kind === "films") {
      matches = films;
    } else if (rule.kind === "long") {
      matches = films.filter((film) => film.minutes >= rule.minMinutes);
    } else if (rule.kind === "short") {
      // Süresi bilinmeyen (0) film kısa sayılmaz.
      matches = films.filter((film) => film.minutes > 0 && film.minutes <= rule.maxMinutes);
    } else if (rule.kind === "genre") {
      matches = films.filter((film) => genreIdsOf(film).has(rule.genre));
    } else if (rule.kind === "genres") {
      matches = fillBuckets(films, (film) => [...genreIdsOf(film)]);
    } else if (rule.kind === "sameDay") {
      matches = bestDayOf(films);
    } else if (rule.kind === "streak") {
      matches = longestStreakOf(films);
    } else if (needsMeta(challenge)) {
      const known = [];
      for (const film of films) {
        if (meta[film.key]) known.push({ ...film, ...meta[film.key] });
        else pending.push(film.id);
      }
      if (rule.kind === "decades") {
        const allowed = new Set(rule.decades);
        matches = fillBuckets(known, (film) => {
          const decade = decadeOf(film.year);
          return allowed.has(decade) ? [decade] : [];
        });
        slots = rule.decades.map((decade) => {
          const film = matches.find((match) => match.label === decade);
          return { key: String(decade), decade, film: film || null };
        });
      } else if (rule.kind === "countries") {
        const within = rule.within ? new Set(rule.within) : null;
        matches = fillBuckets(known, (film) => (film.country && (!within || within.has(film.country)) ? [film.country] : []));
      } else if (rule.kind === "country") {
        const allowed = new Set(rule.countries);
        matches = known.filter((film) => allowed.has(film.country)).map((film) => ({ ...film, label: film.country }));
      } else if (rule.kind === "era") {
        matches = known.filter((film) => Number.isInteger(film.year) && film.year <= rule.maxYear);
      } else if (rule.kind === "recent") {
        const from = Number(String(window.start || "").slice(0, 4)) - (rule.years - 1);
        matches = known.filter((film) => Number.isInteger(film.year) && film.year >= from);
      } else if (rule.kind === "gems") {
        matches = known.filter(
          (film) =>
            Number(film.rating) >= rule.minRating &&
            Number(film.votes) >= rule.minVotes &&
            Number(film.votes) <= rule.maxVotes,
        );
      }
    }
    count = matches.length;
  }

  return { count, target, ratio: Math.min(1, count / target), matches, pending, window, ...(slots ? { slots } : {}) };
}

const NO_PACE_KINDS = new Set(["sameDay", "streak", "episodeDay"]);

/**
 * Tempo: süreli görevde beklenen ilerlemeye göre durum. Açık görevde ya da ilk 3 günde null.
 * @returns {null|{ expected: number, ahead: boolean }}
 */
export function paceOf(challenge, joinedAt, count, today) {
  // Seri / tek gün görevleri doğrusal ilerlemez: "bu tempoda 3 olmalıydı" anlamsız.
  if (NO_PACE_KINDS.has(challenge?.rule?.kind)) return null;
  const { start, end } = windowOf(challenge, joinedAt);
  if (!start || !end) return null;
  const total = daysBetween(start, end) + 1;
  const elapsed = Math.min(total, Math.max(0, daysBetween(start, today) + 1));
  if (elapsed < 3) return null;
  const expected = Math.floor((challenge.target * elapsed) / total);
  return { expected, ahead: count >= expected };
}

/** Kalan gün (bugün dahil); açık görevde null, geçmişse 0. */
export function daysLeftOf(challenge, joinedAt, today) {
  const { end } = windowOf(challenge, joinedAt);
  if (!end) return null;
  return Math.max(0, daysBetween(today, end) + 1);
}

// ── Kayıt ───────────────────────────────────────────────────────────────────

const STATUSES = new Set(Object.values(RUN_STATUS));

function normalizeRun(run) {
  if (!run || typeof run !== "object" || !getChallenge(run.id) || !isDayKey(run.joinedAt)) return null;
  const status = STATUSES.has(run.status) ? run.status : RUN_STATUS.ACTIVE;
  const out = { id: run.id, joinedAt: run.joinedAt, status };
  if (status !== RUN_STATUS.ACTIVE) {
    if (isDayKey(run.endedAt)) out.endedAt = run.endedAt;
    if (Number.isFinite(run.count)) out.count = Math.max(0, Math.floor(run.count));
    if (Number.isFinite(run.target)) out.target = Math.max(1, Math.floor(run.target));
  }
  return out;
}

/** Bozuk / eski kaydı okunur hale getirir. Aynı görevin İKİNCİ etkin kaydı düşer. */
export function normalizeChallengeState(raw) {
  const runs = [];
  const active = new Set();
  for (const item of Array.isArray(raw?.runs) ? raw.runs : []) {
    const run = normalizeRun(item);
    if (!run) continue;
    if (run.status === RUN_STATUS.ACTIVE) {
      if (active.has(run.id)) continue;
      active.add(run.id);
    }
    runs.push(run);
  }
  return { runs };
}

export const activeRuns = (state) => state.runs.filter((run) => run.status === RUN_STATUS.ACTIVE);
export const finishedRuns = (state) =>
  state.runs
    .filter((run) => run.status !== RUN_STATUS.ACTIVE)
    .sort((a, b) => ((a.endedAt || "") < (b.endedAt || "") ? 1 : -1));
export const completedRuns = (state) => finishedRuns(state).filter((run) => run.status === RUN_STATUS.DONE);
export const activeRunOf = (state, id) => activeRuns(state).find((run) => run.id === id) || null;

/** Yönetmen görevi bir kez bitince yeniden katılınmaz (filmografi değişmez). */
const isOnceOnly = (challenge) => challenge?.window?.type === "open";

/**
 * Katılım kararı.
 * @returns {"ok"|"active"|"full"|"season"|"done"|"unknown"}
 */
export function joinBlocker(state, id, today) {
  const challenge = getChallenge(id);
  if (!challenge) return "unknown";
  if (activeRunOf(state, id)) return "active";
  if (isOnceOnly(challenge) && completedRuns(state).some((run) => run.id === id)) return "done";
  if (!isInSeason(challenge, today)) return "season";
  if (activeRuns(state).length >= MAX_ACTIVE_CHALLENGES) return "full";
  return "ok";
}

export function joinChallenge(state, id, today) {
  if (joinBlocker(state, id, today) !== "ok") return state;
  return { runs: [...state.runs, { id, joinedAt: today, status: RUN_STATUS.ACTIVE }] };
}

export function leaveChallenge(state, id) {
  return { runs: state.runs.filter((run) => !(run.id === id && run.status === RUN_STATUS.ACTIVE)) };
}

/** Bitmiş kayıtları sınırla: önce en eski süresi dolanlar, sonra en eski tamamlananlar düşer. */
function capFinished(runs) {
  const finished = runs.filter((run) => run.status !== RUN_STATUS.ACTIVE);
  let overflow = finished.length - MAX_FINISHED_RUNS;
  if (overflow <= 0) return runs;
  const byAge = [...finished].sort((a, b) => {
    if (a.status !== b.status) return a.status === RUN_STATUS.EXPIRED ? -1 : 1;
    return (a.endedAt || "") < (b.endedAt || "") ? -1 : 1;
  });
  const drop = new Set();
  for (const run of byAge) {
    if (overflow <= 0) break;
    drop.add(run);
    overflow -= 1;
  }
  return runs.filter((run) => !drop.has(run));
}

/**
 * Etkin görevleri bugüne göre sonuçlandırır: hedefe ulaşan TAMAMLANIR, penceresi geçen SÜRESİ DOLAR.
 * Saf; değişiklik yoksa AYNI nesne döner (gereksiz yazım olmasın).
 *
 * @param {(challenge, joinedAt) => {count:number, target:number, pending:Array}} progressOf
 * @returns {{ state: object, completed: string[], expired: string[] }}
 */
export function settleChallenges(state, progressOf, today) {
  const completed = [];
  const expired = [];
  let changed = false;
  const runs = state.runs.map((run) => {
    if (run.status !== RUN_STATUS.ACTIVE) return run;
    const challenge = getChallenge(run.id);
    const { count, target, pending = [] } = progressOf(challenge, run.joinedAt);
    if (count >= target) {
      changed = true;
      completed.push(run.id);
      return { ...run, status: RUN_STATUS.DONE, endedAt: today, count, target };
    }
    const { end } = windowOf(challenge, run.joinedAt);
    // Ayrıntısı bekleyen film varken süre dolmuş sayılmaz: son günlerde izlenen film henüz okunmamış olabilir.
    if (end && today > end && pending.length === 0) {
      changed = true;
      expired.push(run.id);
      return { ...run, status: RUN_STATUS.EXPIRED, endedAt: end, count, target };
    }
    return run;
  });
  if (!changed) return { state, completed, expired };
  return { state: { runs: capFinished(runs) }, completed, expired };
}

/** Diske yazılacak biçim (boşsa null → anahtar silinir). */
export const toStoredChallengeState = (state) => (state.runs.length ? { runs: state.runs } : null);

/**
 * Keşfet listesi: grup başına, bugün katılınabilir ya da etkin olan görevler. Mevsimi dışındaki mevsimlik görev
 * listelenmez; bir kez bitmiş yönetmen görevi "tamamlandı" işaretiyle kalır.
 */
export function catalogGroups(state, today) {
  return CHALLENGE_GROUPS.map((group) => ({
    group,
    items: CHALLENGES.filter((challenge) => challenge.group === group && isInSeason(challenge, today)).map((challenge) => ({
      challenge,
      blocker: joinBlocker(state, challenge.id, today),
    })),
  })).filter((section) => section.items.length > 0);
}
