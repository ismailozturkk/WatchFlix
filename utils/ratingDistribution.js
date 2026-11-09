// utils/ratingDistribution.js
//
// Profildeki "Puan dağılımı" grafiğinin saf çekirdeği (UI yok, test edilebilir).
//
// Kaynak: Lists/{uid}.activityIndex.ratings → { "movie_550": 8, "tv_1399": 9, … }
// Ölçek 0-10 (ratingsService: 5 yıldız × yarım adım). Grafikte 10 kademe var:
// kademe k (1..10) = k/2 yıldız → 1 = ½★, 2 = ★, … 10 = ★★★★★.
// Ek Firestore okuması YOK: kendi profilde ListStatusContext, arkadaş profilinde
// zaten dinlenen Lists/{friendUid} belgesi besler.

export const RATING_STEPS = 10;

/** Ham değeri 1..10 kademesine çevirir; geçersiz/0/negatif → null (sayılmaz). */
export function ratingStep(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(RATING_STEPS, Math.max(1, Math.round(n)));
}

/**
 * @param {Record<string, number|null>|null|undefined} ratings
 * @returns {{
 *   counts: number[],   // uzunluk 10; counts[i] = (i+1). kademedeki oy sayısı
 *   total: number,
 *   max: number,        // en kalabalık kademenin sayısı (0 → boş)
 *   average: number|null, // 0-10 ölçeğinde ortalama (kademelerden)
 *   modeStep: number|null // en kalabalık kademe (1..10); eşitlikte YÜKSEK olan
 * }}
 */
export function buildRatingDistribution(ratings) {
  const counts = new Array(RATING_STEPS).fill(0);
  let total = 0;
  let sum = 0;
  if (ratings && typeof ratings === "object") {
    for (const value of Object.values(ratings)) {
      const step = ratingStep(value);
      if (step == null) continue;
      counts[step - 1] += 1;
      total += 1;
      sum += step;
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

/** Kademe → yıldız sayısı (0.5 adımlı): 7 → 3.5 */
export const stepToStars = (step) => step / 2;

/** Ortalama (0-10) → "3,6" / "3.6" gibi 5 yıldız ölçeğinde tek ondalık. */
export function formatStarAverage(average, language = "tr") {
  if (average == null) return "–";
  const stars = Math.round((average / 2) * 10) / 10;
  const code = String(language || "en").toLowerCase().split(/[-_]/)[0];
  const text = stars.toFixed(1);
  return code === "en" ? text : text.replace(".", ",");
}
