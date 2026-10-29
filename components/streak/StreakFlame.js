// components/streak/StreakFlame.js
//
// Günlük seri ALEVİ — Snapchat'teki 🔥 gibi, ama kademe kademe gelişen, renkli ve
// canlı. Kararlar (kademe, büyüme, sönmek üzere mi) utils/streakFlame.js'te; bu
// dosya yalnız çizer.
//
// YAPI: üç SVG alev katmanı (dış → orta → çekirdek) üst üste; her biri kendi
// Animated.View'ında TABANINDAN (transformOrigin alt-orta) esner, daralır ve
// sallanır. Katmanlar farklı fazda oynadığı için alev "titrer", tek parça
// zıplamaz. Görünüş utils/streakFlame.js streakLook()'tan gelir:
//   palet (AY kademesi)  → 13 renk, ilk ay turuncu … 12. ay Efsane
//   efektler (HAFTA)     → korlar → dalga halkası → yıldızlar → taç (arkada ikinci
//                          alev); 12. ayda dönen gökkuşağı halkası
//   yoğunluk (HAFTA)     → her hafta bir kor / yıldız daha
//   ısı (GÜN)            → titreme enerjisi ve parıltı her gün biraz artar
//   boy (toplam gün)     → hiç küçülmeden büyür
//
// TEK SAAT: bütün hareket tek bir paylaşılan değerden (0→1, doğrusal, sonsuz)
// türer. Her bileşen saat üzerinden TAM SAYI frekanslarla sinüs alır; 1'deki poz
// 0'dakiyle aynıdır, döngü başa sarınca sıçrama görünmez.
//
// DİNLENME POZU GÖRÜNÜR: saat 0'da (hareket kapalıyken de) alev tam boyda ve tam
// opak durur. Reanimated 4.5 yeniden çizimde animasyonlu stilin İLK değerini geri
// yazabiliyor; ilk değer görünmez olsaydı alev kaybolabilirdi
// (bkz. hafıza: reanimated-initial-value-vanish). Korlar bu kuralın bilinçli
// istisnası: yalnız hareket AÇIKKEN çizilirler, durunca hiç yoklar.
//
// `animated` false (Hareketi Azalt, ekran odakta değil, uygulama arka planda):
// saat durur, alev dinlenme pozunda kalır, korlar çizilmez.

import React, { memo, useEffect, useId, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { streakLook } from "@utils/streakFlame";

// `look` verilmezse ilk kademe (turuncu, efektsiz) — çizim asla boş kalmaz.
const FALLBACK_LOOK = streakLook(3);

// Alev çizimi 100 × 128'lik bir kutuda; genişlik = yükseklik × 0,78.
const VIEW_BOX = "0 0 100 128";
export const FLAME_ASPECT = 100 / 128;

// Dış alev: sağa yatık sivri uç + solda ikinci, kısa bir dil (🔥 silueti).
const OUTER_PATH =
  "M54 4 C60 26 88 40 88 76 C88 104 70 124 50 124 C29 124 12 106 12 82 C12 64 20 52 30 42 C30 54 34 62 41 66 C38 44 44 22 54 4 Z";
const MID_PATH =
  "M53 40 C58 58 74 66 74 90 C74 108 63 118 50 118 C37 118 26 108 26 92 C26 80 32 72 39 66 C40 74 43 79 47 81 C45 66 47 52 53 40 Z";
const CORE_PATH =
  "M51 72 C55 82 63 88 63 100 C63 110 57 115 50 115 C43 115 37 110 37 101 C37 93 42 88 45 84 C46 89 48 91 50 92 C49 85 49 79 51 72 Z";
// Dört köşeli pırıltı yıldızı (20 × 20).
const SPARKLE_PATH = "M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z";

// Bir döngünün süresi. Titreme frekansları bunun tam katları (4, 7, 9 …).
const LOOP_MS = 3000;
const TWO_PI = Math.PI * 2;

// Kilitli kademe (ayrıntı sayfasındaki merdivende henüz ulaşılmamış alev).
const LOCKED = Object.freeze({
  outer: ["#4B4E57", "#6B6F7B"],
  mid: ["#5C606B", "#848995"],
  core: ["#9A9EA8", "#C4C7CE"],
});

const RAINBOW = ["#FF1744", "#FF9100", "#FFEA00", "#00E676", "#00B0FF", "#D500F9", "#FF1744"];

// Katman başına hareket genliği. İç katmanlar daha oynak: çekirdek en çok titrer.
const LAYERS = Object.freeze([
  { key: "outer", path: OUTER_PATH, stretch: 0.045, sway: 2.2, phase: 0 },
  { key: "mid", path: MID_PATH, stretch: 0.065, sway: 3.2, phase: 1.7 },
  { key: "core", path: CORE_PATH, stretch: 0.085, sway: 4.2, phase: 3.1 },
]);

// Taç: dış alevin arkasında, kendi fazında oynayan ikinci alev.
const CORONA_LAYER = Object.freeze({ key: "corona", path: OUTER_PATH, stretch: 0.06, sway: 3, phase: 0.9 });

// Korların başlangıç noktası (alev genişliğine oranla, merkezden) ve yan salınımı.
const EMBER_OFFSETS = [-0.16, 0.14, -0.04, 0.2, 0.04, -0.22, 0.1];
// Pırıltıların yeri: [x / genişlik, y / yükseklik]. Alevin çevresinde, üstünde değil.
const SPARKLE_SPOTS = [
  [-0.38, 0.16],
  [1.22, 0.3],
  [-0.3, 0.7],
  [1.16, 0.8],
  [0.5, -0.22],
  [-0.46, 0.44],
];

const FlameLayer = memo(function FlameLayer({ clock, layer, colors, gradId, energy, width, height }) {
  const { stretch, sway, phase } = layer;
  const style = useAnimatedStyle(() => {
    const a = clock.value * TWO_PI;
    const s = energy * stretch;
    const scaleY = 1 + s * (0.65 * Math.sin(4 * a + phase) + 0.35 * Math.sin(9 * a + phase * 1.9));
    const scaleX = 1 - s * 0.45 * (0.6 * Math.sin(4 * a + phase + 0.9) + 0.4 * Math.sin(7 * a + phase));
    const rotate = energy * sway * (0.7 * Math.sin(2 * a + phase) + 0.3 * Math.sin(5 * a + phase * 0.6));
    return { transform: [{ rotate: `${rotate}deg` }, { scaleX }, { scaleY }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.baseOrigin, style]}>
      <Svg width={width} height={height} viewBox={VIEW_BOX}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Path d={layer.path} fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
});

// Alevin arkasındaki yumuşak ışık; nabız gibi hafifçe büyüyüp küçülür.
const Glow = memo(function Glow({ clock, color, diameter, left, top, gradId, energy, strength }) {
  const style = useAnimatedStyle(() => {
    const pulse = Math.sin(2 * clock.value * TWO_PI);
    return {
      opacity: 0.85 + 0.15 * pulse * energy,
      transform: [{ scale: 1 + 0.08 * pulse * energy }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left, top, width: diameter, height: diameter }, style]}>
      <Svg width={diameter} height={diameter}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55 * strength} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.24 * strength} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2} fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
});

// Dışa doğru yayılıp sönen halka (aylık kademe ve üstü). İki halka yarım döngü
// arayla: biri sönerken öteki doğar, dalga kesilmez.
const HaloRing = memo(function HaloRing({ clock, color, diameter, left, top, offset, stroke }) {
  const style = useAnimatedStyle(() => {
    const prog = (clock.value * 2 + offset) % 1;
    return {
      opacity: 0.65 * (1 - prog),
      transform: [{ scale: 0.62 + 0.58 * prog }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left, top, width: diameter, height: diameter }, style]}>
      <Svg width={diameter} height={diameter}>
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={(diameter - stroke) / 2}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
});

// Alevin çevresinde dönen gökkuşağı halkası (yıllık kademe). 360° = bir döngü.
const RainbowRing = memo(function RainbowRing({ clock, diameter, left, top, gradId, stroke }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${clock.value * 360}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left, top, width: diameter, height: diameter }, style]}>
      <Svg width={diameter} height={diameter}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            {RAINBOW.map((color, i) => (
              <Stop key={i} offset={String(i / (RAINBOW.length - 1))} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={(diameter - stroke) / 2}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeOpacity={0.9}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
});

// Alevden kopup yukarı süzülen kor. Doğarken belirir, yükseldikçe küçülüp söner.
const Ember = memo(function Ember({ clock, index, count, color, dot, left, top, rise, drift }) {
  const phase = index / count;
  const style = useAnimatedStyle(() => {
    const prog = (clock.value * 2 + phase) % 1;
    const opacity = prog < 0.12 ? prog / 0.12 : Math.max(0, 1 - (prog - 0.12) / 0.88);
    return {
      opacity,
      transform: [
        { translateX: drift * Math.sin(prog * TWO_PI + index * 1.7) },
        { translateY: -rise * prog },
        { scale: 1 - 0.55 * prog },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.ember,
        { left, top, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color, shadowColor: color },
        style,
      ]}
    />
  );
});

// Yanıp sönen dört köşeli yıldız (yüz gün kademesi ve üstü). 90° dönüş = bir
// döngü; yıldız dört katlı simetrik olduğu için başa sarma görünmez.
const Sparkle = memo(function Sparkle({ clock, index, color, size, left, top }) {
  const style = useAnimatedStyle(() => {
    const a = clock.value * TWO_PI;
    const twinkle = Math.max(0, Math.sin(3 * a + index * 2.1));
    return {
      opacity: 0.35 + 0.65 * twinkle,
      transform: [{ rotate: `${clock.value * 90 + index * 20}deg` }, { scale: 0.4 + 0.6 * twinkle }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left, top, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path d={SPARKLE_PATH} fill={color} />
      </Svg>
    </Animated.View>
  );
});

/**
 * @param {object} props
 * @param {object} props.look  utils/streakFlame.js streakLook() çıktısı:
 *                             { palette, effects, heat, intensity, growth }.
 *                             Yalnız `palette` verilirse efektsiz, tam boy çizilir.
 * @param {number} [props.size=24]    Alevin yüksekliği (pt). Genişlik = size × 0,78.
 *                                    Hale/halka/pırıltılar bu kutunun DIŞINA taşar,
 *                                    yerleşimi büyütmez.
 * @param {boolean} [props.animated=true]
 * @param {boolean} [props.dimmed=false]  Risk/telafi/kalkan: soluk ve zayıf titrer.
 * @param {boolean} [props.locked=false]  Henüz ulaşılmamış kademe: gri, efektsiz.
 */
function StreakFlame({
  look: lookProp,
  size = 24,
  animated = true,
  dimmed = false,
  locked = false,
  style,
  testID,
}) {
  const look = lookProp?.palette ? lookProp : FALLBACK_LOOK;
  const tier = look.palette;
  const effects = look.effects || [];
  const has = (effect) => effects.includes(effect);
  const growth = Number.isFinite(look.growth) ? look.growth : 1;
  const intensity = Math.max(0, Math.floor(Number(look.intensity) || 0));
  const rid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clock = useSharedValue(0);
  const moving = animated && !locked;

  useEffect(() => {
    if (!moving) {
      cancelAnimation(clock);
      clock.value = 0;
      return undefined;
    }
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [moving, clock]);

  const width = Math.round(size * FLAME_ASPECT);
  const height = Math.round(size);
  // Küçük boyda (profildeki ad satırı) efektler seyrek.
  const compact = size < 40;
  // GÜNLÜK KADEME: haftanın her günü alev biraz daha harlı titrer (look.heat).
  const heat = Number.isFinite(look.heat) ? look.heat : 1;
  const energy = (dimmed ? 0.45 : 1) * heat;

  const geo = useMemo(() => {
    const cx = width / 2;
    const glowD = Math.round(height * 1.5);
    const glowCy = height * 0.64;
    const haloD = Math.round(height * 1.3);
    const ringD = Math.round(height * 1.42);
    const ringCy = height * 0.6;
    return {
      glow: { diameter: glowD, left: cx - glowD / 2, top: glowCy - glowD / 2 },
      halo: { diameter: haloD, left: cx - haloD / 2, top: glowCy - haloD / 2, stroke: Math.max(1, height * 0.03) },
      ring: { diameter: ringD, left: cx - ringD / 2, top: ringCy - ringD / 2, stroke: Math.max(1.5, height * 0.035) },
      emberDot: Math.max(2, Math.round(height * 0.065)),
      emberTop: height * 0.42,
      emberRise: height * 0.62,
      emberDrift: width * 0.12,
      sparkle: Math.max(5, Math.round(height * 0.17)),
    };
  }, [width, height]);

  const palette = locked ? LOCKED : tier;
  const showEffects = !locked;
  // HAFTA KADEMESİ efektlerin yoğunluğunu da artırır: her hafta bir kor/yıldız daha.
  const emberCount = Math.min(EMBER_OFFSETS.length, compact ? 2 + Math.floor(intensity / 2) : 3 + intensity);
  const sparkleCount = Math.min(SPARKLE_SPOTS.length, compact ? 2 : 2 + intensity);

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[{ width, height, opacity: dimmed ? 0.62 : 1 }, style]}
    >
      <View style={[StyleSheet.absoluteFill, styles.baseOrigin, { transform: [{ scale: growth }] }]}>
        {showEffects ? (
          <Glow
            clock={clock}
            color={tier.glow}
            gradId={`sfg${rid}`}
            energy={energy}
            strength={dimmed ? 0.5 : Math.min(1.15, 0.8 + 0.25 * heat)}
            {...geo.glow}
          />
        ) : null}
        {showEffects && !dimmed && has("halo")
          ? [0, 0.5].map((offset) => (
              <HaloRing key={offset} clock={clock} color={tier.glow} offset={offset} {...geo.halo} />
            ))
          : null}
        {showEffects && has("rainbow") ? (
          <RainbowRing clock={clock} gradId={`sfr${rid}`} {...geo.ring} />
        ) : null}
        {showEffects && has("corona") ? (
          // TAÇ: alevin arkasında, daha büyük ve yarı saydam ikinci bir alev — kendi
          // fazında nabız gibi atar. Ölçek sarmalayıcıda, titreme katmanda.
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.baseOrigin, styles.corona]}>
            <FlameLayer
              clock={clock}
              layer={CORONA_LAYER}
              colors={[tier.glow, tier.outer[1]]}
              gradId={`sfc${rid}`}
              energy={energy}
              width={width}
              height={height}
            />
          </View>
        ) : null}
        {LAYERS.map((layer) => (
          <FlameLayer
            key={layer.key}
            clock={clock}
            layer={layer}
            colors={palette[layer.key]}
            gradId={`sf${layer.key}${rid}`}
            energy={energy}
            width={width}
            height={height}
          />
        ))}
        {moving && !dimmed && has("embers")
          ? EMBER_OFFSETS.slice(0, emberCount).map((offset, index) => (
              <Ember
                key={index}
                clock={clock}
                index={index}
                count={emberCount}
                color={tier.ember}
                dot={geo.emberDot}
                left={width / 2 + offset * width - geo.emberDot / 2}
                top={geo.emberTop}
                rise={geo.emberRise}
                drift={geo.emberDrift}
              />
            ))
          : null}
        {showEffects && has("sparkles")
          ? SPARKLE_SPOTS.slice(0, sparkleCount).map(([x, y], index) => (
              <Sparkle
                key={index}
                clock={clock}
                index={index}
                color={tier.ember}
                size={geo.sparkle}
                left={x * width - geo.sparkle / 2}
                top={y * height - geo.sparkle / 2}
              />
            ))
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  // Alev tabanından esner/sallanır; uç oynar, dip yerinde kalır.
  baseOrigin: { transformOrigin: "50% 100%" },
  ember: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 3,
  },
  corona: { opacity: 0.4, transform: [{ scale: 1.24 }] },
});

export default memo(StreakFlame);
