/* ─────────────────────────────────────────────────────────────────────────────

 * Seelogd — Merkezi Renk & Tema Sistemi

 *

 * Mimari:

 *  - PALETTE   : Tüm ham renk değerleri tek yerde (değer tekrarı yok)

 *  - themes    : tüm yerleşik temalar — her biri `expandTheme` ile v2 token
 *                şemasına genişletilmiş (bkz. theme/themeTokens.js)
 *  - THEME_FAMILIES : 3 aile × 5 ton (bkz. theme/toneModel.js)

 *  - Yardımcı  : getThemeColors, alpha (opacity helper)

 * ────────────────────────────────────────────────────────────────────────────*/

import { clamp, hexToHsl, hslToHex, toHex } from "../utils/colorUtils";
import { deriveToneTokens } from "../utils/themeStudio";
import { DEFAULT_TONE, TONES, isTone } from "./toneModel";
import { expandTheme, toRgba } from "./themeTokens";

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
  // "#rgb", "#rrggbb", "#rrggbbaa", "rgb()" ve "rgba()" hepsi desteklenir; bazı
  // tema token'ları (ör. gray temasının border/tab değerleri) zaten rgba.
  // (Eskiden "#fff" gibi kısa hex parse edilemiyor ve SİYAH dönüyordu.)
  return toRgba(hex, a);
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

export function getSemanticColorsForTheme(themeKey, surfaceHex) {
  if (themeKey === "light" || themeKey === "silver") {
    return { colors: LIGHT_THEME_COLORS, notesColor: LIGHT_THEME_NOTES_COLORS };
  }
  if (themeKey === "green" || themeKey === "greenBright") {
    return { colors: GREEN_THEME_COLORS, notesColor: GREEN_THEME_NOTES_COLORS };
  }
  if (themeKey === "sky" || themeKey === "blueBright") {
    return { colors: SKY_THEME_COLORS, notesColor: SKY_THEME_NOTES_COLORS };
  }
  if (themeKey === "blue" || themeKey === "blueDeep" || themeKey === "blueDusk") {
    return { colors: BLUE_THEME_COLORS, notesColor: BLUE_THEME_NOTES_COLORS };
  }
  if (
    themeKey === "gray" ||
    themeKey === "dark" ||
    themeKey === "dusk" ||
    themeKey === "purple" ||
    themeKey === "amber" ||
    themeKey === "greenMid" ||
    themeKey === "greenDeep" ||
    themeKey === "greenDusk"
  ) {
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

// ─── Temalar ──────────────────────────────────────────────────────────────────

// Ham (elle yazılmış) temalar. Uygulamaya `themes` (genişletilmiş) üzerinden açılır.
// Ton merdiveni (zemin L*): çok açık ~97 · açık ~76 · orta ~27 · koyu ~11 · AMOLED 0.
// Açık→orta arasındaki fark en büyüğüdür: yazı rengi orada siyahtan beyaza döner,
// orta ton da vurgu + beyaz düğme yazısı okunur kalsın diye L* ~30'u geçemez.
const RAW_THEMES = {
  /* ── Gümüş (Varsayılan ailenin "açık" tonu) ──────────────────────
     Çok açık ile orta arasındaki basamak: açık gri zemin, bir tık açık kartlar.  */
  silver: {
    primary: "#B7BCC4",
    secondary: "#C2C8D1",
    secondaryt: alpha("#C2C8D1", 0.5),
    between: "#A8AEB8",
    border: "#9299A5",
    tab: "#C2C8D1",
    ai: alpha("#C2C8D1", 0.4),
    text: {
      primary: "#1E2024",
      secondary: "#353941",
      between: "#454B54",
      muted: "#555C68",
    },
    accent: "#0B5CE0",
    bold: "#084AB4",
    shadow: alpha("#0F172A", 0.16),
    colors: LIGHT_THEME_COLORS,
    notesColor: LIGHT_THEME_NOTES_COLORS,
  },

  /* ── Alacakaranlık (Varsayılan ailenin "orta" tonu) ──────────────
     Açık ile koyu arasındaki basamak: orta-koyu arduvaz gri; yazı açık.  */
  dusk: {
    primary: "#3B3F48",
    secondary: "#474C57",
    secondaryt: alpha("#474C57", 0.5),
    between: "#434751",
    border: "#60646C",
    tab: "#40454F",
    ai: alpha("#40454F", 0.4),
    text: {
      primary: "#FCFCFD",
      secondary: "#DBDDE1",
      between: "#BEC2CA",
      muted: "#A1A6AF",
    },
    accent: "#5593F7",
    bold: "#2474F5",
    shadow: alpha(PALETTE.black, 0.45),
    colors: DARK_THEME_COLORS,
    notesColor: DARK_THEME_NOTES_COLORS,
  },

  /* ── Koyu Gri (Varsayılan ailenin "koyu" tonu; kayıtlı ad "gray") ── */
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

  /* ── Siyah (Varsayılan ailenin AMOLED tonu) ──────────────────── */
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

  /* ── Açık (Varsayılan ailenin "çok açık" tonu; kayıtlı ad "light") ── */
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
      // #94A3B8 zemine karşı 2.34:1'di (soluk metin okunmuyordu); 3.3:1'e çekildi.
      muted: "#7B889D",
    },
    accent: "#2563EB",
    bold: "#1D4ED8",
    shadow: alpha("#0F172A", 0.08),
    colors: LIGHT_THEME_COLORS,
    notesColor: LIGHT_THEME_NOTES_COLORS,
  },
  /* ── Açık Mavi (mavi ailesinin "açık" tonu) ──────────────────────
     Çok açık ile orta arasında: buz mavisi zemin, bir tık açık kartlar, safir vurgu.  */
  sky: {
    primary: "#AABCDF",
    secondary: "#BBCAE8",
    secondaryt: alpha("#BBCAE8", 0.5),
    between: "#97ADD8",
    border: "#7A95CD",
    tab: "#BBCAE8",
    ai: alpha("#BBCAE8", 0.4),
    text: {
      primary: "#0F1D33",
      secondary: "#24344E",
      between: "#374863",
      muted: "#4E5D78",
    },
    accent: "#0557E6",
    bold: "#0446B9",
    shadow: alpha("#032B44", 0.18),
    colors: SKY_THEME_COLORS,
    notesColor: SKY_THEME_NOTES_COLORS,
  },

  /* ── Lacivert (mavi ailesinin "koyu" tonu; uygulama varsayılanı) ── */
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
  /* ── Açık Yeşil (yeşil ailesinin "açık" tonu) ────────────────────
     Çok açık ile orta arasında: adaçayı zemin, bir tık açık kartlar, çam vurgu.  */
  green: {
    primary: "#9CC2B9",
    secondary: "#AACDC5",
    secondaryt: alpha("#AACDC5", 0.5),
    between: "#8BB6AC",
    border: "#71A498",
    tab: "#AACDC5",
    ai: alpha("#AACDC5", 0.4),
    text: {
      primary: "#122E2B",
      secondary: "#24443F",
      between: "#34524D",
      muted: "#475F5B",
    },
    accent: "#156A5C",
    bold: "#0D443B",
    shadow: alpha("#0B221F", 0.22),
    colors: GREEN_THEME_COLORS,
    notesColor: GREEN_THEME_NOTES_COLORS,
  },

  /* ── Gece Laciverti (mavi ailesinin AMOLED tonu; kayıtlı ad "blueDeep")
     Lacivert temanın bir kademe derini: neredeyse siyah gece mavisi. */
  blueDeep: {
    primary: PALETTE.black,
    secondary: "#0B1425",
    secondaryt: alpha("#0B1425", 0.5),
    between: "#08101E",
    border: "#1B2D4D",
    tab: "#0A1424",
    ai: alpha("#0A1424", 0.4),
    text: {
      primary: "#EFF5FA",
      secondary: "#9DBBDA",
      between: "#7C95B6",
      muted: "#6580A2",
    },
    accent: "#4C8DFF",
    bold: "#2D6BDF",
    shadow: alpha(PALETTE.black, 0.65),
    colors: BLUE_THEME_COLORS,
    notesColor: BLUE_THEME_NOTES_COLORS,
  },

  /* ── Buz Mavisi (mavi ailesinin "çok açık" tonu) ─────────────────── */
  blueBright: {
    primary: "#F3F8FC",
    secondary: "#FFFFFF",
    secondaryt: alpha("#FFFFFF", 0.5),
    between: "#E8F1F9",
    border: "#CFE0EF",
    tab: "#FFFFFF",
    ai: alpha("#FFFFFF", 0.4),
    text: {
      primary: "#0A2540",
      secondary: "#1F4266",
      between: "#3E6487",
      muted: "#5A7A99",
    },
    accent: "#1366C9",
    bold: "#0D4F9E",
    shadow: alpha("#0A2540", 0.08),
    colors: SKY_THEME_COLORS,
    notesColor: SKY_THEME_NOTES_COLORS,
  },
  /* ── Alacakaranlık Mavi (mavi ailesinin "orta" tonu) ─────────────
     Açık ile lacivert arasında: gece mavisi zemin; yazı açık.  */
  blueDusk: {
    primary: "#293F6B",
    secondary: "#304A7E",
    secondaryt: alpha("#304A7E", 0.5),
    between: "#2D4576",
    border: "#415F9B",
    tab: "#2B4373",
    ai: alpha("#2B4373", 0.4),
    text: {
      primary: "#F9FAFA",
      secondary: "#D8DADF",
      between: "#BCC0C8",
      muted: "#A1A6AF",
    },
    accent: "#5291FF",
    bold: "#1F71FF",
    shadow: alpha(PALETTE.black, 0.45),
    colors: BLUE_THEME_COLORS,
    notesColor: BLUE_THEME_NOTES_COLORS,
  },

  /* ── Nane (yeşil ailesinin "çok açık" tonu) ─────────────────────── */
  greenBright: {
    primary: "#F2F8F6",
    secondary: "#FFFFFF",
    secondaryt: alpha("#FFFFFF", 0.5),
    between: "#E6F1ED",
    border: "#CBE0D8",
    tab: "#FFFFFF",
    ai: alpha("#FFFFFF", 0.4),
    text: {
      primary: "#0E2A26",
      secondary: "#24504A",
      between: "#3D6862",
      muted: "#557872",
    },
    accent: "#0B6F63",
    bold: "#095A50",
    shadow: alpha("#0B221F", 0.08),
    colors: GREEN_THEME_COLORS,
    notesColor: GREEN_THEME_NOTES_COLORS,
  },
  /* ── Alacakaranlık Yeşil (yeşil ailesinin "orta" tonu) ───────────
     Açık ile koyu yeşil arasında: orman yeşili zemin; yazı açık.  */
  greenDusk: {
    primary: "#25463F",
    secondary: "#2D534B",
    secondaryt: alpha("#2D534B", 0.5),
    between: "#2A5048",
    border: "#417167",
    tab: "#284D45",
    ai: alpha("#284D45", 0.4),
    text: {
      primary: "#FFFFFF",
      secondary: "#E0E6E5",
      between: "#BECAC8",
      muted: "#A1AFAC",
    },
    accent: "#21A690",
    bold: "#187B6B",
    shadow: alpha(PALETTE.black, 0.45),
    colors: DARK_THEME_COLORS,
    notesColor: DARK_THEME_NOTES_COLORS,
  },

  /* ── Koyu Yeşil (yeşil ailesinin "koyu" tonu; kayıtlı ad "greenMid")
     Gri temanın yeşil karşılığı: koyu ama siyah olmayan çam yeşili yüzey. */
  greenMid: {
    primary: "#13211F",
    secondary: "#1C2F2C",
    secondaryt: alpha("#1C2F2C", 0.5),
    between: "#172725",
    border: "#2D4A45",
    tab: "#1B2D2A",
    ai: alpha("#1B2D2A", 0.4),
    text: {
      primary: "#EBF6F3",
      secondary: "#BFD8D2",
      between: "#92B3AC",
      muted: "#729790",
    },
    accent: "#1F9E88",
    bold: "#177A69",
    shadow: alpha(PALETTE.black, 0.6),
    colors: DARK_THEME_COLORS,
    notesColor: DARK_THEME_NOTES_COLORS,
  },

  /* ── Gece Yeşili (yeşil ailesinin AMOLED tonu; kayıtlı ad "greenDeep") */
  greenDeep: {
    primary: PALETTE.black,
    secondary: "#0B1614",
    secondaryt: alpha("#0B1614", 0.5),
    between: "#08110F",
    border: "#17302C",
    tab: "#0A1513",
    ai: alpha("#0A1513", 0.4),
    text: {
      primary: "#E9F5F2",
      secondary: "#B5D1CB",
      between: "#88AAA3",
      muted: "#69908A",
    },
    accent: "#1F9E88",
    bold: "#177A69",
    shadow: alpha(PALETTE.black, 0.65),
    colors: DARK_THEME_COLORS,
    notesColor: DARK_THEME_NOTES_COLORS,
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

/**
 * Uygulamanın kullandığı yerleşik temalar: her biri v2 token şemasına
 * genişletilmiş (surface/textScale/accentScale/borders/state/status/elevation…).
 * Nesneler modül yüklenirken BİR KEZ üretilir; kimlikleri sabittir.
 */
export const themes = Object.freeze(
  Object.fromEntries(Object.entries(RAW_THEMES).map(([key, raw]) => [key, expandTheme(raw)])),
);

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

// ─── Tema aileleri (çok açık · açık · orta · koyu · AMOLED) ───────────────────

/**
 * Ayarlar > Tema ekranındaki ana seçenekler. Her aile TEK renk karakterinin beş
 * tonudur (bkz. theme/toneModel.js); kullanıcı aileyi seçer, altındaki ton
 * düğmeleriyle tonu belirler. `tones` değerleri `themes` anahtarlarıdır.
 * Eski kayıtlı seçimler (light, gray, dark, sky, blue, blueDeep, green, greenMid,
 * greenDeep) değişmeden çalışır: Varsayılan ailede saf siyah "dark" teması artık
 * AMOLED tonudur; yeni "koyu" ton grafittir.
 */
export const THEME_FAMILIES = Object.freeze([
  {
    id: "default",
    icon: "contrast",
    labelKey: "themeFamilyDefault",
    fallback: "Varsayılan",
    tones: Object.freeze({ bright: "light", light: "silver", mid: "dusk", dark: "gray", amoled: "dark" }),
  },
  {
    id: "blue",
    icon: "water",
    labelKey: "themeFamilyBlue",
    fallback: "Mavi",
    tones: Object.freeze({ bright: "blueBright", light: "sky", mid: "blueDusk", dark: "blue", amoled: "blueDeep" }),
  },
  {
    id: "green",
    icon: "leaf",
    labelKey: "themeFamilyGreen",
    fallback: "Yeşil",
    tones: Object.freeze({ bright: "greenBright", light: "green", mid: "greenDusk", dark: "greenMid", amoled: "greenDeep" }),
  },
]);

/** Ailelerde yer alan (Free dahil herkesin seçebildiği) hazır tema anahtarları. */
export const FAMILY_THEME_KEYS = Object.freeze(
  THEME_FAMILIES.flatMap((family) => Object.values(family.tones)),
);

/**
 * Ayar ekranında artık listelenmeyen eski hazır temalar (Gece Moru, Kızıl Sinema).
 * Tema Stüdyosu'nda "Hazır temalar" altına taşındılar; bunları daha önce seçmiş
 * kullanıcıların seçimi bozulmasın diye `themes` içinde duruyorlar.
 */
export const LEGACY_PRESET_THEME_KEYS = Object.freeze(["purple", "amber"]);

/** Hazır tema anahtarından { family, tone } (ailesi yoksa null). */
export function familyOfTheme(themeKey) {
  for (const family of THEME_FAMILIES) {
    for (const tone of TONES) {
      if (family.tones[tone] === themeKey) return { family, tone };
    }
  }
  return null;
}

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

// ─── Özel tema: beş ton ───────────────────────────────────────────────────────

/**
 * Seçili tema anahtarı: "custom:<id>" (varsayılan ton = "koyu"; eski kayıtların
 * "orta"sı ile aynı basamak) veya "custom:<id>:bright|light|mid|dark|amoled".
 * Özel tema değilse null.
 * @returns {{id: string|null, tone: "bright"|"light"|"mid"|"dark"|"amoled"}|null}
 */
export function parseCustomSelection(selection) {
  if (typeof selection !== "string" || !selection.startsWith("custom")) return null;
  const parts = selection.split(":");
  const id = parts[1] || null;
  const tone = isTone(parts[2]) ? parts[2] : DEFAULT_TONE;
  return { id, tone };
}

/** Özel tema + ton → seçim anahtarı (varsayılan ton eksiz yazılır). */
export const customSelectionKey = (id, tone = DEFAULT_TONE) =>
  tone && tone !== DEFAULT_TONE && isTone(tone) ? `custom:${id}:${tone}` : `custom:${id}`;

// ─── Ton merdiveni göçü (12 Kas) ──────────────────────────────────────────────
//
// Özel tema kayıtlarının hangi merdivenle yazıldığı. 2 = eşit basamaklı merdiven
// (çok açık ~97 · açık ~76 · orta ~27 · koyu ~11 · AMOLED 0). Bayrak taşımayan
// kayıt ESKİ merdivendendir (19 Eki üç ton: açık ~94 · orta ~13 · koyu ~4).
export const TONE_LADDER = 2;

// Eski merdivendeki ton adının yeni basamağı. Eski "açık" beyaza yakındı (→ çok
// açık), eski "orta" gri/lacivert yoğunluğundaydı (→ koyu), eski "koyu" siyaha
// yakındı (→ AMOLED). Yeni "açık" ve "orta" basamakları eski kayıtta yoktur.
export const LEGACY_TONE_TO_LADDER = Object.freeze({
  bright: "bright",
  light: "bright",
  mid: "dark",
  dark: "amoled",
  amoled: "amoled",
});

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/** Kayıt eski merdivenden mi (göç gerekir mi)? */
export const isLegacyCustomEntry = (entry) => isPlainObject(entry) && entry.ladder !== TONE_LADDER;

const ladderCache = new WeakMap();

/**
 * Eski merdivenli kaydı yenisine çevirir (saf; aynı girdi için aynı nesne).
 * Görünen tema DEĞİŞMEZ: eski "orta" = yeni "koyu" = `tokens`. Eski "açık" çok
 * açık basamağına geçer; eski "koyu" (L~4) atılır — AMOLED saf siyah olarak
 * türetilir. Yeni "açık"/"orta" basamakları kayıtta yoksa türetilir.
 */
export function migrateCustomEntry(entry) {
  if (!isLegacyCustomEntry(entry)) return entry;
  const cached = ladderCache.get(entry);
  if (cached) return cached;
  const old = isPlainObject(entry.tones) ? entry.tones : {};
  const main = isPlainObject(old.mid) ? old.mid : entry.tokens;
  const tones = {};
  const bright = isPlainObject(old.bright) ? old.bright : old.light;
  if (isPlainObject(bright)) tones.bright = bright;
  if (isPlainObject(main)) tones[DEFAULT_TONE] = main;
  if (isPlainObject(old.amoled)) tones.amoled = old.amoled;
  const out = { ...entry, ladder: TONE_LADDER, tokens: isPlainObject(main) ? main : {} };
  if (Object.keys(tones).length) out.tones = tones;
  else delete out.tones;
  ladderCache.set(entry, out);
  return out;
}

/**
 * Eski merdivenli bir kayda bakan seçim anahtarını yeni basamağa çevirir
 * (ör. "custom:x:dark" → "custom:x:amoled"). Kayıt yeniyse ya da seçim o kayda
 * ait değilse olduğu gibi döner.
 */
export function migrateCustomSelection(selection, entry) {
  const parsed = parseCustomSelection(selection);
  if (!parsed?.id || !isLegacyCustomEntry(entry) || entry.id !== parsed.id) return selection;
  const raw = selection.split(":")[2];
  const oldTone = isTone(raw) ? raw : "mid"; // eksiz anahtar eskiden "orta" idi
  return customSelectionKey(parsed.id, LEGACY_TONE_TO_LADDER[oldTone]);
}

/**
 * Kayıtlı seçim + özel tema listesi → yeni merdiven. `changed` true ise ikisi
 * de depoya geri yazılmalı. Açılışta, yedek dönüşünde ve paylaşımda kullanılır.
 */
export function migrateThemeLadder(selectedTheme, customThemes) {
  const list = Array.isArray(customThemes) ? customThemes : [];
  if (!list.some(isLegacyCustomEntry)) return { selectedTheme, customThemes, changed: false };
  const parsed = parseCustomSelection(selectedTheme);
  const owner = parsed?.id ? list.find((entry) => entry?.id === parsed.id) : null;
  return {
    selectedTheme: owner ? migrateCustomSelection(selectedTheme, owner) : selectedTheme,
    customThemes: list.map(migrateCustomEntry),
    changed: true,
  };
}

const toneCache = new WeakMap();

/**
 * Kayıtlı bir özel temanın bir tonu için token seti. Ton kayıtlıysa olduğu gibi;
 * kayıtta yoksa varsayılan tondan ("koyu" = `tokens`) türetilir. Eski merdivenli
 * kayıt önce `migrateCustomEntry` ile çevrilir (varsayılan ton DEĞİŞMEZ).
 */
export function customToneTokens(rawEntry, tone = DEFAULT_TONE) {
  const entry = migrateCustomEntry(rawEntry);
  const t = isTone(tone) ? tone : DEFAULT_TONE;
  const stored = entry?.tones?.[t];
  if (isPlainObject(stored)) return stored;
  if (t === DEFAULT_TONE || !entry) return entry?.tokens || {};
  let perEntry = toneCache.get(entry);
  if (!perEntry) {
    perEntry = {};
    toneCache.set(entry, perEntry);
  }
  if (!perEntry[t]) {
    const main = entry?.tones?.[DEFAULT_TONE] || entry.tokens;
    perEntry[t] = deriveToneTokens(resolveThemeTokens(main), t, DEFAULT_TONE);
  }
  return perEntry[t];
}

/** Kayıtlı özel tema girdisi + ton → tam tema nesnesi. */
export const buildCustomThemeFromEntry = (entry, tone = DEFAULT_TONE) =>
  buildCustomTheme(customToneTokens(entry, tone));

/**
 * Düz token setinden tam tema nesnesi üretir. Bağıl token'lar önce çözülür;
 * türetilen yüzey/şeffaflık değerleri ve paylaşılan renk setleri otomatik
 * eklenir; böylece özel tema uygulamanın geri kalanı için yerleşik temalarla
 * bire bir aynı şekle sahiptir.
 */
export function buildCustomTheme(tokens) {
  const t = resolveThemeTokens(tokens);
  const semantic = getSemanticColorsForTheme("custom", t.primary);
  return expandTheme({
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
  });
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
