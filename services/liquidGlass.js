// services/liquidGlass.js
//
// iOS Liquid Glass (UIGlassEffect) için native yoklama + abonelikli kanca.
// Karar mantığı utils/liquidGlass.js'te (saf, testli); burası native değerleri
// okuyup ona besler. services/tabBarCapabilities.js ile aynı yoklama yolu.
//
// `expo-glass-effect` import'u BİLEREK tembel ve try/catch içinde: modül yüklenirken
// `requireNativeViewManager("ExpoGlassEffect", "GlassView")` çalışır ve ikilide
// yoksa (cam desteği eklenmeden önce üretilmiş eski bir development build) atar.
// Bu durumda uygulama çökmek yerine eski görünümde açılır.
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useEffectPreset } from "./effectSettings";
import { resolveGlassPlan } from "../utils/liquidGlass";

function probe() {
  const none = { supported: false, GlassView: null };
  if (Platform.OS !== "ios") return none;
  try {
    const native = requireOptionalNativeModule("ExpoGlassEffect");
    // İkisi birden: `isLiquidGlassAvailable` iOS 26 + Info.plist opt-out yok;
    // `isGlassEffectAPIAvailable` UIGlassEffect sınıfı gerçekten var (iOS 26
    // beta'larında sınıf başlatıcısı çöküyordu, o yüzden ayrıca doğrulanıyor).
    if (!native?.isLiquidGlassAvailable || !native?.isGlassEffectAPIAvailable) return none;
    const { GlassView } = require("expo-glass-effect");
    if (!GlassView) return none;
    return { supported: true, GlassView };
  } catch {
    // Modül yok ya da başlatılamadı: eski görünüme dön.
    return none;
  }
}

// Bileşen kimlikleri oturum boyunca değişmemeli (efekt/erişilebilirlik değişince
// alt ağaç yeniden kurulmasın): bir kez yoklanır.
const probed = Object.freeze(probe());

/** Bu ikili + bu cihaz gerçek Liquid Glass çizebilir mi (efekt tercihi HARİÇ). */
export const liquidGlassSupported = probed.supported;
export const NativeGlassView = probed.GlassView;

/**
 * Şu an gerçek cam çizilecek mi? Efektler "Kapalı" seçilince açık ekran da
 * anında düz görünüme döner (yeniden başlatma gerekmez).
 */
export function useLiquidGlass() {
  const { blurEnabled } = useEffectPreset();
  return resolveGlassPlan({
    platform: Platform.OS,
    supported: liquidGlassSupported,
    effectsEnabled: blurEnabled,
  }).native;
}
