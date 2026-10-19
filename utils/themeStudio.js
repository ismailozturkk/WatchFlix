// utils/themeStudio.js
//
// Özel tema oluşturucunun SAF motoru (React/Native bağımlılığı yok):
//  • iki tohum renkten (zemin + vurgu) 11 token'lık uyumlu palet türetme,
//  • zeminden uyumlu vurgu önerileri (tamamlayıcı, komşu, üçlü…),
//  • "ruh hali"ne göre rastgele tema ADAYLARI üretme (kilitli zemin/vurgu destekli),
//  • okunabilirlik analizi ve otomatik düzeltme,
//  • isim önerisi.
//
// Rastgelelik dışarıdan verilebilir (`rng`): testler tohumlu üretici kullanır,
// uygulama `randomInt` tabanlı varsayılanı (bkz. utils/randomPick.js).

import {
  clamp,
  contrastRatio,
  hexToHsl,
  hslToHex,
  isLightSurface,
  readableOn,
  shiftLightness,
  toHex,
} from "./colorUtils";
import { randomInt } from "./randomPick";

/* ───────────────────────── Rastgelelik ───────────────────────── */

// randomInt(65536) → bayt tabanlı reddetmeli örnekleme; n > 65536 olursa
// randomPick sessizce Math.random'a düşer, bu yüzden sınır 65536 tutuldu.
export const defaultRng = () => randomInt(65536) / 65536;

const between = (rng, [lo, hi]) => lo + (hi - lo) * rng();
const pick = (rng, list) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
const wrapHue = (h) => ((h % 360) + 360) % 360;
const hueDistance = (a, b) => {
  const d = Math.abs(wrapHue(a) - wrapHue(b));
  return Math.min(d, 360 - d);
};

function shuffled(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ───────────────────────── Hazır renkler ───────────────────────── */

// Tek dokunuşla vurgu (accent + bold güncellenir).
export const ACCENT_PRESETS = [
  "#3B82F6", "#6C63FF", "#8B5CF6", "#EC4899", "#EF4444",
  "#F97316", "#F59E0B", "#22C55E", "#14B8A6", "#06B6D4",
];

// Tek dokunuşla zemin (tüm palet bu zeminden yeniden türetilir).
export const BACKGROUND_PRESETS = [
  "#0B0D12", "#10151F", "#0D1A16", "#1A1018", "#1B1410", "#0C1A22",
  "#000000", "#F6F7FB", "#FAF6EE", "#EDF5F0", "#F4EEF9", "#E9EEF5",
];

// Tek dokunuşla ANA RENK (üç tonun hepsi bu ton + doygunluktan türetilir).
// Orta açıklıkta, doygun renkler: asıl zemin her tonda açıklığı yeniden kurulur.
export const BASE_PRESETS = [
  "#3B6FD4", "#5B5BD6", "#8B5CF6", "#C026D3", "#E11D48", "#EA580C",
  "#D97706", "#16A34A", "#0D9488", "#0891B2", "#64748B", "#52525B",
];

/* ───────────────────────── Palet türetme ───────────────────────── */

export const CONTRAST_LEVELS = ["soft", "balanced", "high"];
export const SURFACE_MODES = ["neutral", "tinted"];

// Metin kademelerinin zeminlere karşı ULAŞMASI gereken en düşük kontrast.
// Başlangıç açıklığı yeterliyse dokunulmaz; değilse zeminden uzağa itilir.
const TEXT_TARGETS = {
  soft: { primary: 6, secondary: 4.8, between: 3.8, muted: 3 },
  balanced: { primary: 8, secondary: 6, between: 4.6, muted: 3.4 },
  high: { primary: 12, secondary: 8.5, between: 6.5, muted: 4.6 },
};

// Yüzey kademeleri: zeminden kaç açıklık puanı ayrıldığı.
const SURFACE_STEPS = {
  soft: { secondary: 4, between: 2, tab: 1.5, border: 10 },
  balanced: { secondary: 6, between: 3, tab: 2, border: 14 },
  high: { secondary: 8, between: 4, tab: 3, border: 20 },
};

// [primary, secondary, between, muted] başlangıç açıklıkları.
const TEXT_START_L = {
  dark: { soft: [90, 74, 58, 46], balanced: [96, 82, 66, 52], high: [100, 90, 76, 62] },
  light: { soft: [22, 38, 50, 60], balanced: [13, 30, 44, 55], high: [4, 16, 32, 44] },
};
const TEXT_SAT_CAP = { dark: [8, 10, 10, 8], light: [22, 16, 12, 10] };

/**
 * Başlangıç açıklığından zeminden UZAĞA doğru adım adım ilerleyip tüm
 * yüzeylere karşı hedef kontrastı sağlayan ilk tonu döner. Hiçbiri yetmezse
 * saf beyaz/siyah (ulaşılabilecek en yüksek kontrast).
 */
function fitText({ hue, sat, startL, dark, against, target }) {
  const dir = dark ? 1 : -1;
  for (let l = startL; l >= 0 && l <= 100; l += dir) {
    const hex = hslToHex(hue, sat, l);
    if (against.every((surface) => contrastRatio(hex, surface) >= target)) return hex;
  }
  return hslToHex(hue, 0, dark ? 100 : 0);
}

// Koyu vurgu: vurgudan biraz koyu; `drift` verilirse ton da birkaç derece
// kayar (degrade ucu düz bir koyulaşma yerine derinlik kazanır).
function boldFrom(accent, dark, drift = 0) {
  const shifted = shiftLightness(accent, dark ? -10 : -9);
  if (!drift) return shifted;
  const { h, s, l } = hexToHsl(shifted);
  return hslToHex(h + drift, s, l);
}

/**
 * Zemin + vurgu renginden tam 11 token'lık uyumlu palet türetir.
 *
 * Koyu/açık ayrımı algısal parlaklığa (WCAG) göre yapılır — HSL açıklığı
 * sarı gibi renklerde yanıltır. Metin kademeleri hedef kontrastı SAĞLAMAK
 * için doğrulanarak kurulur; kullanıcı soluk bir zemin seçse bile okunur kalır.
 *
 * @param {string} bgHex
 * @param {string} accentHex
 * @param {{contrast?: "soft"|"balanced"|"high", surfaces?: "neutral"|"tinted", boldDrift?: number}} [opts]
 */
export function generateTokensFromSeeds(bgHex, accentHex, opts = {}) {
  const contrast = TEXT_TARGETS[opts.contrast] ? opts.contrast : "balanced";
  const tinted = opts.surfaces !== "neutral";
  const primary = toHex(bgHex);
  const accent = toHex(accentHex);
  const bg = hexToHsl(primary);
  const dark = !isLightSurface(primary);
  const steps = SURFACE_STEPS[contrast];
  const T = (h, s, l) => hslToHex(h, clamp(s, 0, 100), clamp(l, 0, 100));

  // "Nötr yüzeyler": zeminin tonu yüzeylere/metne %40 oranında taşınır.
  const k = tinted ? 1 : 0.4;
  const surfS = bg.s * k;

  let secondary;
  let between;
  let tab;
  let border;
  if (dark) {
    secondary = T(bg.h, surfS, bg.l + steps.secondary);
    between = T(bg.h, surfS, bg.l + steps.between);
    tab = T(bg.h, surfS, bg.l + steps.tab);
    border = T(bg.h, Math.max(surfS - 4, 0), bg.l + steps.border);
  } else {
    secondary = T(bg.h, Math.min(surfS + 4, 100), Math.min(bg.l + steps.secondary - 1, 98));
    between = T(bg.h, surfS, bg.l - (steps.between + 2));
    tab = secondary;
    border = T(bg.h, surfS, bg.l - (steps.border - 1));
  }

  // Gri/nötr zeminde ton açısı anlamsız: doygunluk, zeminin kendi doygunluğuna
  // bağlanır ki saf siyah/gri üzerinde metin pembeye kaçmasın.
  const side = dark ? "dark" : "light";
  const textSat = (i) => Math.min(TEXT_SAT_CAP[side][i], bg.s * 0.8 + 2) * k;
  const against = [primary, secondary];
  const targets = TEXT_TARGETS[contrast];
  const fit = (i, target) =>
    fitText({
      hue: bg.h,
      sat: textSat(i),
      startL: TEXT_START_L[side][contrast][i],
      dark,
      against,
      target,
    });

  return {
    primary,
    secondary,
    between,
    tab,
    border,
    accent,
    bold: boldFrom(accent, dark, opts.boldDrift),
    textPrimary: fit(0, targets.primary),
    textSecondary: fit(1, targets.secondary),
    textBetween: fit(2, targets.between),
    textMuted: fit(3, targets.muted),
  };
}

/* ───────────────────────── Uyum (harmony) ───────────────────────── */

export const HARMONIES = [
  { id: "complementary", offset: 180 },
  { id: "split", offset: 150 },
  { id: "triadic", offset: 120 },
  { id: "analogousR", offset: 35 },
  { id: "analogousL", offset: -35 },
  { id: "mono", offset: 0 },
];

const harmonyOffset = (id) => HARMONIES.find((h) => h.id === id)?.offset ?? 180;

// Uygulamadaki vurgu zeminli düğmelerde yazı BEYAZ (yerleşik 8 temanın hepsi
// beyaza karşı >= 3.2:1). Üretilen vurgu da bu kuralı taşımalı.
const WHITE = "#FFFFFF";

/**
 * Vurguyu iki sınıra oturtur: zemine karşı >= `min` (ayırt edilebilirlik) ve
 * beyaz etikete karşı >= `onWhite` (düğme yazısı). Ton ve doygunluk korunur;
 * yalnız açıklık kayar. İki sınırın ortak bir bandı vardır (≈ 0.115–0.30
 * göreli parlaklık), bu yüzden koyu ve açık zeminlerde ikisi birden sağlanır.
 */
export function fitAccent(accentHex, bgHex, { min = 3, onWhite = 3 } = {}) {
  const bg = toHex(bgHex);
  let accent = toHex(accentHex);
  if (contrastRatio(accent, bg) < min) accent = readableOn(accent, bg, { target: min });
  if (contrastRatio(accent, WHITE) < onWhite) {
    const { h, s, l } = hexToHsl(accent);
    for (let nl = l - 1; nl >= 8; nl -= 1) {
      const candidate = hslToHex(h, s, nl);
      if (contrastRatio(candidate, WHITE) >= onWhite) {
        accent = candidate;
        break;
      }
    }
  }
  return accent;
}

/**
 * Zeminden uyumlu vurgu önerileri. Zeminin tonu anlamlıysa (doygunluk >= 12)
 * onu, değilse mevcut vurgunun tonunu çapa alır; doygunluk/açıklık mevcut
 * vurgudan türetilip zemin polaritesine uygun aralığa çekilir.
 *
 * @returns {{id: string, hex: string}[]}
 */
export function suggestAccents(bgHex, accentHex) {
  const primary = toHex(bgHex);
  const bg = hexToHsl(primary);
  const acc = hexToHsl(toHex(accentHex));
  const dark = !isLightSurface(primary);
  const anchor = bg.s >= 12 ? bg.h : acc.h;
  const s = clamp(acc.s, 62, 92);
  const l = dark ? clamp(acc.l, 54, 68) : clamp(acc.l, 34, 48);
  return HARMONIES.map((h) => ({
    id: h.id,
    hex: fitAccent(hslToHex(anchor + h.offset, s, l), primary),
  }));
}

/* ───────────────────────── Üç ton (açık · orta · koyu) ───────────────────────── */

// Bir özel tema artık TEK renk ailesinin üç tonudur: açık, orta, koyu. Hepsi aynı
// ana renkten (ton + doygunluk) ve aynı vurgudan türetilir; her ton ayrıca tek
// başına ayarlanabilir. "orta" ton, gri tema gibi koyu-ama-siyah-olmayan yüzeydir.
export const TONES = ["light", "mid", "dark"];
export const DEFAULT_TONE = "mid";
export const isTone = (value) => TONES.includes(value);

// Zemin açıklığı (L) ve ana rengin doygunluğunun ton başına payı.
const TONE_BG = {
  light: { l: 94, sMul: 0.75, sMax: 55 },
  mid: { l: 13, sMul: 0.9, sMax: 46 },
  dark: { l: 4, sMul: 0.8, sMax: 56 },
};

// Vurgunun ton başına izin verilen açıklık bandı (mid ton kullanıcının seçtiği
// vurguyu olduğu gibi korur; yalnız zemine oturtulur).
const TONE_ACCENT_L = { light: [32, 46], dark: [52, 68] };

/** Ana renkten bir tonun zemin rengi. `lightness` verilirse tonun varsayılan açıklığını ezer. */
export function toneBackground(baseHex, tone, lightness) {
  const spec = TONE_BG[isTone(tone) ? tone : DEFAULT_TONE];
  const base = hexToHsl(toHex(baseHex));
  const s = clamp(base.s * spec.sMul, 0, spec.sMax);
  const l = Number.isFinite(lightness) ? clamp(lightness, 0, 100) : spec.l;
  return hslToHex(base.h, s, l);
}

/** Vurguyu bir tonun zeminine oturtur: ton/doygunluk korunur, açıklık banda çekilir. */
export function toneAccent(accentHex, tone, bgHex) {
  const accent = toHex(accentHex);
  const band = TONE_ACCENT_L[tone];
  if (!band) return fitAccent(accent, bgHex);
  const { h, s, l } = hexToHsl(accent);
  return fitAccent(hslToHex(h, clamp(s, 45, 96), clamp(l, band[0], band[1])), bgHex);
}

/**
 * Bir paletin vurgusunun, kartlara (secondary) ve zemine karşı da ayırt edilir
 * kalmasını sağlar. Üretilen/sürüklenen vurgu zemine karşı yeterli olsa bile
 * kart yüzeyinde kaybolabiliyordu; "her alanda uyum" için ikisine birden bakılır.
 */
export function harmonizeTokens(tokens) {
  const primary = toHex(tokens.primary);
  const secondary = toHex(tokens.secondary);
  const dark = !isLightSurface(primary);
  let accent = toHex(tokens.accent);
  for (let i = 0; i < 3; i += 1) {
    let next = accent;
    if (contrastRatio(next, secondary) < 2.8) next = fitAccent(next, secondary, { min: 3 });
    if (contrastRatio(next, primary) < 3) next = fitAccent(next, primary);
    if (next === accent) break;
    accent = next;
  }
  if (accent === toHex(tokens.accent)) return tokens;
  return { ...tokens, accent, bold: shiftLightness(accent, dark ? -10 : -9) };
}

/**
 * Ana renk + vurgudan üç tonluk set. `opts`: contrast/surfaces/boldDrift (bkz.
 * generateTokensFromSeeds), `toneL` ({light, mid, dark} → zemin açıklığı) ve
 * `exactMidAccent` (orta tonun vurgusu zemine oturtulmadan olduğu gibi kalır).
 *
 * @returns {{light: object, mid: object, dark: object}} her biri 11 token
 */
export function generateToneSet(baseHex, accentHex, opts = {}) {
  const out = {};
  for (const tone of TONES) {
    const bg = toneBackground(baseHex, tone, opts.toneL?.[tone]);
    // exactMidAccent: kullanıcının KİLİTLEDİĞİ vurgu orta tonda aynen kalır.
    const exact = opts.exactMidAccent && tone === "mid";
    const accent = exact ? toHex(accentHex) : toneAccent(accentHex, tone, bg);
    const tokens = generateTokensFromSeeds(bg, accent, opts);
    out[tone] = exact ? tokens : harmonizeTokens(tokens);
  }
  return out;
}

/**
 * Tek bir tonu yeniden üretir (kullanıcı o tonun zeminini değiştirdiğinde):
 * verilen ZEMİN rengi tonun zemini olur, vurgu o zemine oturtulur.
 */
export function generateToneFromBackground(bgHex, accentHex, tone, opts = {}) {
  const bg = toHex(bgHex);
  return harmonizeTokens(generateTokensFromSeeds(bg, toneAccent(accentHex, tone, bg), opts));
}

/** "Ana renk" kutusunda gösterilecek tohum: zemin tonu + doygunluğu, orta açıklık. */
export function baseFromTokens(tokens) {
  const bg = hexToHsl(toHex(tokens.primary));
  const s = clamp(bg.s / TONE_BG.mid.sMul, 0, 100);
  return hslToHex(bg.h, s, 46);
}

/**
 * Tek bir (çözülmüş) token setinden, onu "orta" ton sayarak açık ve koyu tonları
 * türetir. Eski, tek tonlu özel temaların açık/koyu tonu böyle ortaya çıkar;
 * orta ton DEĞİŞMEZ (seçili tema aynı görünmeye devam eder).
 */
export function deriveToneSet(tokens, opts = {}) {
  const base = baseFromTokens(tokens);
  const accent = toHex(tokens.accent);
  const set = generateToneSet(base, accent, { contrast: "balanced", surfaces: "tinted", ...opts });
  return { light: set.light, mid: tokens, dark: set.dark };
}

/** Bir ton için token seti: kayıtlı tones[tone] > orta ton > türetilen. */
export function deriveToneTokens(tokens, tone) {
  if (tone === "mid" || !isTone(tone)) return tokens;
  return deriveToneSet(tokens)[tone];
}

/* ───────────────────────── Ruh halleri + rastgele ───────────────────────── */

// Her ruh hali bir "ana renk" karakteridir (ton + doygunluk) ve üç tonun hepsine
// yansır. hue/baseS/accS/accL: [min, max]; hue 360'ı aşabilir (sarılır).
//   toneL  — ton başına zemin açıklığı aralığı (yoksa varsayılan aralık)
//   lead   — keşif kartında öne çıkan ton
//   surfaces — "neutral" ise yüzeyler renksiz tutulur (AMOLED gibi)
export const MOODS = [
  { id: "midnight", icon: "moon", lead: "mid", hue: [212, 268], baseS: [30, 52], accS: [72, 92], accL: [58, 68], harmonies: ["complementary", "analogousR", "split", "mono"] },
  { id: "amoled", icon: "contrast", lead: "dark", hue: [0, 360], baseS: [0, 12], accS: [82, 100], accL: [56, 66], harmonies: ["complementary", "triadic", "split", "analogousR", "mono"], toneL: { dark: [0, 1.5], mid: [6, 9] }, surfaces: "neutral" },
  { id: "forest", icon: "leaf", lead: "mid", hue: [135, 168], baseS: [24, 44], accS: [62, 86], accL: [56, 66], harmonies: ["complementary", "split", "triadic", "analogousL"] },
  { id: "sunset", icon: "flame", lead: "mid", hue: [335, 380], baseS: [30, 52], accS: [82, 98], accL: [58, 66], harmonies: ["analogousR", "analogousL", "mono"] },
  { id: "ocean", icon: "water", lead: "mid", hue: [176, 208], baseS: [34, 56], accS: [74, 94], accL: [58, 66], harmonies: ["complementary", "split", "analogousR"] },
  { id: "mocha", icon: "cafe", lead: "mid", hue: [16, 36], baseS: [18, 34], accS: [60, 82], accL: [58, 68], harmonies: ["mono", "analogousR", "complementary"] },
  { id: "neon", icon: "flash", lead: "dark", hue: [256, 292], baseS: [48, 72], accS: [96, 100], accL: [56, 62], harmonies: ["complementary", "triadic", "split"], toneL: { dark: [1, 3.5], mid: [8, 12] } },
  { id: "pastel", icon: "flower", lead: "light", hue: [0, 360], baseS: [40, 66], accS: [52, 72], accL: [48, 58], harmonies: ["triadic", "analogousR", "complementary", "split"], toneL: { light: [95, 97.5], mid: [14, 19], dark: [5, 8] } },
  { id: "paper", icon: "newspaper", lead: "light", hue: [28, 56], baseS: [20, 38], accS: [62, 84], accL: [40, 54], harmonies: ["complementary", "mono", "split"], toneL: { light: [92, 96] } },
  { id: "slate", icon: "cloudy-night", lead: "mid", hue: [200, 228], baseS: [8, 18], accS: [60, 85], accL: [56, 66], harmonies: ["complementary", "split", "analogousR", "mono"], toneL: { mid: [14, 19] } },
  { id: "sand", icon: "sunny", lead: "light", hue: [32, 50], baseS: [14, 28], accS: [56, 78], accL: [44, 58], harmonies: ["analogousL", "complementary", "split"], toneL: { light: [92, 96] } },
  { id: "lavender", icon: "color-filter", lead: "mid", hue: [252, 292], baseS: [24, 40], accS: [58, 82], accL: [58, 68], harmonies: ["analogousL", "split", "complementary", "mono"] },
  { id: "mint", icon: "snow", lead: "light", hue: [146, 178], baseS: [24, 42], accS: [58, 82], accL: [44, 58], harmonies: ["complementary", "analogousR", "split"], toneL: { light: [93, 96.5] } },
  { id: "rose", icon: "rose", lead: "mid", hue: [326, 352], baseS: [28, 46], accS: [66, 90], accL: [58, 68], harmonies: ["analogousL", "complementary", "mono", "split"] },
  { id: "cobalt", icon: "diamond", lead: "dark", hue: [216, 234], baseS: [58, 78], accS: [78, 96], accL: [58, 68], harmonies: ["complementary", "split", "triadic"], toneL: { dark: [3, 5.5] } },
  { id: "ember", icon: "bonfire", lead: "dark", hue: [4, 24], baseS: [34, 52], accS: [78, 96], accL: [56, 66], harmonies: ["analogousR", "mono", "split"] },
  { id: "aurora", icon: "sparkles", lead: "mid", hue: [168, 204], baseS: [30, 48], accS: [74, 94], accL: [58, 68], harmonies: ["triadic", "split", "complementary"] },
];

export const MOOD_IDS = MOODS.map((m) => m.id);
const moodById = (id) => MOODS.find((m) => m.id === id) || null;

// Sarı–limon bandında (≈46°–100°) parlak bir vurgu, beyaz düğme yazısını
// taşımak için (bkz. fitAccent) bulanık zeytine kadar koyulaşıyor; "neon sarı"
// aday olarak istenen şey değil. Rastgele üretimde bu bandın içine düşen ton,
// en yakın kenara (turuncu / yeşil) itilir. Kullanıcı elle sarı seçebilir.
const YELLOW_BAND = [46, 100];
function steerAccentHue(hue) {
  const h = wrapHue(hue);
  if (h <= YELLOW_BAND[0] || h >= YELLOW_BAND[1]) return h;
  return h < (YELLOW_BAND[0] + YELLOW_BAND[1]) / 2 ? YELLOW_BAND[0] - 2 : YELLOW_BAND[1] + 4;
}

// Ton başına varsayılan zemin açıklığı aralığı (ruh hali ezmezse).
const DEFAULT_TONE_L = { light: [91, 96], mid: [10, 16], dark: [2, 6] };

// Vurgu "enerjisi": soluk / normal / canlı. Aynı ruh halinden farklı karakterde
// adaylar çıkması için ölçek çarpanı.
const ENERGIES = [
  { id: "muted", sMul: 0.74, weight: 1 },
  { id: "normal", sMul: 1, weight: 3 },
  { id: "vivid", sMul: 1.1, weight: 1.4 },
];
const CONTRAST_WEIGHTS = [["balanced", 3], ["soft", 1.2], ["high", 1.2]];
const SURFACE_WEIGHTS = [["tinted", 3], ["neutral", 1]];

function weightedPick(rng, entries) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** Ton → renk ailesi kimliği (isim önerisi + etiket). */
export function hueFamily(h, s = 100) {
  if (s < 12) return "gray";
  const hue = wrapHue(h);
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 40) return "orange";
  if (hue < 65) return "yellow";
  if (hue < 160) return "green";
  if (hue < 195) return "teal";
  if (hue < 250) return "blue";
  if (hue < 290) return "violet";
  return "pink";
}

/** Palet için kısa betimleme: kutupluluk + vurgu rengi ailesi. */
export function describeTheme(tokens) {
  const primary = toHex(tokens?.primary);
  const acc = hexToHsl(toHex(tokens?.accent));
  return {
    polarity: isLightSurface(primary) ? "light" : "dark",
    family: hueFamily(acc.h, acc.s),
  };
}

/**
 * Tüm tonları geçerli, okunur ve uyumlu hale getirir (üretimin son kapısı).
 * `keepMidAccent`: kilitli vurgu orta tonda dokunulmadan kalır (metin yine düzelir).
 */
function settleTones(tones, { keepMidAccent = false } = {}) {
  const out = {};
  for (const tone of TONES) {
    const keep = keepMidAccent && tone === "mid";
    let tokens = tones[tone];
    if (!analyzeContrast(tokens).passes) {
      const patch = fixReadability(tokens);
      if (keep) {
        delete patch.accent;
        delete patch.bold;
      }
      tokens = { ...tokens, ...patch };
    }
    out[tone] = keep ? tokens : harmonizeTokens(tokens);
  }
  return out;
}

/**
 * Tek bir rastgele tema adayı: ana renk + vurgu → üç ton.
 *
 * Çeşitlilik ve uyum kaynakları:
 *  • 17 ruh hali (ton/doygunluk/açıklık karakteri), ruh halinin uyum kuralları;
 *  • enerji (soluk/normal/canlı), kontrast ve yüzey kipi (kullanıcı seçmediyse
 *    ağırlıklı rastgele), ton başına zemin açıklığı oynaması, bold ton kayması;
 *  • uyum kuralı: tamamlayıcı dışı seçeneklerde bile vurgu ana renkten ≥ 28° uzak
 *    (zemine karışan "tek ton" hariç), sarı–limon bandı yasak;
 *  • son kapı: her ton okunabilirlik raporundan geçer, vurgu hem zeminde hem
 *    kartta ayırt edilir.
 *
 * @param {object} [opts]
 * @param {string|null} [opts.moodId]   null = karışık (rastgele ruh hali)
 * @param {string|null} [opts.harmonyId] null = ruh halinin uyumlarından biri
 * @param {{base?: string|null, bg?: string|null, accent?: string|null}} [opts.lock] kilitli tohumlar
 * @param {"soft"|"balanced"|"high"} [opts.contrast] verilmezse ağırlıklı rastgele
 * @param {"neutral"|"tinted"} [opts.surfaces] verilmezse ağırlıklı rastgele
 * @param {() => number} [opts.rng]
 */
export function generateRandomTheme(opts = {}) {
  const rng = opts.rng || defaultRng;
  const lock = opts.lock || {};
  const lockedBase = lock.base || lock.bg || null;
  const mood = moodById(opts.moodId) || pick(rng, MOODS);
  const harmonyId = opts.harmonyId || pick(rng, mood.harmonies);

  // ── ana renk ──
  let base;
  if (lockedBase) {
    base = toHex(lockedBase);
  } else {
    let hue;
    if (lock.accent && !opts.moodId) {
      // Karışık kipte kilitli vurgu varsa ana renk ona uyumlu bir tonda kurulur.
      const a = hexToHsl(toHex(lock.accent));
      hue = a.h + pick(rng, [180, 150, 210, 0, 30, -30]) + between(rng, [-8, 8]);
    } else {
      hue = between(rng, mood.hue);
    }
    base = hslToHex(wrapHue(hue), between(rng, mood.baseS), 46);
  }
  const baseHsl = hexToHsl(base);

  // ── stil ──
  const contrast = CONTRAST_LEVELS.includes(opts.contrast) ? opts.contrast : weightedPick(rng, CONTRAST_WEIGHTS);
  const surfaces = SURFACE_MODES.includes(opts.surfaces)
    ? opts.surfaces
    : mood.surfaces || weightedPick(rng, SURFACE_WEIGHTS);
  const toneL = {};
  for (const tone of TONES) toneL[tone] = between(rng, mood.toneL?.[tone] || DEFAULT_TONE_L[tone]);
  const boldDrift = between(rng, [-9, 9]);

  // ── vurgu ──
  let accent;
  if (lock.accent) {
    accent = toHex(lock.accent);
  } else {
    const anchor = baseHsl.s >= 12 ? baseHsl.h : between(rng, [0, 360]);
    let hue = steerAccentHue(anchor + harmonyOffset(harmonyId) + between(rng, [-9, 9]));
    if (harmonyId !== "mono" && baseHsl.s >= 12 && hueDistance(hue, baseHsl.h) < 28) {
      // İki yönden de dene (sarı bandı itmesi bir yönü ana renge geri yaklaştırabilir)
      // ve ana renkten en uzak kalanı al.
      const away = between(rng, [34, 60]);
      const up = steerAccentHue(baseHsl.h + away);
      const down = steerAccentHue(baseHsl.h - away);
      hue = hueDistance(up, baseHsl.h) >= hueDistance(down, baseHsl.h) ? up : down;
    }
    const energy = weightedPick(rng, ENERGIES.map((e) => [e, e.weight]));
    const s = clamp(between(rng, mood.accS) * energy.sMul, 42, 100);
    accent = hslToHex(hue, s, between(rng, mood.accL));
  }

  const keepAccent = Boolean(lock.accent);
  const tones = settleTones(
    generateToneSet(base, accent, { contrast, surfaces, toneL, boldDrift, exactMidAccent: keepAccent }),
    { keepMidAccent: keepAccent },
  );
  // Gösterilen/kilitlenen vurgu, orta tonda GERÇEKTEN kullanılan değerdir.
  const shownAccent = tones.mid.accent;
  const accHsl = hexToHsl(shownAccent);

  return {
    key: `${base}-${shownAccent}-${contrast}-${surfaces}`,
    moodId: mood.id,
    harmonyId,
    lead: mood.lead,
    base,
    accent: shownAccent,
    contrast,
    surfaces,
    family: hueFamily(accHsl.h, accHsl.s),
    tones,
    // Eski çağıranlar (ve orta ton gösterimi) için kısa yol.
    tokens: tones.mid,
  };
}

const rgbDistance = (a, b) => {
  const x = toHex(a);
  const y = toHex(b);
  let sum = 0;
  for (let i = 1; i < 7; i += 2) {
    const d = parseInt(x.slice(i, i + 2), 16) - parseInt(y.slice(i, i + 2), 16);
    sum += d * d;
  }
  return Math.sqrt(sum);
};

// Birbirine fazla benzeyen iki adayı eler: ana renk (ton+doygunluk) VE vurgu yakınsa.
const tooSimilar = (a, b) => {
  const ba = hexToHsl(a.base);
  const bb = hexToHsl(b.base);
  const sameBase = hueDistance(ba.h, bb.h) < 26 && Math.abs(ba.s - bb.s) < 20;
  const sameAccent = hueDistance(hexToHsl(a.accent).h, hexToHsl(b.accent).h) < 38;
  return (sameBase && sameAccent) || (sameAccent && rgbDistance(a.tones.mid.primary, b.tones.mid.primary) < 14);
};

/**
 * Birbirinden FARKLI `count` aday üretir.
 *  • moodId verilmezse adaylar farklı ruh hallerinden (karışık sırayla) gelir;
 *  • `avoid` (önceki adaylar) ile çok benzeyenler elenir → "Karıştır" her
 *    basışta gerçekten yeni bir şey gösterir;
 *  • vurgu rengi ailesi çeşitlenir: bir aile adaylarda en çok iki kez görünür
 *    (çok dar aralıkta gevşetilir);
 *  • hem ana renk hem vurgu kilitliyse değişecek tek şey stil olduğundan adaylar
 *    kontrast/yüzey seçeneklerinin kombinasyonlarıyla çeşitlendirilir.
 */
export function generateCandidates(count = 6, opts = {}) {
  const rng = opts.rng || defaultRng;
  const lock = opts.lock || {};
  const lockedBase = lock.base || lock.bg || null;
  const avoid = opts.avoid || [];
  const out = [];

  if (lockedBase && lock.accent) {
    const combos = [];
    for (const surfaces of ["tinted", "neutral"]) {
      for (const contrast of ["balanced", "soft", "high"]) combos.push({ contrast, surfaces });
    }
    for (let i = 0; i < count; i += 1) {
      const combo = combos[i % combos.length];
      out.push(generateRandomTheme({ ...opts, lock, rng, contrast: combo.contrast, surfaces: combo.surfaces, moodId: opts.moodId || "midnight" }));
    }
    return out;
  }

  const moodOrder = opts.moodId ? null : shuffled(MOODS, rng);
  const limit = count * 16;
  const familyCount = {};
  for (let attempt = 0; out.length < count && attempt < limit; attempt += 1) {
    const moodId = opts.moodId || moodOrder[out.length % moodOrder.length].id;
    const candidate = generateRandomTheme({ ...opts, moodId, lock, rng });
    if ([...out, ...avoid].some((other) => tooSimilar(candidate, other))) continue;
    // İlk %60 denemede aynı vurgu ailesi ikiden fazla görünmesin.
    if (attempt < limit * 0.6 && (familyCount[candidate.family] || 0) >= 2) continue;
    familyCount[candidate.family] = (familyCount[candidate.family] || 0) + 1;
    out.push(candidate);
  }
  // Çok dar aralıkta (tek ruh hali) benzemezlik sağlanamazsa eksik kalanı tamamla.
  while (out.length < count) {
    const moodId = opts.moodId || moodOrder[out.length % moodOrder.length].id;
    out.push(generateRandomTheme({ ...opts, moodId, lock, rng }));
  }
  return out;
}

/* ───────────────────────── Okunabilirlik ───────────────────────── */

export const CONTRAST_CHECKS = [
  { id: "title", fg: "textPrimary", bg: "primary", min: 4.5, great: 7 },
  { id: "card", fg: "textSecondary", bg: "secondary", min: 4.5, great: 7 },
  { id: "muted", fg: "textMuted", bg: "primary", min: 3, great: 4.5 },
  { id: "accent", fg: "accent", bg: "primary", min: 3, great: 4.5 },
  { id: "button", fg: "white", bg: "accent", min: 3, great: 4.5 },
];

const LEVEL_RANK = { great: 3, ok: 2, low: 1, fail: 0 };

/**
 * Çözülmüş (hepsi hex) token haritasından okunabilirlik raporu.
 * level: great (güçlü) | ok (geçer) | low (sınırda) | fail (yetersiz).
 */
export function analyzeContrast(resolved) {
  const colors = { ...resolved, white: WHITE };
  const rows = CONTRAST_CHECKS.map((check) => {
    const fgColor = toHex(colors[check.fg]);
    const bgColor = toHex(colors[check.bg]);
    const ratio = contrastRatio(fgColor, bgColor);
    const level =
      ratio >= check.great ? "great" : ratio >= check.min ? "ok" : ratio >= check.min * 0.7 ? "low" : "fail";
    return { ...check, fgColor, bgColor, ratio, level };
  });
  const worst = rows.reduce((a, b) => (LEVEL_RANK[b.level] < LEVEL_RANK[a.level] ? b : a), rows[0]);
  const allGreat = rows.every((r) => r.level === "great");
  const level = allGreat ? "great" : worst.level === "great" ? "ok" : worst.level;
  const issues = rows.filter((r) => LEVEL_RANK[r.level] < LEVEL_RANK.ok).length;
  return { rows, level, issues, passes: issues === 0 };
}

/**
 * Yetersiz okunan metin kademelerini (ve zemine karışan vurguyu) EN KÜÇÜK
 * kaydırmayla düzelten bir YAMA döner; sorun yoksa boş nesne. Düzelten
 * token'lar mutlak hex olur (bağlı token'ın bağı kopar).
 */
export function fixReadability(resolved) {
  const primary = toHex(resolved.primary);
  const secondary = toHex(resolved.secondary);
  const dark = !isLightSurface(primary);
  const targets = TEXT_TARGETS.balanced;
  const patch = {};

  const specs = [
    ["textPrimary", targets.primary],
    ["textSecondary", targets.secondary],
    ["textBetween", targets.between],
    ["textMuted", targets.muted],
  ];
  for (const [key, target] of specs) {
    const current = toHex(resolved[key]);
    const against = [primary, secondary];
    if (against.every((surface) => contrastRatio(current, surface) >= target)) continue;
    const hsl = hexToHsl(current);
    patch[key] = fitText({ hue: hsl.h, sat: hsl.s, startL: hsl.l, dark, against, target });
  }

  const accent = toHex(resolved.accent);
  const fixed = fitAccent(accent, primary);
  if (fixed !== accent) {
    patch.accent = fixed;
    patch.bold = shiftLightness(fixed, dark ? -10 : -9);
  }
  return patch;
}

/* ───────────────────────── İsim ───────────────────────── */

/** Aynı adı taşıyan tema varsa " 2", " 3" … ekler (büyük/küçük harf duyarsız). */
export function uniqueName(base, existingNames = []) {
  const taken = new Set(existingNames.map((n) => String(n || "").trim().toLocaleLowerCase()));
  const clean = String(base || "").trim();
  if (!clean || !taken.has(clean.toLocaleLowerCase())) return clean;
  for (let i = 2; i < 100; i += 1) {
    const next = `${clean} ${i}`;
    if (!taken.has(next.toLocaleLowerCase())) return next;
  }
  return clean;
}
