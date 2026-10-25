// components/common/GlassSegmentedControl.js
//
// Tam genişlikte, N bölmeli segment anahtarı: hap biçimli kabuk, seçili bölmenin
// altında yaylanarak kayan vurgu hapı. Görsel dil Film/Dizi ana ekranının
// MediaTypeSwitch'iyle aynı (cam kabuk + vurgu gradyanlı hap); o bileşen iki sabit
// bölmeli ve sabit genişlikli, bu ise kabın genişliğine yayılır (bölme = genişlik / N).
//
// Kabuk GlassField: iOS 26+'da Liquid Glass, Android'de buzlu cam, cam çizilemeyen
// yerde tema yüzeyli çerçeveli hap. Vurgu hapı camın İÇİNDE düz bir katmandır (cam
// içine cam konmaz) ve yalnız `transform` ile kayar (camın atalarında opaklık
// animasyonu yok — GlassSurface kural 1). RN Animated: dinlenme konumu kimlik
// olmadığı için Reanimated'in ilk-değer geri yazımına girmez (bkz. MediaTypeSwitch).
//
// Bölme genişliği ölçülene kadar hap çizilmez (ilk karede yanlış yerde durmasın).
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassField from "./GlassField";
import { useTheme } from "../../context/ThemeContext";
import useReduceMotion from "../../hooks/useReduceMotion";
import { selectionAsync } from "../../services/hapticsService";
import { alpha } from "../../theme/colors";

const PAD = 4;
// Alt sekme çubuğu, Notlar sekmesi ve MediaTypeSwitch ile aynı yay.
const SPRING = { mass: 0.6, damping: 18, stiffness: 220 };

const Segment = memo(function Segment({ option, selected, theme, accent, onPress, testID }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}
      testID={testID}
      onPress={() => onPress(option.value)}
      style={styles.segment}
    >
      {option.icon ? (
        <Ionicons
          name={selected ? option.icon : `${option.icon}-outline`}
          size={16}
          color={selected ? accent : theme.text?.muted ?? "#8A8A8E"}
        />
      ) : null}
      {/* Yazı kalınlığı seçimle DEĞİŞMEZ (genişlik titremesin); uzun çeviriler küçülür. */}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.label, { color: selected ? theme.text?.primary : theme.text?.secondary }]}
      >
        {option.label}
      </Text>
    </Pressable>
  );
});

/**
 * @param {{value: string, label: string, icon?: string}[]} props.options
 *   Bölmeler. `icon` Ionicons adı; seçili değilken `-outline` biçimi çizilir.
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {number} [props.height=40]
 * @param {string} [props.accessibilityLabel]  Bölme grubunun adı
 * @param {string} [props.testIDPrefix="segment"]  Bölme testID'si: `${önek}-${value}`
 */
function GlassSegmentedControl({
  options,
  value,
  onChange,
  height = 40,
  accessibilityLabel,
  testIDPrefix = "segment",
  style,
}) {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const accent = theme.accent ?? "#3B82F6";
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const position = useRef(new Animated.Value(index)).current;
  const [innerWidth, setInnerWidth] = useState(0);
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
    (next) => {
      if (next === value) return;
      selectionAsync().catch(() => {});
      onChange(next);
    },
    [onChange, value],
  );

  const onInnerLayout = useCallback((event) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setInnerWidth((prev) => (prev === next ? prev : next));
  }, []);

  const segmentWidth = options.length ? innerWidth / options.length : 0;
  const segmentHeight = height - PAD * 2;
  const thumbTranslate = position.interpolate({
    inputRange: [0, 1],
    outputRange: [0, segmentWidth * (rtl ? -1 : 1)],
  });

  return (
    <GlassField
      height={height}
      accent={accent}
      style={[styles.track, style]}
      fallbackStyle={[
        styles.fallbackBox,
        { borderRadius: height / 2, backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        onLayout={onInnerLayout}
        style={[styles.inner, { height: segmentHeight }]}
      >
        {segmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              rtl ? styles.thumbRtl : styles.thumbLtr,
              {
                width: segmentWidth,
                height: segmentHeight,
                borderRadius: segmentHeight / 2,
                borderColor: alpha(accent, 0.55),
                transform: [{ translateX: thumbTranslate }],
              },
            ]}
          >
            <LinearGradient
              colors={[alpha(accent, 0.3), alpha(accent, 0.12)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        {options.map((option) => (
          <Segment
            key={option.value}
            option={option}
            selected={option.value === value}
            theme={theme}
            accent={accent}
            onPress={handlePress}
            testID={`${testIDPrefix}-${option.value}`}
          />
        ))}
      </View>
    </GlassField>
  );
}

export default memo(GlassSegmentedControl);

const styles = StyleSheet.create({
  track: { padding: PAD },
  // Cam OLMAYAN yol: MediaTypeSwitch'in eski kutusuyla aynı çerçeve + yumuşak gölge.
  // Cam kendi derinliğini çizer, RN gölgesi cam yoluna EKLENMEZ (GlassSurface, kural 4).
  fallbackBox: {
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  inner: { flexDirection: "row" },
  thumb: {
    position: "absolute",
    top: 0,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumbLtr: { left: 0 },
  thumbRtl: { right: 0 },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  label: { flexShrink: 1, fontSize: 14, fontWeight: "700", letterSpacing: -0.1 },
});
