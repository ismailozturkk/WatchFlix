// utils/lensLoaderMotion.js
//
// Uygulama içi yükleme göstergesinin (components/LensLoader.js) SAF hareket modeli.
// RN importu yok; jest'te doğrudan test edilir (__tests__/lensLoaderMotion.test.js).
//
// İKİ KARADELİK: Lens'in iki dairesi (camgöbeği + kırmızı) birer karadeliktir —
// renkli halka (yığılma diski), koyu çekirdek (olay ufku), soluk hale.
//
//   x (0..1, CYCLE_MS'de bir tur, sonsuz)
//   │ 0,00  uzakta, yavaş: camgöbeği üstte, kırmızı altta, ağır ağır dönerler
//   │ 0,00–0,50  yavaşça yaklaşırlar, giderek hızlanırlar (dönüş de hızlanır)
//   │ ~0,50  hızla iç içe geçerler: gelgit gerilmesi + kütleçekim dalgası halkası
//   │ 0,50–1,00  öbür tarafa geçip yavaşlayarak uzaklaşırlar
//   │ 1,00  yer değiştirmiş + yarım tur dönmüş = 0,00'daki pozun AYNISI (dikiş yok)
//
// Konum işaretli tek sayıdır: p ∈ [-1, 1] (camgöbeği +p, kırmızı -p, eksen boyunca).
// Dönüş Kepler'e benzer: açısal hız ~ 1 / (p² + c) — yakınken çok hızlı, uzakta ağır.
// Her şey tek doğrusal sürücüden (x) native interpolate ile türer; eğriler tabloya
// örneklenir (native sürücü yalnız doğrusal parçaları bilir).
import { LENS_COLORS as COLORS, clamp01, ease } from "./splashMotion";

export { LENS_COLORS } from "./splashMotion";

// Aşağı çekip yenileme (RefreshControl) yerel bileşendir, içine Lens çizilemez.
// Android spinner'ı `colors` dizisinde döner: Lens'in iki rengi. (iOS tintColor tek
// renk alır; orada ekranın kendi rengi kalır.)
export const LENS_REFRESH_COLORS = Object.freeze([COLORS.cyan, COLORS.red]);

export const CYCLE_MS = 2200;
// Hareketi Azalt: işaret yerinde durur, yalnız saydamlık nefes alır.
export const BREATHE_MS = 1400;
export const BREATHE_MIN = 0.45;

export const BASE_ANGLE = -90; // camgöbeği üstte (RN'de pozitif açı saat yönü)
// Bir döngüde toplam dönüş: 180 + 360k olmalı (yer değiştirme + yarım tur = aynı poz).
export const TOTAL_TURN = 540;
// Açısal hız: OMEGA_BASE + 1 / (p² + OMEGA_SOFT). Uzakta ~1,9, iç içeyken ~17,7.
const OMEGA_BASE = 1;
const OMEGA_SOFT = 0.06;

// Geometri — kutu kenarına göre oran (kutu = px × px, merkez 0).
export const GEOM = Object.freeze({
  amp: 0.23, // p = ±1'de merkezin kutu merkezinden uzaklığı
  halo: 0.26, // soluk hale yarıçapı
  ring: 0.19, // renkli halka (yığılma diski) yarıçapı
  core: 0.1, // koyu çekirdek (olay ufku) yarıçapı
  wave: 0.48, // kütleçekim dalgasının en geniş yarıçapı
});
// Küçük boy (düğme/satır içi): hale yok, gövdeler iri — 22 px'te de seçilsin.
export const GEOM_COMPACT = Object.freeze({ amp: 0.25, halo: 0, ring: 0.23, core: 0.115, wave: 0.48 });
export const HALO_OPACITY = 0.26;
export const TIDE_ALONG = 0.22; // iç içeyken eksen boyunca gerilme
export const TIDE_ACROSS = 0.1; // enine basılma

// Kütleçekim dalgası: geçişten hemen sonra merkezden yayılan halka.
export const WAVE = Object.freeze({ start: 0.49, end: 0.8, from: 0.2, peak: 0.7 });

// ActivityIndicator adları + kendi kademelerimiz. Kullanım yerine göre:
//   small  24 — düğme içi, satır içi (metin/simge yanında), arama alanı
//   medium 36 — bölüm / sayfa durumu, liste sonu, kart içi
//   large  52 — modal / sayfa (sheet) gövdesi, büyük boş durum
//   screen 68 — tüm ekranı kaplayan ilk yükleme
//   fill      — kabını ölçer (görsel/oynatıcı/avatar üstü kaplama): kısa kenarın ~%30'u
// small dışındakiler ekranın kısa kenarıyla ölçeklenir (büyük telefon/tablette
// büyür, küçük telefonda biraz küçülür) — bkz. screenScaleFor.
export const LOADER_SIZES = Object.freeze({ small: 24, medium: 36, large: 52, screen: 68 });
export const FILL = Object.freeze({ ratio: 0.3, min: 28, max: 96, minBox: 44 });
const REF_SHORT_SIDE = 390; // iPhone 14/15 kısa kenarı

/** Ekran ölçeği: kısa kenar / 390, [0,9 – 1,5]. */
export function screenScaleFor(width, height) {
  const short = Math.min(Number(width) || 0, Number(height) || 0);
  if (!(short > 0)) return 1;
  return Math.max(0.9, Math.min(1.5, short / REF_SHORT_SIDE));
}

/**
 * Ad / sayı → px. Boy verilmezse: mono (dolu düğme içi) → small, brand → medium.
 * "fill" burada medium'a düşer (ölçülene kadar); asıl boyu fillSizeFor verir.
 * Sayı verilirse ölçeklenmez (çağıran kendi kutusuna göre seçmiştir).
 */
export function resolveLoaderSize(size, tone = "brand", scale = 1) {
  if (typeof size === "number" && Number.isFinite(size) && size > 0) return size;
  const key = LOADER_SIZES[size] ? size : tone === "mono" ? "small" : "medium";
  const base = LOADER_SIZES[key];
  // small düğme/satır içinde: küçük ekranda küçülmez, büyükte en çok %20 büyür.
  const k = key === "small" ? Math.max(1, Math.min(1.2, scale)) : scale;
  return Math.round(base * k);
}

/** "fill": kabın kısa kenarına göre boy; kap ölçülemeyecek kadar küçükse null (medium kullan). */
export function fillSizeFor(width, height) {
  const short = Math.min(Number(width) || 0, Number(height) || 0);
  if (!(short >= FILL.minBox)) return null;
  return Math.round(Math.max(FILL.min, Math.min(FILL.max, short * FILL.ratio)));
}

// Bu boyun altında kompakt geometri: hale çizilmez (bulanık leke gibi kalıyor).
export const HALO_MIN_SIZE = 26;
export const geomFor = (px) => (px < HALO_MIN_SIZE ? GEOM_COMPACT : GEOM);

// Yaklaşma eğrisi: kübik (yavaş başlar, ortada çok hızlı) + sinüs (uçlarda tamamen
// durmasın) karışımı.
const approach = (x) => 0.6 * ease.inOut(x) + 0.4 * (0.5 - 0.5 * Math.cos(Math.PI * x));

/** İşaretli konum: 1 = camgöbeği tam uzakta (üstte), -1 = öbür tarafta. */
export const posAt = (x) => 1 - 2 * approach(clamp01(x));

/** Yakınlık: 0 uzak, 1 tam iç içe. */
export const closeAt = (x) => 1 - Math.abs(posAt(x));

// Açı: ω(x) = OMEGA_BASE + 1/(p²+c) integrali, TOTAL_TURN'e ölçeklenir. Bir kez
// sayısal integral (yamuk), sonra doğrusal ara değer.
const ANGLE_STEPS = 2000;
const ANGLE_TABLE = (() => {
  const omega = (x) => OMEGA_BASE + 1 / (posAt(x) ** 2 + OMEGA_SOFT);
  const acc = [0];
  for (let i = 1; i <= ANGLE_STEPS; i += 1) {
    const a = (i - 1) / ANGLE_STEPS;
    const b = i / ANGLE_STEPS;
    acc.push(acc[i - 1] + ((omega(a) + omega(b)) / 2) * (b - a));
  }
  const total = acc[ANGLE_STEPS];
  return acc.map((v) => (v / total) * TOTAL_TURN);
})();

/** Eksenin açısı (derece). 0'da BASE_ANGLE, 1'de BASE_ANGLE + TOTAL_TURN. */
export function angleAt(x) {
  const f = clamp01(x) * ANGLE_STEPS;
  const i = Math.min(ANGLE_STEPS - 1, Math.floor(f));
  const t = f - i;
  return BASE_ANGLE + ANGLE_TABLE[i] + (ANGLE_TABLE[i + 1] - ANGLE_TABLE[i]) * t;
}

/** Gelgit: iç içeyken eksen boyunca gerilir, enine basılır. [boyunca, enine] */
export function tideAt(x) {
  const k = closeAt(x) ** 4;
  return [1 + TIDE_ALONG * k, 1 - TIDE_ACROSS * k];
}

/** Kütleçekim dalgası: [ölçek (0..1 → GEOM.wave), saydamlık]. */
export function waveAt(x) {
  if (x < WAVE.start || x > WAVE.end) return [WAVE.from, 0];
  const t = (x - WAVE.start) / (WAVE.end - WAVE.start);
  const grow = ease.out(t);
  const fadeIn = clamp01(t / 0.12);
  return [WAVE.from + (1 - WAVE.from) * grow, WAVE.peak * fadeIn * (1 - t) ** 1.4];
}

/** Bir karadeliğin kutu merkezinden en uzak noktası (kutu oranı): taşma bekçisi. */
export function reachAt(x, geom = GEOM) {
  const [along] = tideAt(x);
  return Math.abs(posAt(x)) * geom.amp + Math.max(geom.halo, geom.ring) * along;
}

// Hareketi Azalt pozu: dikey, yarı iç içe (Lens işaretine benzer).
export const STILL_POS = 0.55;

// Tablo örneklemesinde kırılma anları (dalga sınırları) + geçiş çevresi sık ızgara.
const KEY_XS = Object.freeze([WAVE.start, WAVE.end, 0.5]);

/**
 * Döngü tablosu: x ∈ [0,1] örneklenir, `map` ile dönüştürülür. Geçiş anı çok hızlı
 * olduğundan 0,38–0,62 arası ayrıca sık örneklenir; yoksa doğrusal ara değer köşe yapar.
 */
export function sampleLoop(fn, { steps = 120, dense = 60, map = (v) => v } = {}) {
  const xs = new Set();
  const add = (x) => xs.add(Math.round(x * 1e6) / 1e6);
  for (let i = 0; i <= steps; i += 1) add(i / steps);
  for (let i = 0; i <= dense; i += 1) add(0.38 + (0.24 * i) / dense);
  KEY_XS.forEach(add);
  const inputRange = [...xs].sort((a, b) => a - b);
  const outputRange = inputRange.map((x) => map(fn(x)));
  return { inputRange, outputRange };
}

/** Hareketi Azalt nefesi: 1 → BREATHE_MIN → 1. */
export const breatheAt = (x) => BREATHE_MIN + (1 - BREATHE_MIN) * (0.5 + 0.5 * Math.cos(2 * Math.PI * x));
