// utils/splashPlan.js
//
// Açılış ekranının "ne kadar iş yapılacak" ve "nereye çizilecek" kararı (SAF; RN
// importu yok). Kullanıcının Efektler ayarı (Tam / Orta / Kapalı, bkz.
// utils/deviceTier.js; zayıf cihazda varsayılan "Kapalı") ve sistemin "Hareketi
// Azalt" tercihi, splash'in kaç yıldız / iz / kıvılcım çizeceğini ve neyin SÜREKLİ
// hareket edeceğini belirler.
//
// NEDEN: splash en yoğun anda çalışır (yerel splash kalkarken, uygulama ağacı mount
// olurken). Zayıf cihazda kasmanın ilk adayı odur.

import { LENS, LENS_COLORS, MARK_HEIGHT, NATIVE_SPLASH_BG, SHOCK_RINGS } from "./splashMotion";
import { isLightSurface, normalizeHex, toHex } from "./colorUtils";
import { WORDMARK_BOX, WORDMARK_FONT_SIZE } from "../data/splashWordmark";

// ── Kalite kademeleri ────────────────────────────────────────────────────────
//
//   spiral     yıldızlar sarmal çizerek gelir (kapalıysa işaret yerinde solarak belirir)
//   stars      arka plan yıldız sayısı
//   twinkle    yıldızlar pırıldar (sürekli döngü)
//   drift      yıldız alanı yavaşça döner (sınırlı, durur)
//   trail      yıldız başına ışık izi kopyası
//   halo       yıldızların renkli halesi
//   flash      çarpışma parlaması
//   rings      şok halkası sayısı
//   sparks     kıvılcım sayısı
//   punch      çarpışmada işaretin kısa büyümesi
//   look       beklerken göz bir yana bakar (sürekli döngü)
//   blink      beklerken göz kırpar (sürekli döngü)
//   rise       yazı harfleri aşağıdan yükselir (kapalıysa yalnız solar)
export const SPLASH_QUALITY = Object.freeze({
  full: Object.freeze({
    spiral: true,
    stars: 44,
    twinkle: true,
    drift: true,
    trail: 6,
    halo: true,
    flash: true,
    rings: 3,
    sparks: 24,
    punch: true,
    look: true,
    blink: true,
    rise: true,
  }),
  balanced: Object.freeze({
    spiral: true,
    stars: 26,
    twinkle: true,
    drift: false,
    trail: 3,
    halo: true,
    flash: true,
    rings: 2,
    sparks: 12,
    punch: true,
    look: false,
    blink: true,
    rise: true,
  }),
  // Kapalı: hikâye (sarmal → çarpışma → göz → yazı) kalır, süs ve döngü yok.
  off: Object.freeze({
    spiral: true,
    stars: 0,
    twinkle: false,
    drift: false,
    trail: 0,
    halo: true,
    flash: true,
    rings: 1,
    sparks: 0,
    punch: true,
    look: false,
    blink: false,
    rise: true,
  }),
});

// Hareketi Azalt: dönen, uçan, büyüyen her şey kapanır; işaret ve yazı yerinde solar.
// Yıldız SAYISI moddan gelir (erişilebilirlik tercihi performans tercihi değildir) ama
// yıldızlar durağandır.
const STILL = Object.freeze({
  spiral: false,
  twinkle: false,
  drift: false,
  trail: 0,
  halo: false,
  flash: false,
  rings: 0,
  sparks: 0,
  punch: false,
  look: false,
  blink: false,
  rise: false,
});

/** Bilinmeyen mod güvenli ortaya ("balanced") düşer — utils/deviceTier.getEffectPreset ile aynı kural. */
export function splashQualityFor(mode, reducedMotion = false) {
  const base = SPLASH_QUALITY[mode] || SPLASH_QUALITY.balanced;
  return reducedMotion ? Object.freeze({ ...base, ...STILL }) : base;
}

// ── Yerleşim ─────────────────────────────────────────────────────────────────

// Video oranları (anim2.cjs): yazı boyu = işaret biriminin 300/1,8'i, işaretle yazı
// arası 110/1,8, harf yükselişi 120/1,8 birim.
export const WORD_SIZE_UNITS = 300 / 1.8;
export const WORD_GAP_UNITS = 110 / 1.8;
export const LETTER_RISE_UNITS = 120 / 1.8;
const WORD_WIDTH_RATIO = 0.6; // yazı ekran genişliğinin en fazla bu kadarı
const WORD_WIDTH_MAX = 300; // dp (tablet)
const GROUP_HEIGHT_RATIO = 0.36; // işaret + yazı ekran yüksekliğinin en fazla bu kadarı
const INTRO_SCALE = 1.18; // giriş ölçeği / son ölçek (splashMotion.INTRO_TO_FINAL'in tersi)

/**
 * Ekran ölçüsünden yerleşim. Tüm konumlar ekran MERKEZİNE göre (dp).
 *   unit       giriş ölçeği: 1 tasarım birimi kaç dp (işaret kabı bu ölçekte çizilir)
 *   finalUnit  son ölçek
 *   markDy     işaretin son merkezi (yukarı kayma, negatif)
 *   word       yazı kutusu: sol-üst (merkeze göre), boyut, viewBox ve harf yükselişi
 */
export function layoutSplash({ width, height }) {
  const wordUnits = (WORDMARK_BOX.x2 - WORDMARK_BOX.x1) / WORDMARK_FONT_SIZE; // yazı boyu başına genişlik
  const textHeightUnits = ((WORDMARK_BOX.y2 - WORDMARK_BOX.y1) / WORDMARK_FONT_SIZE) * WORD_SIZE_UNITS;
  const groupUnits = MARK_HEIGHT + WORD_GAP_UNITS + textHeightUnits;
  const byWidth = Math.min(width * WORD_WIDTH_RATIO, WORD_WIDTH_MAX) / (wordUnits * WORD_SIZE_UNITS);
  const byHeight = (height * GROUP_HEIGHT_RATIO) / groupUnits;
  const finalUnit = Math.min(byWidth, byHeight);
  const unit = finalUnit * INTRO_SCALE;

  const top = (-groupUnits * finalUnit) / 2;
  const markDy = top + (MARK_HEIGHT / 2) * finalUnit;
  const fontDp = WORD_SIZE_UNITS * finalUnit;
  const k = fontDp / WORDMARK_FONT_SIZE; // yazı birimi → dp
  const wordW = (WORDMARK_BOX.x2 - WORDMARK_BOX.x1) * k;
  const wordH = (WORDMARK_BOX.y2 - WORDMARK_BOX.y1) * k;
  return {
    unit,
    finalUnit,
    markDy,
    // İşaret kabı: son göz + daireler + bebek aşımı rahatça sığar (çıkışta ekran dışı
    // katman bu kutuyla sınırlı kalsın diye tam ekran değil).
    markBox: Math.ceil(2 * (LENS.r + LENS.d / 2 + 24) * unit),
    word: {
      left: -wordW / 2,
      top: top + (MARK_HEIGHT + WORD_GAP_UNITS) * finalUnit,
      width: wordW,
      height: wordH,
      viewBox: `${WORDMARK_BOX.x1} ${WORDMARK_BOX.y1} ${WORDMARK_BOX.x2 - WORDMARK_BOX.x1} ${
        WORDMARK_BOX.y2 - WORDMARK_BOX.y1
      }`,
      rise: LETTER_RISE_UNITS * finalUnit,
    },
  };
}

// ── Yıldız alanı ve kıvılcımlar (tohumlu, her açılışta aynı) ─────────────────

// mulberry32: küçük, deterministik.
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TWINKLE_GROUPS = 3;

/** Yıldızlar: merkeze göre konum (dp), çap, temel parlaklık, pırıltı grubu. */
export function planStars({ width, height, count }) {
  const r = rng(7);
  const reach = Math.hypot(width, height) * 0.55;
  return Array.from({ length: count }, (_, i) => {
    const a = r() * Math.PI * 2;
    const dist = Math.sqrt(r()) * reach;
    const z = 0.5 + r() * 1.7;
    return {
      dx: Math.round(Math.cos(a) * dist * 10) / 10,
      dy: Math.round(Math.sin(a) * dist * 10) / 10,
      size: Math.round(z * 1.4 * 10) / 10,
      alpha: Math.round(Math.min(1, 0.35 + z / 2.4) * 100) / 100,
      group: i % TWINKLE_GROUPS,
    };
  });
}

const SPARK_COLORS = ["cyan", "red", "paper"];

/** Kıvılcımlar: yön (derece), hız (ekran oranı), kalınlık (dp), ömür (s), renk adı. */
export function planSparks(count) {
  const r = rng(42);
  return Array.from({ length: count }, (_, i) => ({
    angle: Math.round(r() * 3600) / 10,
    speed: 0.35 + r() * 0.75,
    thickness: Math.round((1.2 + r() * 2.2) * 10) / 10,
    life: 0.45 + r() * 0.5,
    color: SPARK_COLORS[i % SPARK_COLORS.length],
  }));
}

// ── Tema zemini ──────────────────────────────────────────────────────────────

/**
 * Splash renkleri, temanın zemininden (theme.primary). Lens işareti her temada
 * marka renklerinde kalır (marka sayfasındaki açık/koyu zemin logosu gibi); değişen
 * zemin, yazı ve "kâğıt" renkli süsler:
 *
 *   background  sahnenin vardığı zemin (opak hex; geçersizse yerel splash mürekkebi)
 *   light       zemin açık mı (siyah yazı beyazdan daha okunur)
 *   word        "seelogd" yazısının rengi (koyu zeminde kâğıt, açıkta mürekkep)
 *   contrast    beyaz şok halkası ve kıvılcımların rengi (açık zeminde mürekkep)
 *   starsStay   yıldız alanı dalgadan sonra da kalır mı (açık zeminde söner)
 *   statusBar   dalgadan sonraki durum çubuğu simge rengi (expo-status-bar "style")
 *   wipe        zemin mürekkepten farklı mı (aynıysa dalga katmanı hiç kurulmaz)
 */
export function splashPaletteFor(background) {
  const valid =
    typeof background === "string" && (normalizeHex(background) || /^rgba?\(/i.test(background.trim()));
  const bg = valid ? toHex(background) : NATIVE_SPLASH_BG;
  const light = isLightSurface(bg);
  const contrast = light ? LENS_COLORS.ink : LENS_COLORS.paper;
  return Object.freeze({
    background: bg,
    light,
    word: contrast,
    contrast,
    starsStay: !light,
    statusBar: light ? "dark" : "light",
    wipe: bg.toUpperCase() !== NATIVE_SPLASH_BG.toUpperCase(),
  });
}

/** Kademe planı: ekran + kalite (+ tema zemini) → çizilecek her şey. */
export function planSplash({ width, height, quality, background }) {
  return {
    palette: splashPaletteFor(background),
    layout: layoutSplash({ width, height }),
    stars: planStars({ width, height, count: quality.stars }),
    sparks: planSparks(quality.sparks),
    rings: Math.min(quality.rings, SHOCK_RINGS.length),
    trail: quality.trail,
  };
}

// Plan dışı sabit native view'lar: kök, zemin, içerik kabı, yıldız kabı, efekt kabı,
// işaret kabı, 2 yıldız, göz (kap + svg), bebek + parıltı, 7 harf (kap + svg), çocuk kabı.
const FIXED_VIEWS = 1 + 1 + 1 + 1 + 1 + 1 + 2 + 2 + 2 + 7 * 2 + 1;

/**
 * Splash'in mount ettiği native view sayısı (kabaca). Bütçe testinin ortak göstergesi:
 * zayıf cihaz varsayılanı ("Kapalı") eski poster splash'inin ~40 view'ının altında kalmalı.
 */
export const nativeViewCount = (plan, quality) =>
  FIXED_VIEWS +
  plan.stars.length +
  plan.sparks.length +
  plan.rings +
  plan.trail * 2 +
  (quality.halo ? 2 : 0) +
  (quality.flash ? 1 : 0) +
  (plan.palette?.wipe ? 1 : 0);
