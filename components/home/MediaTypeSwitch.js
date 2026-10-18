// components/home/MediaTypeSwitch.js
//
// Film / Dizi ana ekranının (screens/tabs/DiscoverScreen.js) tepesindeki geçiş:
// iki bölmeli bir hap, seçili bölmenin altında yaylanarak kayan vurgu hapı. Eskiden
// alt çubukta iki ayrı sekmeydi; artık tek sekme + bu anahtar.
//
// GÖRSEL DİL: yanındaki arama düğmesiyle (DiscoverSearchAction) AYNI kabuk — iOS 26+'da
// Liquid Glass (GlassField), cam çizilemeyen yerde (Android, iOS 18–25, Efektler: Kapalı)
// tema yüzeyli, çerçeveli, hafif gölgeli kutu. Aynı satırda yan yana durunca ikisi tek
// aileden görünür (yükseklikleri ve tonları birebir; bkz. DiscoverSearchAction).
//
// ── NEDEN REANIMATED DEĞİL, RN Animated ──────────────────────────────────────
//
// Vurgu hapının dinlenme konumu kimlik DEĞİL (Dizi seçiliyken sağ bölmede durur).
// Reanimated 4.5 animasyonlu bir bileşen yeniden çizildiğinde stilin İLK değerini
// görünümün JS stiline yazar ve gerçek değeri yerel kayıttan geri getirir; kayıt
// düşmüşse hap yanlış bölmede kalır (ayrıntı: memory/reanimated-initial-value-vanish).
// RN çekirdek `Animated` değer düğümünü prop'a bağladığı için bu yarışa girmez; native
// sürücüyle de JS iş parçacığından bağımsız akar.
//
// Cam kuralı (components/common/GlassSurface.js): camın atalarında `opacity`
// animasyonu yok; hap yalnız `transform` ile kayar. Hap camın İÇİNDE ayrı bir düz
// katmandır (cam içine cam konmaz).
import React, { memo, useCallback, useEffect, useRef } from "react";
import { Animated, I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassField from "../common/GlassField";
import { useTheme } from "../../context/ThemeContext";
import useReduceMotion from "../../hooks/useReduceMotion";
import { selectionAsync } from "../../services/hapticsService";
import { alpha } from "../../theme/colors";
import { MEDIA_TYPES } from "../../utils/discoverMedia";
import { COMPACT_BELOW, SEGMENT_MAX } from "../../utils/discoverHeaderLayout";

/** Anahtarın yüksekliği; cam yolunda sabit. Arama düğmesinden biraz ince. */
export const MEDIA_SWITCH_HEIGHT = 46;
const PAD = 4;
/** Bölmenin varsayılan (en geniş) genişliği. Dar ekranda `segmentWidth` prop'uyla daralır (utils/discoverHeaderLayout.js). */
const SEGMENT_WIDTH = SEGMENT_MAX;
const SEGMENT_HEIGHT = MEDIA_SWITCH_HEIGHT - PAD * 2;
/** Anahtarın toplam genişliği (iki bölme + iç boşluk; cam yolunda — eski kutuda +2 px çerçeve). */
export const MEDIA_SWITCH_WIDTH = SEGMENT_WIDTH * 2 + PAD * 2;

// Alt sekme çubuğu ve Notlar sekmesiyle aynı yay.
const SPRING = { mass: 0.6, damping: 18, stiffness: 220 };

const ICONS = {
  tv: { on: "tv", off: "tv-outline" },
  movie: { on: "videocam", off: "videocam-outline" },
};

const Segment = memo(function Segment({ type, label, selected, theme, onPress, width, compact }) {
  const accent = theme.accent ?? "#3B82F6";
  const icon = ICONS[type];
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={`media-switch-${type}`}
      onPress={() => onPress(type)}
      style={[styles.segment, { width }, compact && styles.segmentCompact]}
    >
      {/* Kompakt kip (dar ekran): simge kalkar, yazı o yeri alır. */}
      {compact ? null : (
        <Ionicons name={selected ? icon.on : icon.off} size={17} color={selected ? accent : theme.text?.muted ?? "#8A8A8E"} />
      )}
      {/* Yazı kalınlığı seçimle DEĞİŞMEZ (genişlik titremesin); uzun çeviriler küçülür. */}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.label, { color: selected ? theme.text?.primary : theme.text?.secondary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

/**
 * @param {"tv"|"movie"} props.value
 * @param {(type: "tv"|"movie") => void} props.onChange
 * @param {{tv: string, movie: string}} props.labels  Bölme etiketleri (çevrilmiş)
 * @param {number} [props.segmentWidth]  Bölme genişliği (varsayılan 112); daralırsa ve `COMPACT_BELOW`
 *   altına inerse anahtar kompakt olur (simgesiz). Bkz. utils/discoverHeaderLayout.js.
 */
function MediaTypeSwitch({ value, onChange, labels, segmentWidth = SEGMENT_WIDTH }) {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const accent = theme.accent ?? "#3B82F6";
  const index = Math.max(0, MEDIA_TYPES.indexOf(value));
  const position = useRef(new Animated.Value(index)).current;
  const rtl = I18nManager.isRTL;

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(index);
      return undefined;
    }
    const animation = Animated.spring(position, { toValue: index, useNativeDriver: true, ...SPRING });
    animation.start();
    return () => animation.stop();
  }, [index, reduceMotion, position]);

  const handlePress = useCallback(
    (type) => {
      if (type === value) return;
      selectionAsync().catch(() => {});
      onChange(type);
    },
    [onChange, value],
  );

  const compact = segmentWidth < COMPACT_BELOW;
  const travel = segmentWidth * (rtl ? -1 : 1);
  const thumbTranslate = position.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });

  return (
    <GlassField
      height={MEDIA_SWITCH_HEIGHT}
      accent={accent}
      style={styles.track}
      fallbackStyle={[
        styles.fallbackBox,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      {/* Çocuklar iç kapta: vurgu hapı ve bölmeler AYNI koordinat sisteminde, bu
          yüzden cam/eski kutu arasındaki 1 px çerçeve farkı hizayı bozmaz. */}
      <View accessibilityRole="tablist" style={[styles.inner, { width: segmentWidth * 2 }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: segmentWidth },
            rtl ? styles.thumbRtl : styles.thumbLtr,
            { borderColor: alpha(accent, 0.55), transform: [{ translateX: thumbTranslate }] },
          ]}
        >
          <LinearGradient
            colors={[alpha(accent, 0.3), alpha(accent, 0.12)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {MEDIA_TYPES.map((type) => (
          <Segment
            key={type}
            type={type}
            label={labels[type]}
            selected={type === value}
            theme={theme}
            onPress={handlePress}
            width={segmentWidth}
            compact={compact}
          />
        ))}
      </View>
    </GlassField>
  );
}

export default memo(MediaTypeSwitch);

const styles = StyleSheet.create({
  // Genişlik İÇERİKTEN gelir (iki bölme + iç boşluk): cam OLMAYAN yolda 1 px çerçeve
  // kutuya eklenir, sabit bir genişlik bölmeleri iki piksel taşırırdı.
  track: {
    alignSelf: "center",
    padding: PAD,
  },
  // Cam OLMAYAN yol: arama düğmesinin eski kutusuyla aynı çerçeve + yumuşak gölge.
  // Cam kendi derinliğini çizer, RN gölgesi cam yoluna EKLENMEZ (GlassSurface, kural 4).
  fallbackBox: {
    borderWidth: 1,
    borderRadius: MEDIA_SWITCH_HEIGHT / 2,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inner: {
    flexDirection: "row",
    width: SEGMENT_WIDTH * 2,
    height: SEGMENT_HEIGHT,
  },
  thumb: {
    position: "absolute",
    top: 0,
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    borderRadius: SEGMENT_HEIGHT / 2,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumbLtr: { left: 0 },
  thumbRtl: { right: 0 },
  segment: {
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  segmentCompact: { gap: 0, paddingHorizontal: 6 },
  label: { flexShrink: 1, fontSize: 14.5, fontWeight: "700", letterSpacing: -0.1 },
});
