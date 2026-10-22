// utils/cinemaBingo.js
//
// "Sinema Bingosu" — aylık 3x3 kart ve küçük haftalık hedeflerin SAF çekirdeği. RN/Firebase importu YOK
// (jest yalnız saf modülleri çalıştırabiliyor).
//
// FİKİR: her ay herkese AYNI kart gelir (ay kimliğinden türeyen sabit tohum), kareler
// kullanıcının izleme kayıtlarından OTOMATİK işaretlenir. Kullanıcı bir şey "tıklamaz"; bingo,
// zaten yaptığı izlemenin oyunlaştırılmış okunuşudur. Aynı kartın herkese gelmesi, arkadaşlarla
// "bu ay kaç çizgi yaptın?" karşılaştırmasını mümkün kılar (sunucu gerekmez).
//
// KARELER YALNIZ SAKLI VERİDEN HESAPLANABİLİRLERDEN SEÇİLİR. İzleme kaydında tür adları, süre
// (dakika, film için) ve izleme GÜNÜ vardır; yapım yılı, özgün dil ve saat YOKTUR. Bu yüzden
// "90'lardan film" ya da "yabancı dilde" gibi kareler kasten yok — onları işaretlemek için her
// başlığın TMDB'den çekilmesi gerekirdi (ağ + kota) ve hesaplama çevrimdışı bozulurdu.
//
// HAFTA: pazartesi başlar, YEREL takvim. Kimlik pazartesinin "YYYY-AA-GG" günüdür (ISO hafta
// numarası değil): yıl sınırında belirsizlik yok ve önceki/sonraki hafta düz gün aritmetiği.
// Tarihler "YYYY-AA-GG" metni olarak kıyaslanır — saat dilimi kayması bu yolda hiç doğmaz
// (utils/wrapped.js toDate ile aynı gerekçe).

import { createStableSource } from "./seededRandom";
import { kanonikTur } from "./genreCanon";

const pad = (n) => String(n).padStart(2, "0");
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Date → yerel "YYYY-AA-GG". */
export const dayKeyOfDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDay = (key) => {
  const m = DAY_RE.exec(String(key || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** "YYYY-AA-GG" + n gün (yerel takvim; yaz saati kaymasından etkilenmez). */
export function addDays(dayKey, n) {
  const date = parseDay(dayKey);
  if (!date) return null;
  date.setDate(date.getDate() + n);
  return dayKeyOfDate(date);
}

/**
 * İzleme olayının günü. Kayıtlar "YYYY-AA-GG" metni; eski/yabancı biçimler (Date, Firestore
 * zaman damgası, ISO) yerel güne çevrilir. Çözülemezse null.
 */
export function dayOf(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const m = DAY_RE.exec(value);
    if (m) return m[0];
  }
  const raw = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : value);
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : dayKeyOfDate(date);
}

/** Bu haftanın kimliği: pazartesinin günü. */
export function weekIdOf(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dayKeyOfDate(date);
}

/** Haftanın son günü (pazar). */
export const weekEndOf = (weekId) => addDays(weekId, 6);

/** Bugün dahil haftada kaç gün kaldı (pazartesi 7 … pazar 1). */
export function daysLeftInWeek(now = new Date()) {
  return 7 - ((now.getDay() + 6) % 7);
}

export const previousWeekId = (weekId) => addDays(weekId, -7);

/** Aylık kartın kimliği ve son günü yerel takvime göre hesaplanır. */
export const monthIdOf = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
export const monthEndOf = (monthId) => {
  const date = parseDay(monthId);
  return date ? dayKeyOfDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)) : null;
};
export const previousMonthId = (monthId) => {
  const date = parseDay(monthId);
  return date ? monthIdOf(new Date(date.getFullYear(), date.getMonth() - 1, 1)) : null;
};
export const daysLeftInMonth = (now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;

const isWeekend = (dayKey) => {
  const date = parseDay(dayKey);
  return !!date && (date.getDay() === 0 || date.getDay() === 6);
};

// ── Kart ─────────────────────────────────────────────────────────────────────

// Kartta çıkabilecek türler. 12 tür: her haftanın kartında en çok 3'ü görünür.
export const BINGO_GENRES = Object.freeze([
  "action", "comedy", "drama", "horror", "scifi", "thriller",
  "romance", "animation", "documentary", "crime", "fantasy", "mystery",
]);

const MAX_GENRE_CELLS = 2;
export const CENTER = 4;
const CARD_SIZE = 9;

// Satırlar, sütunlar, iki köşegen.
export const BINGO_LINES = Object.freeze([
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
].map((line) => Object.freeze(line)));

/** Karelerin kind → eşik tabloları (kartı kuran ve değerlendiren aynı sayıyı görür). */
const SHORT_MOVIE_MAX_MIN = 100;
const LONG_MOVIE_MIN_MIN = 140;
export const BINGO_THRESHOLDS = Object.freeze({
  shortMovieMax: SHORT_MOVIE_MAX_MIN,
  longMovieMin: LONG_MOVIE_MIN_MIN,
});

/**
 * Dönemin kartı. AYNI ay kimliği → AYNI kart (tohumlu); merkez hep "bir şey izle".
 * Orta sütun ulaşılabilir bir ilk çizgidir: iki izleme, herhangi bir izleme ve iki ayrı gün.
 * Diğer kareler karıştırılmış havuzdan gelir; tür kareleri en çok üç tane.
 *
 * @returns {Array<{id:string, kind:string, n?:number, genre?:string}>} 9 kare
 */
export function buildBingoCard(periodId) {
  const source = createStableSource(`bingo|${periodId}`);
  const pick = (list, salt) => list[source.int(0, list.length - 1, salt)];

  const counted = [
    ["movies", pick([2, 3], "movies")],
    ["episodes", pick([2, 3, 5], "episodes")],
    ["days", pick([3, 4], "days")],
  ].map(([kind, n]) => ({ id: `${kind}:${n}`, kind, n }));
  const plain = ["newGenre", "shortMovie", "longMovie", "weekend", "newShow", "rewatch", "bothTypes", "twoShows"]
    .map((kind) => ({ id: kind, kind }));
  const genres = BINGO_GENRES.map((genre) => ({ id: `genre:${genre}`, kind: "genre", genre }));

  const pool = source.shuffle([...counted, ...plain, ...genres], "pool");
  const picked = [];
  let genreCells = 0;
  for (const candidate of pool) {
    if (picked.length === CARD_SIZE - 3) break;
    if (candidate.kind === "genre") {
      if (genreCells >= MAX_GENRE_CELLS) continue;
      genreCells += 1;
    }
    picked.push(candidate);
  }

  const fixed = {
    1: { id: "watches:2", kind: "watches", n: 2 },
    [CENTER]: { id: "any", kind: "any" },
    7: { id: "days:2", kind: "days", n: 2 },
  };
  const cells = [];
  let next = 0;
  for (let i = 0; i < CARD_SIZE; i += 1) {
    cells.push(fixed[i] || picked[next++]);
  }
  return cells;
}

// ── Değerlendirme ────────────────────────────────────────────────────────────

const genresOf = (item) =>
  [...new Set((Array.isArray(item?.genres) ? item.genres : []).map(kanonikTur).filter(Boolean))];

/**
 * Kartı izleme kayıtlarına göre değerlendirir.
 *
 * @param {object} p
 * @param {Array}  p.card          buildBingoCard çıktısı
 * @param {string} p.weekId        Dönem başlangıcı (aylık kart için ayın biri)
 * @param {string} p.endDay       Dönem sonu (verilmezse hafta sonu)
 * @param {Array}  p.movieEntries  İZLEME OLAYI başına film (ProfileStats `movieHistoryItems`):
 *                                 { id, dateAdded:"YYYY-AA-GG", minutes, genres:[ad] }
 * @param {Array}  p.episodes      İZLEME OLAYI başına bölüm (`flatEpisodesTv`):
 *                                 { id, showId, episodeWatchTime, genres:[ad] }
 * @returns {{
 *   weekId: string, cells: Array, doneCount: number, lines: number[], lineCount: number,
 *   full: boolean, oneAway: number[],
 * }}
 */
export function evaluateBingo({ card, weekId, endDay, movieEntries = [], episodes = [] }) {
  const end = endDay || weekEndOf(weekId);
  const inWeek = (day) => !!day && day >= weekId && day <= end;

  const weekMovies = [];
  const movieDays = new Map(); // film → tüm izleme günleri (geçmiş dahil)
  const seenBefore = new Set(); // hafta öncesinde izlenmiş tür kümeleri
  const allDays = new Set(); // bu haftadaki herhangi bir izleme günü

  movieEntries.forEach((entry, index) => {
    const day = dayOf(entry?.dateAdded);
    if (!day) return;
    const id = String(entry?.id ?? `#${index}`);
    if (!movieDays.has(id)) movieDays.set(id, []);
    movieDays.get(id).push(day);
    if (day < weekId) genresOf(entry).forEach((g) => seenBefore.add(g));
    if (inWeek(day)) {
      weekMovies.push({ id, day, minutes: Number(entry?.minutes) || 0, genres: genresOf(entry) });
      allDays.add(day);
    }
  });

  const weekEpisodes = [];
  const firstDayByShow = new Map(); // dizi → en erken izleme günü (tüm zamanlar)
  episodes.forEach((episode, index) => {
    const day = dayOf(episode?.episodeWatchTime);
    if (!day) return;
    const showId = episode?.showId != null ? String(episode.showId) : null;
    if (showId != null) {
      const known = firstDayByShow.get(showId);
      if (!known || day < known) firstDayByShow.set(showId, day);
    }
    if (day < weekId) genresOf(episode).forEach((g) => seenBefore.add(g));
    if (inWeek(day)) {
      weekEpisodes.push({
        key: String(episode?.id ?? `#${index}`),
        showId,
        day,
        genres: genresOf(episode),
      });
      allDays.add(day);
    }
  });

  const weekTitles = [...weekMovies, ...weekEpisodes];
  const distinct = (list, keyOf) => new Set(list.map(keyOf)).size;
  const movieCount = distinct(weekMovies, (m) => m.id);
  const episodeCount = distinct(weekEpisodes, (e) => e.key);
  const showCount = distinct(weekEpisodes.filter((e) => e.showId != null), (e) => e.showId);

  const bool = (value) => ({ have: value ? 1 : 0, need: 1 });
  const counter = (have, need) => ({ have: Math.min(have, need), need });

  const measure = (cell) => {
    switch (cell.kind) {
      case "any": return counter(weekTitles.length, 1);
      case "watches": return counter(weekTitles.length, cell.n);
      case "movies": return counter(movieCount, cell.n);
      case "episodes": return counter(episodeCount, cell.n);
      case "days": return counter(allDays.size, cell.n);
      case "twoShows": return counter(showCount, 2);
      case "genre": return bool(weekTitles.some((t) => t.genres.includes(cell.genre)));
      case "newGenre":
        return bool(weekTitles.some((t) => t.genres.some((g) => g !== "other" && !seenBefore.has(g))));
      case "shortMovie":
        return bool(weekMovies.some((m) => m.minutes > 0 && m.minutes <= SHORT_MOVIE_MAX_MIN));
      case "longMovie": return bool(weekMovies.some((m) => m.minutes >= LONG_MOVIE_MIN_MIN));
      case "weekend": return bool(weekTitles.some((t) => isWeekend(t.day)));
      case "newShow":
        return bool(weekEpisodes.some((e) => e.showId != null && firstDayByShow.get(e.showId) >= weekId));
      case "rewatch":
        return bool(weekMovies.some((m) => (movieDays.get(m.id) || []).some((d) => d < weekId)));
      case "bothTypes": return bool(weekMovies.length > 0 && weekEpisodes.length > 0);
      default: return { have: 0, need: 1 };
    }
  };

  const cells = card.map((cell) => {
    const { have, need } = measure(cell);
    return { ...cell, have, need, done: have >= need };
  });

  const lines = [];
  const oneAway = [];
  BINGO_LINES.forEach((line, lineIndex) => {
    const open = line.filter((i) => !cells[i].done);
    if (open.length === 0) lines.push(lineIndex);
    else if (open.length === 1 && !oneAway.includes(open[0])) oneAway.push(open[0]);
  });
  const doneCount = cells.filter((c) => c.done).length;

  return {
    weekId,
    cells,
    doneCount,
    lines,
    lineCount: lines.length,
    full: doneCount === CARD_SIZE,
    oneAway,
  };
}

/** Haftalık hafif görevler: bir kayıt, iki kayıt ve iki ayrı gün. Film ve dizi eşit sayılır. */
export function evaluateWeeklyGoals({ weekId, movieEntries = [], episodes = [] }) {
  const end = weekEndOf(weekId);
  const days = new Set();
  let watches = 0;
  for (const entry of movieEntries) {
    const day = dayOf(entry?.dateAdded);
    if (day && day >= weekId && day <= end) { watches += 1; days.add(day); }
  }
  const episodeIds = new Set();
  for (const entry of episodes) {
    const day = dayOf(entry?.episodeWatchTime);
    if (day && day >= weekId && day <= end) {
      episodeIds.add(String(entry?.id ?? `${entry?.showId}:${day}:${episodeIds.size}`));
      days.add(day);
    }
  }
  watches += episodeIds.size;
  const goals = [
    { id: "firstWatch", have: Math.min(watches, 1), need: 1 },
    { id: "twoWatches", have: Math.min(watches, 2), need: 2 },
    { id: "twoDays", have: Math.min(days.size, 2), need: 2 },
  ].map((goal) => ({ ...goal, done: goal.have >= goal.need }));
  return { weekId, goals, doneCount: goals.filter((goal) => goal.done).length };
}

/** Aylık çizgi serisi; içinde bulunulan ay henüz boşsa geçen aydan başlar. */
export function bingoMonthStreak(history, currentMonthId) {
  const normalized = normalizeBingoHistory(history);
  let monthId = (normalized[currentMonthId]?.lines || 0) >= 1 ? currentMonthId : previousMonthId(currentMonthId);
  let streak = 0;
  while (monthId && (normalized[monthId]?.lines || 0) >= 1) {
    streak += 1;
    monthId = previousMonthId(monthId);
  }
  return streak;
}

/** Bu kareyi (hücre indeksiyle) içeren TAMAMLANMIŞ bir çizgi var mı — vurgu için. */
export const cellsOnLines = (lines) => {
  const set = new Set();
  lines.forEach((lineIndex) => BINGO_LINES[lineIndex].forEach((i) => set.add(i)));
  return set;
};

// ── Geçmiş (cihaz-yerel) ─────────────────────────────────────────────────────

export const MAX_WEEKS_KEPT = 26;
const WEEK_ID_RE = /^\d{4}-\d{2}-\d{2}$/;
const clampInt = (value, max) => Math.max(0, Math.min(max, Math.trunc(Number(value)) || 0));

/**
 * Depodan okunan ham değeri güvenli biçime çevirir: { [haftaKimliği]: { lines, squares, full, seen } }.
 * `seen`: kullanıcının Bingo sayfasında GÖRDÜĞÜ çizgi sayısı — kutlama yalnız görülmemiş çizgi için çıkar.
 * Bozuk/eksik kayıt asla hata vermez; geçersiz gün kimlikleri atılır; son 26 dönem tutulur.
 */
export function normalizeBingoHistory(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  Object.keys(raw)
    .filter((weekId) => WEEK_ID_RE.test(weekId) && parseDay(weekId))
    .sort()
    .slice(-MAX_WEEKS_KEPT)
    .forEach((weekId) => {
      const entry = raw[weekId];
      if (!entry || typeof entry !== "object") return;
      const squares = clampInt(entry.squares, CARD_SIZE);
      out[weekId] = {
        lines: clampInt(entry.lines, BINGO_LINES.length),
        squares,
        full: entry.full === true && squares === CARD_SIZE,
        seen: clampInt(entry.seen, BINGO_LINES.length),
      };
    });
  return out;
}

/**
 * Haftanın sonucunu geçmişe işler. DEĞERLER YALNIZ ARTAR: kullanıcı bir izlemeyi sonradan
 * silse bile haftanın "en iyi" sonucu geri düşmez (kutlanan çizgi geri alınmış gibi görünmesin).
 * Değişim yoksa AYNI nesneyi döner (çağıran gereksiz yazımı atlar).
 */
export function recordBingoWeek(history, weekId, result) {
  const current = normalizeBingoHistory(history);
  if (!WEEK_ID_RE.test(String(weekId))) return current;
  const before = current[weekId] || { lines: 0, squares: 0, full: false, seen: 0 };
  const squares = Math.max(before.squares, clampInt(result?.doneCount, CARD_SIZE));
  const next = {
    lines: Math.max(before.lines, clampInt(result?.lineCount, BINGO_LINES.length)),
    squares,
    full: before.full || (result?.full === true && squares === CARD_SIZE),
    seen: before.seen,
  };
  if (
    current[weekId] &&
    current[weekId].lines === next.lines &&
    current[weekId].squares === next.squares &&
    current[weekId].full === next.full
  ) {
    return history && typeof history === "object" && !Array.isArray(history) ? history : current;
  }
  return normalizeBingoHistory({ ...current, [weekId]: next });
}

/**
 * Kullanıcı bu haftanın `lines` çizgisini sayfada gördü. Yalnız artar; hafta kaydı yoksa açılır
 * (kayıt, değerlendirmeden ÖNCE gelen ilk görüşte de oluşabilsin). Değişim yoksa AYNI nesne.
 */
export function markBingoSeen(history, weekId, lines) {
  const current = normalizeBingoHistory(history);
  if (!WEEK_ID_RE.test(String(weekId))) return current;
  const before = current[weekId] || { lines: 0, squares: 0, full: false, seen: 0 };
  const seen = Math.max(before.seen, clampInt(lines, BINGO_LINES.length));
  if (current[weekId] && current[weekId].seen === seen) {
    return history && typeof history === "object" && !Array.isArray(history) ? history : current;
  }
  return normalizeBingoHistory({ ...current, [weekId]: { ...before, seen } });
}

/** Depoya yazılacak değer: boş geçmişte `null` (anahtar silinir). */
export function toStoredBingoHistory(history) {
  const normalized = normalizeBingoHistory(history);
  return Object.keys(normalized).length ? normalized : null;
}

/**
 * Seri: ARDIŞIK haftalarda en az bir çizgi. Bu hafta henüz çizgi yoksa seri bozulmuş SAYILMAZ
 * (hafta bitmedi): geçen haftadan geriye sayılır.
 */
export function bingoStreak(history, currentWeekId) {
  const normalized = normalizeBingoHistory(history);
  let weekId = (normalized[currentWeekId]?.lines || 0) >= 1 ? currentWeekId : previousWeekId(currentWeekId);
  let streak = 0;
  while (weekId && (normalized[weekId]?.lines || 0) >= 1) {
    streak += 1;
    weekId = previousWeekId(weekId);
  }
  return streak;
}

/** Toplamlar: kayıtlı hafta, tam kart sayısı, en iyi çizgi. */
export function bingoTotals(history) {
  const weeks = Object.values(normalizeBingoHistory(history));
  return {
    weeks: weeks.length,
    fullCards: weeks.filter((w) => w.full).length,
    bestLines: weeks.reduce((max, w) => Math.max(max, w.lines), 0),
  };
}
