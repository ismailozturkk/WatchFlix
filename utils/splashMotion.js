// utils/splashMotion.js
//
// Açılış ekranının (components/SplashLensIntro.js) SAF hareket modeli. RN importu
// yok, jest'te doğrudan test edilir (__tests__/splashMotion.test.js). Kademeler ve
// ekrana göre yerleşim utils/splashPlan.js'te.
//
// Hikâye, Lens logo animasyonunun kısaltılmış hâli
// (marketing/marka/yeni-logo/kaynak/anim2.cjs, video 6,4 sn → burada ~2,4 sn):
//
//   0 ──────────────────────────────────────────── MIN_VISIBLE_MS ──▶ hazırsa çıkış
//   │ yerel splash: yalnız mürekkep zemin (yıldızlar JS'te ilk kareden doğar)
//   │ yıldız alanı belirir                                   [0 … 0,4]
//   │ camgöbeği + kırmızı yıldız sarmal çizerek yaklaşır,     [0,08 … 1,12]
//   │   yaklaştıkça hızlanır, büyür ve ışık izi bırakır
//   │ çarpışma: parlama, şok halkaları, kıvılcımlar          [1,12 … ~1,9]
//   │ dönüş söner, iki daire dikey konumda göze oturur        [1,12 … 1,50]
//   │ göz bebeği yaylanarak belirir, parıltı yanar            [1,45 … 1,85]
//   │ işaret yukarı kayar, "seelogd" harf harf yükselir      [1,55 … 2,37]
//   │ bekleme döngüsü: göz bir yana bakar ve kırpar (veri gelene kadar)
//   └ çıkış (EXIT_MS): içerik hafif büyüyerek solar, zemin en son açılır
//
// Neden hepsi interpolate: tüm hareket tek bir doğrusal saat sürücüsünden (saniye)
// MATEMATİKSEL türer ve native tarafta akar. Açılışta JS thread'i bloklansa da
// animasyon takılmaz. Eğriler interpolate'in `easing` seçeneğiyle değil, tabloya
// örneklenerek uygulanır (native sürücü yalnız doğrusal parçaları bilir).
//
// Birimler: işaret 512'lik tasarım ızgarasında (daire r 132, merkezler arası d 120);
// bileşen birimi "giriş ölçeği" ile dp'ye çevirir (splashPlan.layoutSplash).

// ── Renkler (Lens) ───────────────────────────────────────────────────────────
export const LENS_COLORS = Object.freeze({
  ink: "#0D0E13",
  paper: "#F5F2EB",
  cyan: "#14C8E8",
  red: "#FF3D5E",
});

// Yerel splash'in zemini (app.json → expo-splash-screen.backgroundColor ile AYNI).
export const NATIVE_SPLASH_BG = LENS_COLORS.ink;

// ── İşaret ölçüleri (tasarım birimi) ─────────────────────────────────────────
export const LENS = Object.freeze({
  r: 132, // daire yarıçapı
  d: 120, // son düzende merkezler arası
  pupil: 40,
  glint: 9.6,
  glintOff: 15, // parıltı bebeğin merkezinden sağ-üste
});
export const CONTACT_SEP = 2 * LENS.r; // daireler bu ayrılıkta değer (264)
export const START_SEP = 640; // yıldızların ilk ayrılığı
export const TURNS = 2.6; // çarpışmaya kadar toplam tur
export const MARK_HEIGHT = 2 * LENS.r + LENS.d; // dikey işaretin boyu (384)
// Göz: iki dairenin kesişimi. Eksen boyunca uzunluk 2r - d, enine genişlik 2·√(r² - (d/2)²).
export const EYE_LENGTH = 2 * LENS.r - LENS.d; // 144
export const EYE_WIDTH = 2 * Math.sqrt(LENS.r ** 2 - (LENS.d / 2) ** 2); // ≈ 235,2

// ── Zaman çizelgesi (saniye, mount anından) ──────────────────────────────────
export const T = Object.freeze({
  appear: 0.08, // yıldızlar belirir
  grow: 0.3, // küçük parlak yıldız evresi biter, büyüme başlar
  collide: 1.12, // çarpışma
  settle: 1.5, // dönüş biter, göz yerinde
  pupilAt: 1.45,
  pupilDur: 0.4,
  glintAt: 1.6,
  glintDur: 0.15,
  riseAt: 1.55, // işaret yukarı kayar (yazıya yer açar)
  riseDur: 0.45,
  lettersAt: 1.7,
  letterStep: 0.045,
  letterDur: 0.4,
});
// Saat tablolarında mutlaka bulunan anlar.
export const KEY_TIMES = Object.freeze([
  T.appear,
  T.grow,
  T.collide,
  T.settle,
  T.pupilAt,
  T.glintAt,
  T.riseAt,
  T.riseAt + T.riseDur,
]);
export const INTRO_S = 2.4;
export const INTRO_MS = INTRO_S * 1000;
export const EXIT_MS = 600;
// Veri çok hızlı gelse bile splash en az bu kadar görünür (giriş anından sayılır):
// çarpışma, göz ve yazının neredeyse tamamı oynar. Veri geç gelirse splash zaten
// APP_READY'ye kadar kalır ve bekleme döngüsü (bakış + kırpma) sürer.
export const MIN_VISIBLE_MS = 2150;
// APP_READY hiç gelmezse zorla çıkış.
export const FALLBACK_EXIT_MS = 10000;
// Native "bitti" geri çağrısı kaybolursa overlay en geç EXIT_MS + bu kadar sonra sökülür.
export const EXIT_GUARD_MS = 1200;
// Döngüler.
export const IDLE_MS = 3600; // bekleme: bakış + kırpma
export const TWINKLE_MS = 2600; // yıldız alanı pırıltısı
export const DRIFT_MS = 14000; // yıldız alanının yavaş dönüşü (durur, sonsuz değil)
export const DRIFT_DEG = 40;

// ── Yardımcılar ──────────────────────────────────────────────────────────────
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const ease = Object.freeze({
  linear: (x) => x,
  out: (x) => 1 - (1 - x) ** 3,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  // Sönümlü yay (aşımlı oturma): 0 → 1, birkaç küçük salınım.
  spring: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-5.5 * x) * Math.cos(9.5 * x)),
});
const round = (v, digits = 4) => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};

// ── Hareket fonksiyonları (t saniye) ─────────────────────────────────────────

/** İki yıldızın merkezleri arası (tasarım birimi). Çarpışmadan sonra yay ile d'ye oturur. */
export function sepAt(t) {
  if (t < T.collide) {
    const u = clamp01((t - T.appear) / (T.collide - T.appear));
    return CONTACT_SEP + (START_SEP - CONTACT_SEP) * (1 - u) ** 1.6;
  }
  return CONTACT_SEP - (CONTACT_SEP - LENS.d) * ease.spring(clamp01((t - T.collide) / (T.settle - T.collide)));
}

// Kepler benzeri dönüş: açısal hız ayrılığın -1,5 kuvvetiyle artar, çarpışmadan sonra söner.
// Toplam açı sayısal integralle bir kez hesaplanır; son açı -90° (cyan üstte, dikey kilit).
const DT = 1 / 2000;
let thetaCache = null;
function thetaIntegral() {
  if (thetaCache) return thetaCache;
  const steps = Math.ceil((INTRO_S + 0.5) / DT);
  const acc = new Float64Array(steps + 1);
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i * DT;
    let w = 0;
    if (t >= T.appear && t < T.collide) w = sepAt(t) ** -1.5;
    else if (t >= T.collide && t < T.settle) {
      w = CONTACT_SEP ** -1.5 * (1 - (t - T.collide) / (T.settle - T.collide)) ** 2;
    }
    sum += w * DT;
    acc[i] = sum;
  }
  const end = acc[Math.round(T.settle / DT)];
  thetaCache = { acc, end, k: (TURNS * 2 * Math.PI) / end };
  return thetaCache;
}

export const WOBBLE_S = 0.6;

/** Yıldız ekseninin açısı (radyan). Ekran koordinatı: y aşağı; -π/2 = cyan tam üstte. */
export function thetaAt(t) {
  const { acc, end, k } = thetaIntegral();
  const i = Math.max(0, Math.min(acc.length - 1, Math.round(t / DT)));
  let th = -Math.PI / 2 - (end - acc[i]) * k;
  if (t > T.settle && t < T.settle + WOBBLE_S) {
    // Oturmanın küçük sallantısı; pencerenin sonunda TAM -90°'ye iner.
    const q = t - T.settle;
    th += 0.09 * Math.exp(-8 * q) * Math.sin(20 * q) * (1 - q / WOBBLE_S);
  }
  return th;
}

/** Yıldız boyu (0..1, r'nin oranı): küçük ve parlak başlar, çarpışmada tam boy. */
export function sizeAt(t) {
  if (t < T.appear) return 0;
  if (t < T.grow) return 0.3 * ease.out(clamp01((t - T.appear) / (T.grow - T.appear)));
  if (t < T.collide) return 0.3 + 0.7 * ease.inOut(clamp01((t - T.grow) / (T.collide - T.grow)));
  return 1;
}

/** Yıldız halesinin gücü: yaklaşırken yanar, çarpışmadan sonra söner. */
export function glowAt(t) {
  if (t < T.collide) return clamp01((t - T.appear) / 0.2);
  return 1 - ease.out(clamp01((t - T.collide) / 0.5));
}

/** Işık izinin gücü: çarpışmaya dek tam, sonra hızla söner. */
export const trailAt = (t) => (t < T.collide ? 1 : 1 - clamp01((t - T.collide) / 0.2));

/** Çarpışma anında işaretin kısa "yumruk" büyümesi (oran, 0 = yok). */
export function punchAt(t) {
  const tau = t - T.collide;
  if (tau <= 0) return 0;
  return 0.07 * Math.exp(-9 * tau) * Math.sin(Math.min(tau * 20, Math.PI));
}

/** İşaretin yukarı kayma ilerlemesi (0..1). */
export const riseAt = (t) => ease.inOut(clamp01((t - T.riseAt) / T.riseDur));

/** Giriş ölçeği → son ölçek oranı: video gibi işaret önce %18 büyük, yazıyla birlikte küçülür. */
export const INTRO_TO_FINAL = 1 / 1.18;

/** İşaret kabının ölçeği (giriş ölçeğine göre): kayarken küçülür, çarpışmada yumruk. */
export const markScaleAt = (t) => (1 + (INTRO_TO_FINAL - 1) * riseAt(t)) * (1 + punchAt(t));

/** Göz bebeği yayı (0..1, aşımlı). */
export const pupilAt = (t) => ease.spring(clamp01((t - T.pupilAt) / T.pupilDur));
export const glintOpacityAt = (t) => clamp01((t - T.glintAt) / T.glintDur);

/** i. harfin ilerlemesi (0..1). */
export const letterAt = (t, i) => ease.out(clamp01((t - T.lettersAt - i * T.letterStep) / T.letterDur));

/** Yıldız alanının belirişi. */
export const starsInAt = (t) => clamp01(t / 0.4);

/**
 * Göz ölçeği, verilen ayrılıkta (son göze göre): [eksen boyunca, enine].
 * Kesişim yoksa (ayrılık ≥ 2r) ikisi de 0.
 */
export function eyeScaleForSep(sep) {
  const along = Math.max(0, CONTACT_SEP - sep) / EYE_LENGTH;
  const half = sep / 2;
  const across = half >= LENS.r ? 0 : (2 * Math.sqrt(LENS.r ** 2 - half ** 2)) / EYE_WIDTH;
  return [along, across];
}

// ── Çarpışma efektleri (tau = t - T.collide) ─────────────────────────────────
export const FLASH_S = 0.35;
export const flashOpacityAt = (t) => {
  const tau = t - T.collide;
  if (tau <= 0 || tau >= FLASH_S) return 0;
  return 0.75 * (1 - tau / FLASH_S) ** 2;
};
// Parlamanın yarıçapı ekran genişliğinin oranı olarak (en büyük 0,42).
export const FLASH_MAX = 0.42;
export const flashRadiusAt = (t) => 0.12 + 0.3 * clamp01((t - T.collide) / FLASH_S);

// Şok halkaları: [gecikme s, renk, en büyük yarıçap (ekran genişliği oranı)].
export const SHOCK_RINGS = Object.freeze([
  Object.freeze([0, LENS_COLORS.paper, 0.75]),
  Object.freeze([0.05, LENS_COLORS.cyan, 0.62]),
  Object.freeze([0.09, LENS_COLORS.red, 0.55]),
]);
export const SHOCK_S = 0.6;
export const SHOCK_MIN = 0.05;
export function shockProgressAt(t, ring) {
  return clamp01((t - T.collide - SHOCK_RINGS[ring][0]) / SHOCK_S);
}
export const shockRadiusAt = (t, ring) =>
  SHOCK_MIN + SHOCK_RINGS[ring][2] * ease.out(shockProgressAt(t, ring));
export function shockOpacityAt(t, ring) {
  const p = shockProgressAt(t, ring);
  return p <= 0 || p >= 1 ? 0 : 0.6 * (1 - p) ** 1.4;
}

/** Kıvılcımın merkezden uzaklığı (ekran genişliği oranı) ve opaklığı. */
export const sparkDistanceAt = (t, v) => {
  const tau = Math.max(0, t - T.collide);
  return 0.62 * v * (1 - Math.exp(-4.5 * tau));
};
export function sparkOpacityAt(t, life) {
  const tau = t - T.collide;
  if (tau <= 0 || tau >= life) return 0;
  return (1 - tau / life) ** 1.3;
}

// ── Bekleme döngüsü (b ∈ [0,1], IDLE_MS) ─────────────────────────────────────
export const LOOK_WINDOW = Object.freeze([0.08, 0.3]);
export const BLINK_WINDOW = Object.freeze([0.5, 0.5 + 0.22 / (IDLE_MS / 1000)]);
export const LOOK_UNITS = -18; // bebek bu kadar sola bakar
export const BLINK_SEP = 148; // kırpışta daireler bu kadar ayrılır → göz kapanır
const windowPhase = (b, [a, z]) => (b <= a || b >= z ? 0 : Math.sin((Math.PI * (b - a)) / (z - a)));
export const lookAt = (b) => LOOK_UNITS * windowPhase(b, LOOK_WINDOW);
export const blinkAt = (b) => windowPhase(b, BLINK_WINDOW); // 0..1..0
export const blinkSepAt = (b) => BLINK_SEP * blinkAt(b);
// Göz kapanırken bebek ince bir şerit olarak kalmasın: kapanmanın sonunda solar.
export const blinkFadeAt = (b) => clamp01((blinkAt(b) - 0.55) / 0.3);

// ── Pırıltı döngüsü (yıldız grubu başına faz) ────────────────────────────────
export const twinkleAt = (x, phase) => 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (x + phase)));

// ── Tema zemini ──────────────────────────────────────────────────────────────
// Yerel splash uygulamanın temasını okuyamaz (tema JS deposunda), bu yüzden sahne
// HER temada mürekkep uzayda başlar. Çarpışmanın şok dalgası ekranı merkezden
// temanın zeminine boyar; açık temada yıldızlar bu sırada söner. Hareketi Azalt'ta
// dalga yok: zemin ilk anlarda kısa bir geçişle temaya döner.
export const WIPE_S = 0.55;
const wipeProgressAt = (t) => clamp01((t - T.collide) / WIPE_S);
export const wipeAt = (t) => ease.out(wipeProgressAt(t)); // dalga yarıçapı (0 → ekranı örter)
export const wipeOpacityAt = (t) => ease.out(clamp01(wipeProgressAt(t) / 0.35));
export const STILL_WIPE_S = 0.35;
export const stillWipeAt = (t) => ease.inOut(clamp01(t / STILL_WIPE_S));

// ── Çıkış (e ∈ [0,1], EXIT_MS) ───────────────────────────────────────────────
export const exitContentOpacityAt = (e) => 1 - ease.out(clamp01(e / 0.6));
export const exitContentScaleAt = (e) => 1 + 0.06 * ease.out(clamp01(e / 0.7));
export const exitBackdropOpacityAt = (e) => 1 - ease.inOut(clamp01((e - 0.35) / 0.65));

// ── Tablolar ─────────────────────────────────────────────────────────────────

/**
 * Bir fonksiyonu [from, to] aralığında örnekleyip native interpolate tablosu kurar.
 * Aralık dışında değer sabit kalsın diye çağıran `extrapolate: "clamp"` verir.
 * `step` saniye (ya da sürücü birimi) aralıkla; uçlar her zaman dahil.
 */
export function sampleTable(fn, { from = 0, to = INTRO_S, step = 1 / 60, map, knots = KEY_TIMES } = {}) {
  const xs = [];
  const n = Math.max(1, Math.ceil((to - from) / step - 1e-9));
  for (let i = 0; i <= n; i++) xs.push(round(i === n ? to : from + i * step, 5));
  // Kırılma anları (çarpışma, oturma...) örnek ızgarasına düşmese de tabloda olsun:
  // yoksa doğrusal ara değer o anın değerini kaçırır (ör. çarpışmadaki ayrılık).
  for (const k of knots) if (k > from && k < to) xs.push(round(k, 5));
  xs.sort((p, q) => p - q);
  const inputRange = [];
  const outputRange = [];
  for (const x of xs) {
    if (inputRange.length && x - inputRange[inputRange.length - 1] < 1e-4) continue;
    const v = fn(x);
    inputRange.push(x);
    outputRange.push(map ? map(v) : round(v));
  }
  return { inputRange, outputRange };
}

export const toDeg = (rad) => `${round((rad * 180) / Math.PI, 3)}deg`;

/** Bir tablonun bütün çıktıları sayısal ve sonlu mu (test ve geliştirme denetimi). */
export function isFiniteTable({ inputRange, outputRange }) {
  if (inputRange.length !== outputRange.length || inputRange.length < 2) return false;
  for (let i = 1; i < inputRange.length; i++) if (!(inputRange[i] > inputRange[i - 1])) return false;
  return outputRange.every((v) =>
    typeof v === "number" ? Number.isFinite(v) : /^-?\d+(\.\d+)?deg$/.test(v),
  );
}
