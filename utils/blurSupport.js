// utils/blurSupport.js
//
// "Bu blur gerçekten çizilecek mi?" kararının SAF mantığı. Burada RN/Expo
// importu YOK — jest yalnızca saf JS modüllerini çalıştırabiliyor (bkz.
// jest.config.js), bu yüzden karar burada, native değerleri okuyan ince
// sarmalayıcı components/common/AdaptiveBlurView.js içinde durur.
// Aynı ayrım utils/deviceTier.js ↔ services/deviceTier.js'te de var.
//
// ── NEDEN BÖYLE BİR KARAR TABLOSU GEREKTİ ────────────────────────────────────
//
// expo-blur 55.0.0 (SDK 55) Android tarafını baştan yazdı:
//   • `experimentalBlurMethod` → `blurMethod` olarak yeniden adlandırıldı,
//     eskisi her mount'ta konsola uyarı basıyor (iOS'ta da).
//   • `dimezisBlurView` artık bir `BlurTargetView` OLMADAN çalışmıyor —
//     hedefsiz BlurView sessizce düz yarı saydam bir dikdörtgene düşüyor.
//
// Proje SDK 54 → 57'ye atlarken (expo-blur 15.0.8 → 57.0.2) bu değişiklik fark
// edilmedi; Android'de blur veren 19 çağrı yerinin hepsi çökmeden, log basmadan
// düz karartmaya düştü. Bu dosya o kararı artık AÇIKÇA veriyor: blur gerçekten
// çizilemeyecekse expo-blur'ün kendi "none" katmanını çizmesine izin vermiyor,
// sarmalayıcının kendi fallback'ini kullanıyoruz. Böylece tek bir opaklık
// formülü kalıyor (aşağıya bakınız).

/**
 * Android'de donanım hızlandırmalı blur yolunun (RenderNode) alt sınırı.
 *
 * Kütüphanenin (Dimezis BlurView 3.1.0) `BlurTarget` sınıfı, API 31'in altında
 * RenderNode kaydı yapmayıp RenderScript'e düşüyor — Google'ın kendi
 * kullanımdan kaldırdığı, expo'nun da "SDK 30 ve altında performans düşüşüne yol
 * açabilir" diye uyardığı yol. Bu projede blur zaten dekoratif; eski cihazda
 * kare düşürmektense düz katman çiziyoruz.
 */
export const ANDROID_BLUR_MIN_API = 31;

/** expo-blur'e verilecek Android yöntemi. API < 31'de kendisi "none"a düşer. */
export const ANDROID_BLUR_METHOD = "dimezisBlurViewSdk31Plus";

/**
 * Android'de native blur için gereken koşullar sağlanıyor mu?
 * (Hedefin VARLIĞI ayrı bir soru — bkz. resolveBlurPlan.)
 */
export function androidSupportsNativeBlur(apiLevel) {
  return typeof apiLevel === "number" && apiLevel >= ANDROID_BLUR_MIN_API;
}

/**
 * Bir AdaptiveBlurView'ın ne çizeceğine karar verir.
 *
 * @param {object} girdi
 * @param {string}  girdi.platform     "ios" | "android" | diğer
 * @param {number}  [girdi.apiLevel]   Android API seviyesi (Platform.Version)
 * @param {boolean} girdi.blurEnabled  Efekt modunun blur bütçesi (Kapalı'da false)
 * @param {boolean} girdi.hasTarget    Bir BlurTargetView bağlandı mı
 * @returns {{native: boolean, blurMethod: string|undefined, reason: string}}
 *   `native: false` ise çağıran düz katmanı çizer. `reason` yalnızca hata
 *   ayıklama/test okunabilirliği için.
 */
export function resolveBlurPlan({
  platform,
  apiLevel = null,
  blurEnabled,
  hasTarget = false,
} = {}) {
  if (!blurEnabled) return { native: false, blurMethod: undefined, reason: "mod-kapali" };

  // iOS: UIVisualEffectView. Hedef gerekmiyor, API sınırı yok.
  if (platform === "ios") {
    return { native: true, blurMethod: undefined, reason: "ios" };
  }

  if (platform === "android") {
    if (!androidSupportsNativeBlur(apiLevel)) {
      return { native: false, blurMethod: undefined, reason: "android-eski-api" };
    }
    // Hedefsiz BlurView blur ÇİZMEZ; expo-blur içeride "none"a düşer ve ayrıca
    // her mount'ta uyarı basar. Bu durumda hiç BlurView kurmuyoruz.
    if (!hasTarget) {
      return { native: false, blurMethod: undefined, reason: "android-hedef-yok" };
    }
    return { native: true, blurMethod: ANDROID_BLUR_METHOD, reason: "android" };
  }

  // Web ve bilinmeyen platformlar: blur garantisi yok, düz katman.
  return { native: false, blurMethod: undefined, reason: "platform-bilinmiyor" };
}

// ── DÜZ KATMANIN OPAKLIĞI ────────────────────────────────────────────────────
//
// Blur olmadığında arka planın yüksek frekanslı detayı (poster, backdrop)
// olduğu gibi kalır; üstteki metin/ikon aynı kontrast payını korusun diye düz
// katman, blur'ün `intensity` değerinden BİR MİKTAR DAHA opak çizilir:
//   0.30 taban  → en zayıf blur'lar (intensity ~20) bile okunur bir zemin verir
//   0.60 eğim   → intensity ile orantılı artış, görsel hiyerarşi korunur
//   0.85 tavan  → hiçbir zaman tam opak olmayıp altındaki içerik sezilir kalır
//
// NOT: expo-blur'ün Android'deki kendi "none" katmanı bundan belirgin AÇIK bir
// formül kullanıyor (alfa = intensity/100 × 0.69). İkisi yan yana çalışırken
// "Efektler: Kapalı" seçen kullanıcı, açık bırakandan DAHA KOYU bir arayüz
// görüyordu. Artık expo-blur'ün o yoluna hiç girmiyoruz; tek formül bu.
const FALLBACK_ALPHA_FLOOR = 0.3;
const FALLBACK_ALPHA_CEIL = 0.85;

export function blurFallbackAlpha(intensity = 50) {
  const i = typeof intensity === "number" && intensity > 0 ? intensity : 50;
  const scaled = 0.2 + (i / 100) * 0.6;
  return Math.min(FALLBACK_ALPHA_CEIL, Math.max(FALLBACK_ALPHA_FLOOR, scaled));
}

// ── BLUR "KAPATILDI" İLE "KULLANILAMIYOR" AYNI ŞEY DEĞİL ────────────────────
//
// Yukarıdaki eğri, kullanıcı efektleri KENDİ KAPATTIĞINDA blur'ün yerine geçmek
// için ayarlandı: blur yokken arka planın detayı olduğu gibi kaldığı için üstteki
// metnin okunabilmesi adına bilerek daha opak.
//
// Ama blur'ün "kullanılamadığı" durum (Android'de hedef yok / API < 31) farklı:
// orada kullanıcı hiçbir şey seçmedi ve ekranın görünümü değişmemeli. expo-blur
// bu durumda kendi yarı saydam katmanını çiziyordu; onu bire bir taklit
// ediyoruz, aksi hâlde tüm cam yüzeyler bir anda koyulaşıyor.
//
// İLK SÜRÜMDE BU AYRIM YOKTU: iki durumda da opak eğri kullanılınca Android'de
// yarı saydam yüzeyler mat panele döndü ("blur kayboldu" olarak bildirildi).
//
// Katsayılar expo-blur'ün Android tarafından (TintStyle.toColorInt):
//   dark  → #191919, alfa = intensity/100 × 0.69
//   light → #F9F9F9, alfa = intensity/100 × 0.78
const UNAVAILABLE_TINTS = {
  dark: { color: "#191919", factor: 0.69 },
  light: { color: "#F9F9F9", factor: 0.78 },
};

/**
 * Blur teknik olarak çizilemediğinde kullanılacak katman.
 * @returns {{color: string, alpha: number}}
 */
export function unavailableBlurLayer(intensity = 50, tint = "dark") {
  const i = typeof intensity === "number" && intensity > 0 ? intensity : 50;
  const t = UNAVAILABLE_TINTS[tint] || UNAVAILABLE_TINTS.dark;
  return { color: t.color, alpha: Math.min(1, (i / 100) * t.factor) };
}

/**
 * Fallback katmanının, düşüş SEBEBİNE göre seçilmesi.
 * @param {string} reason `resolveBlurPlan` sonucundaki `reason`
 */
export const isUserDisabledBlur = (reason) => reason === "mod-kapali";
