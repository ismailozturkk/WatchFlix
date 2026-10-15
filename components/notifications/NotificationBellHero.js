// components/notifications/NotificationBellHero.js
//
// Bildirim ön-açıklama sayfasının üst sahnesi: accent renkli zil rozeti, etrafında
// yayılan halkalar, rozetin köşesinde beliren "1" noktası ve kullanıcının izinle
// kazanacağı şeyleri simgeleyen üç küçük çip (hatırlatma / mesaj / beğeni).
//
// NEDEN AYRI DOSYA: sayfanın kendisi (NotificationPrimingSheet) metin, fayda
// satırları ve düğmelerden oluşuyor; buradaki hareket dili (döngüler, yay
// animasyonları) onun okunurluğunu bozmasın diye ayrıldı.
//
// HAREKET: hepsi Reanimated paylaşılan değerleriyle, yani JS iş parçacığından
// bağımsız. `animate=false` ("Hareketi Azalt" açık) iken hiçbir döngü
// başlamaz — sahne statik ama eksiksiz görünür (halka sabit, nokta yerinde).
//
// Bu bileşenler yalnız sayfa AÇIKKEN monte ediliyor (BottomSheetModal kapanınca
// çocukları söküyor); döngüler cleanup'ta `cancelAnimation` ile durduruluyor.

import React, { useEffect, useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import { isLightSurface, shiftLightness } from "../../utils/colorUtils";

// Rozetin köşesindeki "okunmamış" noktası. Tema rengi DEĞİL: kırmızı nokta
// "yeni bildirim" anlamını her temada aynı taşıyor.
const DOT_RED = "#FF3B30";

// Çiplerin tonları. `accent` yerine tema rengini çağıran taraf geçiriyor.
const CHIP_GREEN = "#22C55E";
const CHIP_ROSE = "#F43F5E";

// Halkanın rozete göre en büyük ölçeği; sahne yüksekliği buna bağlı.
const RIPPLE_MAX_SCALE = 1.7;

// ── Sayfa arkası ışıma ───────────────────────────────────────────────────────

/**
 * Sayfanın üst kenarından inen accent ışıması. Radyal degrade SVG ile çiziliyor:
 * blur istemediği için Android'de de aynı görünür (bkz. AuthBackdrop).
 */
export function SheetGlow({ accent, isLightTheme }) {
  // id ÇAKIŞMASI: react-native-svg'de Defs ad alanı Android'de doküman genelinde
  // global; her örneğe ayrı id (bkz. AuthBackdrop).
  const rid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = `bell${rid}glow`;
  return (
    <View pointerEvents="none" style={styles.glow}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient
            id={gradientId}
            cx="50%"
            cy="30%"
            fx="50%"
            fy="30%"
            rx="78%"
            ry="60%"
          >
            <Stop offset="0" stopColor={accent} stopOpacity={isLightTheme ? 0.3 : 0.4} />
            <Stop offset="0.5" stopColor={accent} stopOpacity={isLightTheme ? 0.1 : 0.13} />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

// ── Yayılan halka ────────────────────────────────────────────────────────────

/**
 * Rozetin ŞEKLİNİ (yuvarlak kare) izleyerek büyüyüp sönen halka. `delay` ile
 * iki halka yarım turluk farkla çalışınca sürekli bir "sinyal" hissi veriyor.
 * Hareketsiz modda tek bir silik halka bırakılır.
 */
function Ripple({ size, radius, color, delay, animate }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animate) return undefined;
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [animate, delay, progress]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, RIPPLE_MAX_SCALE]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        { width: size, height: size, borderRadius: radius, borderColor: color },
        animate ? rippleStyle : styles.rippleStill,
      ]}
    />
  );
}

// ── Süzülen çip ──────────────────────────────────────────────────────────────

/**
 * Rozetin yanında yay animasyonuyla beliren ve sonra hafifçe süzülen küçük
 * daire. Konum, hero'nun ORTASINA göre (dx, dy) verilir.
 */
function FloatingChip({
  icon,
  tone,
  surface,
  size,
  dx,
  dy,
  centerY,
  delay,
  bobDuration,
  animate,
}) {
  const appear = useSharedValue(animate ? 0 : 1);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      appear.value = 1;
      bob.value = 0;
      return undefined;
    }
    appear.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 150 }));
    bob.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: bobDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(5, { duration: bobDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        // reverse=false: her ayak mevcut değerden başlıyor, zaten kesintisiz;
        // reverse=true bir `withSequence`'i GERİ oynatıp titretir.
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(appear);
      cancelAnimation(bob);
    };
  }, [animate, delay, bobDuration, appear, bob]);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(appear.value, [0, 0.6, 1], [0, 1, 1]),
    transform: [{ translateY: bob.value }, { scale: appear.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          top: centerY + dy - size / 2,
          marginLeft: dx - size / 2,
          backgroundColor: surface,
          borderColor: alpha(tone, 0.4),
          shadowColor: tone,
        },
        chipStyle,
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: alpha(tone, 0.14) },
        ]}
      />
      <Ionicons name={icon} size={size * 0.48} color={tone} />
    </Animated.View>
  );
}

// ── Sahne ────────────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {object} props.theme    ThemeContext teması (primary / secondary).
 * @param {string} props.accent   Rozet ve halka rengi.
 * @param {boolean} props.animate Döngüler ve giriş hareketi açık mı.
 * @param {boolean} [props.compact] Kısa ekranlar için küçültülmüş sahne.
 */
export default function NotificationBellHero({ theme, accent, animate, compact }) {
  const size = compact ? 62 : 76;
  // Sahne yüksekliği = halkanın EN BÜYÜK çapı. Sayfanın kaydırma alanı içeriği
  // kırpıyor; halka bunun dışına taşarsa üst kenarda düz kesilmiş görünür.
  const heroHeight = Math.round(size * RIPPLE_MAX_SCALE);
  const radius = size * 0.32;
  const iconSize = Math.round(size * 0.46);
  const foreground = isLightSurface(accent) ? "#111827" : "#FFFFFF";
  const gradient = [shiftLightness(accent, 9), accent, shiftLightness(accent, -14)];

  // Rozetin belirmesi, zilin sallanması, noktanın zıplaması.
  const appear = useSharedValue(animate ? 0 : 1);
  const swing = useSharedValue(0);
  const dot = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) {
      appear.value = 1;
      swing.value = 0;
      dot.value = 1;
      return undefined;
    }
    appear.value = withDelay(120, withSpring(1, { damping: 13, stiffness: 140 }));

    // Zil: kısa, sönümlenen bir sallanma, ardından uzun sessizlik; tekrar.
    const wiggle = withSequence(
      withTiming(16, { duration: 110 }),
      withTiming(-14, { duration: 140 }),
      withTiming(10, { duration: 130 }),
      withTiming(-7, { duration: 120 }),
      withTiming(3, { duration: 100 }),
      withTiming(0, { duration: 100 }),
    );
    swing.value = withDelay(
      760,
      withRepeat(withSequence(wiggle, withDelay(2600, withTiming(0, { duration: 1 }))), -1, false),
    );

    // Nokta: önce yay ile belirir (zil ilk kez çalarken), sonra yavaşça nabız atar.
    dot.value = withDelay(
      820,
      withSequence(
        withSpring(1, { damping: 8, stiffness: 220 }),
        withRepeat(
          withSequence(
            withTiming(1.16, { duration: 760, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 760, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      ),
    );

    return () => {
      cancelAnimation(appear);
      cancelAnimation(swing);
      cancelAnimation(dot);
    };
  }, [animate, appear, swing, dot]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(appear.value, [0, 0.5, 1], [0, 1, 1]),
    transform: [{ scale: interpolate(appear.value, [0, 1], [0.55, 1]) }],
  }));

  // Zil üstten asılıymış gibi sallansın: dönüşü, simgenin üst kısmındaki bir
  // eksen etrafında yapmak için önce yukarı, sonra geri kaydırıyoruz.
  const pivot = iconSize * 0.36;
  const bellStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -pivot },
      { rotate: `${swing.value}deg` },
      { translateY: pivot },
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, dot.value * 2),
    transform: [{ scale: dot.value }],
  }));

  const centerY = heroHeight / 2;

  return (
    <View
      style={[styles.hero, { height: heroHeight }]}
      // Süs: ekran okuyucu için anlamlı içerik yok, başlık zaten söylüyor.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <FloatingChip
        icon="alarm-outline"
        tone={accent}
        surface={theme.secondary}
        size={compact ? 32 : 36}
        dx={-98}
        dy={-22}
        centerY={centerY}
        delay={430}
        bobDuration={2300}
        animate={animate}
      />
      <FloatingChip
        icon="chatbubble-ellipses-outline"
        tone={CHIP_GREEN}
        surface={theme.secondary}
        size={compact ? 36 : 40}
        dx={96}
        dy={-6}
        centerY={centerY}
        delay={560}
        bobDuration={2700}
        animate={animate}
      />
      <FloatingChip
        icon="heart"
        tone={CHIP_ROSE}
        surface={theme.secondary}
        size={compact ? 26 : 30}
        dx={-70}
        dy={34}
        centerY={centerY}
        delay={690}
        bobDuration={2100}
        animate={animate}
      />

      <Animated.View style={[{ width: size, height: size }, badgeStyle]}>
        <Ripple
          size={size}
          radius={radius}
          color={alpha(accent, 0.7)}
          delay={900}
          animate={animate}
        />
        <Ripple
          size={size}
          radius={radius}
          color={alpha(accent, 0.7)}
          delay={2200}
          animate={animate}
        />

        {/* Gölge OPAK bir tabanda durur: yarı saydam gövdeye `elevation` verilirse
            Android gölgeyi içeriden de gösterir (bkz. AuthBadge). */}
        <View
          style={[
            styles.badge,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: accent,
              shadowColor: accent,
            },
          ]}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.badgeFill, { borderRadius: radius }]}
          >
            <Animated.View style={bellStyle}>
              <Ionicons name="notifications" size={iconSize} color={foreground} />
            </Animated.View>
          </LinearGradient>
          {/* Üst-sol köşeden süzülen ışık: düz renkli rozete hacim veriyor. */}
          <LinearGradient
            pointerEvents="none"
            colors={[alpha("#FFFFFF", 0.3), alpha("#FFFFFF", 0)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.75, y: 0.75 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          />
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.dot, { borderColor: theme.primary }, dotStyle]}
        >
          <Text allowFontScaling={false} style={styles.dotText}>
            1
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  hero: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  ripple: {
    position: "absolute",
    top: 0,
    left: 0,
    borderWidth: 1.5,
  },
  rippleStill: {
    opacity: 0.3,
    transform: [{ scale: 1.32 }],
  },
  chip: {
    position: "absolute",
    left: "50%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  badge: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
    elevation: 10,
  },
  badgeFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    backgroundColor: DOT_RED,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: {
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
  },
});
