// utils/themePresets.js
//
// Tema Stüdyosu'nun "ÜÇ TONLU TEMA DESTESİ" (bundle) modeli ve "Hazır temalar".
//
// Bir deste = tek renk ailesinin üç tonu + onları üreten iki tohum:
//   { base, accent, tones: { light, mid, dark } }
//   • base   — "ana renk": zemin tonu + doygunluğu (ekranda renk kutusu)
//   • accent — üç tonun ortak vurgusu (her tona oturtulmuş hali tones içinde)
//   • tones  — her biri 11 token'lık tam palet (kullanıcı tonları tek tek ayarlar)
//
// Saf modül (React/Native yok): ekran bunu geçmiş (undo/redo) değeri olarak taşır,
// kayıt `entryFromBundle` ile, açılış `bundleFromEntry` ile yapılır.

import { clamp, hslToHex, toHex } from "./colorUtils";
import { THEME_FAMILIES, themeToTokens, resolveThemeTokens, parseCustomSelection, themes } from "../theme/colors";
import { TONES, baseFromTokens, deriveToneSet, generateToneSet } from "./themeStudio";

const STYLE = { contrast: "balanced", surfaces: "tinted" };

/** Üç tonlu sette yer alan ton anahtarlarının hepsi dolu mu? */
export const isBundle = (value) =>
  !!value && typeof value === "object" && TONES.every((tone) => value.tones && value.tones[tone]);

/**
 * Kayıtlı özel tema → deste. Üç ton kayıtlıysa olduğu gibi; eski tek tonlu
 * temada orta ton `tokens` (DEĞİŞMEZ), açık/koyu ondan türetilir.
 */
export function bundleFromEntry(entry) {
  const mid = resolveThemeTokens(entry?.tones?.mid || entry?.tokens || {});
  const derived = deriveToneSet(mid);
  const tones = {
    light: entry?.tones?.light || derived.light,
    mid: entry?.tones?.mid || entry?.tokens || mid,
    dark: entry?.tones?.dark || derived.dark,
  };
  return {
    base: entry?.base || baseFromTokens(mid),
    accent: toHex(mid.accent),
    tones,
  };
}

/** Deste → kaydedilecek özel tema girdisi (`tokens` = orta ton, eski okuyucular için). */
export function entryFromBundle(bundle, { id, name }) {
  return { id, name, base: bundle.base, tones: bundle.tones, tokens: bundle.tones.mid };
}

/** Hazır tema ailesi (Varsayılan/Mavi/Yeşil) → deste: üç tonu AYNEN yerleşik temalardır. */
export function bundleFromFamily(familyId) {
  const family = THEME_FAMILIES.find((f) => f.id === familyId) || THEME_FAMILIES[0];
  const tones = {
    light: themeToTokens(family.tones.light),
    mid: themeToTokens(family.tones.mid),
    dark: themeToTokens(family.tones.dark),
  };
  return { base: baseFromTokens(tones.mid), accent: toHex(tones.mid.accent), tones };
}

/** Tek bir yerleşik temadan (ör. Gece Moru) deste: orta ton o tema, açık/koyu türetilir. */
export function bundleFromBuiltin(themeKey) {
  const mid = themeToTokens(themeKey);
  const derived = deriveToneSet(mid);
  return { base: baseFromTokens(mid), accent: toHex(mid.accent), tones: { light: derived.light, mid, dark: derived.dark } };
}

/** Tohum renklerden (ton, doygunluk, vurgu) deste. */
export function bundleFromSeeds(hue, sat, accent, opts = {}) {
  const base = hslToHex(hue, clamp(sat, 0, 100), 46);
  return { base, accent: toHex(accent), tones: generateToneSet(base, accent, { ...STYLE, ...opts }) };
}

/**
 * Hazır temalar. İlk üçü yerleşik ailelerin AYNISI (başlangıç noktası); Gece Moru
 * ve Kızıl Sinema, ayar listesinden buraya taşınan eski hazır temalar; kalanı
 * stüdyonun üç tonluk motoruyla kurulmuş yeni setler.
 */
export const THEME_PRESETS = [
  { id: "default", build: () => bundleFromFamily("default") },
  { id: "blue", build: () => bundleFromFamily("blue") },
  { id: "green", build: () => bundleFromFamily("green") },
  { id: "purple", build: () => bundleFromBuiltin("purple") },
  { id: "crimson", build: () => bundleFromBuiltin("amber") },
  { id: "ocean", build: () => bundleFromSeeds(200, 58, "#F97316") },
  { id: "forest", build: () => bundleFromSeeds(150, 36, "#E58B3A") },
  { id: "mocha", build: () => bundleFromSeeds(24, 30, "#D9A066") },
  { id: "sunset", build: () => bundleFromSeeds(352, 46, "#FB923C") },
];

export const PRESET_IDS = THEME_PRESETS.map((preset) => preset.id);

const presetCache = new Map();

/** Bir hazır temanın destesi (üretim pahalı değil ama liste her açılışta aynı kalsın diye önbellekli). */
export function getPresetBundle(id) {
  if (!presetCache.has(id)) {
    const preset = THEME_PRESETS.find((p) => p.id === id);
    if (!preset) return null;
    presetCache.set(id, preset.build());
  }
  return presetCache.get(id);
}

/**
 * Ekran açılırken başlangıç destesi + ton: düzenleme ise kayıtlı tema, yeni
 * temada o an seçili tema (özel, hazır aile, eski hazır) — bulunamazsa Varsayılan aile.
 *
 * @returns {{bundle: object, tone: "light"|"mid"|"dark"}}
 */
export function initialBundle({ existing, selectedTheme, customThemes = [] }) {
  const selection = parseCustomSelection(selectedTheme);
  if (existing) {
    const tone = selection && selection.id === existing.id ? selection.tone : "mid";
    return { bundle: bundleFromEntry(existing), tone };
  }
  if (selection?.id) {
    const current = customThemes.find((c) => c.id === selection.id);
    if (current) return { bundle: bundleFromEntry(current), tone: selection.tone };
  }
  for (const family of THEME_FAMILIES) {
    const tone = TONES.find((t) => family.tones[t] === selectedTheme);
    if (tone) return { bundle: bundleFromFamily(family.id), tone };
  }
  if (selectedTheme && themes[selectedTheme]) {
    return { bundle: bundleFromBuiltin(selectedTheme), tone: "mid" };
  }
  return { bundle: bundleFromFamily("default"), tone: "mid" };
}
