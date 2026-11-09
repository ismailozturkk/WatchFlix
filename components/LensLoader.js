// components/LensLoader.js
//
// Uygulamanın yükleme göstergesi: ActivityIndicator'ın yerine geçen Lens işareti.
// İki daire (camgöbeği üstte, kırmızı altta) göz kırpar gibi ayrılır, birbirinin
// çevresinde bir tur atar ve yeniden birleşip kesişimde gözü açar — açılış
// animasyonunun (SplashLensIntro) tek nefeslik döngüsü. Hareket modeli saf:
// utils/lensLoaderMotion.js.
//
// API ActivityIndicator ile aynı (`size` "small" | "large" | sayı, `color`,
// `animating`, `hidesWhenStopped`, `style`, `testID`), böylece yer değiştirme tek
// satırdır. İki ton:
//   - "brand" (varsayılan): marka renkleri; `color` yok sayılır. Ekran, bölüm,
//     liste sonu, arama alanı gibi nötr zeminlerde.
//   - "mono": tek renk (`color`), dolu renkli düğmelerin içinde (beyaz/onAccent
//     yazılı düğmeler). Çizgi logo: daireler halka, göz dolu; bebek çizilmez.
//
// KASMA BÜTÇESİ: 4–5 düz View + göz için tek SVG yolu; tüm hareket tek sürücüden
// native interpolate ile (JS thread'i meşgulken de döner). Tablolar boya göre
// modül düzeyinde önbelleklenir (bir listede onlarca gösterge olabilir).
// Hareketi Azalt: işaret yerinde durur, yalnız saydamlık nefes alır.
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import useReduceMotion from "../hooks/useReduceMotion";
import { i18nText } from "../utils/i18nText";
import {
  BASE_ANGLE,
  BOX_UNITS,
  BREATHE_MS,
  CYCLE_MS,
  EYE_LENGTH,
  EYE_WIDTH,
  GLINT_MIN_SIZE,
  LENS,
  LENS_COLORS,
  angleAt,
  breatheAt,
  discScaleAt,
  eyeAt,
  pupilAt,
  resolveLoaderSize,
  sampleLoop,
  sepAt,
} from "../utils/lensLoaderMotion";

const EPS = 0.0001; // sıfır ölçek yerine (tekil dönüşüm matrisi olmasın)
const MONO_RING_MIN = 1.5;
const MONO_RING_RATIO = 0.075;

const EYE_VIEWBOX = `${-EYE_LENGTH / 2} ${-EYE_WIDTH / 2} ${EYE_LENGTH} ${EYE_WIDTH}`;
const EYE_PATH = `M0 ${-EYE_WIDTH / 2}A${LENS.r} ${LENS.r} 0 0 1 0 ${EYE_WIDTH / 2}A${LENS.r} ${LENS.r} 0 0 1 0 ${-EYE_WIDTH / 2}Z`;

// Birimsiz tablolar bir kez; yalnız dairelerin ötelenmesi boya bağlı.
const TABLES = {
  angle: sampleLoop(angleAt, { map: (v) => `${v}deg` }),
  disc: sampleLoop(discScaleAt),
  eyeAlong: sampleLoop((x) => Math.max(EPS, eyeAt(x)[0])),
  eyeAcross: sampleLoop((x) => Math.max(EPS, eyeAt(x)[1])),
  pupil: sampleLoop((x) => Math.max(EPS, pupilAt(x))),
  breathe: sampleLoop(breatheAt, { steps: 48 }),
};
const halfTables = new Map();
function halfTable(size) {
  let table = halfTables.get(size);
  if (!table) {
    const u = size / BOX_UNITS;
    table = sampleLoop((x) => (sepAt(x) / 2) * u);
    halfTables.set(size, table);
  }
  return table;
}

const CLAMP = { extrapolate: "clamp" };
const lerp = (driver, table) => driver.interpolate({ ...table, ...CLAMP });

// Kutu merkezine göre konum: ölçüsüz, onLayout gerektirmez.
const centered = (width, height) => ({
  position: "absolute",
  left: "50%",
  top: "50%",
  marginLeft: -width / 2,
  marginTop: -height / 2,
  width,
  height,
});

function LensLoader({
  size = "small",
  color,
  tone = "brand",
  animating = true,
  hidesWhenStopped = true,
  style,
  testID,
  accessibilityLabel,
}) {
  const reduceMotion = useReduceMotion();
  const px = resolveLoaderSize(size);
  const mono = tone === "mono";
  const running = animating !== false;
  const driver = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!running) return undefined;
    driver.setValue(0);
    const loop = Animated.loop(
      Animated.timing(driver, {
        toValue: 1,
        duration: reduceMotion ? BREATHE_MS : CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [driver, running, reduceMotion]);

  const nodes = useMemo(() => {
    if (reduceMotion || !running) return null;
    const half = lerp(driver, halfTable(px));
    return {
      rotate: lerp(driver, TABLES.angle),
      half,
      halfNeg: Animated.multiply(half, -1),
      disc: lerp(driver, TABLES.disc),
      eyeAlong: lerp(driver, TABLES.eyeAlong),
      eyeAcross: lerp(driver, TABLES.eyeAcross),
      pupil: lerp(driver, TABLES.pupil),
    };
  }, [driver, px, reduceMotion, running]);

  const breathe = useMemo(
    () => (reduceMotion && running ? lerp(driver, TABLES.breathe) : null),
    [driver, reduceMotion, running],
  );

  const box = { width: px, height: px };
  const a11y = {
    accessible: true,
    accessibilityRole: "progressbar",
    accessibilityLabel: accessibilityLabel ?? i18nText("loading", "Yükleniyor..."),
    accessibilityState: { busy: running },
  };

  if (!running && hidesWhenStopped) {
    return <View testID={testID} style={[box, style]} />;
  }

  const u = px / BOX_UNITS;
  const discSize = 2 * LENS.r * u;
  const still = !nodes; // Hareketi Azalt ya da durmuş gösterge: işaret pozu
  const staticHalf = (LENS.d / 2) * u;
  const discTransform = (sign) =>
    still
      ? [{ translateX: sign * staticHalf }]
      : [{ translateX: sign > 0 ? nodes.half : nodes.halfNeg }, { scale: nodes.disc }];
  // Mono: daireler halka (çizgi logo), göz dolu — renkli düğmede leke gibi durmaz.
  const discStyle = (fill) => [
    centered(discSize, discSize),
    { borderRadius: discSize / 2 },
    mono
      ? { borderWidth: Math.max(MONO_RING_MIN, px * MONO_RING_RATIO), borderColor: fill }
      : { backgroundColor: fill },
  ];
  const monoColor = color || LENS_COLORS.paper;
  const pupilSize = 2 * LENS.pupil * u;
  const glintSize = 2 * LENS.glint * u;
  const glintOff = LENS.glintOff * u;

  return (
    <Animated.View
      testID={testID}
      {...a11y}
      pointerEvents="none"
      needsOffscreenAlphaCompositing={!!breathe}
      style={[box, breathe && { opacity: breathe }, style]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: still ? `${BASE_ANGLE}deg` : nodes.rotate }] },
        ]}
      >
        <Animated.View
          testID={testID ? `${testID}-cyan` : undefined}
          style={[...discStyle(mono ? monoColor : LENS_COLORS.cyan), { transform: discTransform(1) }]}
        />
        <Animated.View
          testID={testID ? `${testID}-red` : undefined}
          style={[...discStyle(mono ? monoColor : LENS_COLORS.red), { transform: discTransform(-1) }]}
        />
        <Animated.View
          style={[
            centered(EYE_LENGTH * u, EYE_WIDTH * u),
            !still && { transform: [{ scaleX: nodes.eyeAlong }, { scaleY: nodes.eyeAcross }] },
          ]}
        >
          <Svg width="100%" height="100%" viewBox={EYE_VIEWBOX}>
            <Path d={EYE_PATH} fill={mono ? monoColor : LENS_COLORS.ink} />
          </Svg>
        </Animated.View>
      </Animated.View>
      {mono ? null : (
        <Animated.View
          style={[
            centered(pupilSize, pupilSize),
            { borderRadius: pupilSize / 2, backgroundColor: LENS_COLORS.paper },
            !still && { transform: [{ scale: nodes.pupil }] },
          ]}
        >
          {px >= GLINT_MIN_SIZE ? (
            <View
              style={[
                centered(glintSize, glintSize),
                {
                  marginLeft: glintOff - glintSize / 2,
                  marginTop: -glintOff - glintSize / 2,
                  borderRadius: glintSize / 2,
                  backgroundColor: LENS_COLORS.ink,
                },
              ]}
            />
          ) : null}
        </Animated.View>
      )}
    </Animated.View>
  );
}

export default React.memo(LensLoader);
