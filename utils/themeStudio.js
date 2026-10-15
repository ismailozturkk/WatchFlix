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

/**
 * Zemin + vurgu renginden tam 11 token'lık uyumlu palet türetir.
 *
 * Koyu/açık ayrımı algısal parlaklığa (WCAG) göre yapılır — HSL açıklığı
 * sarı gibi renklerde yanıltır. Metin kademeleri hedef kontrastı SAĞLAMAK
 * için doğrulanarak kurulur; kullanıcı soluk bir zemin seçse bile okunur kalır.
 *
 * @param {string} bgHex
 * @param {string} accentHex
 * @param {{contrast?: "soft"|"balanced"|"high", surfaces?: "neutral"|"tinted"}} [opts]
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
    bold: shiftLightness(accent, dark ? -10 : -9),
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

/* ───────────────────────── Ruh halleri + rastgele ───────────────────────── */

// hue/bgS/bgL/accS/accL: [min, max] aralıkları. hue 360'ı aşabilir (sarılır).
export const MOODS = [
  { id: "midnight", icon: "moon", dark: true, hue: [212, 268], bgS: [24, 40], bgL: [7, 12], accS: [72, 92], accL: [60, 68], harmonies: ["complementary", "analogousR", "split", "mono"] },
  { id: "amoled", icon: "contrast", dark: true, hue: [0, 360], bgS: [0, 14], bgL: [1, 4], accS: [82, 100], accL: [56, 66], harmonies: ["complementary", "triadic", "split", "analogousR", "mono"] },
  { id: "forest", icon: "leaf", dark: true, hue: [135, 168], bgS: [22, 36], bgL: [7, 11], accS: [62, 86], accL: [56, 66], harmonies: ["complementary", "split", "triadic", "analogousL"] },
  { id: "sunset", icon: "flame", dark: true, hue: [335, 380], bgS: [24, 38], bgL: [8, 12], accS: [82, 98], accL: [58, 66], harmonies: ["analogousR", "analogousL", "mono"] },
  { id: "ocean", icon: "water", dark: true, hue: [176, 208], bgS: [30, 48], bgL: [8, 12], accS: [74, 94], accL: [58, 66], harmonies: ["complementary", "split", "analogousR"] },
  { id: "mocha", icon: "cafe", dark: true, hue: [16, 36], bgS: [16, 28], bgL: [8, 12], accS: [60, 82], accL: [58, 68], harmonies: ["mono", "analogousR", "complementary"] },
  { id: "neon", icon: "flash", dark: true, hue: [256, 292], bgS: [44, 64], bgL: [5, 9], accS: [96, 100], accL: [56, 62], harmonies: ["complementary", "triadic", "split"] },
  { id: "pastel", icon: "flower", dark: false, hue: [0, 360], bgS: [38, 62], bgL: [93, 96], accS: [52, 72], accL: [46, 56], harmonies: ["triadic", "analogousR", "complementary", "split"] },
  { id: "paper", icon: "newspaper", dark: false, hue: [28, 56], bgS: [20, 36], bgL: [91, 95], accS: [62, 84], accL: [34, 46], harmonies: ["complementary", "mono", "split"] },
];

export const MOOD_IDS = MOODS.map((m) => m.id);
const moodById = (id) => MOODS.find((m) => m.id === id) || null;

// Kilitli zemin bir ruh halinin kutupluluğuyla çelişirse vurgu için güvenli aralık.
const ACCENT_FALLBACK = {
  dark: { s: [70, 92], l: [58, 68] },
  light: { s: [62, 84], l: [34, 46] },
};

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
 * Tek bir rastgele tema adayı.
 *
 * @param {object} [opts]
 * @param {string|null} [opts.moodId]   null = karışık (rastgele ruh hali)
 * @param {string|null} [opts.harmonyId] null = ruh halinin uyumlarından biri
 * @param {{bg?: string|null, accent?: string|null}} [opts.lock] kilitli tohumlar
 * @param {"soft"|"balanced"|"high"} [opts.contrast]
 * @param {"neutral"|"tinted"} [opts.surfaces]
 * @param {() => number} [opts.rng]
 */
export function generateRandomTheme(opts = {}) {
  const rng = opts.rng || defaultRng;
  const lock = opts.lock || {};
  const mood = moodById(opts.moodId) || pick(rng, MOODS);
  const harmonyId = opts.harmonyId || pick(rng, mood.harmonies);

  // ── zemin ──
  let bg;
  if (lock.bg) {
    bg = toHex(lock.bg);
  } else {
    let hue;
    if (lock.accent && !opts.moodId) {
      // Karışık kipte kilitli vurgu varsa zemin ona uyumlu bir tonda kurulur.
      const a = hexToHsl(toHex(lock.accent));
      hue = a.h + pick(rng, [180, 150, 210, 0, 30, -30]) + between(rng, [-8, 8]);
    } else {
      hue = between(rng, mood.hue);
    }
    bg = hslToHex(wrapHue(hue), between(rng, mood.bgS), between(rng, mood.bgL));
  }
  const bgHsl = hexToHsl(bg);
  const dark = !isLightSurface(bg);

  // ── vurgu ──
  let accent;
  if (lock.accent) {
    accent = toHex(lock.accent);
  } else {
    const anchor = bgHsl.s >= 12 ? bgHsl.h : between(rng, [0, 360]);
    const hue = steerAccentHue(anchor + harmonyOffset(harmonyId) + between(rng, [-8, 8]));
    const sameSide = mood.dark === dark;
    const sRange = sameSide ? mood.accS : ACCENT_FALLBACK[dark ? "dark" : "light"].s;
    const lRange = sameSide ? mood.accL : ACCENT_FALLBACK[dark ? "dark" : "light"].l;
    accent = fitAccent(hslToHex(hue, between(rng, sRange), between(rng, lRange)), bg);
  }

  const contrast = CONTRAST_LEVELS.includes(opts.contrast) ? opts.contrast : "balanced";
  const surfaces = SURFACE_MODES.includes(opts.surfaces) ? opts.surfaces : "tinted";
  const tokens = generateTokensFromSeeds(bg, accent, { contrast, surfaces });
  const accHsl = hexToHsl(accent);

  return {
    key: `${bg}-${accent}-${contrast}-${surfaces}`,
    moodId: mood.id,
    harmonyId,
    bg,
    accent,
    dark,
    family: hueFamily(accHsl.h, accHsl.s),
    tokens,
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

// Birbirine fazla benzeyen iki adayı eler (ayrı ruh hali değilken sık oluyor).
const tooSimilar = (a, b) =>
  rgbDistance(a.bg, b.bg) < 42 && hueDistance(hexToHsl(a.accent).h, hexToHsl(b.accent).h) < 38;

/**
 * Birbirinden FARKLI `count` aday üretir.
 *  • moodId verilmezse adaylar farklı ruh hallerinden (karışık sırayla) gelir;
 *  • `avoid` (önceki adaylar) ile çok benzeyenler elenir → "Karıştır" her
 *    basışta gerçekten yeni bir şey gösterir;
 *  • hem zemin hem vurgu kilitliyse değişecek tek şey stil olduğundan adaylar
 *    kontrast/yüzey seçeneklerinin kombinasyonlarıyla çeşitlendirilir.
 */
export function generateCandidates(count = 6, opts = {}) {
  const rng = opts.rng || defaultRng;
  const lock = opts.lock || {};
  const avoid = opts.avoid || [];
  const out = [];

  if (lock.bg && lock.accent) {
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
  const limit = count * 14;
  for (let attempt = 0; out.length < count && attempt < limit; attempt += 1) {
    const moodId = opts.moodId || moodOrder[out.length % moodOrder.length].id;
    const candidate = generateRandomTheme({ ...opts, moodId, lock, rng });
    if ([...out, ...avoid].some((other) => tooSimilar(candidate, other))) continue;
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
