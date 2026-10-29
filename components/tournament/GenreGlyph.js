// components/tournament/GenreGlyph.js
//
// Ayın türünün ANİMASYONLU simgesi — turnuva kartının/hero'sunun köşesinde
// duran cam bir rozet. Simge ve hareket türden gelir (genreMeta.js):
// Bilim Kurgu'da gezegenin etrafında uydu döner, Romantik'te kalp atar,
// Korku'da hayalet süzülüp titrer, Suç'ta parmak izini tarayıcı çizgi geçer…
//
// Tüm hareket TEK bir paylaşılan değerden (t: 0→1, döngüsel) türer ve UI
// thread'de çalışır; JS thread'e dokunmaz. "Hareketi azalt" açıksa
// (ReduceMotion.System) t uca atlar — anahtar karelerin ucu dinlenme durumu
// olduğu için simge düz ve görünür durur. Süs öğesidir: dokunulmaz, ekran
// okuyucuya görünmez (tür adı kartın kendi etiketinde zaten söylenir).

import React, { memo, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation,
  Easing, ReduceMotion,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { GLYPH_MOTIONS, sampleKeyframes } from "@components/tournament/genreMeta";

const TAU = Math.PI * 2;
const ORBIT_TILT = (-24 * Math.PI) / 180;
const ORBIT_SQUASH = 0.36;

// Yörünge: eğik elips halka + üzerinde dönen uydu. Uydu halkanın ARKA
// yarısındayken (gezegenin arkası) solar → derinlik hissi.
function Orbit({ t, size, color }) {
  const r = size * 0.62;
  const dot = Math.max(4, Math.round(size * 0.1));
  const dotStyle = useAnimatedStyle(() => {
    const a = t.value * TAU;
    const ex = Math.cos(a) * r;
    const ey = Math.sin(a) * r * ORBIT_SQUASH;
    const c = Math.cos(ORBIT_TILT);
    const s = Math.sin(ORBIT_TILT);
    return {
      opacity: Math.sin(a) < -0.05 ? 0.35 : 1,
      transform: [{ translateX: ex * c - ey * s }, { translateY: ex * s + ey * c }],
    };
  });
  return (
    <>
      <View
        style={[
          styles.orbitRing,
          {
            width: 2 * r, height: 2 * r, borderRadius: r,
            left: size / 2 - r, top: size / 2 - r, borderColor: color,
            transform: [{ rotate: `${(ORBIT_TILT * 180) / Math.PI}deg` }, { scaleY: ORBIT_SQUASH }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.abs,
          {
            width: dot, height: dot, borderRadius: dot / 2,
            left: size / 2 - dot / 2, top: size / 2 - dot / 2,
            backgroundColor: color, shadowColor: color,
          },
          styles.dotShadow,
          dotStyle,
        ]}
      />
    </>
  );
}

// Kalp atışıyla genişleyip sönen halka.
function Ripple({ t, size, color }) {
  const style = useAnimatedStyle(() => ({
    opacity: sampleKeyframes(t.value, [0, 0.1, 0.14, 0.6, 1], [0, 0, 0.7, 0, 0]),
    transform: [{ scale: sampleKeyframes(t.value, [0, 0.12, 0.6, 1], [1, 1, 1.55, 1.55]) }],
  }));
  return (
    <Animated.View
      style={[
        styles.abs,
        { width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, left: 0, top: 0 },
        style,
      ]}
    />
  );
}

// Parmak izinin üstünden yukarıdan aşağı geçen tarayıcı çizgi (rozetin içinde kırpılır).
function Scan({ t, size, color }) {
  const w = size * 0.6;
  const style = useAnimatedStyle(() => ({
    opacity: sampleKeyframes(t.value, [0, 0.06, 0.62, 0.7, 1], [0, 1, 1, 0, 0]),
    transform: [{ translateY: sampleKeyframes(t.value, [0, 0.7, 1], [-size * 0.3, size * 0.3, size * 0.3]) }],
  }));
  return (
    <View style={[styles.abs, styles.clip, { width: size, height: size, borderRadius: size / 2, left: 0, top: 0 }]}>
      <Animated.View
        style={[
          styles.abs,
          { width: w, height: 2, borderRadius: 1, left: (size - w) / 2, top: size / 2 - 1, backgroundColor: color, shadowColor: color },
          styles.dotShadow,
          style,
        ]}
      />
    </View>
  );
}

// Asanın ucunda sırayla parlayıp sönen iki kıvılcım.
function Sparkle({ t, size, color, x, y, at }) {
  const s = Math.round(size * 0.22);
  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: sampleKeyframes(t.value, [0, at, at + 0.14, at + 0.28, 1], [0, 0, 1, 0, 0]) },
      { rotate: `${t.value * 180}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.abs, { left: x - s / 2, top: y - s / 2 }, style]}>
      <AppIcon family="MaterialCommunityIcons" name="star-four-points" size={s} color={color} />
    </Animated.View>
  );
}

function GenreGlyph({ meta, size = 56, style }) {
  const motion = GLYPH_MOTIONS[meta?.motion] || GLYPH_MOTIONS.sway;
  const glow = meta?.glow || "#FFFFFF";
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: motion.period, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t, motion]);

  const iconStyle = useAnimatedStyle(() => {
    const p = t.value;
    const k = (arr, rest) => (arr ? sampleKeyframes(p, motion.input, arr) : rest);
    return {
      opacity: k(motion.opacity, 1),
      transform: [
        { translateX: k(motion.translateX, 0) },
        { translateY: k(motion.translateY, 0) },
        { rotate: `${k(motion.rotate, 0)}deg` },
        { scale: k(motion.scale, 1) },
        { scaleX: k(motion.scaleX, 1) },
        { scaleY: k(motion.scaleY, 1) },
      ],
    };
  });

  // Rozetin arkasındaki renkli hale yavaşça "nefes alır".
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.07 * Math.sin(t.value * TAU) }],
  }));

  const halo = Math.round(size * 1.24);
  const iconSize = Math.round(size * 0.5);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, style]}
    >
      <Animated.View
        style={[
          styles.abs,
          {
            width: halo, height: halo, borderRadius: halo / 2,
            left: (size - halo) / 2, top: (size - halo) / 2, backgroundColor: glow,
          },
          styles.halo,
          haloStyle,
        ]}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.34)", "rgba(255,255,255,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
      />
      {motion.extra === "scan" && <Scan t={t} size={size} color={glow} />}
      {motion.extra === "ripple" && <Ripple t={t} size={size} color={glow} />}
      <View style={[styles.abs, styles.center, { width: size, height: size, left: 0, top: 0 }]}>
        <Animated.View style={iconStyle}>
          <AppIcon
            family={meta?.icon?.family || "Ionicons"}
            name={meta?.icon?.name || "trophy"}
            size={iconSize}
            color="#FFFFFF"
            style={[styles.iconGlow, { textShadowColor: glow }]}
          />
        </Animated.View>
      </View>
      {motion.extra === "orbit" && <Orbit t={t} size={size} color={glow} />}
      {motion.extra === "sparkle" && (
        <>
          <Sparkle t={t} size={size} color={glow} x={size * 0.8} y={size * 0.2} at={0.12} />
          <Sparkle t={t} size={size} color={glow} x={size * 0.92} y={size * 0.5} at={0.3} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  center: { alignItems: "center", justifyContent: "center" },
  clip: { overflow: "hidden" },
  halo: { opacity: 0.22 },
  badge: {
    position: "absolute", left: 0, top: 0,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.38)",
  },
  iconGlow: { textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  orbitRing: { position: "absolute", borderWidth: 1.4, opacity: 0.75 },
  dotShadow: { shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
});

export default memo(GenreGlyph);
