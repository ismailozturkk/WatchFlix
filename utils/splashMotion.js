// utils/splashMotion.js
//
// Açılış ekranının (components/SplashPosterWave.js) SAF hareket modeli: süreler,
// halka geometrisi ve native sürücüye verilecek interpolate tabloları. RN
// import'u yok → jest'te doğrudan test edilir (bkz. __tests__/splashMotion.test.js).
// Hangi cihazda/modda hangi hareketin ve kaç posterin çalışacağı (kalite kademeleri,
// görünürlük kırpması) utils/splashPlan.js'te.
//
// ZAMAN ÇİZELGESİ (mount anından, ms)
//
//   0 ─────────────────────────────────────────────── MIN_VISIBLE_MS ──▶ hazırsa çıkış
//   │ zemin: yerel splash grisi → tema rengi         [0 … 360]
//   │ ışıma (logo renklerinde) belirir + nefes alır   [0 … 700], sonra döngü
//   │ logo: ilk karede yerel splash'le AYNI; 1 kez nabız [110 … 450]
//   │ halka 0 → 1 → 2 (→ 3): merkezden dışa çiçeklenir [72 … ~780], 81 ms arayla
//   │ dalga (Meksika dalgası) döngüsü + halkaların YAVAŞLAYARAK duran yörüngesi
//   └ çıkış (EXIT_MS): logo/ışıma/halkalar dışa süzülüp solar, zemin açılır
//
// Neden hepsi interpolate: tüm hareket tek bir doğrusal [0,1] sürücüden
// MATEMATİKSEL türer. Açılışta JS thread'i navigator mount'u, cache parse'ı
// yüzünden bloklansa da animasyon native tarafta akar; setTimeout/sequence tabanlı
// bir kurgu bu pencerede takılırdı. Easing, interpolate'in `easing` seçeneğiyle
// DEĞİL tabloya örneklenerek uygulanır (native sürücü yalnız doğrusal parçaları
// bilir).

// ── Süreler ──────────────────────────────────────────────────────────────────
export const INTRO_MS = 900;
export const EXIT_MS = 600;
// Giriş bitmeden çıkışa geçmek animasyonu yarıda keser; veri çok hızlı gelse bile
// splash en az bu kadar görünür. Veri geç gelirse zaten APP_READY'ye kadar kalır —
// bu yalnız "her şey hazırken" ödenen tabandır.
export const MIN_VISIBLE_MS = 800;
// Güvenlik ağı: APP_READY hiç gelmezse bu sürede zorla çıkış başlar.
export const FALLBACK_EXIT_MS = 10000;
// Çıkış animasyonunun "bitti" haberi (native → JS) kaybolursa overlay sonsuza
// kadar ekranda kalırdı; bu pay geçince zorla sökülür.
export const EXIT_GUARD_MS = 1200;

export const WAVE_PERIOD_MS = 2800;
export const BREATH_MS = 3200;
export const GLOW_SPIN_MS = 16000;
// Yörünge sonsuz DÖNMEZ: ORBIT_MS içinde ORBIT_SWEEP_DEG kadar süzülüp durur.
// (a) Görünürlük kırpması bu açıya göre kesin hesaplanır — sonsuz dönüşte
// ekran dışındaki posterlerin hepsi lazım olurdu. (b) Uzun süren bir açılışta
// bile hareket kendiliğinden sakinleşir, sonsuza dek iş yapmaz.
export const ORBIT_MS = 7000;
export const ORBIT_SWEEP_DEG = 26;

// Yerel (native) splash'in zemin rengi — app.json > expo-splash-screen
// backgroundColor ile AYNI olmak zorunda (bkz. __tests__/splashMotion.test.js).
// JS splash bu renkle başlar, sonra tema rengine geçer: ilk kare yerel splash'ten
// ayırt edilemez, açık temada "karanlıktan aydınlığa" sert bir parlama olmaz.
export const NATIVE_SPLASH_BG = "#1E1E1E";

// ── Geometri ─────────────────────────────────────────────────────────────────
// Logo kutusu: adaptive foreground PNG'nin (1024 px, kendi güvenli-alan dolgusu
// var; görünür "S" ~%37 genişlik) çizildiği kare. Android 12+ sistem splash'i bu
// simgeyi 288 dp'lik kareye oturtur; iOS'ta app.json'daki `ios.imageWidth` bu
// değere eşitlenir → iki platformda da yerel splash ile JS splash'te "S" AYNI
// boyutta ve el değiştirme sıçramasız olur.
export const LOGO_SIZE = 288;

export const TILE_W = 78;
export const TILE_H = 117;
export const FIRST_RING_RADIUS = 150; // logo boşluğu → ilk halkanın merkezi
export const RING_STEP = TILE_H + 6; // halkalar radyal olarak neredeyse bitişik
export const MAX_RING_COUNT = 4; // büyük ekranlarda (tablet) dördüncü halka da gelir
export const TANGENTIAL_GAP = 4; // aynı halkadaki posterler neredeyse bitişik
// Halkanın iç kenarı köşe uzaklığının bu kesrini aşıyorsa halka ekrana yeterince
// girmiyor sayılır ve üretilmez.
const CORNER_REACH = 0.97;

// Işıma görseli (assets/splash-glow.png, scripts/generate-splash-glow.cjs ile
// üretilir; SVG degrade DEĞİL — hazır bitmap, açılışta çizim/ayrıştırma işi yok)
// bu kareye gerilir.
export const GLOW_SIZE = 380;

// ── Easing (saf; RN Easing'e bağımlı değil) ──────────────────────────────────
export const ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  // Hafif aşımlı varış: "çiçeklenme" hissi. s = aşım miktarı (1.2 ≈ %5 taşma).
  outBack: (t, s = 1.2) => {
    const c3 = s + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
};

/**
 * Easing'i [from,to] giriş aralığında örnekleyip interpolate tablosuna çevirir.
 * Sürücü aralığın dışında kenar değerde kalır (çağıran `extrapolate: "clamp"`
 * kullanmalı).
 */
export function sampleCurve({ from = 0, to = 1, a, b, easing = ease.linear, samples = 14 }) {
  const inputRange = [];
  const outputRange = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    inputRange.push(from + (to - from) * t);
    outputRange.push(a + (b - a) * easing(t));
  }
  return { inputRange, outputRange };
}

// ── Halka geometrisi ─────────────────────────────────────────────────────────

/**
 * İkonun etrafında eş merkezli daireler: her halkada posterler çembere eşit açıyla
 * dizilir, komşu halkalar yarım adım kaydırılır. Konumlar ekran MERKEZİNE göre
 * (dx, dy) verilir — ekranı ölçmeye (onLayout) ve ölçü gelince yeniden
 * yerleştirmeye gerek yoktur; bileşen `left/top: 50%` + kenar boşluğuyla çizer.
 *
 * Bir halka, iç kenarı ekranın köşe uzaklığına (neredeyse) varmıyorsa üretilmez:
 * köşeye yalnızca ucu değen dördüncü halka (35 poster) telefonda görünür bir şey
 * katmaz. İlk halka her ekranda vardır. Ekran dışında kalan posterlerin elenmesi
 * burada DEĞİL utils/splashPlan.js'te (yörünge + çiçeklenme payıyla).
 */
export function buildRings(screenW, screenH, maxRings = MAX_RING_COUNT) {
  const cornerDistance = Math.hypot(screenW / 2, screenH / 2);
  const limit = Math.min(maxRings, MAX_RING_COUNT);
  const rings = [];
  for (let ring = 0; ring < limit; ring++) {
    const radius = FIRST_RING_RADIUS + ring * RING_STEP;
    if (ring > 0 && radius - TILE_H / 2 > cornerDistance * CORNER_REACH) break;
    const count = Math.max(
      6,
      Math.round((2 * Math.PI * radius) / (TILE_W + TANGENTIAL_GAP)),
    );
    const angleOffset = ring % 2 ? Math.PI / count : 0;
    const tiles = [];
    for (let s = 0; s < count; s++) {
      const angle = angleOffset + (s / count) * 2 * Math.PI;
      tiles.push({ dx: radius * Math.cos(angle), dy: radius * Math.sin(angle) });
    }
    rings.push({ ring, radius, tiles });
  }
  return rings;
}

/** Halka yönü: çift halkalar saat yönünde, tekler tersi → komşu halkalar birbirine zıt akar. */
export const orbitDirection = (ring) => (ring % 2 === 0 ? 1 : -1);

// ── Yörünge (sınırlı, yavaşlayarak durur) ────────────────────────────────────
// Halka kabı `orbitTable(dir)` kadar döner; her poster `orbitTable(dir, true)`
// ile TERS döner → posterler dik kalır. Aynı sürücüden türediği için toplamları
// her an tam sıfırdır.
export function orbitTable(dir, counter = false) {
  const sign = counter ? -dir : dir;
  const { inputRange, outputRange } = sampleCurve({
    a: 0,
    b: sign * ORBIT_SWEEP_DEG,
    easing: ease.outQuad,
    samples: 14,
  });
  return { inputRange, outputRange: outputRange.map((v) => `${v.toFixed(4)}deg`) };
}

// ── Giriş: halka çiçeklenmesi ────────────────────────────────────────────────
const BLOOM_START = 0.08; // ilk halkanın başlangıcı (INTRO'nun kesri)
const BLOOM_STAGGER = 0.09; // halkalar arası gecikme
const BLOOM_SPAN = 0.52; // bir halkanın çiçeklenme süresi
export const BLOOM_FROM_SCALE = 0.55; // halka merkeze yakın başlar, dışa açılır
// Dış halkalar arka planda kalsın: odak ortadaki logo + iç halkalarda.
const RING_PEAK_OPACITY = [1, 0.88, 0.74, 0.62];
// Dalga akmıyorsa (düşük kalite / hareketi azalt) posterler tepe parlaklığın bu
// kesrinde SABİT durur: ne tamamen sönük ne de dalga tepesi kadar parlak.
export const STATIC_LEVEL = 0.5;

export const ringPeakOpacity = (ring) =>
  RING_PEAK_OPACITY[Math.min(ring, RING_PEAK_OPACITY.length - 1)];

/** Halkanın giriş penceresi, INTRO sürücüsünün [0,1] kesri olarak. */
export function bloomWindow(ring) {
  const start = BLOOM_START + BLOOM_STAGGER * ring;
  return { start, end: Math.min(1, start + BLOOM_SPAN) };
}

/** `flat` true ise ölçek hep 1 (çiçeklenme yalnız opaklıkla). */
export function bloomScaleTable(ring, flat = false) {
  const { start, end } = bloomWindow(ring);
  return sampleCurve({
    from: start,
    to: end,
    a: flat ? 1 : BLOOM_FROM_SCALE,
    b: 1,
    easing: flat ? ease.linear : (t) => ease.outBack(t, 1.1),
  });
}

/** `level`: tepe parlaklığın kesri (dalga varken 1; dalgasızken STATIC_LEVEL). */
export function bloomOpacityTable(ring, level = 1) {
  const { start, end } = bloomWindow(ring);
  // Opaklık ölçekten biraz önce oturur: halka belirirken büyüyormuş gibi değil,
  // büyürken belirmiş gibi görünür.
  return sampleCurve({
    from: start,
    to: start + (end - start) * 0.7,
    a: 0,
    b: ringPeakOpacity(ring) * level,
    easing: ease.outCubic,
    samples: 10,
  });
}

// ── Dalga (Meksika dalgası) ──────────────────────────────────────────────────
const WAVE_SCALE_AMP = 0.14; // tepe noktasında poster 1.14x büyür
const WAVE_CREST = 0.4; // halka döngünün yalnız bu kesrinde hareket eder
const WAVE_REST_OPACITY = 0.14;
const WAVE_SAMPLES = 32;

// Yükseltilmiş-kosinüs tepeciği; dışında 0. f(0)=f(1) → döngü sarımında sıçrama yok.
function crestBump(local) {
  return local < WAVE_CREST
    ? 0.5 * (1 - Math.cos((2 * Math.PI * local) / WAVE_CREST))
    : 0;
}

function waveTable(phase, map) {
  const inputRange = [];
  const outputRange = [];
  for (let s = 0; s <= WAVE_SAMPLES; s++) {
    const t = s / WAVE_SAMPLES;
    inputRange.push(t);
    outputRange.push(map(crestBump((t - phase + 1) % 1)));
  }
  return { inputRange, outputRange };
}

export function waveScaleTable(phase) {
  return waveTable(phase, (b) => 1 + WAVE_SCALE_AMP * b);
}

export function waveOpacityTable(phase) {
  return waveTable(phase, (b) => WAVE_REST_OPACITY + (1 - WAVE_REST_OPACITY) * b);
}

// ── Logo ─────────────────────────────────────────────────────────────────────
// İlk karede logo yerel splash'le aynı (ölçek 1, opaklık 1). Halkalar açılırken tek
// bir nabız atar: halkaları "o salmış" gibi okunur.
export function logoPulseTable() {
  const from = 0.12;
  const to = 0.5;
  const inputRange = [];
  const outputRange = [];
  const samples = 16;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    inputRange.push(from + (to - from) * t);
    outputRange.push(1 + 0.07 * Math.sin(Math.PI * t));
  }
  return { inputRange, outputRange };
}

/** [0,1] döngüsü boyunca 1 → 1+amp → 1 sinüs "nefesi" (sarım noktasında kesintisiz). */
export function breathTable(amp) {
  const inputRange = [];
  const outputRange = [];
  const samples = 16;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    inputRange.push(t);
    outputRange.push(1 + amp * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)));
  }
  return { inputRange, outputRange };
}

// ── Zemin + ışıma girişi ─────────────────────────────────────────────────────
export function veilTable() {
  return sampleCurve({ from: 0, to: 0.4, a: 0, b: 1, easing: ease.outCubic, samples: 8 });
}

/** `peak`: ışımanın tepe opaklığı (açık zeminde daha silik). */
export function glowOpacityTable(peak = 1) {
  return sampleCurve({ from: 0, to: 0.78, a: 0, b: peak, easing: ease.outCubic, samples: 10 });
}

export function glowScaleTable(flat = false) {
  return sampleCurve({
    from: 0,
    to: 0.78,
    a: flat ? 1 : 0.7,
    b: 1,
    easing: ease.outCubic,
    samples: 10,
  });
}

/**
 * Işıma görselinin (koyu zemine göre pişirilmiş: tepe alfa 0.62) görünürlük çarpanı.
 * Açık zeminde daha silik (yoksa yıkanmış görünür): 0.4 / 0.62 ≈ 0.65.
 */
export const glowPeakAlpha = (isLightBackground) => (isLightBackground ? 0.65 : 1);

// ── Çıkış ────────────────────────────────────────────────────────────────────
// Çıkış sürücüsü 0→1 (EXIT_MS). Katmanlar farklı pencerelerde ve ölçeklerde süzülür;
// iç halkalar önce, dış halkalar bir an sonra çözülür → "içinden geçiş" hissi.
const EXIT_RING_SCALE = 1.34;
const EXIT_LOGO_SCALE = 1.2;
const EXIT_GLOW_SCALE = 1.5;

export function exitRingScaleTable(ring, flat = false) {
  return sampleCurve({
    from: 0,
    to: 1,
    a: 1,
    b: flat ? 1 : EXIT_RING_SCALE + 0.03 * ring,
    easing: ease.inCubic,
    samples: 12,
  });
}

export function exitRingOpacityTable(ring) {
  const from = 0.06 + 0.05 * ring;
  return sampleCurve({ from, to: Math.min(1, from + 0.7), a: 1, b: 0, easing: ease.inOutCubic, samples: 10 });
}

export function exitLogoScaleTable(flat = false) {
  return sampleCurve({
    from: 0,
    to: 0.8,
    a: 1,
    b: flat ? 1 : EXIT_LOGO_SCALE,
    easing: ease.inCubic,
    samples: 10,
  });
}

export function exitLogoOpacityTable() {
  return sampleCurve({ from: 0.04, to: 0.8, a: 1, b: 0, easing: ease.inOutCubic, samples: 10 });
}

export function exitGlowScaleTable(flat = false) {
  return sampleCurve({
    from: 0,
    to: 0.8,
    a: 1,
    b: flat ? 1 : EXIT_GLOW_SCALE,
    easing: ease.outCubic,
    samples: 10,
  });
}

export function exitGlowOpacityTable() {
  return sampleCurve({ from: 0, to: 0.8, a: 1, b: 0, easing: ease.inOutCubic, samples: 10 });
}

// Zemin en son açılır: önce içerik çözülür, sonra altındaki uygulama belirir.
export function exitBackdropTable() {
  return sampleCurve({ from: 0.3, to: 1, a: 1, b: 0, easing: ease.inOutCubic, samples: 12 });
}
