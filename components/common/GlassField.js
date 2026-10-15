// components/common/GlassField.js
//
// Arama / yazı alanı kabuğu: iOS 26+'da hap biçimli Liquid Glass (sistemin arama
// çubuğuyla aynı dil), diğer yerlerde çağıranın eski kutusu.
//
// Yalnız KABUK: içindeki TextInput, ikonlar ve temizle düğmesi çağırana ait.
// Alan odaklanınca cam, vurgu renginde hafifçe tonlanır (eski görünümün vurgu
// çerçevesinin karşılığı); cam üstüne ayrıca çerçeve çizilmez.
//
// ── NEDEN GÖVDE KATMANI YOK, TON CAMIN KENDİSİNDE ────────────────────────────
//
// Cam, arkasındaki içeriği kırıp bulandırarak görünür; arkası düz bir sayfa
// zemini olunca (arama ekranları: yalnız tema zemini + hafif dekor) çizilecek
// bir şey yoktur ve alan sayfadan ayırt edilemez, yani kutu "yok" gibi durur.
// Sohbet yazı alanı (ComposerBlur) bundan etkilenmez çünkü altından mesajlar
// kayar.
//
// Eskiden bunun çaresi camın ALTINA tema yüzeyinden ayrı, yarı saydam bir hap
// koymaktı. Cihazda bu, camın arkasında eski düz kutu duruyormuş gibi okundu:
// iki ayrı şekil, iki ayrı kenar (cam sistemin kapsül şeklini, gövde RN köşesini
// çizer; kenarlarda gövdenin rengi cam dışına sızar). Artık TEK katman var ve ton
// camın kendi `tintColor`ından gelir: alan sayfadan ayrışır, ama cam şeffaflığını
// ve kenar ışığını korur, altında başka bir yüzey yoktur.
//
// Cam, çocukların ARKASINDA mutlak katmandır (ComposerBlur ile aynı düzen);
// çocuklar `style`ın verdiği düzende normal akışta durur, camın şekline
// kırpılmaz, dokunuşlar katmana takılmaz.
//
// Form alanları (kayıt, profil düzenleme) BİLEREK bu kabuğu kullanmaz: sınır
// netliği veri girişinde erişilebilirlik için önemlidir ve orada cam yerine
// çerçeveli düz alan daha okunaklıdır. Cam, içerik üstünde yüzen alanlar
// (arama, mesaj yazma) içindir.
import React from "react";
import { StyleSheet, View } from "react-native";
import GlassSurface from "./GlassSurface";
import { useTheme } from "../../context/ThemeContext";
import { useLiquidGlass } from "../../services/liquidGlass";
import { alpha } from "../../theme/colors";

/** Camın dinlenme tonunun opaklığı (tema yüzeyi): alanı düz sayfadan ayırır. */
export const GLASS_FIELD_TINT_ALPHA = 0.55;
/** Odaktayken vurgu tonunun opaklığı. */
export const GLASS_FIELD_FOCUS_TINT_ALPHA = 0.22;

/**
 * @param {number}  [props.height=46]     Cam yolunda SABİT yükseklik (hap = height/2)
 * @param {boolean} [props.focused]       Odaktayken cam vurgu renginde tonlanır
 * @param {string}  [props.accent]        Vurgu rengi (tonlama için)
 * @param {object}  [props.fallbackStyle] Cam yokken kutunun görünümü (zemin, çerçeve, köşe)
 * @param {object}  [props.style]         İki yolda da geçerli yerleşim (padding, margin, gap …)
 */
export default function GlassField({
  height = 46,
  focused = false,
  accent,
  fallbackStyle,
  style,
  children,
  ...rest
}) {
  const glass = useLiquidGlass();
  const { theme } = useTheme();

  // Cam yok: çağıranın eski kutusu. Köşe yarıçapı BİLEREK verilmez — hap
  // yarıçapı `fallbackStyle.borderRadius`u ezmesin, eski görünüm aynen kalsın.
  if (!glass) {
    return (
      <View style={[style, { minHeight: height }, fallbackStyle]} {...rest}>
        {children}
      </View>
    );
  }

  const radius = height / 2;
  const tint =
    focused && accent
      ? alpha(accent, GLASS_FIELD_FOCUS_TINT_ALPHA)
      : alpha(theme.secondary, GLASS_FIELD_TINT_ALPHA);
  return (
    <View style={[style, { height }]} {...rest}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GlassSurface radius={radius} tint={tint} style={StyleSheet.absoluteFill} />
      </View>
      {children}
    </View>
  );
}
