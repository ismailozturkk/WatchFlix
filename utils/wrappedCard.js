// utils/wrappedCard.js
//
// Wrapped paylaşım kartının SAF mantığı: düzenler, renk paletleri, seçenek
// doğrulama, poster seçimi ve yıl ısı haritası hesabı. React/RN importu YOKTUR
// (jest'te doğrudan test edilir); kartı çizen bileşen
// components/wrapped/WrappedShareCard.js, düzenleyici ekran
// screens/wrapped/WrappedScreen.js.
//
// Kimlikler (düzen/palet/arka plan) kayıtlı tercih olarak saklanır: bir kimliği
// yeniden adlandırmak kullanıcının kayıtlı seçimini sıfırlar. Görünümleri
// serbestçe değişebilir.

// Referans tuval (9:16). Kart HER ZAMAN bu boyutta yerleşir; ekran onu
// `transform: scale` ile küçültüp gösterir. Yakalama düğümün KENDİ boyutunu alır,
// üst öğenin dönüşümünü almaz → önizleme küçük de olsa çıktı tam boyutlu ve
// önizlemeyle birebir aynıdır.
export const WRAPPED_CARD_W = 360;
export const WRAPPED_CARD_H = 640;
// Instagram Story tam çözünürlüğü.
export const WRAPPED_CARD_CAPTURE = Object.freeze({ width: 1080, height: 1920 });

export const WRAPPED_CAPTION_MAX = 60;

export const WRAPPED_CARD_LAYOUT_IDS = Object.freeze([
  "showcase",
  "posters",
  "ticket",
  "minimal",
]);
export const WRAPPED_CARD_BACKGROUND_IDS = Object.freeze(["glow", "clean", "poster"]);
export const WRAPPED_POSTER_CONTENT_IDS = Object.freeze(["shows", "movies"]);

// ─── Paletler ────────────────────────────────────────────────────────────────
//
// İlk altısı profil hikâye kartıyla ORTAK (utils/profileStoryCard.js
// WRAPPED_THEME_IDS) — sıra ve kimlikler değişmez. Kalanlar yalnız Wrapped'e özel.
//   tone      "dark" | "light": kartın yazı/cam renkleri buna göre seçilir
//   onAccent  vurgu renginin ÜSTÜNE gelen yazı rengi (düğme/rozet)
export const WRAPPED_PALETTES = Object.freeze([
  { id: "signature", labelKey: "themeSignature", tone: "dark", onAccent: "#FFFFFF", accent: "#A78BFA", secondary: "#FF2D87", colors: ["#7C3AED", "#4B1D8F", "#160C24", "#060409"] },
  { id: "sunset", labelKey: "themeSunset", tone: "dark", onAccent: "#FFFFFF", accent: "#FF8A3D", secondary: "#FFC857", colors: ["#FF6B35", "#B42318", "#351218", "#090507"] },
  { id: "ocean", labelKey: "themeOcean", tone: "dark", onAccent: "#0A0F14", accent: "#34D6EE", secondary: "#60A5FA", colors: ["#0891B2", "#164E63", "#082F49", "#030712"] },
  { id: "forest", labelKey: "themeForest", tone: "dark", onAccent: "#0A0F14", accent: "#34D399", secondary: "#A3E635", colors: ["#059669", "#065F46", "#0A2E24", "#04120C"] },
  { id: "gold", labelKey: "themeGold", tone: "dark", onAccent: "#0A0F14", accent: "#FBBF24", secondary: "#FB923C", colors: ["#D97706", "#92400E", "#2E1A08", "#120A04"] },
  { id: "noir", labelKey: "themeNoir", tone: "dark", onAccent: "#0A0F14", accent: "#F4F4F5", secondary: "#A1A1AA", colors: ["#3F3F46", "#27272A", "#18181B", "#050505"] },
  // Yalnız Wrapped:
  { id: "rose", labelKey: "themeRose", tone: "dark", onAccent: "#FFFFFF", accent: "#FB7185", secondary: "#F472B6", colors: ["#E11D48", "#9F1239", "#3B0A1A", "#0A0307"] },
  { id: "aurora", labelKey: "themeAurora", tone: "dark", onAccent: "#06201C", accent: "#2DD4BF", secondary: "#A78BFA", colors: ["#0D9488", "#4C1D95", "#150B33", "#050310"] },
  { id: "paper", labelKey: "themePaper", tone: "light", onAccent: "#FFFFFF", accent: "#E4572E", secondary: "#F2A541", colors: ["#FFFBF2", "#F6EEDB", "#EADFC4", "#DCCFB0"] },
]);

export const WRAPPED_CARD_THEME_IDS = Object.freeze(WRAPPED_PALETTES.map((p) => p.id));

/** Profil hikâye kartıyla paylaşılan ilk altı palet. */
export const WRAPPED_SHARED_PALETTES = Object.freeze(WRAPPED_PALETTES.slice(0, 6));

/**
 * Seçili temaya göre palet. "signature" kullanıcının uygulama vurgusunu alır;
 * bilinmeyen kimlik "signature"a düşer.
 */
export function resolveWrappedPalette(themeId, fallbackAccent) {
  const preset =
    WRAPPED_PALETTES.find((item) => item.id === themeId) || WRAPPED_PALETTES[0];
  if (preset.id !== "signature" || !fallbackAccent) return preset;
  return {
    ...preset,
    accent: fallbackAccent,
    colors: [fallbackAccent, "#4B1D8F", "#160C24", "#060409"],
  };
}

// ─── Seçenekler ──────────────────────────────────────────────────────────────

export const DEFAULT_WRAPPED_CARD_OPTIONS = Object.freeze({
  layout: "showcase",
  themeId: "signature",
  background: "glow",
  posterContent: "shows",
  showPersonality: true,
  showStats: true,
  showGenres: true,
  showPosters: true,
  showActivity: true,
  showName: true,
  caption: "",
});

const BOOLEAN_KEYS = [
  "showPersonality",
  "showStats",
  "showGenres",
  "showPosters",
  "showActivity",
  "showName",
];

const oneOfOr = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

/** Satır sonlarını/ardışık boşlukları tek boşluğa indirir, sınırı uygular. */
export function cleanWrappedCaption(raw) {
  if (typeof raw !== "string") return "";
  const flat = raw.replace(/\s+/g, " ").trim();
  if (flat.length <= WRAPPED_CAPTION_MAX) return flat;
  // Vekil çift (emoji) ortasından kesilmesin.
  const chars = Array.from(flat).slice(0, WRAPPED_CAPTION_MAX);
  return chars.join("").trimEnd();
}

/**
 * Kayıtlı/bozuk/eksik bir seçenek nesnesini güvenli tam nesneye çevirir.
 * Bilinmeyen anahtarlar atılır, geçersiz değerler varsayılana düşer — eski
 * sürümde kaydedilmiş bir tercih yeni sürümde ekranı bozamaz.
 */
export function sanitizeWrappedCardOptions(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const d = DEFAULT_WRAPPED_CARD_OPTIONS;
  const out = {
    layout: oneOfOr(src.layout, WRAPPED_CARD_LAYOUT_IDS, d.layout),
    themeId: oneOfOr(src.themeId, WRAPPED_CARD_THEME_IDS, d.themeId),
    background: oneOfOr(src.background, WRAPPED_CARD_BACKGROUND_IDS, d.background),
    posterContent: oneOfOr(src.posterContent, WRAPPED_POSTER_CONTENT_IDS, d.posterContent),
    caption: cleanWrappedCaption(src.caption),
  };
  for (const key of BOOLEAN_KEYS) {
    out[key] = typeof src[key] === "boolean" ? src[key] : d[key];
  }
  return out;
}

/** Diske yazılacak hâl: not HER paylaşıma özel olduğundan saklanmaz. */
export function persistableWrappedCardOptions(options) {
  const { caption: _caption, ...rest } = sanitizeWrappedCardOptions(options);
  return rest;
}

// Her düzenin gösterebildiği bölümler. Desteklenmeyen bölümün düğmesi pasif
// kalır (kullanıcı neden çalışmadığını görür).
export const WRAPPED_LAYOUT_MODULES = Object.freeze({
  showcase: Object.freeze(["showPersonality", "showStats", "showGenres", "showPosters", "showActivity", "showName"]),
  posters: Object.freeze(["showPersonality", "showStats", "showGenres", "showPosters", "showName"]),
  ticket: Object.freeze(["showPersonality", "showStats", "showGenres", "showPosters", "showName"]),
  minimal: Object.freeze(["showPersonality", "showStats", "showGenres", "showPosters", "showActivity", "showName"]),
});

export const layoutSupportsModule = (layout, key) =>
  (WRAPPED_LAYOUT_MODULES[layout] || WRAPPED_LAYOUT_MODULES.showcase).includes(key);

// ─── Posterler ───────────────────────────────────────────────────────────────

// Her düzenin gösterebildiği en çok poster sayısı.
export const WRAPPED_POSTER_COUNT = Object.freeze({
  showcase: 3,
  posters: 5,
  ticket: 3,
  minimal: 4,
});

const toShowItem = (p) => ({
  key: `show-${p.showId ?? p.showName}`,
  name: String(p.showName || ""),
  image: p.showImage || null,
  count: Number(p.episodeCount) || 0,
});
const toMovieItem = (p) => ({
  key: `movie-${p.id ?? p.name}`,
  name: String(p.name || ""),
  image: p.imagePath || null,
  minutes: Number(p.minutes) || 0,
});

/**
 * Karta konacak posterleri seçer. İstenen içerikte HİÇ öğe yoksa diğerine
 * düşülür; dönen `source` fiilen kullanılan kaynaktır — başlık ("Zirvedeki
 * dizilerin" / "…filmlerin") buna göre yazılmalı. İstenen kaynakta öğe VARSA yalnız
 * o kullanılır, eksik yuvalar başka listeyle doldurulmaz.
 *
 * @returns {{ source: "shows"|"movies"|null, items: Array }}
 */
export function pickWrappedPosters(recap, requested = "shows", count = 3) {
  const shows = (recap?.topShows || []).map(toShowItem);
  const movies = (recap?.moviePosters || []).map(toMovieItem);
  const lists = { shows, movies };
  const order = requested === "movies" ? ["movies", "shows"] : ["shows", "movies"];
  for (const source of order) {
    if (lists[source].length) {
      return { source, items: lists[source].slice(0, Math.max(0, count)) };
    }
  }
  return { source: null, items: [] };
}

/** Karttaki herhangi bir düzende gösterilebilecek poster var mı? */
export const hasWrappedPosters = (recap) =>
  Boolean(recap?.topShows?.length || recap?.moviePosters?.length);

// ─── Her bölümün göstereceği veri var mı? ────────────────────────────────────

export function wrappedModuleAvailability(recap, { hasUserName = false } = {}) {
  return {
    showPersonality: Boolean(recap?.personality),
    showStats: true,
    showGenres: Boolean(recap?.topGenres?.length),
    showPosters: hasWrappedPosters(recap),
    // Eski arşivlenmiş özetlerde ısı haritası verisi yoktur.
    showActivity: Array.isArray(recap?.dayHeat) && (recap?.activeDays || 0) > 0,
    showName: Boolean(hasUserName),
  };
}

// ─── Yıl ısı haritası ────────────────────────────────────────────────────────

/**
 * Gün sayısını 0–4 yoğunluk düzeyine çevirir (0 = o gün hiçbir şey izlenmedi).
 * Düzeyler o yılın EN YOĞUN gününe göre bölünür: tek tük izleyen biri de
 * haritada renk görür, çok izleyen biri de tek renge yapışmaz.
 */
export function heatLevel(count, max) {
  const c = Number(count) || 0;
  if (c <= 0 || !(max > 0)) return 0;
  return Math.min(4, Math.max(1, Math.ceil((c / max) * 4)));
}

/**
 * GitHub tarzı ızgara: sütun = hafta, satır = gün (Pazartesi üstte).
 *
 * @param {number} year
 * @param {number[]} dayHeat 1 Ocak'tan başlayan günlük öğe sayıları
 * @returns {{ cols: number, rows: 7, cells: Array<{col:number,row:number,level:number,count:number}>, monthCols: number[] }}
 *          monthCols: her ayın ilk gününün düştüğü sütun (ay etiketleri için).
 */
export function buildYearHeat(year, dayHeat) {
  const days = Array.isArray(dayHeat) ? dayHeat : [];
  const first = new Date(Number(year), 0, 1);
  // Pazartesi = 0
  const offset = (first.getDay() + 6) % 7;
  const max = days.reduce((m, v) => (v > m ? v : m), 0);
  const cells = days.map((count, i) => {
    const slot = i + offset;
    return {
      col: Math.floor(slot / 7),
      row: slot % 7,
      level: heatLevel(count, max),
      count: Number(count) || 0,
    };
  });
  const cols = Math.max(1, Math.ceil((days.length + offset) / 7));
  const monthCols = [];
  for (let m = 0; m < 12; m += 1) {
    const idx = Math.round(
      (Date.UTC(Number(year), m, 1) - Date.UTC(Number(year), 0, 1)) / 86400000,
    );
    monthCols.push(Math.floor((idx + offset) / 7));
  }
  return { cols, rows: 7, cells, monthCols };
}

// ─── Hero rakamları ──────────────────────────────────────────────────────────

/** "10 gün 5 saat" için parçalar (gün sayıldıktan SONRA kalan saat). */
export function splitWatchTime(totalMinutes = 0) {
  const minutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const hours = Math.floor(minutes / 60);
  return { minutes, hours, days: Math.floor(hours / 24), remHours: hours % 24 };
}

/**
 * Yıl bitmiş mi, sürüyor mu? Sürüyorsa kartta "YTD" gibi bir ibare gerekmez ama
 * kıyas metni farklıdır; ekran getYearPace ile birlikte kullanır.
 */
export const isCurrentYear = (year, now = new Date()) => now.getFullYear() === Number(year);

/** Bilet numarası gibi kararlı bir rakam dizisi: aynı özet → aynı numara. */
export function wrappedSerial(recap) {
  const seed =
    (Number(recap?.year) || 0) * 7919 +
    (Number(recap?.totalMinutes) || 0) * 31 +
    (Number(recap?.totalMovies) || 0) * 17 +
    (Number(recap?.totalEpisodes) || 0) * 13;
  const digits = String(Math.abs(seed) % 100000000).padStart(8, "0");
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/**
 * Bilet barkodu için kararlı çubuk genişlikleri (1–3 birim). Gerçek bir barkod
 * değil, yalnızca süs; ama aynı özet her yakalamada aynı çizilir.
 */
export function wrappedBarcode(recap, bars = 38) {
  let state = (Number(String(wrappedSerial(recap)).replace("-", "")) || 1) % 2147483647;
  const out = [];
  for (let i = 0; i < bars; i += 1) {
    state = (state * 48271) % 2147483647;
    out.push(1 + (state % 3));
  }
  return out;
}

/**
 * Kartın çizeceği poster görselleri: düzenin poster bölümü + (seçiliyse) bulanık
 * arka plan posteri. Kart ve düzenleyici ekran AYNI hesabı kullanır — ekran, hangi
 * görsellerin inmesini beklemesi gerektiğini buradan öğrenir (yakalama, posterler
 * inmeden alınırsa boş yuvalı kart çıkar).
 *
 * @param {object} recap
 * @param {object} options sanitizeWrappedCardOptions çıktısı
 * @param {(path: string, kind: "poster"|"backdrop") => string|null} getUri
 * @returns {{ source: "shows"|"movies"|null, items: Array, bgUri: string|null, uris: string[] }}
 */
export function buildWrappedCardPosters(recap, options, getUri) {
  const layout = options?.layout;
  const wanted = Boolean(options?.showPosters) && layoutSupportsModule(layout, "showPosters");
  const count = WRAPPED_POSTER_COUNT[layout] || 3;
  const pick = pickWrappedPosters(recap, options?.posterContent, count);
  const uriOf = (image, kind) => (image && getUri ? getUri(image, kind) || null : null);

  const items = wanted
    ? pick.items.map((item) => ({ ...item, uri: uriOf(item.image, "poster") }))
    : [];

  let bgUri = null;
  if (options?.background === "poster") {
    const lead = pickWrappedPosters(recap, options?.posterContent, 1).items[0];
    bgUri = uriOf(lead?.image, "backdrop");
  }

  const uris = [...items.map((item) => item.uri), bgUri].filter(Boolean);
  return { source: pick.source, items, bgUri, uris };
}
