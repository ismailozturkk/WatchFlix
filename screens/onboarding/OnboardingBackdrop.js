// screens/onboarding/OnboardingBackdrop.js
//
// Tanıtım akışının TÜM slaytlarda ortak zemini:
//   1) Eğik, dikey akan poster duvarı (PosterWall) — ilk slaytta görünür,
//      sonraki slaytlarda tema rengine doğru soluklaşır ve DURUR (görünmeyen bir
//      animasyon pil yakmasın diye).
//   2) Accent'ten türeyen yumuşak ışıma (AuthBackdrop) — giriş/kayıt ekranlarıyla
//      aynı dil, böylece akış tek parça hissedilir.

import React, { useEffect, useId, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { AuthBackdrop } from "../../components/auth/AuthKit";

const { width, height } = Dimensions.get("window");

/**
 * Yumuşak yuvarlak ışıma (düz renkli daire yerine): merkezden kenara sönen
 * radyal degrade. Logo ve poster yelpazesinin arkasında derinlik verir.
 * Defs id'si örnek başına ayrı (Android'de Defs ad alanı global).
 */
export function RadialGlow({ color, size, opacity = 0.5, style }) {
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.38} />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const GAP = 10;
const COL_W = Math.min(150, Math.round(width * 0.31));
const POSTER_H = Math.round(COL_W * 1.5);
const WALL_W = width * 1.45;
const WALL_H = height * 1.3;
const COLS = Math.ceil(WALL_W / (COL_W + GAP));
// Bir sütunun yarım şeridi ekranı doldurmalı; şerit iki kopya = kesintisiz döngü.
const PER_COL = Math.ceil(WALL_H / (POSTER_H + GAP)) + 1;
const STRIP_H = PER_COL * (POSTER_H + GAP);

// Tek sütun: tek yöne sonsuz akar. Duraklatılınca bulunduğu yerde kalır, devam
// edince oradan sürer (başa sıçramaz).
function WallColumn({ uris, direction, speed, paused }) {
  const translateY = useRef(new Animated.Value(direction === "up" ? 0 : -STRIP_H)).current;
  const resumeAt = useRef(direction === "up" ? 0 : -STRIP_H);
  const doubled = useMemo(() => [...uris, ...uris], [uris]);

  useEffect(() => {
    if (paused || !uris.length) return undefined;
    const origin = direction === "up" ? 0 : -STRIP_H;
    const target = direction === "up" ? -STRIP_H : 0;
    let cancelled = false;
    let running = null;

    const run = (from) => {
      const distance = Math.abs(target - from);
      running = Animated.timing(translateY, {
        toValue: target,
        duration: Math.max(1, (distance / speed) * 1000),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      running.start(({ finished }) => {
        if (!finished || cancelled) return;
        // Şerit iki özdeş kopya: başa dönmek gözle görülmez.
        translateY.setValue(origin);
        run(origin);
      });
    };
    run(resumeAt.current);

    return () => {
      cancelled = true;
      running?.stop();
      translateY.stopAnimation((value) => {
        resumeAt.current = value;
      });
    };
  }, [paused, uris.length, direction, speed, translateY]);

  return (
    <View style={styles.column}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {doubled.map((uri, i) => (
          <ExpoImage
            key={i}
            source={{ uri }}
            style={styles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
          />
        ))}
      </Animated.View>
    </View>
  );
}

export function PosterWall({ posters, paused }) {
  const columns = useMemo(() => {
    if (!posters.length) return [];
    return Array.from({ length: COLS }, (_, c) =>
      Array.from({ length: PER_COL }, (_, i) => posters[(c * 4 + i * 3) % posters.length]),
    );
  }, [posters]);

  return (
    <View style={styles.clip} pointerEvents="none">
      <View style={styles.wall}>
        {columns.map((uris, c) => (
          <View key={c} style={{ marginTop: c % 2 ? -POSTER_H * 0.5 : 0 }}>
            <WallColumn
              uris={uris}
              direction={c % 2 ? "down" : "up"}
              speed={11 + (c % 3) * 4}
              paused={paused}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * @param scrollX   pager kaydırma değeri (Animated.Value) — scrim buna bağlı
 * @param settled   intro bitti, ana akış görünüyor
 * @param wallPaused duvar animasyonu dursun mu (ilk slayttan çıkınca)
 */
export default function OnboardingBackdrop({
  theme,
  accent,
  isLightTheme,
  posters,
  scrollX,
  settled,
  wallPaused,
}) {
  const scrimMax = isLightTheme ? 0.94 : 0.92;
  const scrim = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [0, width * 0.9],
        outputRange: [0.12, scrimMax],
        extrapolate: "clamp",
      }),
    [scrollX, scrimMax],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {posters.length > 0 && (
        <>
          <PosterWall posters={posters} paused={wallPaused} />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.primary, opacity: settled ? scrim : 0.5 },
            ]}
          />
        </>
      )}
      <AuthBackdrop accent={accent} isLightTheme={isLightTheme} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  wall: {
    position: "absolute",
    top: -height * 0.15,
    left: -(WALL_W - width) / 2,
    width: WALL_W,
    height: WALL_H,
    flexDirection: "row",
    gap: GAP,
    transform: [{ rotate: "-8deg" }],
  },
  column: { width: COL_W, height: WALL_H, overflow: "hidden" },
  poster: {
    width: COL_W,
    height: POSTER_H,
    marginBottom: GAP,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
