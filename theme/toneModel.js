// theme/toneModel.js
//
// Tema TONLARININ tek kaynağı. Bir renk ailesi (hazır ya da özel tema) artık
// beş tondur; ekranlar, motor, yedek ve paylaşım bu listeyi buradan okur —
// hiçbir yerde ["light", "mid", "dark"] gibi elle yazılmış liste kalmamalı.
//
// Ton merdiveni (zemin algısal açıklığı L*, 12 Kas): eşit basamaklara yakın.
//   bright → çok açık  (~97; beyaza yakın zemin, beyaz kartlar)
//   light  → açık      (~76; gümüş / buz mavisi / adaçayı zemin, koyu yazı)
//   mid    → orta      (~27; alacakaranlık — açık yazının başladığı ilk basamak)
//   dark   → koyu      (~11; gri / lacivert — VARSAYILAN ton)
//   amoled → AMOLED    (0; saf siyah zemin, renk tonu kartlarda)
// Açık→orta arası en büyük basamaktır: yazı orada siyahtan beyaza döner ve orta
// ton, vurgu + beyaz düğme yazısı okunur kalsın diye L* ~30 üstüne çıkamaz.
//
// Saf modül: React/Native ya da başka tema modülü içe aktarmaz (döngüsel bağımlılık yok).

export const TONES = Object.freeze(["bright", "light", "mid", "dark", "amoled"]);

/** 19 Eki'deki ilk üç tonlu model (eski merdiven: açık ~94 · orta ~13 · koyu ~4). */
export const LEGACY_TONES = Object.freeze(["light", "mid", "dark"]);

// Varsayılan ton "koyu": uygulama varsayılanı Lacivert bu basamaktadır ve eski
// kayıtların "orta" tonu (L~13) yeni merdivende buraya düşer — "custom:<id>"
// (eksiz) seçimi bu yüzden göçsüz aynı görünür.
export const DEFAULT_TONE = "dark";

export const isTone = (value) => typeof value === "string" && TONES.includes(value);

/** Tonun kutupluluğu: zemini açık mı koyu mu. */
export const TONE_POLARITY = Object.freeze({
  bright: "light",
  light: "light",
  mid: "dark",
  dark: "dark",
  amoled: "dark",
});

/** Ayarlar ekranındaki çeviri anahtarları (translations/*.json). */
export const TONE_LABEL_KEYS = Object.freeze({
  bright: "themeToneBright",
  light: "themeToneLight",
  mid: "themeToneMid",
  dark: "themeToneDark",
  amoled: "themeToneAmoled",
});

export const TONE_FALLBACKS = Object.freeze({
  bright: "Çok açık",
  light: "Açık",
  mid: "Orta",
  dark: "Koyu",
  amoled: "AMOLED",
});

/** `t` (useLanguage çeviri tablosu) + ton → görünen ad. */
export const toneLabel = (t, tone) =>
  (t && t[TONE_LABEL_KEYS[tone]]) || TONE_FALLBACKS[tone] || String(tone || "");

/** Tüm tonlar için { ton: ad } haritası. */
export const toneLabelMap = (t) => Object.fromEntries(TONES.map((tone) => [tone, toneLabel(t, tone)]));

/** Seçim anahtarındaki ton eki için düzenli ifade parçası: "bright|light|mid|dark|amoled". */
export const TONE_PATTERN = TONES.join("|");

/**
 * Eksik tonları `fill(tone)` ile tamamlayarak TONES sırasında tam bir harita
 * döner. Eski üç tonlu kayıtlar böyle beş tona genişler; var olan ton değişmez.
 */
export function completeToneMap(partial, fill) {
  const out = {};
  for (const tone of TONES) {
    const value = partial && partial[tone];
    out[tone] = value && typeof value === "object" ? value : fill(tone);
  }
  return out;
}
