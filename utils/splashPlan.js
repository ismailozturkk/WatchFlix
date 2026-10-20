// utils/splashPlan.js
//
// Açılış ekranının "ne kadar iş yapılacak" kararı (SAF; RN importu yok):
// kullanıcının Efektler ayarı (Tam / Orta / Kapalı, bkz. utils/deviceTier.js;
// düşük cihazda varsayılan "Kapalı") ve sistemin "Hareketi Azalt" tercihi
// splash'in kaç poster çizeceğini ve neyi SÜREKLİ hareket ettireceğini belirler.
//
// NEDEN: splash en yoğun anda çalışır — yerel splash kalkarken, uygulama ağacı
// mount olurken. Zayıf cihazda "kasma"nın ilk adayı odur. Efekt ayarını yok
// saymak, efektleri kapatmış (ya da cihazı yetmediği için sistemin kapattığı)
// kullanıcıya her açılışta tam yük bindirmekti.
//
// GÖRÜNÜRLÜK KIRPMASI BİLEREK YOK: ekran dışında kalan posterleri elemeyi denedim
// (çiçeklenme payı ölçek 0.55'e kadar iner, yörünge ±26° döner, dalga 1.14x büyütür
// → hareketin tamamı hesaba katılınca) ve 360×800 … 820×1180 arasındaki tüm
// ekranlarda ELENEN POSTER SIFIR çıktı: halka merkeze çekildiği için her poster bir
// an ekrana giriyor. Kazancı olmayan kırpma kodu eklenmedi. Halka sayısı zaten
// ekrana göre sınırlı (utils/splashMotion.js buildRings → CORNER_REACH).

import { buildRings } from "./splashMotion";

// ── Kalite kademeleri ────────────────────────────────────────────────────────
//
//   maxRings     en fazla halka sayısı (ekran küçükse zaten daha az üretilir)
//   orbit        halkalar yavaşça süzülür, posterler karşı dönüşle dik kalır
//   waveLoop     Meksika dalgası sürekli döner (kapalıysa posterler sabit parlaklıkta)
//   waveScale    dalga posteri büyütür (yalnız waveLoop açıkken anlamlı)
//   glowMotion   ışıma yavaşça döner ve nefes alır
//   breath       logo nefes alır
//   pulse        logo çiçeklenme anında bir kez nabız atar
//   bloomScale   halkalar ölçekle açılır/kapanır (kapalıysa yalnız opaklıkla)
//   posterPool   kaç FARKLI afiş çözülür (her biri bir bitmap kodlama maliyeti)
//
// full      Tam     tüm hareket, 4 halkaya kadar (4. halka yalnız büyük ekranda).
// balanced  Orta    yörünge ve ışıma hareketi yok, 3 halka; dalga + nefes sürer.
// off       Kapalı  süreklilik yok: 2 halka, çiçeklenme + çıkış dışında HİÇBİR
//                   hareket çalışmaz; ışıma ve logo statik. Zayıf cihaz buraya düşer.
export const SPLASH_QUALITY = Object.freeze({
  full: Object.freeze({
    maxRings: 4,
    orbit: true,
    waveLoop: true,
    waveScale: true,
    glowMotion: true,
    breath: true,
    pulse: true,
    bloomScale: true,
    posterPool: 24,
  }),
  balanced: Object.freeze({
    maxRings: 3,
    orbit: false,
    waveLoop: true,
    waveScale: true,
    glowMotion: false,
    breath: true,
    pulse: true,
    bloomScale: true,
    posterPool: 24,
  }),
  off: Object.freeze({
    maxRings: 2,
    orbit: false,
    waveLoop: false,
    waveScale: false,
    glowMotion: false,
    breath: false,
    pulse: true,
    bloomScale: true,
    posterPool: 12,
  }),
});

// Hareketi Azalt: sürekli ve ölçekli her şey kapanır, yalnız yavaş solma kalır.
// Halka sayısı moddan gelir (erişilebilirlik tercihi performans tercihi değildir).
const STILL = Object.freeze({
  orbit: false,
  waveLoop: false,
  waveScale: false,
  glowMotion: false,
  breath: false,
  pulse: false,
  bloomScale: false,
});

/** Bilinmeyen mod güvenli ortaya ("balanced") düşer — utils/deviceTier.getEffectPreset ile aynı kural. */
export function splashQualityFor(mode, reducedMotion = false) {
  const base = SPLASH_QUALITY[mode] || SPLASH_QUALITY.balanced;
  return reducedMotion ? Object.freeze({ ...base, ...STILL }) : base;
}

/**
 * Splash'in çizim planı: hangi halkada kaç poster üretilecek (merkeze göre dx,dy).
 * Yalnız ekran boyutuna ve halka sayısına bağlıdır — `reducedMotion` geometriyi
 * DEĞİŞTİRMEZ, bu yüzden "Hareketi Azalt" bilgisi geç gelse de poster kümesi
 * yeniden kurulmaz.
 *
 * @param {{width:number,height:number,quality:{maxRings:number}}} args
 */
export function planSplash({ width, height, quality }) {
  const rings = buildRings(width, height, quality.maxRings);
  return {
    rings,
    ringCount: rings.length,
    tileCount: rings.reduce((n, r) => n + r.tiles.length, 0),
  };
}

// Plan dışı sabit native view'lar: kök, zemin (3: kap + gri + tema), ışıma, logo,
// çocuk kabı (StatusBar/kar için; çocuk yoksa çizilmez ama App her zaman verir).
const FIXED_VIEWS = 1 + 3 + 1 + 1 + 1;

/**
 * Splash'in mount ettiği native view sayısı: poster başına TEK view (sarmalayıcı
 * yok), halka başına bir kap, artı sabitler. Bütçe testinin ve ölçümün ortak
 * göstergesi — eskiden poster başına iki view (köşe maskeli sarmalayıcı + resim)
 * ve SVG ışıma vardı: 390×844'te 135 view.
 */
export const nativeViewCount = (plan) => plan.tileCount + plan.ringCount + FIXED_VIEWS;
