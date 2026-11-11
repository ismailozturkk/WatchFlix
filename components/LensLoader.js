// components/LensLoader.js
//
// Uygulamanın yükleme göstergesi: ActivityIndicator'ın yerine geçen Lens işareti.
// İki karadelik (camgöbeği + kırmızı): uzaktan yavaşça yaklaşır, giderek hızlanır,
// hızla iç içe geçer (gelgit gerilmesi + kütleçekim dalgası) ve öbür tarafta
// yavaşlayarak uzaklaşır; bu sırada birbirinin çevresinde döner (yakınken hızlı).
// Hareket modeli saf: utils/lensLoaderMotion.js.
//
// API ActivityIndicator ile aynı (`size` "small" | "medium" | "large" | "screen" |
// "fill" | sayı — kademeler ekranın kısa kenarıyla ölçeklenir, "fill" kabını ölçer;
// `color`, `animating`, `hidesWhenStopped`, `style`, `testID`). DIŞ KAP da
// ActivityIndicator gibi davranır: `style` dış kaba gider, kap içeriği ortalar ve
// sütunda genişliğe yayılır. (Eski sürümde `style` sabit px kutusuna gidiyordu;
// sütunda gösterge sola yapışıyor, `flex: 1` verilen durum kutularında kenarda
// kalıyordu.)
//
// İki ton:
//   - "brand" (varsayılan): marka renkleri; `color` yok sayılır. Ekran, bölüm,
//     liste sonu, arama alanı gibi nötr zeminlerde. Boy verilmezse "medium".
//   - "mono": tek renk (`color`), dolu renkli düğmelerin içinde. Halka + dolu
//     çekirdek; hale yok. Boy verilmezse "small".
//
// KASMA BÜTÇESİ: düz View'lar, SVG yok; tüm hareket tek sürücüden native
// interpolate ile (JS thread'i meşgulken de döner). Tablolar boya göre modül
// düzeyinde önbelleklenir (bir listede onlarca gösterge olabilir).
// Hareketi Azalt: karadelikler yarı iç içe durur, yalnız saydamlık nefes alır.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import useReduceMotion from "../hooks/useReduceMotion";
import { i18nText } from "../utils/i18nText";
import {
  BASE_ANGLE,
  BREATHE_MS,
  CYCLE_MS,
  HALO_OPACITY,
  LENS_COLORS,
  STILL_POS,
  angleAt,
  breatheAt,
  fillSizeFor,
  geomFor,
  posAt,
  resolveLoaderSize,
  sampleLoop,
  screenScaleFor,
  tideAt,
  waveAt,
} from "../utils/lensLoaderMotion";

const MONO_RING_MIN = 1.5;
const MONO_RING_RATIO = 0.07;
const WAVE_RING_RATIO = 0.035;

// Birimsiz tablolar bir kez; yalnız ötelenme boya bağlı.
const TABLES = {
  angle: sampleLoop(angleAt, { map: (v) => `${v}deg` }),
  along: sampleLoop((x) => tideAt(x)[0]),
  across: sampleLoop((x) => tideAt(x)[1]),
  waveScale: sampleLoop((x) => waveAt(x)[0]),
  waveOpacity: sampleLoop((x) => waveAt(x)[1]),
  breathe: sampleLoop(breatheAt, { steps: 48, dense: 0 }),
};
const offsetTables = new Map();
function offsetTable(px) {
  let table = offsetTables.get(px);
  if (!table) {
    const { amp } = geomFor(px);
    table = sampleLoop((x) => posAt(x) * amp * px);
    offsetTables.set(px, table);
  }
  return table;
}

const CLAMP = { extrapolate: "clamp" };
const lerp = (driver, table) => driver.interpolate({ ...table, ...CLAMP });

// Kutu merkezine göre konum: ölçüsüz, onLayout gerektirmez.
const centered = (width, height = width) => ({
  position: "absolute",
  left: "50%",
  top: "50%",
  marginLeft: -width / 2,
  marginTop: -height / 2,
  width,
  height,
});
const disc = (radius) => ({ ...centered(2 * radius), borderRadius: radius });

function LensLoader({
  size,
  color,
  tone = "brand",
  animating = true,
  hidesWhenStopped = true,
  style,
  testID,
  accessibilityLabel,
}) {
  const reduceMotion = useReduceMotion();
  const mono = tone === "mono";
  const window = useWindowDimensions();
  const fill = size === "fill";
  // "fill": dış kap kabını doldurur, kısa kenarı ölçülür; ölçülene kadar medium.
  const [fillPx, setFillPx] = useState(null);
  const onFillLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    const next = fillSizeFor(width, height);
    setFillPx((prev) => (prev === next ? prev : next));
  }, []);
  const scale = screenScaleFor(window?.width, window?.height);
  const px = (fill && fillPx) || resolveLoaderSize(fill ? "medium" : size, tone, scale);
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
    const offset = lerp(driver, offsetTable(px));
    return {
      rotate: lerp(driver, TABLES.angle),
      offset,
      offsetNeg: Animated.multiply(offset, -1),
      along: lerp(driver, TABLES.along),
      across: lerp(driver, TABLES.across),
      waveScale: lerp(driver, TABLES.waveScale),
      waveOpacity: lerp(driver, TABLES.waveOpacity),
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

  const containerStyle = [styles.container, fill && styles.fill, style];
  const layoutProps = fill ? { onLayout: onFillLayout } : null;

  if (!running && hidesWhenStopped) {
    return (
      <View testID={testID} {...layoutProps} style={containerStyle}>
        <View style={box} />
      </View>
    );
  }

  const GEOM = geomFor(px);
  const still = !nodes; // Hareketi Azalt ya da durmuş gösterge: sabit poz
  const stillOffset = STILL_POS * GEOM.amp * px;
  const bodyTransform = (sign) =>
    still
      ? [{ translateX: sign * stillOffset }]
      : [
          { translateX: sign > 0 ? nodes.offset : nodes.offsetNeg },
          { scaleX: nodes.along },
          { scaleY: nodes.across },
        ];

  const monoColor = color || LENS_COLORS.paper;
  const tint = (brandColor) => (mono ? monoColor : brandColor);
  const showHalo = !mono && GEOM.halo > 0;
  const ringStyle = (fill) =>
    mono
      ? { borderWidth: Math.max(MONO_RING_MIN, px * MONO_RING_RATIO), borderColor: fill }
      : { backgroundColor: fill };

  // Katman sırası: haleler → halkalar → çekirdekler. Böylece iç içe geçerken iki
  // olay ufku da görünür (biri ötekinin halkası altında kaybolmaz).
  const bodies = [
    { key: "red", sign: -1, color: LENS_COLORS.red },
    { key: "cyan", sign: 1, color: LENS_COLORS.cyan },
  ];
  const coreRadius = GEOM.core * px * (mono ? 0.8 : 1);
  const waveSize = 2 * GEOM.wave * px;

  return (
    <View testID={testID} {...a11y} {...layoutProps} pointerEvents="none" style={containerStyle}>
      <Animated.View
        testID={testID ? `${testID}-box` : undefined}
        needsOffscreenAlphaCompositing={!!breathe}
        style={[box, breathe && { opacity: breathe }]}
      >
        {still ? null : (
          <Animated.View
            testID={testID ? `${testID}-wave` : undefined}
            style={[
              centered(waveSize),
              {
                borderRadius: waveSize / 2,
                borderWidth: Math.max(1, px * WAVE_RING_RATIO),
                borderColor: tint(LENS_COLORS.cyan),
                opacity: nodes.waveOpacity,
                transform: [{ scale: nodes.waveScale }],
              },
            ]}
          />
        )}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate: still ? `${BASE_ANGLE}deg` : nodes.rotate }] },
          ]}
        >
          {showHalo
            ? bodies.map((b) => (
                <Animated.View
                  key={`halo-${b.key}`}
                  style={[
                    disc(GEOM.halo * px),
                    { backgroundColor: b.color, opacity: HALO_OPACITY },
                    { transform: bodyTransform(b.sign) },
                  ]}
                />
              ))
            : null}
          {bodies.map((b) => (
            <Animated.View
              key={`ring-${b.key}`}
              testID={testID ? `${testID}-${b.key}` : undefined}
              style={[disc(GEOM.ring * px), ringStyle(tint(b.color)), { transform: bodyTransform(b.sign) }]}
            />
          ))}
          {bodies.map((b) => (
            <Animated.View
              key={`core-${b.key}`}
              testID={testID ? `${testID}-${b.key}-core` : undefined}
              style={[
                disc(coreRadius),
                { backgroundColor: mono ? monoColor : LENS_COLORS.ink },
                { transform: bodyTransform(b.sign) },
              ]}
            />
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ActivityIndicator'ın kabıyla aynı: içerik ortada.
const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  // "fill": kabın tamamını kaplar (kaplama / tam ekran kabı ölçülebilsin). Kutu
  // ortada durur; kap içerikle büyümediği için ölçüm döngüsü olmaz.
  fill: { flex: 1, alignSelf: "stretch" },
});

export default React.memo(LensLoader);
