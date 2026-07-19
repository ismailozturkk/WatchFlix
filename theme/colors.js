/* ─────────────────────────────────────────────────────────────────────────────

 * Watchify — Merkezi Renk & Tema Sistemi

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

  blueDark: "#0551A3", // dark tema accent

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

const SHARED_NOTES_COLORS = {
  green: PALETTE.noteGreen,

  greenBackground: alpha(PALETTE.noteGreen, 0.25),

  red: PALETTE.noteRed,

  redBackground: alpha(PALETTE.noteRed, 0.25),

  blue: PALETTE.noteBlue,

  blueBackground: alpha(PALETTE.noteBlue, 0.25),

  orange: PALETTE.noteOrange,

  orangeBackground: alpha(PALETTE.noteOrange, 0.25),

  yellow: PALETTE.noteYellow,

  yellowBackground: alpha(PALETTE.noteYellow, 0.2),

  purple: PALETTE.notePurple,

  purpleBackground: alpha(PALETTE.notePurple, 0.25),

  pink: PALETTE.notePink,

  pinkBackground: alpha(PALETTE.notePink, 0.25),

  aqua: PALETTE.noteAqua,

  aquaBackground: alpha(PALETTE.noteAqua, 0.2),

  teal: PALETTE.noteTeal,

  tealBackground: alpha(PALETTE.noteTeal, 0.25),
};

// ─── Semantic renk seti (tüm temalar paylaşır) ────────────────────────────────

const SHARED_COLORS = {
  green: PALETTE.green,

  red: PALETTE.red,

  blue: PALETTE.blue,

  orange: PALETTE.orange,

  purple: PALETTE.purple,

  yellow: PALETTE.yellow,
};

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
}) {
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
    ), // aşağıda override

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

    // ── Paylaşılan renk setleri ─────────────────────────────────────────────

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  };
}

// ─── Temalar ──────────────────────────────────────────────────────────────────

export const themes = {
  /* ── Koyu Gri ─────────────────────────────────────────────────── */

  gray: {
    primary: PALETTE.gray900,

    secondary: PALETTE.gray800,

    secondaryt: alpha(PALETTE.gray800, 0.5),

    between: PALETTE.gray850,

    border: alpha(PALETTE.gray700, 0.8),

    tab: alpha(PALETTE.gray800, 0.95),

    ai: alpha(PALETTE.gray800, 0.4),

    text: {
      primary: PALETTE.white,

      secondary: "#DDDDDD",

      between: "#BBBBBB",

      muted: PALETTE.gray600,
    },

    accent: PALETTE.blueAlt,

    bold: PALETTE.blueMid,

    shadow: alpha(PALETTE.black, 0.7),

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Siyah (AMOLED) ──────────────────────────────────────────── */

  dark: {
    primary: PALETTE.black,

    secondary: "#141414",

    secondaryt: alpha("#141414", 0.5),

    between: "#1F1F1F",

    border: "#232323",

    tab: "#141414",

    ai: alpha("#141414", 0.4),

    text: {
      primary: PALETTE.white,

      secondary: "#D3D3D3",

      between: "#B1B1B1",

      muted: PALETTE.gray600,
    },

    accent: PALETTE.blueDark,

    bold: "#2275B9",

    shadow: alpha(PALETTE.gray500, 0.4),

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Açık (Light) ────────────────────────────────────────────── */

  light: {
    primary: PALETTE.gray100,

    secondary: PALETTE.gray200,

    secondaryt: alpha(PALETTE.gray200, 0.5),

    between: PALETTE.gray300,

    border: PALETTE.gray400,

    tab: "#C6C6C6",

    ai: alpha("#C6C6C6", 0.4),

    text: {
      primary: PALETTE.gray700,

      secondary: PALETTE.gray600,

      between: PALETTE.gray500,

      muted: "#818181",
    },

    accent: "#38A6F0",

    bold: PALETTE.blue,

    shadow: alpha(PALETTE.black, 0.7),

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Lacivert ─────────────────────────────────────────────────── */

  blue: {
    primary: PALETTE.navy500,

    secondary: PALETTE.navy400,

    secondaryt: alpha(PALETTE.navy400, 0.5),

    between: PALETTE.navy200,

    border: PALETTE.navy300,

    tab: "#25395B",

    ai: alpha("#25395B", 0.4),

    text: {
      primary: PALETTE.navy050,

      secondary: PALETTE.navy100,

      between: PALETTE.navy200,

      muted: PALETTE.navy100,
    },

    accent: PALETTE.navy300,

    bold: PALETTE.navy500,

    shadow: alpha(PALETTE.black, 0.7),

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Açık Yeşil (Teal) ───────────────────────────────────────── */

  green: {
    primary: PALETTE.teal050,

    secondary: PALETTE.teal100,

    secondaryt: alpha(PALETTE.teal500, 0.5),

    between: PALETTE.teal150,

    border: PALETTE.teal200,

    tab: PALETTE.teal300,

    ai: alpha(PALETTE.teal300, 0.4),

    text: {
      primary: PALETTE.teal600,

      secondary: PALETTE.teal500,

      between: PALETTE.teal400,

      muted: PALETTE.teal600,
    },

    accent: "#62BEB4",

    bold: PALETTE.teal700,

    shadow: alpha(PALETTE.black, 0.7),

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
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
    colors: SHARED_COLORS,
    notesColor: SHARED_NOTES_COLORS,
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
