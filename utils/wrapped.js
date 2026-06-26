// utils/wrapped.js
//
// Watchify Wrapped — saf hesaplama katmanı (Firestore/listener YOK).
// ProfileStatsContext'in zaten topladığı zaman damgalı izleme verisinden
// (filmler: dateAdded, bölümler: episodeWatchTime) yıllık bir "recap" üretir.
//
// Tüm fonksiyonlar saftır: aynı girdi → aynı çıktı. Ekran tarafında useMemo
// ile sarılır, böylece her render'da yeniden hesaplanmaz.

/**
 * Çeşitli tarih formatlarını Date'e çevirir.
 * Destekler: Date, Firestore Timestamp ({seconds}), "YYYY-MM-DD"/ISO string,
 * epoch (saniye veya ms) number. Geçersizse null.
 */
export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && typeof value.seconds === "number")
    return new Date(value.seconds * 1000);
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    const d = new Date(value < 1e12 ? value * 1000 : value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const yearOf = (value) => {
  const d = toDate(value);
  return d ? d.getFullYear() : null;
};

const dayKey = (value) => {
  const d = toDate(value);
  if (!d) return null;
  // Yerel saat dilimine göre YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Veri bulunan tüm yılları azalan sırada döndürür (en yeni → en eski).
 * @param {Array} movies   listItems içinden type==="movie" filtrelenmiş
 * @param {Array} episodes flatEpisodesTv
 */
export const getAvailableYears = (movies = [], episodes = []) => {
  const set = new Set();
  movies.forEach((m) => {
    const y = yearOf(m?.dateAdded);
    if (y) set.add(y);
  });
  episodes.forEach((e) => {
    const y = yearOf(e?.episodeWatchTime);
    if (y) set.add(y);
  });
  return [...set].sort((a, b) => b - a);
};

// ─── Kişilik (tür → izleyici kişiliği rozeti) ────────────────────────────────

const PERSONALITIES = [
  { key: "comedy",      emoji: "😂", tr: "Kahkaha Avcısı",       en: "Laugh Hunter",      match: ["komedi", "comedy"] },
  { key: "horror",      emoji: "😱", tr: "Cesur Yürek",          en: "Brave Heart",       match: ["korku", "horror"] },
  { key: "thriller",    emoji: "🔪", tr: "Gerilim Ustası",       en: "Thrill Seeker",     match: ["gerilim", "thriller"] },
  { key: "action",      emoji: "💥", tr: "Adrenalin Bağımlısı",  en: "Adrenaline Junkie", match: ["aksiyon", "action", "macera", "adventure"] },
  { key: "scifi",       emoji: "🚀", tr: "Zaman Yolcusu",        en: "Time Traveler",     match: ["bilim kurgu", "science fiction", "sci-fi", "fantastik", "fantasy"] },
  { key: "drama",       emoji: "🎭", tr: "Duygu Yolcusu",        en: "Soul Wanderer",     match: ["dram", "drama"] },
  { key: "romance",     emoji: "💘", tr: "Romantik Ruh",         en: "Hopeless Romantic", match: ["romantik", "romance"] },
  { key: "animation",   emoji: "🎨", tr: "Çizgi Düşler",         en: "Animated Dreamer",  match: ["animasyon", "animation"] },
  { key: "documentary", emoji: "🔭", tr: "Bilge Gözlemci",       en: "Wise Observer",     match: ["belgesel", "documentary"] },
  { key: "crime",       emoji: "🕵️", tr: "Dosya Avcısı",         en: "Case Cracker",      match: ["suç", "crime", "gizem", "mystery"] },
];
const DEFAULT_PERSONALITY = { key: "default", emoji: "🍿", tr: "Sinefil", en: "Cinephile" };

export const getPersonality = (genre, language = "tr") => {
  const g = (genre || "").toLowerCase();
  const found =
    (g && PERSONALITIES.find((p) => p.match.some((m) => g.includes(m)))) ||
    DEFAULT_PERSONALITY;
  return { key: found.key, emoji: found.emoji, title: language === "tr" ? found.tr : found.en };
};

// ─── Ana hesaplama ───────────────────────────────────────────────────────────

/**
 * Belirli bir yıl için izleme özetini üretir.
 * @returns recap nesnesi (bkz. plan). Veri yoksa totalMinutes=0 vb. ile döner.
 */
export const buildYearlyRecap = ({ movies = [], episodes = [], year, language = "tr" }) => {
  const myMovies = movies.filter((m) => yearOf(m?.dateAdded) === year);
  const myEps = episodes.filter((e) => yearOf(e?.episodeWatchTime) === year);

  const movieMinutes = myMovies.reduce((acc, m) => acc + (Number(m.minutes) || 0), 0);
  const tvMinutes = myEps.reduce((acc, e) => acc + (Number(e.episodeMinutes) || 0), 0);
  const totalMinutes = movieMinutes + tvMinutes;

  const totalMovies = myMovies.length;
  const totalEpisodes = myEps.length;

  // ── Türler (film + dizi birleşik) ──
  const genreCount = {};
  const addGenres = (arr) =>
    (arr || []).forEach((g) => {
      const name = typeof g === "string" ? g : g?.name;
      if (name) genreCount[name] = (genreCount[name] || 0) + 1;
    });
  myMovies.forEach((m) => addGenres(m.genres));
  myEps.forEach((e) => addGenres(e.genres));
  const allGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({ genre, count }));
  const topGenres = allGenres.slice(0, 5);

  // ── En çok izlenen diziler (yıl içi bölüm sayısına göre) ──
  const showMap = {};
  myEps.forEach((e) => {
    const id = e.showId ?? e.showName;
    if (id == null) return;
    if (!showMap[id])
      showMap[id] = {
        showId: e.showId,
        showName: e.showName,
        showImage: e.showImage,
        episodeCount: 0,
        minutes: 0,
      };
    showMap[id].episodeCount += 1;
    showMap[id].minutes += Number(e.episodeMinutes) || 0;
  });
  const totalShows = Object.keys(showMap).length;
  const allShows = Object.values(showMap).sort(
    (a, b) => b.episodeCount - a.episodeCount || b.minutes - a.minutes,
  );
  const topShows = allShows.slice(0, 5);

  // ── İzlenen filmler (süreye göre, posterlik) ──
  const moviePosters = [...myMovies]
    .sort((a, b) => (Number(b.minutes) || 0) - (Number(a.minutes) || 0))
    .slice(0, 9)
    .map((m) => ({ id: m.id, name: m.name, imagePath: m.imagePath, minutes: Number(m.minutes) || 0 }));

  // ── Aylık dağılım (dakika) + aylık film/bölüm sayısı ──
  const monthly = new Array(12).fill(0);
  const monthlyCount = new Array(12).fill(0);
  const monthlyMovies = new Array(12).fill(0);
  const monthlyEpisodes = new Array(12).fill(0);
  const dayCount = {};
  const tallyDate = (value, minutes, kind) => {
    const d = toDate(value);
    if (!d) return;
    const mi = d.getMonth();
    monthly[mi] += minutes;
    monthlyCount[mi] += 1;
    if (kind === "movie") monthlyMovies[mi] += 1;
    else monthlyEpisodes[mi] += 1;
    const k = dayKey(value);
    if (k) dayCount[k] = (dayCount[k] || 0) + 1;
  };
  myMovies.forEach((m) => tallyDate(m.dateAdded, Number(m.minutes) || 0, "movie"));
  myEps.forEach((e) => tallyDate(e.episodeWatchTime, Number(e.episodeMinutes) || 0, "episode"));

  // En yoğun ay (dakikaya göre) + o ayın kırılımı
  let busiestMonth = null;
  let bmIdx = -1;
  monthly.forEach((min, i) => {
    if (min > 0 && (bmIdx === -1 || min > monthly[bmIdx])) bmIdx = i;
  });
  if (bmIdx !== -1)
    busiestMonth = {
      month: bmIdx,
      minutes: monthly[bmIdx],
      count: monthlyCount[bmIdx],
      movieCount: monthlyMovies[bmIdx],
      episodeCount: monthlyEpisodes[bmIdx],
    };

  // En yoğun gün (öğe sayısına göre)
  let busiestDay = null;
  Object.entries(dayCount).forEach(([date, count]) => {
    if (!busiestDay || count > busiestDay.count) busiestDay = { date, count };
  });

  const personality = getPersonality(topGenres[0]?.genre, language);

  return {
    year,
    totalMinutes,
    movieMinutes,
    tvMinutes,
    totalMovies,
    totalEpisodes,
    totalShows,
    topGenres,
    allGenres,
    topShows,
    allShows,
    moviePosters,
    monthly,
    busiestMonth,
    busiestDay,
    personality,
    generatedAt: Date.now(),
  };
};

// ─── Biçimlendirme yardımcıları ──────────────────────────────────────────────

export const formatNumber = (n, language = "tr") =>
  Number(n || 0).toLocaleString(language === "tr" ? "tr-TR" : "en-US");

/** Toplam dakikadan {hours, days} türetir (özet kartı için). */
export const minutesBreakdown = (minutes = 0) => {
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return { minutes, hours, days };
};

/** language'a göre uzun ay adı (0-11). */
export const monthName = (index, language = "tr") => {
  try {
    return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-US", {
      month: "long",
    }).format(new Date(2020, index, 1));
  } catch {
    return String(index + 1);
  }
};

/** language'a göre uzun tarih (YYYY-MM-DD veya Date). */
export const formatLongDate = (value, language = "tr") => {
  const d = toDate(value);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return String(value);
  }
};
