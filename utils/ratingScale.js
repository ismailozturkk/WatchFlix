// utils/ratingScale.js
//
// Kullanıcı puanının tek kaynağı (saf, RN yok). Bkz. docs/planlama/YARIM_PUAN_10_YILDIZ_PLANI.md
//
// SAKLAMA her zaman 0-10 ölçeğinde. Kullanıcı Ayarlar > Kişiselleştirme'den GÖRÜNÜM ölçeğini seçer:
//   "ten"  (varsayılan) → 10 yıldız, yarım puan: 0.5 … 8.5 … 10 (yıldız = 1 puan)
//   "five"              → 5 yıldız, yarım yıldız = 1 puan: 1 … 10 TAM puan (küsuratsız)
// İki modda da değerlendirme 10 ÜZERİNDENDİR ("9 / 10"); 5'li mod yalnız 5 yıldızlı, küsuratsız
// giriş/gösterimdir — "/5" ölçeği YOK. Kayıtlı puanlar dönüştürülmez: 10'lu modda verilmiş 8.5,
// 5'li modda en yakın tam puana (9) yuvarlanarak gösterilir.

export const RATING_MAX = 10;
export const RATING_STEP = 0.5;
export const RATING_STARS = 10;

export const RATING_SCALES = Object.freeze(["ten", "five"]);
export const DEFAULT_RATING_SCALE = "ten";

const SCALE_SPECS = Object.freeze({
  ten: Object.freeze({ stars: 10, step: 0.5, max: 10 }),
  five: Object.freeze({ stars: 5, step: 1, max: 10 }),
});

export const isRatingScale = (value) => RATING_SCALES.includes(value);

/** { stars, step (0-10 saklama adımı), max (gösterilen tavan — iki modda da 10) } */
export const ratingScaleSpec = (scale) => SCALE_SPECS[isRatingScale(scale) ? scale : DEFAULT_RATING_SCALE];

/**
 * Ham değer → ölçeğin adımına yuvarlanmış 0-10 puan; geçersiz / ≤0 → 0 (puansız).
 * ten: 0.5 adım (8.4 → 8.5) · five: 1 adım (8.5 → 9).
 */
export function normalizeUserRating(value, scale = DEFAULT_RATING_SCALE) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const { step } = ratingScaleSpec(scale);
  const stepped = Math.round(n / step) * step;
  return Math.max(step, Math.min(RATING_MAX, stepped));
}

/** Ondalık ayraç: İngilizce ve Japoncada nokta, diğer uygulama dillerinde virgül. */
export function decimalSeparatorOf(language) {
  const code = String(language || "en").toLowerCase().split(/[-_]/)[0];
  return code === "en" || code === "ja" ? "." : ",";
}

/** 8.5 → "8,5" (tr) / "8.5" (en); 8 → "8"; puansız → null. Ölçekten bağımsız ham biçim. */
export function formatUserRating(value, language = "tr") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return text.replace(".", decimalSeparatorOf(language));
}

/** 0-10 saklanan puan → seçili modda gösterilen değer, 10 üzerinden (ten: 8.5 · five: 8.5 → 9). */
export function ratingInScale(value, scale = DEFAULT_RATING_SCALE) {
  return normalizeUserRating(value, scale);
}

/** Seçili modda etiket (10 üzerinden): ten "8,5" · five "9" (küsuratsız); puansız → null. */
export function formatRatingInScale(value, language = "tr", scale = DEFAULT_RATING_SCALE) {
  return formatUserRating(ratingInScale(value, scale), language);
}
