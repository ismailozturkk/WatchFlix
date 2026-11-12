// theme/themeTokens.js
//
// TEMA TOKEN ŞEMASI v2 — her tema nesnesinin (yerleşik, özel, her ton) TEK
// genişletme noktası. Ham tema 11 temel renk + paylaşılan anlam setleri taşır
// (primary/secondary/between/tab/border, text.*, accent/bold, colors, notesColor);
// `expandTheme` bunlardan kademeli, okunabilirliği DOĞRULANMIŞ token aileleri türetir.
//
// Neden türetme: elle yazılan kademeler her yeni temada (özellikle kullanıcının
// ürettiği beş tonlu temalarda) tekrar yazılmak zorunda kalırdı ve tutarsızlaşırdı.
// Ekranlar `alpha(theme.accent, 0.12)`, `"#fff"`, `rgba(255,255,255,0.08)` gibi
// yerel hesaplar yerine buradaki anlamlı token'ları kullanmalı — böylece açık ve
// koyu tonların hepsinde doğru görünür.
//
// Geriye uyumluluk: ham anahtarların HİÇBİRİ değişmez (değer de, tür de).
// `theme.border` hâlâ string, `theme.text.primary` hâlâ aynı renk. Yeni kademeler
// yeni anahtarlardadır; `text` nesnesine yalnız YENİ alt anahtarlar eklenir.
//
// ŞEMA (tümü string renk, aksi belirtilmedikçe):
//   scheme "light"|"dark", isDark boolean, tokensVersion 2
//   surface   { sunken, canvas, subtle, card, raised, overlay, highest, inverse }
//   surfaceScale [sunken, canvas, subtle, card, raised, overlay, highest]   (7 kademe, alttan üste)
//   text      + { faint, disabled, placeholder, inverse, onAccent, link }
//   textScale [primary, secondary, between, muted, faint, disabled]          (6 kademe, güçlüden soluğa)
//   accentScale { 50 … 950 }  (11 kademe; 500 = theme.accent)
//   accentAlpha { 4, 8, 12, 16, 20, 24, 32, 40, 56, 72 }  (vurgunun % opaklık kademeleri)
//   accentSoft, accentSubtle (opak açık vurgu zeminleri), accentText (zeminde okunur vurgu),
//   accentHover, accentPressed, onAccent
//   borders   { hairline, subtle, default, strong, focus, accent, inverse }
//   state     { hover, pressed, focus, selected, dragged, disabledContainer, disabledOpacity:number }
//   scrim     { faint, soft, medium, strong, heavy }
//   status    { success, warning, danger, info } → { base, fg, soft, softSolid, border, on }
//   elevation [0..5] → RN gölge stili { shadowColor, shadowOpacity, shadowRadius, shadowOffset, elevation }
//   onMedia   { text, secondary, muted, faint, glass, glassStrong, border, scrimTop[], scrimBottom[] }
//   chart     [8 kategorik renk]
//   gradients { accent[], surface[], hero[] }
//
// Saf modül: yalnız renk yardımcılarını içe aktarır.

import { clamp, contrastRatio, hexToRgb, isLightSurface, readableOn, toHex } from "../utils/colorUtils";

export const TOKENS_VERSION = 2;

const WHITE = "#FFFFFF";
const BLACK = "#000000";
// Vurgu zemini beyaz yazıyı taşıyamadığında kullanılan koyu mürekkep.
const INK = "#0B0D12";

/* ───────────────────────── Renk yardımcıları ───────────────────────── */

/**
 * Herhangi bir css rengini ("#rgb", "#rrggbb", "#rrggbbaa", "rgb()", "rgba()")
 * verilen opaklıkla "rgba(r, g, b, a)" yapar. Geçersiz girdi saydam siyaha düşer.
 */
export function toRgba(color, a = 1) {
  const opacity = clamp(Number.isFinite(a) ? a : 1, 0, 1);
  if (typeof color !== "string") return `rgba(0, 0, 0, ${opacity})`;
  const raw = color.trim();
  const m = raw.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*[\d.]+)?\s*\)$/i);
  if (m) return `rgba(${Math.round(m[1])}, ${Math.round(m[2])}, ${Math.round(m[3])}, ${opacity})`;
  let hex = raw.replace(/^#/, "");
  if (/^[0-9a-f]{3,4}$/i.test(hex)) hex = hex.slice(0, 3).split("").map((c) => c + c).join("");
  else if (/^[0-9a-f]{8}$/i.test(hex)) hex = hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return `rgba(0, 0, 0, ${opacity})`;
  const { r, g, b } = hexToRgb(`#${hex}`);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** İki rengi sRGB'de karıştırır: t=0 → a, t=1 → b. Sonuç opak "#RRGGBB". */
export function mix(a, b, t) {
  const x = hexToRgb(toHex(a));
  const y = hexToRgb(toHex(b));
  const k = clamp(t, 0, 1);
  const ch = (p, q) => Math.round(p + (q - p) * k).toString(16).padStart(2, "0");
  return `#${ch(x.r, y.r)}${ch(x.g, y.g)}${ch(x.b, y.b)}`.toUpperCase();
}

/** Bir zemin üzerinde okunur mürekkep: beyaz yetiyorsa beyaz (uygulama kuralı), yoksa koyu. */
export function inkOn(bg, minWhite = 3) {
  return contrastRatio(WHITE, bg) >= minWhite ? WHITE : INK;
}

/* ───────────────────────── Kademe üreticileri ───────────────────────── */

export const ACCENT_SCALE_STEPS = Object.freeze([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
// 500'ün altındakiler beyaza, üstündekiler siyaha doğru karışım payı.
const SCALE_MIX = { 50: 0.92, 100: 0.84, 200: 0.68, 300: 0.5, 400: 0.26, 500: 0, 600: 0.16, 700: 0.32, 800: 0.48, 900: 0.62, 950: 0.74 };

/** Tek bir renkten 11 kademeli skala (500 = rengin kendisi). */
export function colorScale(color) {
  const base = toHex(color);
  const out = {};
  for (const step of ACCENT_SCALE_STEPS) {
    const t = SCALE_MIX[step];
    out[step] = step < 500 ? mix(base, WHITE, t) : step > 500 ? mix(base, BLACK, t) : base;
  }
  return out;
}

export const ACCENT_ALPHA_STEPS = Object.freeze([4, 8, 12, 16, 20, 24, 32, 40, 56, 72]);

/** Bir rengin % opaklık kademeleri ({ 12: "rgba(…, 0.12)" }). */
export function alphaScale(color) {
  const out = {};
  for (const step of ACCENT_ALPHA_STEPS) out[step] = toRgba(color, step / 100);
  return out;
}

// Gölge kademeleri (0 = düz). Koyu temada gölge zor seçildiği için opaklık artar.
const ELEVATION = [
  { opacity: 0, radius: 0, y: 0, android: 0 },
  { opacity: 0.08, radius: 2, y: 1, android: 1 },
  { opacity: 0.12, radius: 6, y: 3, android: 3 },
  { opacity: 0.16, radius: 12, y: 6, android: 6 },
  { opacity: 0.2, radius: 20, y: 10, android: 10 },
  { opacity: 0.26, radius: 32, y: 16, android: 16 },
];

function buildElevation(shadowColor, isDark) {
  const boost = isDark ? 2.2 : 1;
  return ELEVATION.map((lvl) =>
    Object.freeze({
      shadowColor,
      shadowOpacity: clamp(lvl.opacity * boost, 0, 0.6),
      shadowRadius: lvl.radius,
      shadowOffset: Object.freeze({ width: 0, height: lvl.y }),
      elevation: lvl.android,
    }),
  );
}

function buildStatus(color, { canvas, card, isDark }) {
  const base = toHex(color);
  return Object.freeze({
    base,
    // Zemin ve kart üstünde METİN olarak okunur hali (AA 4.5).
    fg: readableOn(readableOn(base, canvas, { target: 4.5 }), card, { target: 4.5 }),
    soft: toRgba(base, isDark ? 0.18 : 0.12),
    softSolid: mix(card, base, isDark ? 0.2 : 0.12),
    border: toRgba(base, isDark ? 0.5 : 0.4),
    on: inkOn(base),
  });
}

// Fotoğraf/afiş üstü (tema DIŞI, her zaman koyu görüntü üstü) metin ve cam.
const ON_MEDIA = Object.freeze({
  text: WHITE,
  secondary: "rgba(255, 255, 255, 0.86)",
  muted: "rgba(255, 255, 255, 0.7)",
  faint: "rgba(255, 255, 255, 0.5)",
  glass: "rgba(255, 255, 255, 0.14)",
  glassStrong: "rgba(255, 255, 255, 0.22)",
  border: "rgba(255, 255, 255, 0.18)",
  scrimTop: Object.freeze(["rgba(0, 0, 0, 0.55)", "rgba(0, 0, 0, 0)"]),
  scrimBottom: Object.freeze(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.78)"]),
});

/* ───────────────────────── Genişletme ───────────────────────── */

const expandedCache = new WeakMap();

/** Nesne zaten v2 şemasında mı? */
export const isExpandedTheme = (theme) => Boolean(theme && theme.tokensVersion === TOKENS_VERSION);

/**
 * Ham tema → v2 tema. Ham anahtarlar aynen korunur, yeni kademeler eklenir.
 * Aynı ham nesne için sonuç önbelleklenir (kimlik sabit kalır → memo'lar bozulmaz).
 * Zaten genişletilmiş bir nesne olduğu gibi döner.
 */
export function expandTheme(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if (isExpandedTheme(raw)) return raw;
  const cached = expandedCache.get(raw);
  if (cached) return cached;

  const canvas = toHex(raw.primary);
  const card = toHex(raw.secondary);
  const subtle = toHex(raw.between || raw.primary);
  const isDark = !isLightSurface(canvas);
  const text = raw.text || {};
  const textPrimary = toHex(text.primary || (isDark ? WHITE : BLACK));
  const textMuted = toHex(text.muted || text.between || textPrimary);
  const accent = toHex(raw.accent);
  const bold = toHex(raw.bold || raw.accent);
  const colors = raw.colors || {};

  // ── Yüzeyler: koyu temada yükseldikçe açılır, açık temada beyaza yaklaşır ──
  const surface = isDark
    ? {
        sunken: mix(canvas, BLACK, 0.35),
        canvas,
        subtle,
        card,
        raised: mix(card, textPrimary, 0.05),
        overlay: mix(card, textPrimary, 0.09),
        highest: mix(card, textPrimary, 0.14),
        inverse: textPrimary,
      }
    : {
        sunken: mix(canvas, textPrimary, 0.05),
        canvas,
        subtle,
        card,
        raised: mix(card, WHITE, 0.5),
        overlay: mix(card, WHITE, 0.8),
        highest: WHITE,
        inverse: textPrimary,
      };

  const onAccent = inkOn(accent);
  const accentText = readableOn(readableOn(accent, canvas, { target: 4.5 }), card, { target: 4.5 });

  const fullText = {
    ...text,
    faint: mix(textMuted, canvas, 0.28),
    disabled: mix(textMuted, canvas, 0.45),
    placeholder: textMuted,
    inverse: canvas,
    onAccent,
    link: accentText,
  };

  const statusCtx = { canvas, card, isDark };
  const expanded = {
    ...raw,
    tokensVersion: TOKENS_VERSION,
    scheme: isDark ? "dark" : "light",
    isDark,
    text: Object.freeze(fullText),
    surface: Object.freeze(surface),
    surfaceScale: Object.freeze([
      surface.sunken,
      surface.canvas,
      surface.subtle,
      surface.card,
      surface.raised,
      surface.overlay,
      surface.highest,
    ]),
    textScale: Object.freeze([
      toHex(text.primary || textPrimary),
      toHex(text.secondary || textPrimary),
      toHex(text.between || textMuted),
      textMuted,
      fullText.faint,
      fullText.disabled,
    ]),
    accentScale: Object.freeze(colorScale(accent)),
    accentAlpha: Object.freeze(alphaScale(accent)),
    accentSoft: mix(card, accent, isDark ? 0.18 : 0.1),
    accentSubtle: mix(canvas, accent, isDark ? 0.1 : 0.06),
    accentText,
    accentHover: mix(accent, isDark ? WHITE : BLACK, 0.08),
    accentPressed: bold,
    onAccent,
    borders: Object.freeze({
      hairline: toRgba(textPrimary, 0.06),
      subtle: toRgba(textPrimary, 0.1),
      default: raw.border,
      strong: mix(toHex(raw.border), textPrimary, 0.28),
      focus: accent,
      accent: toRgba(accent, 0.5),
      inverse: toRgba(canvas, 0.24),
    }),
    state: Object.freeze({
      hover: toRgba(textPrimary, 0.04),
      pressed: toRgba(textPrimary, 0.1),
      focus: toRgba(textPrimary, 0.12),
      selected: toRgba(accent, isDark ? 0.18 : 0.12),
      dragged: toRgba(textPrimary, 0.16),
      disabledContainer: toRgba(textPrimary, 0.08),
      disabledOpacity: 0.38,
    }),
    scrim: Object.freeze({
      faint: toRgba(BLACK, 0.2),
      soft: toRgba(BLACK, 0.35),
      medium: toRgba(BLACK, 0.5),
      strong: toRgba(BLACK, 0.65),
      heavy: toRgba(BLACK, 0.8),
    }),
    status: Object.freeze({
      success: buildStatus(colors.green || "#22C55E", statusCtx),
      warning: buildStatus(colors.orange || "#F97316", statusCtx),
      danger: buildStatus(colors.red || "#EF4444", statusCtx),
      info: buildStatus(colors.blue || "#3B82F6", statusCtx),
    }),
    elevation: Object.freeze(buildElevation(toHex(raw.shadow || BLACK), isDark)),
    onMedia: ON_MEDIA,
    chart: Object.freeze(
      [accent, colors.green, colors.orange, colors.purple, raw.notesColor?.pink, raw.notesColor?.teal, colors.yellow, colors.red]
        .filter(Boolean)
        .map((c) => toHex(c)),
    ),
    gradients: Object.freeze({
      accent: Object.freeze([accent, bold]),
      surface: Object.freeze([card, canvas]),
      hero: Object.freeze([mix(canvas, accent, isDark ? 0.28 : 0.16), canvas]),
    }),
  };
  expandedCache.set(raw, expanded);
  return expanded;
}
