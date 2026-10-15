// components/common/GlassSurface.js
//
// iOS 26+ Liquid Glass yüzeyi — uygulamada `expo-glass-effect`in GlassView'ını
// doğrudan kullanan TEK yer (AdaptiveBlurView'ın expo-blur için olduğu gibi).
//
// Cam çizilemiyorsa (Android, iOS 18–25, eski development build, Efektler:
// Kapalı) çağıran yerin KENDİ eski görünümü çizilir; bu bileşen o görünümü iki
// yoldan alır:
//   • `fallbackBlur` verilirse → AdaptiveBlurView (poster/backdrop üstü yüzeyler)
//   • yoksa → düz View + `fallbackStyle` (tema zeminli yüzeyler)
//
// ── CAM İÇİN KURALLAR (cihazda sessizce bozulan şeyler) ──────────────────────
//
//  1. Cam yüzeyin KENDİSİNE ya da ATALARINA `opacity` animasyonu verme. Sistem
//     camı opaklıkla soldurunca efekt kaybolur / düz gri dikdörtgene döner.
//     Giriş animasyonunu `transform` ile yap, solmayı cam altındaki içerikte.
//  2. Köşe yarıçapı `style.borderRadius`tan okunur ve SABİT uygulanır. Hap için
//     yüksekliğin yarısını ver (utils/liquidGlass.capsuleRadius); `overflow:
//     "hidden"` EKLEME — cam kendi şeklini keser, kenar ışığını da kırpmayalım.
//  3. Cam camı örnekleyemez: cam içine cam koyma. Bitişik duran birkaç cam
//     düğme birbirine akıp birleşsin isteniyorsa expo-glass-effect'in
//     `GlassContainer`ı gerekir (şu an hiçbir yerde kullanılmıyor).
//  4. RN gölgesi (shadow*/elevation) EKLEME: cam kendi derinlik gölgesini çizer.
//  5. `colorScheme` açıkça verilir: "auto" sistemi izler, oysa uygulamanın kendi
//     tema seçimi var (utils/liquidGlass.glassSchemeFor).
import React from "react";
import { StyleSheet, View } from "react-native";
import AdaptiveBlurView from "./AdaptiveBlurView";
import { useTheme } from "../../context/ThemeContext";
import { NativeGlassView, useLiquidGlass } from "../../services/liquidGlass";
import { isLightSurface } from "../../utils/colorUtils";
import { glassSchemeFor } from "../../utils/liquidGlass";

/**
 * Tema yüzeyine göre cam görünümü ("light" | "dark"). `override` verilirse o
 * kazanır — poster/backdrop üstündeki düğmeler temadan bağımsız hep koyu cam ister.
 */
export function useGlassScheme(override) {
  const { theme } = useTheme();
  if (override === "light" || override === "dark") return override;
  return glassSchemeFor(isLightSurface(theme.primary));
}

/**
 * @param {object}  props
 * @param {number}  props.radius                 Köşe yarıçapı (cam için ZORUNLU; hap = yükseklik/2)
 * @param {"regular"|"clear"} [props.variant="regular"]
 *   regular → okunabilirlik öncelikli (düğme, alan, çubuk). clear → daha şeffaf;
 *   yalnız zengin görsel (poster, gradyan) üstünde ve üstüne koyu katman/metin
 *   gölgesi konabilen yerlerde.
 * @param {"light"|"dark"} [props.scheme]        Cam görünümünü zorla (varsayılan: tema)
 * @param {string}  [props.tint]                 Cam tonu (vurgulu eylem için accent)
 * @param {boolean} [props.interactive=false]    Dokununca cam sistem düzeyinde esner/parlar
 * @param {object}  [props.fallbackBlur]         { tint, intensity } — cam yoksa blur çiz
 * @param {object}  [props.fallbackStyle]        Cam yoksa `style`a eklenecek yüzey stili
 */
export default function GlassSurface({
  radius,
  variant = "regular",
  scheme,
  tint,
  interactive = false,
  fallbackBlur,
  fallbackStyle,
  style,
  children,
  ...rest
}) {
  const glass = useLiquidGlass();
  const resolvedScheme = useGlassScheme(scheme);

  if (glass && NativeGlassView) {
    return (
      <NativeGlassView
        glassEffectStyle={variant}
        colorScheme={resolvedScheme}
        tintColor={tint}
        isInteractive={interactive}
        style={[style, typeof radius === "number" ? { borderRadius: radius } : null]}
        {...rest}
      >
        {children}
      </NativeGlassView>
    );
  }

  const shape = typeof radius === "number" ? { borderRadius: radius } : null;

  if (fallbackBlur) {
    // AdaptiveBlurView'ın kendisi yuvarlak köşeyi kırpmaz; kırpma burada.
    return (
      <AdaptiveBlurView
        tint={fallbackBlur.tint ?? "dark"}
        intensity={fallbackBlur.intensity ?? 60}
        style={[style, fallbackStyle, shape, styles.clip]}
        {...rest}
      >
        {children}
      </AdaptiveBlurView>
    );
  }

  return (
    <View style={[style, fallbackStyle, shape]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
});
