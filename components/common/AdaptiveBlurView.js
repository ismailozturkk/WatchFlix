// components/common/AdaptiveBlurView.js
//
// BlurView'ın cihaz sınıfına duyarlı sarmalayıcısı.
//
// NEDEN VAR: expo-blur'ün BlurView'ı her karede yeniden çizilir. Android'de
// `experimentalBlurMethod="dimezisBlurView"` ile arkasındaki tüm ağaç offscreen
// bir buffer'a alınıp bulanıklaştırıldığı için maliyet ekran alanıyla büyür;
// düşük RAM'li cihazlarda liste kaydırmada ve detay ekranlarında kare düşüşünün
// bilinen kaynaklarından (bkz. docs/PERFORMANS_INCELEME_RAPORU.txt).
//
// DAVRANIŞ: mid/high katmanda mevcut BlurView aynen render edilir — görüntü
// birebir değişmez. Yalnız `low` katmanda blur yerine yarı saydam düz bir View
// çizilir; tek bir compositing geçişi, blur pass'i yok.
//
// Çağrı yerleri BlurView'ı bire bir değiştirebilir: `tint`, `intensity`, `style`
// ve diğer props aynı adlarla geçer.
import React from "react";
import { View } from "react-native";
import { BlurView } from "expo-blur";
import { alpha } from "../../theme/colors";
import { perfPreset } from "../../services/deviceTier";

// Fallback'te blur olmadığı için arka planın yüksek frekanslı detayı (poster,
// backdrop) olduğu gibi kalır — üstteki metin/ikon aynı kontrast payını
// korusun diye düz katman, blur'un `intensity` değerinden BİR MİKTAR DAHA
// opak çizilir:
//   0.30 taban  → en zayıf blur'lar (intensity ~20) bile okunur bir zemin verir
//   0.60 eğim   → intensity ile orantılı artış, görsel hiyerarşi korunur
//   0.85 tavan  → hiçbir zaman tam opak olmayıp altındaki içerik sezilir kalır
const FALLBACK_ALPHA_FLOOR = 0.3;
const FALLBACK_ALPHA_CEIL = 0.85;

export function blurFallbackAlpha(intensity = 50) {
  const i = typeof intensity === "number" && intensity > 0 ? intensity : 50;
  const scaled = 0.2 + (i / 100) * 0.6;
  return Math.min(FALLBACK_ALPHA_CEIL, Math.max(FALLBACK_ALPHA_FLOOR, scaled));
}

/** Düşük katmanda blur devre dışı mı — çağrı yerinin ek karar vermesi gerekirse. */
export const blurEnabled = perfPreset.blurEnabled;

/**
 * @param {object}  props
 * @param {"dark"|"light"} [props.tint="dark"]   BlurView tint'i
 * @param {number}  [props.intensity=50]         BlurView yoğunluğu
 * @param {string}  [props.fallbackColor]        Düşük katmanda kullanılacak taban
 *   renk (tema token'ı, ör. `theme.tab`). Verilmezse tint'e göre siyah/beyaz.
 * @param {number}  [props.fallbackAlpha]        Opaklığı elle sabitler; verilmezse
 *   `intensity`ten türetilir.
 */
const AdaptiveBlurView = ({
  tint = "dark",
  intensity = 50,
  fallbackColor,
  fallbackAlpha,
  style,
  children,
  ...rest
}) => {
  if (perfPreset.blurEnabled) {
    return (
      <BlurView tint={tint} intensity={intensity} style={style} {...rest}>
        {children}
      </BlurView>
    );
  }

  // Blur'a özgü props düz View'a geçmesin; geri kalanı (pointerEvents,
  // accessibility*, testID …) View'ın da anladığı props.
  const { experimentalBlurMethod, blurReductionFactor, ...viewProps } = rest;

  const a = typeof fallbackAlpha === "number" ? fallbackAlpha : blurFallbackAlpha(intensity);
  const base = fallbackColor || (tint === "light" ? "#FFFFFF" : "#000000");

  return (
    <View style={[style, { backgroundColor: alpha(base, a) }]} {...viewProps}>
      {children}
    </View>
  );
};

export default AdaptiveBlurView;
