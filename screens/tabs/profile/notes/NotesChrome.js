// screens/tabs/profile/notes/NotesChrome.js
//
// Notlar ekranının "çerçevesi": sekme çubuğu (Notlar / Yapılacaklar / Film-Dizi),
// yapılacaklar süzgeci ve açılıp kapanan arama kutusu için kaydırmalı kabuk.
//
// Eski sekme çubuğu üç sorun taşıyordu:
//   • simge + etiket + sayı TEK satırdı: "Yapılacaklar" dar telefonda kırpılıyor,
//     sayı rozeti 0 → 1 olunca sekmenin içeriği yana kayıyordu;
//   • seçili sekmenin yazı kalınlığı 700 → 800 değişiyor, genişlik titriyordu;
//   • seçim anında "zıplıyordu" (arka plan rengi bir karede değişiyor).
// Burada simge üstte, etiket altta durur; sayı rozeti simgenin KÖŞESİNE biner
// (akışta yer tutmaz), yazı kalınlığı sabit, seçim göstergesi tek bir hap olarak
// yaylanarak kayar (uygulamanın alt sekme çubuğuyla aynı yay + hap dili).
//
// Cam kuralı (bkz. components/common/GlassSurface.js): cam yüzeyin ya da
// atalarının `opacity`si animasyonlanamaz. `RevealBox` bu yüzden `fade={false}`
// ile yalnız yükseklik + `translateY` ile çalışabilir; arama kutusu cam çizilirken
// böyle çağrılır.
import React, { memo, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { selectionAsync } from "../../../../services/hapticsService";
import useReduceMotion from "../../../../hooks/useReduceMotion";
import { alpha } from "../../../../theme/colors";
import { TAB_BAR_PADDING, badgeLabel, segmentWidth } from "../../../../utils/notesView";

// Alt sekme çubuğuyla (components/navigation/TabBar.js) aynı yay.
const SPRING = { mass: 0.6, damping: 18, stiffness: 220 };
const REVEAL_MS = 240;

export const TAB_BAR_HEIGHT = 58;
const TAB_PAD = TAB_BAR_PADDING;
const TAB_RADIUS = TAB_BAR_HEIGHT / 2;

// ─── Açılıp kapanan kabuk ─────────────────────────────────────────────────────
/**
 * `open` true olunca `height` kadar yer açıp çocuğu aşağı kayarak getirir; false
 * olunca kapatıp çocuğu sökmeden ÖNCE animasyonun bitmesini bekler. Alttaki liste
 * böylece zıplamaz, yer yumuşakça açılır/kapanır.
 *
 * @param {number}  props.height  Açıkken kapladığı yükseklik (alt boşluk dahil)
 * @param {boolean} [props.fade=true] false: saydamlık oynatma (cam çocuklar için)
 */
export function RevealBox({ open, height, fade = true, children }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(open ? 1 : 0);
  // Çocuk, kapanış animasyonu bitene kadar sökülmez. `mounted` açılırken render
  // sırasında hemen true olur (efekti beklemek ilk karede bileşeni kaçırırdı).
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const duration = reduceMotion ? 0 : REVEAL_MS;
    if (open) {
      progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
      return undefined;
    }
    progress.value = withTiming(0, { duration, easing: Easing.in(Easing.cubic) });
    const timer = setTimeout(() => setMounted(false), duration + 30);
    return () => clearTimeout(timer);
  }, [open, reduceMotion, progress]);

  const outerStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, height]),
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-14, 0]) }],
    ...(fade ? { opacity: progress.value } : null),
  }));

  if (!mounted) return null;
  return (
    <Animated.View style={[styles.revealOuter, outerStyle]} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[{ height }, innerStyle]}>{children}</Animated.View>
    </Animated.View>
  );
}

// ─── Sekme çubuğu ─────────────────────────────────────────────────────────────
const TabSegment = memo(function TabSegment({
  item,
  index,
  position,
  count,
  theme,
  accent,
  active,
  reduceMotion,
  onPress,
}) {
  const press = useSharedValue(0);
  // Worklet'lere tema NESNESİ değil düz renk dizeleri girer (nesne worklet
  // evrenine kopyalanırken işlev/bileşen taşıyorsa uyarı verir).
  const cPrimary = theme.text.primary;
  const cSecondary = theme.text.secondary;
  const cBadgeIdle = alpha(theme.text.primary, 0.12);
  const cBadgeOn = alpha(accent, 0.9);

  // `position` kesirli sekme sırası: hap iki sekme arasındayken renkler de
  // oransal geçer, yani renk geçişi hapla birlikte akar (ayrı zamanlayıcı yok).
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      position.value,
      [index - 1, index, index + 1],
      [cSecondary, cPrimary, cSecondary],
    ),
  }));
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(position.value, [index - 1, index, index + 1], [0, 1, 0], "clamp"),
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      position.value,
      [index - 1, index, index + 1],
      [cBadgeIdle, cBadgeOn, cBadgeIdle],
    ),
  }));
  const badgeTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      position.value,
      [index - 1, index, index + 1],
      [cSecondary, "#FFFFFF", cSecondary],
    ),
  }));
  // Seçili sekmenin simgesi hafifçe yükselir; basılırken tüm sekme küçülür.
  const bodyStyle = useAnimatedStyle(() => {
    const near = interpolate(position.value, [index - 1, index, index + 1], [0, 1, 0], "clamp");
    return {
      transform: [{ scale: 1 - press.value * 0.06 }, { translateY: -1.5 * near }],
    };
  });

  return (
    <Pressable
      style={styles.segment}
      onPress={() => onPress(item.key)}
      onPressIn={() => {
        if (!reduceMotion) press.value = withSpring(1, SPRING);
      }}
      onPressOut={() => {
        press.value = withSpring(0, SPRING);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count > 0 ? `${item.label}, ${count}` : item.label}
    >
      <Animated.View style={[styles.segmentBody, bodyStyle]}>
        <View style={styles.iconBox}>
          <Ionicons name={`${item.icon}-outline`} size={19} color={theme.text.muted} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconActive, activeIconStyle]}>
            <Ionicons name={item.icon} size={19} color={accent} />
          </Animated.View>
          {count > 0 && (
            <Animated.View style={[styles.badge, badgeStyle]}>
              <Animated.Text allowFontScaling={false} style={[styles.badgeText, badgeTextStyle]}>
                {badgeLabel(count)}
              </Animated.Text>
            </Animated.View>
          )}
        </View>
        {/* Uzun çeviriler ("Movie / TV Show") kırpılmak yerine küçülür. */}
        <Animated.Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.label, labelStyle]}
        >
          {item.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

/**
 * @param {Array<{key:string,label:string,icon:string}>} props.tabs
 * @param {string} props.value        Seçili sekmenin anahtarı
 * @param {object} props.counts       { [key]: sayı }
 */
export function NotesTabBar({ tabs, value, counts, onChange, theme, accent }) {
  const reduceMotion = useReduceMotion();
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === value),
  );
  const position = useSharedValue(activeIndex);
  const segW = useSharedValue(0);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    position.value = reduceMotion ? activeIndex : withSpring(activeIndex, SPRING);
  }, [activeIndex, reduceMotion, position]);

  const thumbStyle = useAnimatedStyle(() => ({
    width: segW.value,
    transform: [{ translateX: position.value * segW.value }],
  }));

  const handleLayout = (event) => {
    segW.value = segmentWidth(event.nativeEvent.layout.width, tabs.length, StyleSheet.hairlineWidth);
    setMeasured(true);
  };

  const handlePress = (key) => {
    if (key === value) return;
    selectionAsync().catch(() => {});
    onChange(key);
  };

  return (
    <View
      onLayout={handleLayout}
      style={[styles.track, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      {/* Seçim hapı: ölçülmeden önce çizilmez (genişlik 0 → kısa süre sol üstte
          görünmesin). Cam değil, düz katman: `opacity` serbest. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          { borderColor: alpha(accent, 0.55), opacity: measured ? 1 : 0 },
          thumbStyle,
        ]}
      >
        <LinearGradient
          colors={[alpha(accent, 0.3), alpha(accent, 0.12)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {tabs.map((item, index) => (
        <TabSegment
          key={item.key}
          item={item}
          index={index}
          position={position}
          count={counts[item.key] || 0}
          theme={theme}
          accent={accent}
          active={item.key === value}
          reduceMotion={reduceMotion}
          onPress={handlePress}
        />
      ))}
    </View>
  );
}

// ─── Yapılacaklar süzgeci ─────────────────────────────────────────────────────
export const FILTER_ROW_HEIGHT = 46;
const PILL_HEIGHT = 34;

const FilterPill = memo(function FilterPill({ label, count, active, theme, accent, onPress }) {
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 200 });
  }, [active, progress]);
  const cSurface = theme.secondary;
  const cBorder = theme.border;
  const cSecondary = theme.text.secondary;
  const cMuted = theme.text.muted;

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [cSurface, accent]),
    borderColor: interpolateColor(progress.value, [0, 1], [cBorder, accent]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [cSecondary, "#FFFFFF"]),
  }));
  const countStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [cMuted, "rgba(255,255,255,0.85)"]),
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.pillPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${count}`}
    >
      <Animated.View style={[styles.pill, pillStyle]}>
        <Animated.Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.pillText, labelStyle]}
        >
          {label}
        </Animated.Text>
        <Animated.Text allowFontScaling={false} style={[styles.pillCount, countStyle]}>
          {count}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

/** Yapılacaklar durum süzgeci; `visible` false iken yer kaplamaz (kayarak kapanır). */
export function NotesFilterRow({ visible, filters, value, counts, onChange, theme, accent }) {
  return (
    <RevealBox open={visible} height={FILTER_ROW_HEIGHT}>
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <FilterPill
            key={f.key}
            label={f.label}
            count={counts[f.key] ?? 0}
            active={value === f.key}
            theme={theme}
            accent={accent}
            onPress={() => onChange(f.key)}
          />
        ))}
      </View>
    </RevealBox>
  );
}

const styles = StyleSheet.create({
  revealOuter: { overflow: "hidden" },

  // Sekme çubuğu
  track: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: TAB_PAD,
    borderRadius: TAB_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    position: "absolute",
    top: TAB_PAD,
    left: TAB_PAD,
    height: TAB_BAR_HEIGHT - TAB_PAD * 2 - StyleSheet.hairlineWidth * 2,
    borderRadius: TAB_RADIUS - TAB_PAD,
    borderWidth: 1,
    overflow: "hidden",
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  segmentBody: { alignItems: "center", justifyContent: "center", gap: 3 },
  iconBox: { width: 22, height: 20, alignItems: "center", justifyContent: "center" },
  iconActive: { alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11.5, fontWeight: "700", letterSpacing: -0.1 },
  badge: {
    position: "absolute",
    // Soldan sabit: "99+" gibi geniş rozet sağa doğru büyür, simgenin üstüne binmez.
    top: -6,
    left: 15,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9.5, fontWeight: "800" },

  // Süzgeç
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  // 320 pt'lik ekranda üç hap yan yana sığmıyordu (sağdaki taşıyordu): hap
  // daralabilir, etiket önce yazıyı küçültür.
  pillPress: { flexShrink: 1 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: PILL_HEIGHT,
    paddingHorizontal: 11,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
  },
  pillText: { flexShrink: 1, fontSize: 12.5, fontWeight: "800" },
  pillCount: { fontSize: 11.5, fontWeight: "800" },
});
