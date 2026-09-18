/* ─────────────────────────────────────────────────────────────────────────────

 * Seelogd — Merkezi Renk & Tema Sistemi

 *

 * Mimari:

 *  - PALETTE   : Tüm ham renk değerleri tek yerde (değer tekrarı yok)

 *  - makeTheme : Tema token'larını PALETTE'ten üreten factory

 *  - themes    : { gray, dark, light, blue, green } — tüm temalar

 *  - Yardımcı  : getThemeColors, alpha (opacity helper)

 * ────────────────────────────────────────────────────────────────────────────*/

import { clamp, hexToHsl, hslToHex, toHex } from "../utils/colorUtils";

// ─── Temel renk sabitleri (raw) ───────────────────────────────────────────────

const PALETTE = {
  // Nötrler

  white: "#FFFFFF",

  black: "#000000",

  // Griler

  gray050: "#F8F8F8",

  gray100: "#E8E8E8",

  gray200: "#D6D6D6",

  gray300: "#C4C4C4",

  gray400: "#B0B0B0",

  gray500: "#888888",

  gray600: "#666666",

  gray700: "#444444",

  gray800: "#2C2C2C",

  gray850: "#282828",

  gray900: "#1E1E1E",

  gray950: "#141414",

  // Lacivert / Mavi tonları

  navy050: "#EFF5FA",

  navy100: "#8BAFD0",

  navy200: "#5374AC",

  navy300: "#2B4C84",

  navy400: "#23324B",

  navy500: "#141C33",

  navy600: "#0A1426",

  navy700: "#050A13",

  navy800: "#02050A",

  // Deniz mavisi / Teal (yeşil tema)

  teal050: "#BDD1CF",

  teal100: "#A9BDBB",

  teal150: "#95A9A7",

  teal200: "#76A7AB",

  teal300: "#6C9DA1",

  teal400: "#3D8B89",

  teal500: "#2A7473",

  teal600: "#1C4F4E",

  teal700: "#143636",

  // Vurgu / Semantic renkleri

  blue: "#138DF0", // rgb(19, 141, 240)

  blueAlt: "#2196F3",

  blueDark: "#0551A3", // (eski dark tema accent'i — artık kullanılmıyor)

  blueMid: "#2275B9", // gray tema bold

  green: "#64FF64", // rgb(100, 255, 100)

  red: "#FF3232", // rgb(255, 50, 50)

  orange: "#FF7C25", // rgb(255, 124, 37)

  purple: "#A100A1", // rgb(161, 0, 161)

  yellow: "#FFEB3B", // rgb(255, 235, 59)

  // Not renkleri (UI renk seçici)

  noteGreen: "#64FF64",

  noteRed: "#FF3232",

  noteBlue: "#138DF0",

  noteOrange: "#FF7C25",

  noteYellow: "#FFEB3B",

  notePurple: "#800080",

  notePink: "#FFC0CB",

  noteAqua: "#00FFFF",

  noteTeal: "#008080",
};

// ─── Opacity yardımcı (hex → rgba) ───────────────────────────────────────────

/**

 * @param {string} hex  — "#RRGGBB" formatında renk

 * @param {number} a    — 0-1 arası opaklık

 * @returns {string}    — "rgba(r, g, b, a)"

 */

export function alpha(hex, a = 1) {
  if (typeof hex !== "string") return `rgba(0, 0, 0, ${a})`;

  // Bazı tema token'ları (ör. gray temasının border/tab değerleri) zaten
  // "rgba(...)" — hex parse etmeye kalkınca "rgba(NaN, NaN, NaN, a)" üretip
  // stili geçersiz kılıyordu. rgb bileşenlerini koruyup opaklığı değiştir.
  const rgbaMatch = hex.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/,
  );
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${a})`;
  }

  const clean = hex.replace("#", "");

  const r = parseInt(clean.substring(0, 2), 16);

  const g = parseInt(clean.substring(2, 4), 16);

  const b = parseInt(clean.substring(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(0, 0, 0, ${a})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ─── Not renk paleti (tüm temalar paylaşır) ───────────────────────────────────

// ─── Semantic & Not Renk Setleri (Tema Bazlı) ─────────────────────────────────

// Koyu Temalar (Gray, Dark, Purple, Amber)
export const DARK_THEME_COLORS = Object.freeze({
  green: "#22C55E",
  red: "#EF4444",
  blue: "#3B82F6",
  orange: "#F97316",
  purple: "#A855F7",
  yellow: "#FACC15",
});

export const DARK_THEME_NOTES_COLORS = Object.freeze({
  green: "#22C55E",
  greenBackground: alpha("#22C55E", 0.2),
  red: "#EF4444",
  redBackground: alpha("#EF4444", 0.2),
  blue: "#3B82F6",
  blueBackground: alpha("#3B82F6", 0.2),
  orange: "#F97316",
  orangeBackground: alpha("#F97316", 0.2),
  yellow: "#FACC15",
  yellowBackground: alpha("#FACC15", 0.2),
  purple: "#A855F7",
  purpleBackground: alpha("#A855F7", 0.2),
  pink: "#F472B6",
  pinkBackground: alpha("#F472B6", 0.2),
  aqua: "#22D3EE",
  aquaBackground: alpha("#22D3EE", 0.2),
  teal: "#14B8A6",
  tealBackground: alpha("#14B8A6", 0.2),
});

// Açık Tema (Light) — Beyaz/Açık Gri zeminlerde yüksek kontrast ve temiz okunurluk
export const LIGHT_THEME_COLORS = Object.freeze({
  green: "#15803D", // Canlı derin zümrüt yeşili (kontrast > 5:1)
  red: "#DC2626",   // Net crimson kırmızısı (kontrast > 4.8:1)
  blue: "#2563EB",  // Modern mavi (kontrast > 5.2:1)
  orange: "#C2410C",// Yanık kehribar turuncusu (kontrast > 4.9:1)
  purple: "#7E22CE",// Kraliyet moru (kontrast > 5.6:1)
  yellow: "#A16207",// Zengin altın sarısı / amber (kontrast > 4.8:1)
});

export const LIGHT_THEME_NOTES_COLORS = Object.freeze({
  green: "#15803D",
  greenBackground: alpha("#15803D", 0.14),
  red: "#DC2626",
  redBackground: alpha("#DC2626", 0.14),
  blue: "#2563EB",
  blueBackground: alpha("#2563EB", 0.14),
  orange: "#C2410C",
  orangeBackground: alpha("#C2410C", 0.14),
  yellow: "#A16207",
  yellowBackground: alpha("#A16207", 0.16),
  purple: "#7E22CE",
  purpleBackground: alpha("#7E22CE", 0.14),
  pink: "#BE185D",
  pinkBackground: alpha("#BE185D", 0.14),
  aqua: "#0E7490",
  aquaBackground: alpha("#0E7490", 0.14),
  teal: "#0F766E",
  tealBackground: alpha("#0F766E", 0.14),
});

// Yeşil Tema (Green) — Adaçayı/Nane zeminlerde net ayrışan tonlar
export const GREEN_THEME_COLORS = Object.freeze({
  green: "#0D6E5B", // Koyu çam yeşili (adaçayı zeminde net ayrışır, kontrast > 4.8:1)
  red: "#B91C1C",   // Derin yakut kırmızısı (kontrast > 5.3:1)
  blue: "#0369A1",  // Derin safir mavi (kontrast > 4.7:1)
  orange: "#C2410C",// Zengin sıcak turuncu (kontrast > 4.9:1)
  purple: "#6B21A8",// Derin mürdüm moru (kontrast > 5.7:1)
  yellow: "#92400E",// Sıcak altın sarısı / kehribar (kontrast > 5.1:1)
});

export const GREEN_THEME_NOTES_COLORS = Object.freeze({
  green: "#0D6E5B",
  greenBackground: alpha("#0D6E5B", 0.15),
  red: "#B91C1C",
  redBackground: alpha("#B91C1C", 0.15),
  blue: "#0369A1",
  blueBackground: alpha("#0369A1", 0.15),
  orange: "#C2410C",
  orangeBackground: alpha("#C2410C", 0.15),
  yellow: "#92400E",
  yellowBackground: alpha("#92400E", 0.16),
  purple: "#6B21A8",
  purpleBackground: alpha("#6B21A8", 0.15),
  pink: "#9D174D",
  pinkBackground: alpha("#9D174D", 0.15),
  aqua: "#155E75",
  aquaBackground: alpha("#155E75", 0.15),
  teal: "#115E59",
  tealBackground: alpha("#115E59", 0.15),
});

// Açık Mavi Tema (Sky) — Ferah gökyüzü / buz mavisi zeminler (#81D4FA / #4FC3F7 tabanlı)
export const SKY_THEME_COLORS = Object.freeze({
  green: "#0D6E5B",
  red: "#B91C1C",
  blue: "#026AA7",
  orange: "#C2410C",
  purple: "#6B21A8",
  yellow: "#92400E",
});

export const SKY_THEME_NOTES_COLORS = Object.freeze({
  green: "#0D6E5B",
  greenBackground: alpha("#0D6E5B", 0.14),
  red: "#B91C1C",
  redBackground: alpha("#B91C1C", 0.14),
  blue: "#026AA7",
  blueBackground: alpha("#026AA7", 0.14),
  orange: "#C2410C",
  orangeBackground: alpha("#C2410C", 0.14),
  yellow: "#92400E",
  yellowBackground: alpha("#92400E", 0.15),
  purple: "#6B21A8",
  purpleBackground: alpha("#6B21A8", 0.14),
  pink: "#9D174D",
  pinkBackground: alpha("#9D174D", 0.14),
  aqua: "#0E7490",
  aquaBackground: alpha("#0E7490", 0.14),
  teal: "#0F766E",
  tealBackground: alpha("#0F766E", 0.14),
});

// Lacivert Tema (Blue) — Gece laciverti zeminler
export const BLUE_THEME_COLORS = Object.freeze({
  green: "#34D399",
  red: "#F87171",
  blue: "#60A5FA",
  orange: "#FB923C",
  purple: "#C084FC",
  yellow: "#FDE047",
});

export const BLUE_THEME_NOTES_COLORS = Object.freeze({
  green: "#34D399",
  greenBackground: alpha("#34D399", 0.2),
  red: "#F87171",
  redBackground: alpha("#F87171", 0.2),
  blue: "#60A5FA",
  blueBackground: alpha("#60A5FA", 0.2),
  orange: "#FB923C",
  orangeBackground: alpha("#FB923C", 0.2),
  yellow: "#FDE047",
  yellowBackground: alpha("#FDE047", 0.2),
  purple: "#C084FC",
  purpleBackground: alpha("#C084FC", 0.2),
  pink: "#F472B6",
  pinkBackground: alpha("#F472B6", 0.2),
  aqua: "#38BDF8",
  aquaBackground: alpha("#38BDF8", 0.2),
  teal: "#2DD4BF",
  tealBackground: alpha("#2DD4BF", 0.2),
});

export const SHARED_COLORS = DARK_THEME_COLORS;
export const SHARED_NOTES_COLORS = DARK_THEME_NOTES_COLORS;

export function getSemanticColorsForTheme(themeKey, surfaceHex) {
  if (themeKey === "light") {
    return { colors: LIGHT_THEME_COLORS, notesColor: LIGHT_THEME_NOTES_COLORS };
  }
  if (themeKey === "green") {
    return { colors: GREEN_THEME_COLORS, notesColor: GREEN_THEME_NOTES_COLORS };
  }
  if (themeKey === "sky") {
    return { colors: SKY_THEME_COLORS, notesColor: SKY_THEME_NOTES_COLORS };
  }
  if (themeKey === "blue") {
    return { colors: BLUE_THEME_COLORS, notesColor: BLUE_THEME_NOTES_COLORS };
  }
  if (themeKey === "gray" || themeKey === "dark" || themeKey === "purple" || themeKey === "amber") {
    return { colors: DARK_THEME_COLORS, notesColor: DARK_THEME_NOTES_COLORS };
  }
  if (surfaceHex) {
    const hsl = hexToHsl(toHex(surfaceHex));
    if (hsl.h >= 80 && hsl.h <= 180 && hsl.l >= 35) {
      return { colors: GREEN_THEME_COLORS, notesColor: GREEN_THEME_NOTES_COLORS };
    }
    if (hsl.h >= 181 && hsl.h <= 220 && hsl.l >= 50) {
      return { colors: SKY_THEME_COLORS, notesColor: SKY_THEME_NOTES_COLORS };
    }
    if (hsl.l >= 50) {
      return { colors: LIGHT_THEME_COLORS, notesColor: LIGHT_THEME_NOTES_COLORS };
    }
  }
  return { colors: DARK_THEME_COLORS, notesColor: DARK_THEME_NOTES_COLORS };
}

// ─── Theme factory ────────────────────────────────────────────────────────────

/**
 * Tema token'larını üreten factory fonksiyonu.
 * Her tema yalnızca kendi değerlerini geçirir, shared değerler otomatik eklenir.
 */
function makeTheme({
  primary,
  secondary,
  between,
  border,
  tab,
  text,
  accent,
  bold,
  shadow,
  themeKey,
}) {
  const semantic = getSemanticColorsForTheme(themeKey, primary);
  return {
    // ── Yüzey renkleri ─────────────────────────────────────────────────────
    primary,
    secondary,
    secondaryt: alpha(
      secondary
        .replace("rgb(", "rgba(")
        .replace(")", ", 0.5)")
        .startsWith("rgba")
        ? secondary
        : secondary,
      0,
    ),
    between,
    border,
    tab,
    ai: alpha(tab, 0.4),

    // ── Metin ──────────────────────────────────────────────────────────────
    text: {
      primary: text.primary,
      secondary: text.secondary,
      between: text.between,
      muted: text.muted,
    },

    // ── Vurgu ──────────────────────────────────────────────────────────────
    accent,
    bold,
    shadow,

    // ── Tema Bazlı Renk Setleri ─────────────────────────────────────────────
    colors: semantic.colors,
    notesColor: semantic.notesColor,
  };
}

// ─── Temalar ──────────────────────────────────────────────────────────────────

export const themes = {
  /* ── Koyu Gri ─────────────────────────────────────────────────── */
  gray: {
    primary: "#1D1F23",
    secondary: "#2A2D33",
    secondaryt: alpha("#2A2D33", 0.5),
    between: "#24262B",
    border: alpha("#4A4F58", 0.8),
    tab: alpha("#2A2D33", 0.95),
    ai: alpha("#2A2D33", 0.4),
    text: {
      primary: "#F6F7F9",
      secondary: "#D6D9DE",
      between: "#B4B9C1",
      muted: "#7C838F",
    },
    accent: "#3B82F6",
    bold: "#2563EB",
    shadow: alpha(PALETTE.black, 0.6),
    colors: DARK_THEME_COLORS,
    notesColor: DARK_THEME_NOTES_COLORS,
  },

  /* ── Siyah (AMOLED) ────────────────────────────────────────────── */
  dark: {
    primary: PALETTE.black,
    secondary: "#15171C",
    secondaryt: alpha("#15171C", 0.5),
    between: "#1D2026",
    border: "#262A31",
    tab: "#121418",
    ai: alpha("#121418", 0.4),
    text: {
      primary: "#F5F6F8",
      secondary: "#C9CDD4",
      between: "#9AA1AB",
      muted: "#757C87",
    },
    accent: "#3B82F6",
    bold: "#2563EB",
    shadow: alpha(PALETTE.black, 0.55),
    colors: DARK_THEME_COLORS,
    notesColor: DARK_THEME_NOTES_COLORS,
  },

  /* ── Açık (Light) ──────────────────────────────────────────────── */
  light: {
    primary: "#F1F5F9",
    secondary: "#FFFFFF",
    secondaryt: alpha("#FFFFFF", 0.5),
    between: "#EEF2F6",
    border: "#E2E8F0",
    tab: "#FFFFFF",
    ai: alpha("#FFFFFF", 0.4),
    text: {
      primary: "#0F172A",
      secondary: "#334155",
      between: "#64748B",
      muted: "#94A3B8",
    },
    accent: "#2563EB",
    bold: "#1D4ED8",
    shadow: alpha("#0F172A", 0.08),
    colors: LIGHT_THEME_COLORS,
    notesColor: LIGHT_THEME_NOTES_COLORS,
  },

  /* ── Açık Mavi (Sky / Ice Blue) ───────────────────────────────────
     #81D4FA / #4FC3F7 tabanlı ferah pastel mavi zemin + berrak buz mavisi
     kartlar + derin okyanus safir accent. */
  sky: {
    primary: "#B6DCF0",
    secondary: "#DDF2FC",
    secondaryt: alpha("#DDF2FC", 0.5),
    between: "#A5D4EC",
    border: "#8EC4E0",
    tab: "#DDF2FC",
    ai: alpha("#DDF2FC", 0.4),
    text: {
      primary: "#0A2540",
      secondary: "#183B5E",
      between: "#2D557B",
      muted: "#486E94",
    },
    accent: "#026AA7",
    bold: "#024C7B",
    shadow: alpha("#032B44", 0.18),
    colors: SKY_THEME_COLORS,
    notesColor: SKY_THEME_NOTES_COLORS,
  },

  /* ── Lacivert ───────────────────────────────────────────────────── */
  blue: {
    primary: PALETTE.navy500,
    secondary: PALETTE.navy400,
    secondaryt: alpha(PALETTE.navy400, 0.5),
    between: "#1B2440",
    border: "#2A3E63",
    tab: "#20304F",
    ai: alpha("#20304F", 0.4),
    text: {
      primary: PALETTE.navy050,
      secondary: PALETTE.navy100,
      between: "#6E87A8",
      muted: "#5F7694",
    },
    accent: "#4C8DFF",
    bold: "#2D6BDF",
    shadow: alpha(PALETTE.black, 0.6),
    colors: BLUE_THEME_COLORS,
    notesColor: BLUE_THEME_NOTES_COLORS,
  },

  /* ── Açık Yeşil (Teal / Sage) ──────────────────────────────────── */
  green: {
    primary: "#B9CEC7",
    secondary: "#D8E7E1",
    secondaryt: alpha("#D8E7E1", 0.5),
    between: "#A9C0B8",
    border: "#93AFA6",
    tab: "#D8E7E1",
    ai: alpha("#D8E7E1", 0.4),
    text: {
      primary: "#122E2B",
      secondary: "#24504B",
      between: "#3E6862",
      muted: "#527570",
    },
    accent: "#0B5F57",
    bold: "#0A4A44",
    shadow: alpha("#0B221F", 0.22),
    colors: GREEN_THEME_COLORS,
    notesColor: GREEN_THEME_NOTES_COLORS,
  },

  /* ── Gece Moru ──────────────────────────────────────────────────── */
  purple: {
    primary: "#16131E",
    secondary: "#211C2E",
    secondaryt: alpha("#211C2E", 0.5),
    between: "#1B1726",
    border: "#332C46",
    tab: "#1D1929",
    ai: alpha("#1D1929", 0.4),
    text: {
      primary: "#F4F2F9",
      secondary: "#CFC9DE",
      between: "#A79FBE",
      muted: "#7E7694",
    },
    accent: "#8B5CF6",
    bold: "#7C3AED",
    shadow: alpha(PALETTE.black, 0.6),
    colors: DARK_THEME_COLORS,
    notesColor: DARK_THEME_NOTES_COLORS,
  },

  /* ── Kızıl Sinema (Crimson / Velvet Red) ────────────────────────── */
  amber: {
    primary: "#170D12",
    secondary: "#24141D",
    secondaryt: alpha("#24141D", 0.5),
    between: "#1C0F17",
    border: "#3D202F",
    tab: "#20121A",
    ai: alpha("#20121A", 0.4),
    text: {
      primary: "#FDF2F4",
      secondary: "#E2CBD2",
      between: "#B89CA5",
      muted: "#886E77",
    },
    accent: "#F43F5E",
    bold: "#E11D48",
    shadow: alpha(PALETTE.black, 0.6),
    colors: DARK_THEME_COLORS,
    notesColor: DARK_THEME_NOTES_COLORS,
  },
};

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/**

 * Tema adına göre tema nesnesini döner.

 * Bilinmeyen tema adı için varsayılan olarak "gray" döner.

 * @param {keyof typeof themes} themeName

 * @returns {(typeof themes)[keyof typeof themes]}

 */

export const getThemeColors = (themeName) => themes[themeName] ?? themes.gray;

/**

 * Tüm tema adlarının listesi

 */

export const THEME_NAMES = Object.keys(themes);

// ─── Özel Tema (kullanıcı tarafından oluşturulan) ─────────────────────────────

/**
 * Özel tema oluşturucuda düzenlenebilen renk token'ları. Her giriş, düz bir
 * token anahtari (buildCustomTheme'in bekledigi) + UI grubu + etiket tasir.
 * Türetilen degerler (secondaryt, ai, shadow) ve paylasilan setler (colors,
 * notesColor) kullaniciya gosterilmez; otomatik uretilir.
 */
export const CUSTOM_THEME_TOKENS = [
  { key: "primary", group: "surface", labelKey: "autoI18n.ct_arka_plan", fallback: "Arka Plan" },
  { key: "secondary", group: "surface", labelKey: "autoI18n.ct_yuzey", fallback: "Yüzey / Kart" },
  { key: "between", group: "surface", labelKey: "autoI18n.ct_ara_yuzey", fallback: "Ara Yüzey" },
  { key: "tab", group: "surface", labelKey: "autoI18n.ct_sekme", fallback: "Sekme Çubuğu" },
  { key: "border", group: "surface", labelKey: "autoI18n.ct_kenarlik", fallback: "Kenarlık" },
  { key: "accent", group: "accent", labelKey: "autoI18n.ct_vurgu", fallback: "Vurgu" },
  { key: "bold", group: "accent", labelKey: "autoI18n.ct_koyu_vurgu", fallback: "Koyu Vurgu" },
  { key: "textPrimary", group: "text", labelKey: "autoI18n.ct_ana_metin", fallback: "Ana Metin" },
  { key: "textSecondary", group: "text", labelKey: "autoI18n.ct_ikincil_metin", fallback: "İkincil Metin" },
  { key: "textBetween", group: "text", labelKey: "autoI18n.ct_ara_metin", fallback: "Ara Metin" },
  { key: "textMuted", group: "text", labelKey: "autoI18n.ct_soluk_metin", fallback: "Soluk Metin" },
];

export const CUSTOM_THEME_GROUPS = [
  { id: "surface", labelKey: "autoI18n.ct_grup_yuzeyler", fallback: "Yüzeyler" },
  { id: "accent", labelKey: "autoI18n.ct_grup_vurgu", fallback: "Vurgu Renkleri" },
  { id: "text", labelKey: "autoI18n.ct_grup_metin", fallback: "Metin Renkleri" },
];

/**
 * Bir temanın 11 düzenlenebilir token değerini (hepsi hex'e normalize) çıkarır.
 * Özel tema oluşturucuda bir temel temadan başlatmak/sıfırlamak için kullanılır.
 */
export function themeToTokens(themeName) {
  const tm = getThemeColors(themeName);
  return {
    primary: toHex(tm.primary),
    secondary: toHex(tm.secondary),
    between: toHex(tm.between),
    tab: toHex(tm.tab),
    border: toHex(tm.border),
    accent: toHex(tm.accent),
    bold: toHex(tm.bold || tm.accent),
    textPrimary: toHex(tm.text.primary),
    textSecondary: toHex(tm.text.secondary),
    textBetween: toHex(tm.text.between),
    textMuted: toHex(tm.text.muted),
  };
}

/** Yeni özel temalar için varsayılan tohum (koyu/AMOLED temasından). */
export const DEFAULT_CUSTOM_TOKENS = themeToTokens("dark");

/**
 * Bir token "bağıl" mı? Bağıl token, başka bir token'dan türetilir:
 *   { from: "accent", l: +15, s: -5, h: 0 }
 * l/s/h, kaynağın HSL değerine eklenen ofsetlerdir (% puan). Kullanıcı "bir
 * rengin %X açık/koyu halini" başka bir alanda kullanmak istediğinde kurulur.
 */
export const isRelativeToken = (v) =>
  Boolean(v) && typeof v === "object" && typeof v.from === "string";

/**
 * Kaynak hex + ofsetlerden bağıl rengi hesaplar.
 */
export function applyRelative(baseHex, { l = 0, s = 0, h = 0 } = {}) {
  const hsl = hexToHsl(baseHex);
  return hslToHex(
    hsl.h + (Number(h) || 0),
    clamp(hsl.s + (Number(s) || 0), 0, 100),
    clamp(hsl.l + (Number(l) || 0), 0, 100),
  );
}

/**
 * Karışık (mutlak hex + bağıl) token setini, hepsi mutlak hex olan düz bir
 * haritaya çözer. Bağıl token zinciri iteratif çözülür; döngü/eksik referans
 * varsayılana düşer.
 */
export function resolveThemeTokens(tokens) {
  const raw = { ...DEFAULT_CUSTOM_TOKENS, ...(tokens && typeof tokens === "object" ? tokens : {}) };
  const resolved = {};
  const pending = {};
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (isRelativeToken(v)) pending[key] = v;
    else resolved[key] = toHex(v);
  }
  let guard = 0;
  while (Object.keys(pending).length && guard < 24) {
    guard += 1;
    let progressed = false;
    for (const key of Object.keys(pending)) {
      const rel = pending[key];
      const base = resolved[rel.from];
      if (base) {
        resolved[key] = applyRelative(base, rel);
        delete pending[key];
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  // Çözülemeyen (döngüsel/eksik referanslı) token'lar varsayılan değere düşer.
  for (const key of Object.keys(pending)) {
    resolved[key] = toHex(DEFAULT_CUSTOM_TOKENS[key] || "#808080");
  }
  return resolved;
}

/**
 * Düz token setinden tam tema nesnesi üretir. Bağıl token'lar önce çözülür;
 * türetilen yüzey/şeffaflık değerleri ve paylaşılan renk setleri otomatik
 * eklenir; böylece özel tema uygulamanın geri kalanı için yerleşik temalarla
 * bire bir aynı şekle sahiptir.
 */
export function buildCustomTheme(tokens) {
  const t = resolveThemeTokens(tokens);
  const semantic = getSemanticColorsForTheme("custom", t.primary);
  return {
    primary: t.primary,
    secondary: t.secondary,
    secondaryt: alpha(t.secondary, 0.5),
    between: t.between,
    border: t.border,
    tab: t.tab,
    ai: alpha(t.tab, 0.4),
    text: {
      primary: t.textPrimary,
      secondary: t.textSecondary,
      between: t.textBetween,
      muted: t.textMuted,
    },
    accent: t.accent,
    bold: t.bold,
    shadow: alpha(PALETTE.black, 0.7),
    colors: semantic.colors,
    notesColor: semantic.notesColor,
  };
}

/**

 * Belirtilen themeKey ve token path'i için değer döner.

 * Örnek: getToken("dark", "text.muted") → "#666666"

 *

 * @param {string} themeName

 * @param {string} tokenPath  — "accent" | "text.primary" | "notesColor.blue" vb.

 * @returns {string|undefined}

 */

export const getToken = (themeName, tokenPath) => {
  const theme = getThemeColors(themeName);

  return tokenPath.split(".").reduce((obj, key) => obj?.[key], theme);
};

/**

 * Stil özelliği → tema token eşlemesi.

 * applyTheme() ile kullanılır.

 */

export const themeProperties = {
  container: { backgroundColor: "primary" },

  settingItem: { backgroundColor: "secondary", borderColor: "border" },

  text: { color: "text.primary" },

  sectionTitle: { color: "text.muted" },

  aboutItem: { backgroundColor: "secondary" },

  version: { color: "text.primary" },

  copyright: { color: "text.muted" },
};

/**

 * Verilen tema ve style anahtarı için React Native stili döner.

 * @param {string} themeName

 * @param {string} styleKey  — themeProperties'deki anahtar

 * @returns {Record<string, string>}

 */

export const applyTheme = (themeName, styleKey) => {
  const property = themeProperties[styleKey];

  if (!property) return {};

  const styles = {};

  Object.entries(property).forEach(([cssProp, tokenPath]) => {
    styles[cssProp] = getToken(themeName, tokenPath);
  });

  return styles;
};
