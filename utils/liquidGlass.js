// utils/liquidGlass.js
//
// "Bu yüzey iOS Liquid Glass (UIGlassEffect) olarak mı çizilecek?" kararının SAF
// mantığı. RN/Expo importu YOK — jest yalnız saf JS modüllerini çalıştırıyor
// (bkz. jest.config.js); native değerleri okuyan ince sarmalayıcı
// services/liquidGlass.js'te, çizen bileşen components/common/GlassSurface.js'te.
// utils/blurSupport.js ↔ AdaptiveBlurView ayrımıyla aynı düzen.
//
// ── NEDEN AYRI BİR KARAR ─────────────────────────────────────────────────────
//
// Liquid Glass iOS 26 ile geldi (iOS 27 SDK'sı ile derlenen uygulamalarda
// `UIDesignRequiresCompatibility` opt-out'u artık yok sayılıyor). Aşağıdakilerin
// HEPSİ geçerliyse gerçek cam çizilir; biri eksikse çağıran yerin kendi
// eski görünümü (blur ya da düz yüzey) aynen kalır — Android ve iOS 18–25
// kullanıcısı için hiçbir şey değişmez:
//
//   • platform iOS            → UIGlassEffect başka yerde yok
//   • native modül destekliyor→ iOS 26+ çalışma zamanı VE Xcode 26+ ile derlenmiş
//                               ikili VE Info.plist'te opt-out yok (bunu
//                               expo-glass-effect'in `isLiquidGlassAvailable`ı verir)
//   • efektler açık           → Ayarlar → Kişiselleştirme → Efektler "Kapalı"
//                               ise kullanıcı bilerek düz arayüz istemiştir
//
// "Saydamlığı azalt" (Reduce Transparency) burada ELE ALINMAZ: UIGlassEffect o
// ayarda kendini sistem düzeyinde buzlu/opak yüzeye çevirir; bizim ayrıca düşmemiz
// sistemin erişilebilirlik davranışını ikinci kez uygulamak olurdu.

/** Liquid Glass'ın başladığı iOS ana sürümü (bilgi amaçlı; karar native sabitten gelir). */
export const LIQUID_GLASS_MIN_IOS = 26;

/**
 * @param {object}  girdi
 * @param {string}  girdi.platform         "ios" | "android" | diğer
 * @param {boolean} girdi.supported        expo-glass-effect: iOS 26+ ve cam API'si var
 * @param {boolean} [girdi.effectsEnabled] Efekt modunun blur bütçesi (Kapalı'da false)
 * @returns {{native: boolean, reason: string}}
 *   `reason` yalnız hata ayıklama / test okunabilirliği için.
 */
export function resolveGlassPlan({ platform, supported = false, effectsEnabled = true } = {}) {
  if (platform !== "ios") return { native: false, reason: "ios-degil" };
  if (!supported) return { native: false, reason: "desteklenmiyor" };
  if (!effectsEnabled) return { native: false, reason: "efektler-kapali" };
  return { native: true, reason: "ios-glass" };
}

/**
 * Camın açık/koyu görünümü. `colorScheme: "auto"` SİSTEM görünümünü izler; oysa
 * bu uygulamanın kendi tema seçimi var (sistem açıkken koyu tema, tersi). Cam,
 * yüzeyin gerçek parlaklığına göre zorlanmazsa koyu temada beyaz bir hap, açık
 * temada kapkara bir hap görünür.
 *
 * @param {boolean} lightSurface Sayfa yüzeyi açık mı (`isLightSurface(theme.primary)`)
 * @returns {"light"|"dark"}
 */
export function glassSchemeFor(lightSurface) {
  return lightSurface ? "light" : "dark";
}

/**
 * Yuvarlak / hap şekli için köşe yarıçapı. GlassView köşeyi `borderRadius`
 * stilinden alır ve yarıçapı sabit uygular (UICornerRadius); "mümkün olduğunca
 * yuvarlak" demek için boyutun yarısı verilmeli. Boyut bilinmiyorsa (`null`)
 * çağıranın kendi yarıçapı kullanılır.
 *
 * @param {number|null} height Yüzeyin (bilinen) yüksekliği
 * @returns {number|null}
 */
export function capsuleRadius(height) {
  return typeof height === "number" && height > 0 ? height / 2 : null;
}
