// utils/posterCorners.js
//
// Poster köşe yuvarlaklığının TEK kaynağı: köşeliden yuvarlağa beş kademe. Her alan
// kendi ölçeğinde, çünkü poster genişlikleri farklı:
//   grid → Listeler + "Tümünü Gör" ızgarası (3/4 sütun, ~80–115 pt genişlik)
//   rail → Film & Dizi ana ekranı rafları (~130–155 pt genişlik)
// Eski üç kademenin değerleri (grid 2/10/20, rail 4/15/24) korunur: kayıtlı
// seçimler, paylaşılan/yedeklenen ayarlar göç gerektirmeden geçerli kalır.
//
// Saf modül (RN/i18n yok): registry doğrulaması da buradan okur. Etiketler
// çağıran yerde çözülür (Ayarlar > Poster görünümü, ListSortFilterSheet kopyası).

export const POSTER_CORNER_LEVELS = Object.freeze(["sharp", "subtle", "normal", "soft", "round"]);

export const POSTER_CORNER_SCALES = Object.freeze({
  grid: Object.freeze([2, 6, 10, 15, 20]),
  rail: Object.freeze([4, 9, 15, 24, 32]),
});

const NORMAL_INDEX = POSTER_CORNER_LEVELS.indexOf("normal");

/** Alanın beş değeri (bilinmeyen alan → grid). */
export function posterCornerValues(scale) {
  return POSTER_CORNER_SCALES[scale] || POSTER_CORNER_SCALES.grid;
}

/** Değere en yakın kademenin sırası (0–4); sayı değilse "normal". */
export function posterCornerIndex(scale, value) {
  const n = Number(value);
  const values = posterCornerValues(scale);
  if (value == null || !Number.isFinite(n)) return NORMAL_INDEX;
  let best = NORMAL_INDEX;
  values.forEach((v, i) => {
    if (Math.abs(v - n) < Math.abs(values[best] - n)) best = i;
  });
  return best;
}

/** Kademe kimliği ("sharp" … "round"). */
export function posterCornerLevel(scale, value) {
  return POSTER_CORNER_LEVELS[posterCornerIndex(scale, value)];
}

/** Aynı kademenin başka alandaki değeri (ör. "tüm alanlara uygula"). */
export function posterCornerValueAt(scale, index) {
  const values = posterCornerValues(scale);
  const i = Math.min(values.length - 1, Math.max(0, Math.round(Number(index) || 0)));
  return values[i];
}

// "Trendler" vitrin kartı raf posterinden ~1.5 kat geniş; köşesi raf ayarını izler.
// Oran, varsayılan raf köşesi 15'te eski sabit 25'i verecek şekilde seçildi.
const TREND_RADIUS_RATIO = 25 / 15;

/** Trendler kartının köşesi: ana ekran raf köşesinden (railPosterRadius) türetilir. */
export function trendPosterRadius(railRadius) {
  const n = Number(railRadius);
  return Math.round((Number.isFinite(n) ? n : 15) * TREND_RADIUS_RATIO);
}

// Film/dizi detay sayfası posterleri (ana poster ~110 pt, "Önerilen"/"Seri" rafları
// ~0.38 ekran) raf ayarını izler; oran varsayılan 15'te eski sabit 14'ü verir.
const DETAIL_RADIUS_RATIO = 14 / 15;

/** Detay sayfası posterinin köşesi: ana ekran raf köşesinden (railPosterRadius) türetilir. */
export function detailPosterRadius(railRadius) {
  const n = Number(railRadius);
  return Math.round((Number.isFinite(n) ? n : 15) * DETAIL_RADIUS_RATIO);
}

// Göreli alanlar (Eğlence, Kütüphane): her yüzeyin kendi köşesi var (40 pt'lik küçük
// afişte 4, 200 pt'lik oyun afişinde 18…). Tek bir sayı hepsine uymaz; kayıtlı değer
// grid ölçeğindedir ve ÇARPAN olarak okunur: Normal (10) = ×1 → her yüzey bugünkü
// köşesinde kalır; Köşeli ×0.2 … Yuvarlak ×2. Hook: hooks/usePosterCorner.js.
export const RELATIVE_POSTER_AREAS = Object.freeze(["fun", "library"]);

/** Kayıtlı değer (2/6/10/15/20) → çarpan (0.2 … 2); geçersizse ×1. */
export function posterCornerFactor(value) {
  const n = Number(value);
  return value != null && Number.isFinite(n) && n > 0 ? n / 10 : 1;
}

/** Yüzeyin taban köşesini seçili kademeye göre ölçekler (yarım noktaya yuvarlanır). */
export function scalePosterCorner(base, value) {
  return Math.round(base * posterCornerFactor(value) * 2) / 2;
}

/** Sıradaki kademe; en yuvarlaktan sonra köşeliye döner (tek düğmeli seçici). */
export function nextPosterCorner(scale, value) {
  const values = posterCornerValues(scale);
  return values[(posterCornerIndex(scale, value) + 1) % values.length];
}
