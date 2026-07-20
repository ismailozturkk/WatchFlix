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

  // Varsayılan tema — kimliği (nötr koyu gri + mavi accent) korunarak inceltildi:
  // yüzeylere çok hafif soğuk alt ton, soluk metne daha okunur kademe
  // (#666 ≈ 4.0:1 → #7C838F ≈ 4.9:1), accent dark temayla aynı modern maviye.
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

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Siyah (AMOLED) ──────────────────────────────────────────────
     Zemin saf siyah (OLED kimliği); yüzeyler hafif mavi alt tonlu koyu
     griler (Material dark rehberi: saf siyah kart yerine yükseltilmiş
     yüzey). Eski accent (#0551A3) siyah üstünde ~2.4:1 ile ölüydü —
     yeni accent #3B82F6 siyahta ~6.2:1 kontrast verir. */

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

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Açık (Light) ────────────────────────────────────────────────
     Eski palet baştan sona orta-gri (zemin #E8E8E8, kart #D6D6D6) olduğu
     için yıkanmış görünüyordu. Modern açık tema deseni: hafif soğuk kırık
     beyaz zemin + BEYAZ kartlar + ince ayrım çizgileri. Metin koyu lacivert-
     grafit ölçeği; accent beyaz üstünde ~5.2:1 kontrastlı (#2563EB) —
     eski #38A6F0 (~2.5:1) buton üzerindeki beyaz yazıyı okunmaz kılıyordu.
     Gölge %70 siyah yerine yumuşak, mavi alt tonlu %16. */

  light: {
    // Saf beyaz kart + çok açık zemin fazla parlak geldi — tüm yüzeyler bir
    // kademe koyulaştırıldı (slate alt tonlu): kart kırık beyaz, zemin gri.
    primary: "#EDF0F5",

    secondary: "#F7F9FC",

    secondaryt: alpha("#F7F9FC", 0.5),

    between: "#E2E7EE",

    border: "#D3DAE3",

    tab: "#F7F9FC",

    ai: alpha("#F7F9FC", 0.4),

    text: {
      primary: "#1A202C",

      secondary: "#3E4756",

      between: "#667081",

      muted: "#7C8594",
    },

    accent: "#2563EB",

    bold: "#1D4ED8",

    shadow: alpha("#0F172A", 0.16),

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Lacivert ─────────────────────────────────────────────────────
     Eski accent (#2B4C84) lacivert zeminde ~1.8:1 ile görünmezdi ve bold
     zeminle AYNI renkti (fiilen bozuk). Yeni accent parlak azur (~6:1);
     between artık zemin-kart arasında (eskiden karttan açık bir orta mavi
     olduğu için chip'ler metin gibi parlıyordu); muted, secondary metinden
     ayrıştırıldı. */

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

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Açık Yeşil (Teal) ────────────────────────────────────────────
     Eski palette kartlar zeminden KOYUYDU (ters hiyerarşi → çamurlu his)
     ve accent (#62BEB4) açık zeminde ~2:1 ile kayboluyordu. Yeni düzen:
     ferah adaçayı zemin + açık nane kartlar + koyu teal accent (Tailwind
     teal-700, açık yüzeylerde ~4.8:1). Kimlik (yeşil/teal) korunur. */

  green: {
    // İlk düzenleme fazla açık kaçıp beyaz temaya benzedi — yeşil kimliği
    // hissedilir kılmak için tüm yüzeyler bir kademe koyulaştırıldı: doygun
    // adaçayı zemin + nane kartlar. Kart > zemin hiyerarşisi korunur; accent
    // koyu teal, orta tonlu zeminde de ~4.6:1 kontrast verir.
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

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Gece Moru ────────────────────────────────────────────────────
     Medya uygulamalarının klasiği: mor alt tonlu koyu yüzeyler + canlı
     violet accent. Uygulamanın mevcut mor kimliğiyle (sohbet accent'i
     #6C63FF, Wrapped gradyanı) akraba. Accent koyu zeminde ~5.3:1. */

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

    colors: SHARED_COLORS,

    notesColor: SHARED_NOTES_COLORS,
  },

  /* ── Kehribar (Sinema) ────────────────────────────────────────────
     Sıcak projektör ışığı hissi: kahve alt tonlu koyu yüzeyler + altın
     accent — film uygulaması kimliğine birebir. Amber accent koyu
     zeminde ~9:1 kontrast verir; metin ölçeği sıcak kırık beyazlar. */

  amber: {
    primary: "#1A1512",

    secondary: "#282017",

    secondaryt: alpha("#282017", 0.5),

    between: "#211A14",

    border: "#3E3226",

    tab: "#241D15",

    ai: alpha("#241D15", 0.4),

    text: {
      primary: "#F8F4EE",

      secondary: "#DCD2C4",

      between: "#B3A794",

      muted: "#847A69",
    },

    accent: "#F59E0B",

    bold: "#D97706",

    shadow: alpha(PALETTE.black, 0.6),

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
