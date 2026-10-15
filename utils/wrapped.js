// utils/wrapped.js
//
// Seelogd Wrapped — saf hesaplama katmanı (Firestore/listener YOK).
// ProfileStatsContext'in zaten topladığı zaman damgalı izleme verisinden
// (filmler: dateAdded, bölümler: episodeWatchTime) yıllık bir "recap" üretir.
//
// Tüm fonksiyonlar saftır: aynı girdi → aynı çıktı. Ekran tarafında useMemo
// ile sarılır, böylece her render'da yeniden hesaplanmaz.

// "YYYY-MM-DD" — uygulamanın dateAdded/episodeWatchTime için ürettiği biçim
// (bkz. utils/mediaFacts.todayListDate, utils/watchHistory.normalizeWatchDate).
// Sonu kapalı ($) tutuluyor ki saat içeren tam ISO string'ler bu daldan geçmesin.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

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
    // KRİTİK: "YYYY-MM-DD" ES spec'e göre UTC gece yarısı çözülür, ama aşağıdaki
    // yearOf/dayKey/tallyDate YEREL alanları (getFullYear/getMonth/getDate) okur.
    // Negatif UTC ofsetinde gün bir geri kayar → 1 Ocak'ta izlenen film önceki
    // yılın Wrapped'ine düşer. Tarih-only değerler YEREL kurulur.
    // (Aynı koruma: utils/airDate.js ve utils/watchScoring.js)
    const m = DATE_ONLY.exec(value.trim());
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
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

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Yılın gün sayısı (365 / 366). */
export const daysInYear = (y) => (isLeapYear(Number(y)) ? 366 : 365);

// 1 Ocak = 0. Date.UTC: yerel DST geçişi 23/25 saatlik günler üretip indeksi
// kaydırmasın (longestStreakOf ile aynı gerekçe).
const dayOfYearIndex = (d) =>
  Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
      Date.UTC(d.getFullYear(), 0, 1)) /
      86400000,
  );

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

/**
 * Bir bölümü ait olduğu diziye bağlayan anahtar.
 * showId yoksa dizi adına düşer; bölümün kendi `id`si ASLA kullanılmaz —
 * o `showId_sezon_bölüm_event` biçiminde bölüm başına tekil olduğundan
 * her bölüm ayrı bir diziymiş gibi sayılırdı.
 */
const showKeyOf = (episode) => episode?.showId ?? episode?.showName ?? null;

/**
 * Bölüm listesindeki farklı dizi sayısı. Dizi sayısı üç yerde gösteriliyor
 * (Wrapped özeti, profildeki giriş kartı, yıllık arşiv); hesap tek yerde
 * tutulmazsa aynı yıl için farklı sayılar görünür.
 */
export const countShows = (episodes = []) => {
  const set = new Set();
  episodes.forEach((e) => {
    const key = showKeyOf(e);
    if (key != null) set.add(key);
  });
  return set.size;
};

/**
 * Her yıl için tek geçişte {movies, episodes, shows, minutes} özeti.
 * Hub kartı ve yıllık arşiv listesi eskiden yıl başına tüm listeyi yeniden
 * süzüyordu (yıl sayısı × veri boyutu); burada veri bir kez gezilir.
 * Dizi sayısı countShows'tan geçer → üç yüzeyde aynı hesap.
 */
export const getYearSummaries = (movies = [], episodes = []) => {
  const out = {};
  const slot = (y) => {
    if (!out[y]) out[y] = { movies: 0, episodes: 0, shows: 0, minutes: 0 };
    return out[y];
  };
  const epsByYear = {};
  movies.forEach((m) => {
    const y = yearOf(m?.dateAdded);
    if (!y) return;
    const s = slot(y);
    s.movies += 1;
    s.minutes += Number(m?.minutes) || 0;
  });
  episodes.forEach((e) => {
    const y = yearOf(e?.episodeWatchTime);
    if (!y) return;
    const s = slot(y);
    s.episodes += 1;
    s.minutes += Number(e?.episodeMinutes) || 0;
    (epsByYear[y] || (epsByYear[y] = [])).push(e);
  });
  Object.keys(epsByYear).forEach((y) => {
    out[y].shows = countShows(epsByYear[y]);
  });
  return out;
};

/**
 * Seçili yılın izleme süresini bir önceki yılla kıyaslar.
 *
 * Devam eden yılda (year === bugünün yılı) önceki yılın TAMAMI değil, bugünün
 * ay/gününe kadarki kısmı alınır; yoksa Ekim'de "geçen yıldan %40 az" gibi
 * haksız bir sonuç çıkar. Bitmiş yılda iki yıl da tam kıyaslanır.
 *
 * deltaPct: önceki yıl verisi yoksa null (0'a bölme / anlamsız "∞%").
 */
export const getYearPace = ({ movies = [], episodes = [], year, now = new Date() }) => {
  const inProgress = now.getFullYear() === year;
  // ay*100+gün: aynı yıl içinde tarihleri sıralı karşılaştırmanın en ucuz yolu.
  const cutoff = inProgress ? now.getMonth() * 100 + now.getDate() : Infinity;
  const md = (d) => d.getMonth() * 100 + d.getDate();

  const sumYear = (y, limit) => {
    let total = 0;
    movies.forEach((m) => {
      const d = toDate(m?.dateAdded);
      if (d && d.getFullYear() === y && md(d) <= limit) total += Number(m?.minutes) || 0;
    });
    episodes.forEach((e) => {
      const d = toDate(e?.episodeWatchTime);
      if (d && d.getFullYear() === y && md(d) <= limit) total += Number(e?.episodeMinutes) || 0;
    });
    return total;
  };

  const minutes = sumYear(year, Infinity);
  const prevMinutes = sumYear(year - 1, cutoff);
  const deltaPct =
    prevMinutes > 0 ? Math.round(((minutes - prevMinutes) / prevMinutes) * 100) : null;
  return { minutes, prevMinutes, deltaPct, sameWindow: inProgress };
};

// Gün anahtarı → gün numarası. Date.UTC: yerel DST geçişinde 23/25 saatlik
// günler yüzünden "ardışık gün" farkının kaymasını önler.
const dayNumber = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** En uzun ardışık izleme günü serisi (gün anahtarları "YYYY-MM-DD"). */
export const longestStreakOf = (dayKeys = []) => {
  const nums = [...new Set(dayKeys)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  nums.forEach((n, i) => {
    run = i > 0 && n === nums[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  });
  return best;
};

// ─── Kişilik (tür → izleyici kişiliği rozeti) ────────────────────────────────

const PERSONALITIES = [
  { key: "comedy",      emoji: "😂", tr: "Kahkaha Avcısı",       en: "Laugh Hunter",      match: ["komedi", "comedy"],
    trDesc: "Kötü bir günün ilacı hep bir komedi.", enDesc: "A good comedy fixes any bad day." },
  { key: "horror",      emoji: "😱", tr: "Cesur Yürek",          en: "Brave Heart",       match: ["korku", "horror"],
    trDesc: "Işıklar kapalı, ses sonuna kadar açık.", enDesc: "Lights off, volume all the way up." },
  { key: "thriller",    emoji: "🔪", tr: "Gerilim Ustası",       en: "Thrill Seeker",     match: ["gerilim", "thriller"],
    trDesc: "Bir sonraki sürprizi hep sen tahmin edersin.", enDesc: "You always call the next twist." },
  { key: "action",      emoji: "💥", tr: "Adrenalin Bağımlısı",  en: "Adrenaline Junkie", match: ["aksiyon", "action", "macera", "adventure"],
    trDesc: "Tempo düşmesin, patlama eksik olmasın.", enDesc: "Keep the pace up and the explosions coming." },
  { key: "scifi",       emoji: "🚀", tr: "Zaman Yolcusu",        en: "Time Traveler",     match: ["bilim kurgu", "science fiction", "sci-fi", "fantastik", "fantasy"],
    trDesc: "Gerçeklik sana dar gelir, yeni evrenler ararsın.", enDesc: "Reality feels small — you want new worlds." },
  { key: "drama",       emoji: "🎭", tr: "Duygu Yolcusu",        en: "Soul Wanderer",     match: ["dram", "drama"],
    trDesc: "Karakterlerle yaşar, finalde derin bir nefes alırsın.", enDesc: "You live with the characters, then exhale at the finale." },
  { key: "romance",     emoji: "💘", tr: "Romantik Ruh",         en: "Hopeless Romantic", match: ["romantik", "romance"],
    trDesc: "Bir aşk hikâyesine hep yer vardır.", enDesc: "There's always room for a love story." },
  { key: "animation",   emoji: "🎨", tr: "Çizgi Düşler",         en: "Animated Dreamer",  match: ["animasyon", "animation"],
    trDesc: "Çizilmiş dünyalar sana hiç çocukça gelmez.", enDesc: "Drawn worlds never feel childish to you." },
  { key: "documentary", emoji: "🔭", tr: "Bilge Gözlemci",       en: "Wise Observer",     match: ["belgesel", "documentary"],
    trDesc: "Gerçek hikâyeler her kurgudan çok sarar.", enDesc: "Real stories beat fiction every time." },
  { key: "crime",       emoji: "🕵️", tr: "Dosya Avcısı",         en: "Case Cracker",      match: ["suç", "crime", "gizem", "mystery"],
    trDesc: "Her ipucunu izler, dosyayı sen kapatırsın.", enDesc: "You follow every clue and close the case." },
];
const DEFAULT_PERSONALITY = {
  key: "default", emoji: "🍿", tr: "Sinefil", en: "Cinephile",
  trDesc: "Her türden izlersin; sinema sana geniş bir alan.", enDesc: "You watch everything — cinema is wide open to you.",
};

export const getPersonality = (genre, language = "tr") => {
  const g = (genre || "").toLowerCase();
  const found =
    (g && PERSONALITIES.find((p) => p.match.some((m) => g.includes(m)))) ||
    DEFAULT_PERSONALITY;
  const tr = language === "tr";
  return {
    key: found.key,
    emoji: found.emoji,
    title: tr ? found.tr : found.en,
    desc: tr ? found.trDesc : found.enDesc,
  };
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
    const id = showKeyOf(e);
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
  // Yıl içi her gün için öğe sayısı (0. indeks = 1 Ocak). Isı haritası bunu çizer.
  const dayHeat = new Array(daysInYear(year)).fill(0);
  // Pazartesi = 0 … Pazar = 6
  const weekdayCounts = new Array(7).fill(0);
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
    const di = dayOfYearIndex(d);
    if (di >= 0 && di < dayHeat.length) dayHeat[di] += 1;
    weekdayCounts[(d.getDay() + 6) % 7] += 1;
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

  const activeDayKeys = Object.keys(dayCount);
  const activeDays = activeDayKeys.length;
  const longestStreak = longestStreakOf(activeDayKeys);

  let favoriteWeekday = null;
  weekdayCounts.forEach((count, i) => {
    if (count > 0 && (favoriteWeekday === null || count > weekdayCounts[favoriteWeekday]))
      favoriteWeekday = i;
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
    activeDays,
    longestStreak,
    dayHeat,
    weekdayCounts,
    favoriteWeekday,
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

/** language'a göre uzun hafta günü adı (0 = Pazartesi … 6 = Pazar). */
export const weekdayName = (index, language = "tr") => {
  try {
    // 2024-01-01 bir Pazartesi.
    return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-US", {
      weekday: "long",
    }).format(new Date(2024, 0, 1 + index));
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
