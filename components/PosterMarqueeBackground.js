import React, { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { Image as ExpoImage } from "expo-image";

const { width, height } = Dimensions.get("window");
const POSTER_W = 96;
const POSTER_H = 144;
const POSTER_GAP = 10;
const ROW_GAP = 10;

const MarqueeRow = memo(function MarqueeRow({
  posters,
  direction,
  speed,
  paused,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const stripW = posters.length * (POSTER_W + POSTER_GAP);

  useEffect(() => {
    if (!posters.length || !stripW || paused) return undefined;
    const from = direction === "left" ? 0 : -stripW;
    const to = direction === "left" ? -stripW : 0;
    translateX.setValue(from);
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: to,
        duration: (stripW / speed) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [direction, paused, posters.length, speed, stripW, translateX]);

  const doubled = useMemo(() => [...posters, ...posters], [posters]);
  return (
    <View style={styles.row}>
      <Animated.View style={[styles.rowStrip, { transform: [{ translateX }] }]}>
        {doubled.map((uri, index) => (
          <ExpoImage
            key={`${uri}-${index}`}
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
});

function PosterMarqueeBackground({ posters = [], paused = false, style }) {
  const rows = useMemo(() => {
    if (!posters.length) return [];
    const visibleCount =
      Math.ceil((width * 1.45) / (POSTER_W + POSTER_GAP)) + 2;
    const rowsCount = Math.ceil((height * 1.15) / (POSTER_H + ROW_GAP)) + 2;
    return Array.from({ length: rowsCount }, (_, rowIndex) => {
      const start = (rowIndex * 5) % posters.length;
      return Array.from(
        { length: visibleCount },
        (_, index) => posters[(start + index) % posters.length]
      );
    });
  }, [posters]);

  if (!rows.length) return null;
  return (
    <View style={[styles.clip, style]} pointerEvents="none">
      <View style={styles.inner}>
        {rows.map((rowPosters, index) => (
          <MarqueeRow
            key={index}
            posters={rowPosters}
            direction={index % 2 === 0 ? "right" : "left"}
            speed={20 + (index % 3) * 5}
            paused={paused}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(PosterMarqueeBackground);

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  inner: {
    position: "absolute",
    top: -POSTER_H,
    left: -width * 0.35,
    width: width * 1.7,
    bottom: -POSTER_H,
    justifyContent: "center",
    transform: [{ rotate: "-9deg" }, { scale: 1.15 }],
  },
  row: { height: POSTER_H, marginBottom: ROW_GAP },
  rowStrip: { flexDirection: "row" },
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 10,
    marginRight: POSTER_GAP,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
