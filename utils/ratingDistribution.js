// utils/ratingDistribution.js
//
// Profildeki "Puan dağılımı" grafiğinin saf çekirdeği (UI yok, test edilebilir).
//
// Kaynak: Lists/{uid}.activityIndex.ratings → { "movie_550": 8.5, "tv_1399": 9, … } (0-10)
// Kademeler kullanıcının puan ölçeğine göre (utils/ratingScale, Ayarlar > Kişiselleştirme):
//   ten  → 20 kademe: k = k/2 puan = k/2 yıldız → 1 = ½★, 17 = 8½★, 20 = 10★
//   five → 10 kademe: k = k puan (küsuratsız, 10 üzerinden) → 1 … 10 (8.5 → 9. kademe)
// Ek Firestore okuması YOK: kendi profilde ListStatusContext, arkadaş profilinde
// zaten dinlenen Lists/{friendUid} belgesi besler.

import {
  DEFAULT_RATING_SCALE,
  RATING_MAX,
  decimalSeparatorOf,
  formatUserRating,
  ratingScaleSpec,
} from "./ratingScale";

/** 10 yıldızlı (varsayılan) ölçekteki kademe sayısı. */
export const RATING_STEPS = 20;

/** Ölçeğin kademe sayısı: ten 20, five 10. */
export const ratingStepsOf = (scale = DEFAULT_RATING_SCALE) => RATING_MAX / ratingScaleSpec(scale).step;

/** Ham değeri 1..N kademesine çevirir; geçersiz/0/negatif → null (sayılmaz). */
export function ratingStep(value, scale = DEFAULT_RATING_SCALE) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const steps = ratingStepsOf(scale);
  return Math.min(steps, Math.max(1, Math.round(n / ratingScaleSpec(scale).step)));
}

/**
 * @param {Record<string, number|null>|null|undefined} ratings
 * @returns {{
 *   counts: number[],   // uzunluk ratingStepsOf(scale); counts[i] = (i+1). kademedeki oy sayısı
 *   total: number,
 *   max: number,        // en kalabalık kademenin sayısı (0 → boş)
 *   average: number|null, // 0-10 ölçeğinde ortalama (ham puanlardan, 10'a kırpılmış)
 *   modeStep: number|null // en kalabalık kademe (1..N); eşitlikte YÜKSEK olan
 * }}
 */
export function buildRatingDistribution(ratings, scale = DEFAULT_RATING_SCALE) {
  const counts = new Array(ratingStepsOf(scale)).fill(0);
  let total = 0;
  let sum = 0;
  if (ratings && typeof ratings === "object") {
    for (const value of Object.values(ratings)) {
      const step = ratingStep(value, scale);
      if (step == null) continue;
      counts[step - 1] += 1;
      total += 1;
      sum += Math.min(RATING_MAX, Number(value));
    }
  }
  let max = 0;
  let modeStep = null;
  counts.forEach((count, index) => {
    if (count > 0 && count >= max) {
      max = count;
      modeStep = index + 1;
    }
  });
  return {
    counts,
    total,
    max,
    average: total > 0 ? sum / total : null,
    modeStep,
  };
}

/** Kademe → puan (10 üzerinden): ten 17 → 8.5 · five 9 → 9. */
export const stepToStars = (step, scale = DEFAULT_RATING_SCALE) => step * ratingScaleSpec(scale).step;

/** Kademe etiketi (10 üzerinden): ten 17 → "8,5", 16 → "8" · five 9 → "9". */
export const formatStep = (step, language = "tr", scale = DEFAULT_RATING_SCALE) =>
  formatUserRating(stepToStars(step, scale), language);

/** Ortalama (0-10) → 10 üzerinden tek ondalık ("7,4"); iki modda da aynı ölçek. */
export function formatStarAverage(average, language = "tr") {
  if (average == null) return "–";
  const stars = Math.round(average * 10) / 10;
  return stars.toFixed(1).replace(".", decimalSeparatorOf(language));
}
