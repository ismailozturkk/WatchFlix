// utils/lensLoaderMotion.js
//
// Uygulama içi yükleme göstergesinin (components/LensLoader.js) SAF hareket modeli.
// RN importu yok; jest'te doğrudan test edilir (__tests__/lensLoaderMotion.test.js).
//
// Gösterge, açılış animasyonunun (SplashLensIntro) tek nefeslik döngüsüdür:
//
//   x (0..1, CYCLE_MS'de bir tur, sonsuz)
//   │ 0,00–0,10  Lens işareti: camgöbeği üstte, kırmızı altta, kesişimde göz + bebek
//   │ 0,10–0,30  göz kırpar gibi daireler ayrılır ve küçülür; bebek söner
//   │ 0,10–0,86  iki daire birbirinin çevresinde tam bir tur atar (yavaş-hızlı-yavaş)
//   │ 0,64–0,90  yeniden yaklaşıp yayla birleşir, göz açılır
//   │ 0,84–1,00  bebek yaylanarak belirir; döngü işaretle biter = işaretle başlar
//
// Her şey tek doğrusal sürücüden (x) native interpolate ile türer; eğriler tabloya
// örneklenir (native sürücü yalnız doğrusal parçaları bilir). Kutunun çapı işaretin
// boyudur (2r + d): daireler ayrıldığında küçüldükleri için dönerken de kutudan
// taşmazlar (test bekçisi var).
import { LENS, LENS_COLORS as COLORS, EYE_LENGTH, EYE_WIDTH, MARK_HEIGHT, clamp01, ease } from "./splashMotion";

export { LENS_COLORS, LENS, EYE_LENGTH, EYE_WIDTH, MARK_HEIGHT } from "./splashMotion";

// Aşağı çekip yenileme (RefreshControl) yerel bileşendir, içine Lens çizilemez.
// Android spinner'ı `colors` dizisinde döner: Lens'in iki rengi. (iOS tintColor tek
// renk alır; orada ekranın kendi rengi kalır.)
export const LENS_REFRESH_COLORS = Object.freeze([COLORS.cyan, COLORS.red]);

export const CYCLE_MS = 1500;
// Hareketi Azalt: işaret yerinde durur, yalnız saydamlık nefes alır.
export const BREATHE_MS = 1400;
export const BREATHE_MIN = 0.45;

// Ayrık evrede dairelerin ölçeği ve merkezler arası (tasarım birimi, 512 ızgara).
export const ORBIT_SCALE = 0.7;
export const ORBIT_SEP = 196;
export const BASE_ANGLE = -90; // camgöbeği üstte (RN'de pozitif açı saat yönü)

export const PHASE = Object.freeze({
  split: 0.1,
  splitEnd: 0.3,
  spinEnd: 0.86,
  merge: 0.64,
  mergeEnd: 0.9,
  pupilOut: 0.18,
  pupilIn: 0.84,
});

// ActivityIndicator ile aynı adlandırma: "small" 20, "large" 36 → Lens'te iri kademe
// biraz büyük (işaretin göz bebeği küçük boyda seçilebilsin diye).
export const LOADER_SIZES = Object.freeze({ small: 20, large: 40 });
// Parıltı (bebekteki küçük mürekkep nokta) bu boyun altında çizilmez (≈1 dp kalıyor).
export const GLINT_MIN_SIZE = 28;

export function resolveLoaderSize(size) {
  if (typeof size === "number" && Number.isFinite(size) && size > 0) return size;
  return LOADER_SIZES[size] ?? LOADER_SIZES.small;
}

// "split" evresindeki ilerleme (0 → ayrık) ve "merge" evresindeki ilerleme (0 → birleşik).
const splitAt = (x) => ease.inOut(clamp01((x - PHASE.split) / (PHASE.splitEnd - PHASE.split)));
const mergeAt = (x) => ease.spring(clamp01((x - PHASE.merge) / (PHASE.mergeEnd - PHASE.merge)));
/** 0 = Lens işareti, 1 = tam ayrık (döngü boyunca). */
export const apartAt = (x) => (x < PHASE.merge ? splitAt(x) : 1 - mergeAt(x));

/** Merkezler arası (tasarım birimi). Yay aşımında d'nin biraz altına iner (göz "tık" diye açılır). */
export const sepAt = (x) => LENS.d + (ORBIT_SEP - LENS.d) * apartAt(x);
/** Daire ölçeği (1 = işaretteki boy). */
export const discScaleAt = (x) => 1 + (ORBIT_SCALE - 1) * clamp01(apartAt(x));
/** Eksenin açısı (derece): işaretten işarete tam bir tur. */
export const angleAt = (x) =>
  BASE_ANGLE + 360 * ease.inOut(clamp01((x - PHASE.split) / (PHASE.spinEnd - PHASE.split)));

/**
 * Eşit iki dairenin (yarıçap R, merkezler arası S) kesişimi, son göze göre ölçek:
 * [eksen boyunca, enine]. Kesişim yoksa ikisi de 0.
 */
export function eyeScaleFor(sep, discScale = 1) {
  const R = LENS.r * discScale;
  const along = Math.max(0, 2 * R - sep) / EYE_LENGTH;
  const half = sep / 2;
  const across = half >= R ? 0 : (2 * Math.sqrt(R * R - half * half)) / EYE_WIDTH;
  return [along, across];
}
export const eyeAt = (x) => eyeScaleFor(sepAt(x), discScaleAt(x));

/** Göz bebeği ölçeği: kırpışta hızla söner, birleşmenin sonunda yaylanarak döner. */
export function pupilAt(x) {
  if (x < PHASE.split) return 1;
  if (x < PHASE.pupilOut) return 1 - ease.out(clamp01((x - PHASE.split) / (PHASE.pupilOut - PHASE.split)));
  if (x < PHASE.pupilIn) return 0;
  return ease.spring(clamp01((x - PHASE.pupilIn) / (1 - PHASE.pupilIn)));
}

/** Bir dairenin kutu merkezinden uzaklığı + yarıçapı (tasarım birimi): kutuya sığma bekçisi. */
export const reachAt = (x) => sepAt(x) / 2 + LENS.r * discScaleAt(x);
export const BOX_UNITS = MARK_HEIGHT; // 384

/**
 * Döngü tablosu: x ∈ [0,1] örneklenir, `map` ile dönüştürülür. Kırılma anları
 * (evre sınırları) ızgaraya eklenir; yoksa doğrusal ara değer yay aşımını kaçırır.
 */
export function sampleLoop(fn, { steps = 90, map = (v) => v } = {}) {
  const xs = new Set();
  for (let i = 0; i <= steps; i += 1) xs.add(Math.round((i / steps) * 1e6) / 1e6);
  Object.values(PHASE).forEach((x) => xs.add(x));
  const inputRange = [...xs].sort((a, b) => a - b);
  const outputRange = inputRange.map((x) => map(fn(x)));
  return { inputRange, outputRange };
}

/** Hareketi Azalt nefesi: 1 → BREATHE_MIN → 1. */
export const breatheAt = (x) => BREATHE_MIN + (1 - BREATHE_MIN) * (0.5 + 0.5 * Math.cos(2 * Math.PI * x));
