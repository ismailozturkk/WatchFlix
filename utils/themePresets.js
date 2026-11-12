// utils/themePresets.js
//
// Tema Stüdyosu'nun "BEŞ TONLU TEMA DESTESİ" (bundle) modeli ve "Hazır temalar".
//
// Bir deste = tek renk ailesinin beş tonu + onları üreten iki tohum:
//   { base, accent, tones: { bright, light, mid, dark, amoled } }  (bkz. theme/toneModel.js)
//   • base   — "ana renk": zemin tonu + doygunluğu (ekranda renk kutusu)
//   • accent — tonların ortak vurgusu (her tona oturtulmuş hali tones içinde)
//   • tones  — her biri 11 token'lık tam palet (kullanıcı tonları tek tek ayarlar)
//
// Saf modül (React/Native yok): ekran bunu geçmiş (undo/redo) değeri olarak taşır,
// kayıt `entryFromBundle` ile, açılış `bundleFromEntry` ile yapılır.

import { clamp, hslToHex, toHex } from "./colorUtils";
import {
  THEME_FAMILIES,
  TONE_LADDER,
  migrateCustomEntry,
  themeToTokens,
  resolveThemeTokens,
  parseCustomSelection,
  themes,
} from "../theme/colors";
import { TONES, baseFromTokens, deriveToneSet, generateToneSet, toneOfTokens } from "./themeStudio";
import { DEFAULT_TONE, completeToneMap } from "../theme/toneModel";

const STYLE = { contrast: "balanced", surfaces: "tinted" };

/** Destedeki ton anahtarlarının hepsi dolu mu? */
export const isBundle = (value) =>
  !!value && typeof value === "object" && TONES.every((tone) => value.tones && value.tones[tone]);

/**
 * Kayıtlı özel tema → deste. Eski merdivenli kayıt önce çevrilir; kayıtlı tonlar
 * olduğu gibi, eksik olanlar varsayılan tondan ("koyu") türetilir — o DEĞİŞMEZ.
 */
export function bundleFromEntry(rawEntry) {
  const entry = migrateCustomEntry(rawEntry);
  const main = resolveThemeTokens(entry?.tones?.[DEFAULT_TONE] || entry?.tokens || {});
  let derived = null;
  const tones = completeToneMap(entry?.tones, (tone) => {
    if (tone === DEFAULT_TONE) return entry?.tokens || main;
    derived = derived || deriveToneSet(main, { at: DEFAULT_TONE });
    return derived[tone];
  });
  return {
    base: entry?.base || baseFromTokens(main),
    accent: toHex(main.accent),
    tones,
  };
}

/** Deste → kaydedilecek özel tema girdisi (`tokens` = varsayılan ton, eski okuyucular için). */
export function entryFromBundle(bundle, { id, name }) {
  return { id, name, ladder: TONE_LADDER, base: bundle.base, tones: bundle.tones, tokens: bundle.tones[DEFAULT_TONE] };
}

/** Hazır tema ailesi (Varsayılan/Mavi/Yeşil) → deste: tonları AYNEN yerleşik temalardır. */
export function bundleFromFamily(familyId) {
  const family = THEME_FAMILIES.find((f) => f.id === familyId) || THEME_FAMILIES[0];
  const tones = Object.fromEntries(TONES.map((tone) => [tone, themeToTokens(family.tones[tone])]));
  return { base: baseFromTokens(tones[DEFAULT_TONE]), accent: toHex(tones[DEFAULT_TONE].accent), tones };
}

/** Tek bir yerleşik temadan (ör. Gece Moru) deste: tema kendi basamağında, diğerleri türetilir. */
export function bundleFromBuiltin(themeKey) {
  const mid = themeToTokens(themeKey);
  return { base: baseFromTokens(mid), accent: toHex(mid.accent), tones: deriveToneSet(mid) };
}

/** Tohum renklerden (ton, doygunluk, vurgu) deste. */
export function bundleFromSeeds(hue, sat, accent, opts = {}) {
  const base = hslToHex(hue, clamp(sat, 0, 100), 46);
  return { base, accent: toHex(accent), tones: generateToneSet(base, accent, { ...STYLE, ...opts }) };
}

/**
 * Hazır temalar. İlk üçü yerleşik ailelerin AYNISI (başlangıç noktası); Gece Moru
 * ve Kızıl Sinema, ayar listesinden buraya taşınan eski hazır temalar; kalanı
 * stüdyonun beş tonluk motoruyla kurulmuş yeni setler.
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
 * @returns {{bundle: object, tone: "bright"|"light"|"mid"|"dark"|"amoled"}}
 */
export function initialBundle({ existing, selectedTheme, customThemes = [] }) {
  const selection = parseCustomSelection(selectedTheme);
  if (existing) {
    const tone = selection && selection.id === existing.id ? selection.tone : DEFAULT_TONE;
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
    return { bundle: bundleFromBuiltin(selectedTheme), tone: toneOfTokens(themeToTokens(selectedTheme)) };
  }
  return { bundle: bundleFromFamily("default"), tone: DEFAULT_TONE };
}
