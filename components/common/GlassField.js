// components/common/GlassField.js
//
// Arama / yazı alanı kabuğu: iOS 26+'da hap biçimli Liquid Glass (sistemin arama
// çubuğuyla aynı dil), Android'de aynı biçimde buzlu cam, iOS 18–25 ve Efektler
// Kapalı'da çağıranın eski kutusu.
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
// Bu kabuk yüzen arama / mesaj alanları içindir (sabit hap, odakta vurgu tonu).
// Form ve sayfa içi yazı alanları (sayfalar, ayarlar, listeler…) aynı camı
// `GlassBox role="field"` / `GlassTextInput` ile alır: onlar alanın ESKİ
// stilini (köşe, boyut, çok satır) korur, yalnız dolgu/çerçeve camlaşır; durum
// bildiren renkli çerçeve (odak, hata) cam üstünde de çizilir.
import React from "react";
import { StyleSheet, View } from "react-native";
import GlassSurface from "./GlassSurface";
import { GlassNestContext } from "./useGlassChrome";
import { useTheme } from "../../context/ThemeContext";
import { useGlassMode } from "../../services/liquidGlass";
import { alpha } from "../../theme/colors";
import { GLASS_FIELD_FOCUS_TINT_ALPHA, GLASS_FIELD_TINT_ALPHA } from "../../utils/glassChrome";
import { GLASS_MODES } from "../../utils/liquidGlass";

// Camın dinlenme tonunun opaklığı (tema yüzeyi: alanı düz sayfadan ayırır) ve
// odaktayken vurgu tonunun opaklığı utils/glassChrome'da durur (GlassBox da kullanır).
export { GLASS_FIELD_FOCUS_TINT_ALPHA, GLASS_FIELD_TINT_ALPHA };

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
  const mode = useGlassMode();
  const glass = mode === GLASS_MODES.native;
  const { theme } = useTheme();

  // Cam yok: çağıranın eski kutusu. Köşe yarıçapı BİLEREK verilmez — hap
  // yarıçapı `fallbackStyle.borderRadius`u ezmesin, eski görünüm aynen kalsın.
  if (mode === GLASS_MODES.off) {
    return (
      <View style={[style, { minHeight: height }, fallbackStyle]} {...rest}>
        {children}
      </View>
    );
  }

  // Gerçek cam ve Android buzlu camı AYNI yerleşimi kullanır (sabit yükseklik,
  // hap). Buzlu camda yüzey çağıranın eski zemininden gelir, odak kenar ışığının
  // vurgu rengine dönmesiyle anlatılır (yarı saydam vurgu zemini düz sayfada
  // okunaksızlaşırdı).
  const radius = height / 2;
  const focusAccent = focused && accent ? accent : undefined;
  const tint = focusAccent
    ? alpha(focusAccent, GLASS_FIELD_FOCUS_TINT_ALPHA)
    : alpha(theme.secondary, GLASS_FIELD_TINT_ALPHA);
  return (
    <View style={[style, { height }]} {...rest}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GlassSurface
          radius={radius}
          tint={glass ? tint : undefined}
          rim={focusAccent}
          fallbackStyle={glass ? undefined : fallbackStyle}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* İçerideki GlassTouchable/GlassBox camlaşmaz: cam camı örnekleyemez. */}
      <GlassNestContext.Provider value>{children}</GlassNestContext.Provider>
    </View>
  );
}
