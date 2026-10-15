// components/game/PosterReveal.js
//
// Poster Bulmaca'nın sahnesi: afiş, mozaik karolarla ÖRTÜLÜ başlar; süre
// ilerledikçe karolar rastgele sırayla açılır. Erken bilmek hem daha az ipucu
// (daha zor) hem de daha çok puan demek — puan zaten kalan süreye bağlı
// (utils/gameScoring), yani ek bir puanlama kuralı gerekmez.
//
// TEK sürücü değer (`elapsed` 0→1) tüm karoları native thread'de açar; 24 karo
// için JS thread'e kare başına iş çıkmaz. Duraklatınca olduğu yerde donar,
// devam edince kalan süreyle sürer. Cevaplanınca kalan örtü yumuşakça kalkar.

import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { createRng, shuffleWith } from "@utils/seededRandom";
import { alpha } from "../../theme/colors";

const COLS = 4;
const ROWS = 6;
const TILE_COUNT = COLS * ROWS;
// Süre dolduğunda bile son karoların bir kısmı kapalı kalmasın diye açılış bu
// orana kadar biter; geri kalanı cevaplanınca/süre bitince kalkar.
const REVEAL_SPAN = 0.88;
const FADE = 0.05;

export default function PosterReveal({
  uri,
  width,
  height,
  running,
  revealMs,
  resetKey,
  answered,
  ready,
  failed,
  theme,
  onLoad,
  onError,
}) {
  const elapsed = useRef(new Animated.Value(0)).current;
  const cover = useRef(new Animated.Value(1)).current;
  const pausedAt = useRef(0);

  // Karoların açılış sırası soruya özel ve deterministik (aynı soruda sabit).
  const order = useMemo(() => shuffleWith(Array.from({ length: TILE_COUNT }, (_, i) => i), createRng(`poster:${resetKey}`)), [resetKey]);

  useEffect(() => {
    elapsed.stopAnimation();
    elapsed.setValue(0);
    pausedAt.current = 0;
    cover.setValue(1);
  }, [cover, elapsed, resetKey]);

  useEffect(() => {
    if (!running) {
      elapsed.stopAnimation((value) => {
        pausedAt.current = value;
      });
      return undefined;
    }
    const from = pausedAt.current;
    elapsed.setValue(from);
    Animated.timing(elapsed, {
      toValue: 1,
      duration: Math.max(0, (1 - from) * revealMs),
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    return () => elapsed.stopAnimation((value) => {
      pausedAt.current = value;
    });
  }, [elapsed, revealMs, running]);

  useEffect(() => {
    if (!answered) return;
    Animated.timing(cover, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [answered, cover]);

  const tileW = width / COLS;
  const tileH = height / ROWS;
  const tiles = useMemo(
    () =>
      Array.from({ length: TILE_COUNT }, (_, index) => {
        const rank = order.indexOf(index);
        const start = (rank / TILE_COUNT) * REVEAL_SPAN;
        return {
          index,
          left: (index % COLS) * tileW,
          top: Math.floor(index / COLS) * tileH,
          start,
        };
      }),
    [order, tileW, tileH],
  );

  const checker = [theme.between || theme.secondary, theme.secondary];

  return (
    <View style={[styles.frame, { width, height, borderColor: theme.border, backgroundColor: theme.secondary }]}>
      {uri ? (
        <Image
          key={uri}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          onLoad={onLoad}
          onError={onError}
        />
      ) : null}

      {/* Örtü: tüm karoları saran tek katman; cevapta komple söner. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: cover }]}>
        {tiles.map((tile) => (
          <Animated.View
            key={tile.index}
            style={{
              position: "absolute",
              left: tile.left,
              top: tile.top,
              width: tileW + 0.5,
              height: tileH + 0.5,
              backgroundColor: checker[(Math.floor(tile.index / COLS) + (tile.index % COLS)) % 2],
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: alpha("#FFFFFF", 0.08),
              opacity: elapsed.interpolate({
                inputRange: [tile.start, tile.start + FADE],
                outputRange: [1, 0],
                extrapolate: "clamp",
              }),
            }}
          />
        ))}
        <View style={styles.questionWrap} pointerEvents="none">
          <Animated.Text
            allowFontScaling={false}
            style={[
              styles.question,
              {
                color: alpha(theme.text.primary, 0.18),
                opacity: elapsed.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: "clamp" }),
              },
            ]}
          >
            ?
          </Animated.Text>
        </View>
      </Animated.View>

      {uri && !ready && !failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.secondary }]}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 22, overflow: "hidden", borderWidth: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  questionWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  question: { fontSize: 120, fontWeight: "900" },
});
