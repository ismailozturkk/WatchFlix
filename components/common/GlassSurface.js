// components/common/GlassSurface.js
//
// iOS 26+ Liquid Glass yüzeyi — uygulamada `expo-glass-effect`in GlassView'ını
// doğrudan kullanan TEK yer (AdaptiveBlurView'ın expo-blur için olduğu gibi).
//
// Üç çizim kipi (services/liquidGlass.useGlassMode):
//   • native  → GlassView (iOS 26+)
//   • frosted → Android "buzlu cam": camla aynı şekil, yarı saydam yüzey, ince
//               kenar ışığı + üstten parlama; `fallbackBlur` verilen yerde gerçek
//               blur (Android'de `blurTarget` varsa — bkz. BlurTarget.js)
//   • off     → çağıran yerin KENDİ eski görünümü (iOS 18–25, Efektler: Kapalı):
//               `fallbackBlur` → AdaptiveBlurView, yoksa düz View + `fallbackStyle`
//
// ── CAM İÇİN KURALLAR (cihazda sessizce bozulan şeyler) ──────────────────────
//
//  1. Cam yüzeyin KENDİSİNE ya da ATALARINA `opacity` animasyonu verme. Sistem
//     camı opaklıkla soldurunca efekt kaybolur / düz gri dikdörtgene döner.
//     Giriş animasyonunu `transform` ile yap, solmayı cam altındaki içerikte.
//     iOS 26.1+ UIKit, neredeyse saydamken çizilen camı düşürür ve kendiliğinden
//     geri çizmez ("dokununca görünüyor" hatası: Reveal/FadeIn girişleri, AI
//     modalı). Native güvenlik ağı patches/expo-glass-effect+*.patch: efekt,
//     opaklık yükselip oturunca yeniden atanır (yeni native build gerekir). Ağ
//     solmanın SONUNDA düzeltir; solma sırasında cam yine görünmeyebilir.
//  2. Köşe yarıçapı `style.borderRadius`tan okunur ve SABİT uygulanır. Hap için
//     yüksekliğin yarısını ver (utils/liquidGlass.capsuleRadius); `overflow:
//     "hidden"` EKLEME — cam kendi şeklini keser, kenar ışığını da kırpmayalım.
//  3. Cam camı örnekleyemez: cam içine cam koyma. Bitişik duran birkaç cam
//     düğme birbirine akıp birleşsin isteniyorsa expo-glass-effect'in
//     `GlassContainer`ı gerekir (şu an hiçbir yerde kullanılmıyor).
//  4. RN gölgesi (shadow*/elevation) EKLEME: cam kendi derinlik gölgesini çizer.
//     Buzlu camda da yok: Android `elevation`ı yarı saydam zeminin İÇİNDEN görünür.
//  5. `colorScheme` açıkça verilir: "auto" sistemi izler, oysa uygulamanın kendi
//     tema seçimi var (utils/liquidGlass.glassSchemeFor).
//  6. Cam üstüne RN çerçevesi (borderWidth + renk) KOYMA: cam dokununca esneyip
//     büyür/küçülür, çerçeve yerinde sabit kalır → camdan kopuk ikinci halka.
//     Durum rengi (odak, seçili, hata) `tint` ile verilir.
import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AdaptiveBlurView from "./AdaptiveBlurView";
import { useTheme } from "../../context/ThemeContext";
import { NativeGlassView, useGlassMode } from "../../services/liquidGlass";
import { isLightSurface } from "../../utils/colorUtils";
import { frostedAppearance, frostedFill, stateBorderColor } from "../../utils/glassChrome";
import { GLASS_MODES, glassSchemeFor } from "../../utils/liquidGlass";

/**
 * Tema yüzeyine göre cam görünümü ("light" | "dark"). `override` verilirse o
 * kazanır — poster/backdrop üstündeki düğmeler temadan bağımsız hep koyu cam ister.
 */
export function useGlassScheme(override) {
  const { theme } = useTheme();
  if (override === "light" || override === "dark") return override;
  return glassSchemeFor(isLightSurface(theme.primary));
}

/** Buzlu camın kenar ışığı kalınlığı (mutlak katman: yerleşimi etkilemez). */
const FROSTED_RIM_WIDTH = 1;

/** Kenar ışığı + üstten inen parlama; yüzeyin İLK çocuğu (içeriğin arkasında). */
function FrostedSheen({ shape, look, inset = 0 }) {
  return (
    <View
      pointerEvents="none"
      style={[
        inset ? { position: "absolute", top: -inset, left: -inset, right: -inset, bottom: -inset } : StyleSheet.absoluteFill,
        shape,
        styles.clip,
        { borderWidth: FROSTED_RIM_WIDTH, borderColor: look.rim },
      ]}
    >
      <LinearGradient
        colors={look.sheen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
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
 * @param {object}  [props.blurTarget]           `fallbackBlur` için Android blur hedefi
 *   (useLocalBlurTarget / useBlurTargetRef); yoksa Android'de düz koyu katman
 * @param {object}  [props.fallbackStyle]        Cam yoksa `style`a eklenecek yüzey stili.
 *   Buzlu camda yalnız `backgroundColor`u okunur (yüzey rengi); çerçeve/gölge çizilmez.
 * @param {string}  [props.rim]                  Buzlu camın kenar ışığı rengi (odak / seçili)
 */
export default function GlassSurface({
  radius,
  variant = "regular",
  scheme,
  tint,
  interactive = false,
  fallbackBlur,
  blurTarget,
  fallbackStyle,
  rim,
  style,
  children,
  ...rest
}) {
  const mode = useGlassMode();
  const { theme } = useTheme();
  const resolvedScheme = useGlassScheme(scheme);

  if (mode === GLASS_MODES.native && NativeGlassView) {
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
  const frosted = mode === GLASS_MODES.frosted;

  if (fallbackBlur) {
    // AdaptiveBlurView'ın kendisi yuvarlak köşeyi kırpmaz; kırpma burada.
    return (
      <AdaptiveBlurView
        tint={fallbackBlur.tint ?? "dark"}
        intensity={fallbackBlur.intensity ?? 60}
        blurTarget={blurTarget}
        style={[style, frosted ? null : fallbackStyle, shape, styles.clip]}
        {...rest}
      >
        {frosted ? (
          <FrostedSheen shape={shape} look={frostedAppearance({ scheme: "dark", rim })} />
        ) : null}
        {children}
      </AdaptiveBlurView>
    );
  }

  if (frosted) {
    // Yüzey rengi: çağıranın eski zemini (opak tema yüzeyi buzlu opaklığa iner),
    // yoksa camın tonu, o da yoksa tema yüzeyi.
    // Kenar ışığı: açık `rim`, yoksa eski kutunun DURUM çerçevesi (etkin filtre,
    // odak), yoksa nötr ışık.
    const fallbackFlat = StyleSheet.flatten(fallbackStyle) || {};
    const fill = frostedFill(fallbackFlat.backgroundColor ?? tint ?? theme.secondary);
    const look = frostedAppearance({
      fill,
      scheme: resolvedScheme,
      rim: rim ?? stateBorderColor(fallbackFlat.borderColor),
    });
    // Eski kutunun çerçeve KALINLIĞI saydam olarak korunur (içerik 1 px bile
    // kaymasın); ışık katmanı o payı da örter.
    const inset = typeof fallbackFlat.borderWidth === "number" ? fallbackFlat.borderWidth : 0;
    return (
      <View
        style={[
          style,
          shape,
          { backgroundColor: fill },
          inset ? { borderWidth: inset, borderColor: "transparent" } : null,
        ]}
        {...rest}
      >
        <FrostedSheen shape={shape} look={look} inset={inset} />
        {children}
      </View>
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
