// components/toast/ToastOrb.js
//
// Toast'ın solundaki animasyonlu ikon rozeti. Her tür kendi hareketiyle gelir:
//
//   success  yaylanarak belirir, tik ÇİZİLİR, ardından bir halka yayılır
//   error    belirirken yana titrer, çarpı çizilir
//   warning  ünlem çizilir, rozet iki kez nabız atar
//   info     "i" çizilir, halka yayılır
//   loading  dönen yay (kalıcı; sonuç gelince aynı kartta başarı/hataya dönüşür)
//   premium  yıldız yaylanır, çevresine altın kıvılcımlar saçılır
//
// REANIMATED KURALI (bkz. memory/reanimated-initial-value-vanish): Reanimated 4.5 animasyonlu
// stilin/props'un İLK değerini yeniden çizimde geri yazabiliyor. Bu yüzden "kalıcı" her değerin
// ilk/dinlenme değeri GÖRÜNÜR durumdur (ölçek 1, çizgi tam çizili); giriş hareketi efektte
// "gizliye atla → oynat" diye başlar. Yalnız süs olan katmanlar (halka, kıvılcım) dinlenme
// değerinde GİZLİDİR; onlar için geri yazılan ilk değer zaten doğru olandır.
//
// "Hareketi Azalt" açıkken hiçbir hareket oynamaz; glif doğrudan çizili durur (yükleniyor
// dönüşü işlevsel olduğu için kalır).

import React, { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ORB_SIZE = 42;
const ORB_RADIUS = 15;
const STROKE = "#FFFFFF";

// Çizgi uzunlukları (24x24 görünüm kutusunda, dash hesabı için biraz payla).
const CHECK_LEN = 18;
const CROSS_LEN = 12;
const BAR_LEN = 7.5;
const RING_R = 8.6;
const RING_LEN = 2 * Math.PI * RING_R;

const STAR_PATH =
  "M12 3.3 L14.55 9.05 L20.8 9.65 L16.1 13.8 L17.5 19.95 L12 16.75 L6.5 19.95 L7.9 13.8 L3.2 9.65 L9.45 9.05 Z";

/** Çizgi çizme ilerlemesi: dinlenme 1 (çizili); oynarken 0'a atlayıp 1'e çizilir. */
function useDraw(delay, reduceMotion) {
  const draw = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    draw.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(delay, withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) })),
    );
  }, [delay, draw, reduceMotion]);
  return draw;
}

const strokeProps = {
  stroke: STROKE,
  strokeWidth: 2.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
};

function CheckGlyph({ reduceMotion }) {
  const draw = useDraw(120, reduceMotion);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LEN * (1 - draw.value),
  }));
  return (
    <AnimatedPath
      d="M6.2 12.5 L10.3 16.6 L17.9 8.4"
      {...strokeProps}
      strokeDasharray={[CHECK_LEN, CHECK_LEN]}
      animatedProps={animatedProps}
    />
  );
}

function CrossGlyph({ reduceMotion }) {
  const draw = useDraw(140, reduceMotion);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CROSS_LEN * (1 - draw.value),
  }));
  return (
    <>
      <AnimatedPath
        d="M8 8 L16 16"
        {...strokeProps}
        strokeDasharray={[CROSS_LEN, CROSS_LEN]}
        animatedProps={animatedProps}
      />
      <AnimatedPath
        d="M16 8 L8 16"
        {...strokeProps}
        strokeDasharray={[CROSS_LEN, CROSS_LEN]}
        animatedProps={animatedProps}
      />
    </>
  );
}

// Ünlem: üstte çizgi çizilir, alttaki nokta büyüyerek gelir.
function AlertGlyph({ reduceMotion }) {
  const draw = useDraw(130, reduceMotion);
  const barProps = useAnimatedProps(() => ({
    strokeDashoffset: BAR_LEN * (1 - draw.value),
  }));
  const dotProps = useAnimatedProps(() => ({ r: 1.6 * draw.value }));
  return (
    <>
      <AnimatedPath
        d="M12 6.4 L12 13.2"
        {...strokeProps}
        strokeDasharray={[BAR_LEN, BAR_LEN]}
        animatedProps={barProps}
      />
      <AnimatedCircle cx={12} cy={17.5} r={1.6} fill={STROKE} animatedProps={dotProps} />
    </>
  );
}

// "i": nokta üstte, gövde çizilir.
function InfoGlyph({ reduceMotion }) {
  const draw = useDraw(130, reduceMotion);
  const barProps = useAnimatedProps(() => ({
    strokeDashoffset: BAR_LEN * (1 - draw.value),
  }));
  const dotProps = useAnimatedProps(() => ({ r: 1.6 * draw.value }));
  return (
    <>
      <AnimatedCircle cx={12} cy={6.9} r={1.6} fill={STROKE} animatedProps={dotProps} />
      <AnimatedPath
        d="M12 10.9 L12 17.6"
        {...strokeProps}
        strokeDasharray={[BAR_LEN, BAR_LEN]}
        animatedProps={barProps}
      />
    </>
  );
}

function StarGlyph() {
  return <Path d={STAR_PATH} fill={STROKE} stroke={STROKE} strokeWidth={1.2} strokeLinejoin="round" />;
}

function LoadingGlyph() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
  }, [spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.center, style]}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={RING_R} stroke={STROKE} strokeOpacity={0.28} strokeWidth={2.7} fill="none" />
        <Circle
          cx={12}
          cy={12}
          r={RING_R}
          stroke={STROKE}
          strokeWidth={2.7}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[RING_LEN * 0.28, RING_LEN]}
          transform="rotate(-90 12 12)"
        />
      </Svg>
    </Animated.View>
  );
}

function Glyph({ kind, reduceMotion }) {
  if (kind === "loading") return <LoadingGlyph />;
  let glyph;
  switch (kind) {
    case "success":
      glyph = <CheckGlyph reduceMotion={reduceMotion} />;
      break;
    case "error":
      glyph = <CrossGlyph reduceMotion={reduceMotion} />;
      break;
    case "warning":
      glyph = <AlertGlyph reduceMotion={reduceMotion} />;
      break;
    case "premium":
      glyph = <StarGlyph />;
      break;
    default:
      glyph = <InfoGlyph reduceMotion={reduceMotion} />;
  }
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {glyph}
    </Svg>
  );
}

// ── Kıvılcımlar (premium) ────────────────────────────────────────────────────
const SPARKS = [0, 1, 2, 3, 4, 5].map((i) => ({
  angle: (Math.PI * 2 * i) / 6 - Math.PI / 2 + 0.2,
  dist: 25 + (i % 2) * 6, // orb merkezi kart kenarından ~34 px: kıvılcım kartın içinde kalsın
  size: 4 + (i % 3),
}));

function Spark({ burst, spec, color }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.12, 0.7, 1], [0, 1, 0.9, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: Math.cos(spec.angle) * spec.dist * burst.value },
      { translateY: Math.sin(spec.angle) * spec.dist * burst.value },
      { scale: 1 - burst.value * 0.45 },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        { width: spec.size, height: spec.size, borderRadius: spec.size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

/**
 * @param {object} props
 * @param {"success"|"error"|"warning"|"info"|"loading"|"premium"} props.kind
 * @param {{ orb:string[], main:string, soft:string, alt:string }} props.palette
 * @param {boolean} props.reduceMotion
 */
function ToastOrbBase({ kind, palette, reduceMotion }) {
  const pop = useSharedValue(1);
  const shake = useSharedValue(0);
  const pulse = useSharedValue(0);
  const ring = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || kind === "loading") return;
    pop.value = withSequence(
      withTiming(0.5, { duration: 0 }),
      withDelay(40, withSpring(1, { damping: 9, stiffness: 230, mass: 0.7 })),
    );
    if (kind === "error") {
      shake.value = withDelay(
        180,
        withSequence(
          withTiming(-5, { duration: 55 }),
          withTiming(5, { duration: 80 }),
          withTiming(-4, { duration: 70 }),
          withTiming(2.5, { duration: 60 }),
          withTiming(0, { duration: 50 }),
        ),
      );
    } else if (kind === "warning") {
      pulse.value = withDelay(
        200,
        withRepeat(withSequence(withTiming(1, { duration: 190 }), withTiming(0, { duration: 230 })), 2, false),
      );
    } else {
      ring.value = withDelay(150, withTiming(1, { duration: 820, easing: Easing.out(Easing.quad) }));
      if (kind === "premium") {
        burst.value = withDelay(110, withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
      }
    }
  }, [kind, reduceMotion, pop, shake, pulse, ring, burst]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: pop.value * (1 + pulse.value * 0.12) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.02, 1], [0, 0.55, 0], Extrapolation.CLAMP),
    transform: [{ scale: 1 + ring.value * 0.85 }],
  }));

  return (
    <View style={styles.slot} pointerEvents="none">
      <Animated.View style={[styles.ring, { borderColor: palette.soft }, ringStyle]} />
      {/* Gölge dış katmanda: iOS'ta overflow:hidden aynı görünümün gölgesini de keser. */}
      <Animated.View
        style={[styles.orb, { shadowColor: palette.main, backgroundColor: palette.deep }, orbStyle]}
      >
        <View style={styles.orbClip}>
          <LinearGradient colors={palette.orb} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {/* Üst-sol ışık: düz gradyanı cam/metal hissine taşır. */}
          <LinearGradient
            colors={["rgba(255,255,255,0.34)", "rgba(255,255,255,0)"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.7, y: 0.75 }}
            style={StyleSheet.absoluteFill}
          />
          <Glyph kind={kind} reduceMotion={reduceMotion} />
        </View>
      </Animated.View>
      {kind === "premium"
        ? SPARKS.map((spec, i) => (
            <Spark key={i} burst={burst} spec={spec} color={i % 2 ? palette.soft : palette.alt} />
          ))
        : null}
    </View>
  );
}

export const ToastOrb = memo(ToastOrbBase);

const styles = StyleSheet.create({
  // Kıvılcım/halka orb sınırının dışına taşar: yuva orb kadar, taşma serbest.
  slot: { width: ORB_SIZE, height: ORB_SIZE, alignItems: "center", justifyContent: "center" },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_RADIUS,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  orbClip: {
    flex: 1,
    borderRadius: ORB_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_RADIUS,
    borderWidth: 2,
  },
  spark: { position: "absolute" },
  center: { alignItems: "center", justifyContent: "center" },
});
