// components/feed/PosterStack.js
//
// Birbirinin ARKASINA taşan poster yığını (en önde ilk poster). Postlarım
// kartları ve taslak kartları aynı görseli kullanır: liste ve medya anketlerinde
// birden çok poster tek bir yığına sığar, taşan adet "+N" rozetiyle söylenir.

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

export const STACK_POSTER_W = 80;
export const STACK_POSTER_H = 120;

const PosterStack = memo(function PosterStack({
  uris,
  theme,
  max = 3,
  width = STACK_POSTER_W,
  height = STACK_POSTER_H,
  step = 16,
  radius = 14,
}) {
  const all = (uris || []).filter(Boolean);
  const shown = all.slice(0, max);
  if (shown.length === 0) return null;
  const extra = all.length - shown.length;

  return (
    <View style={{ width: width + (shown.length - 1) * step, height }}>
      {shown.map((uri, i) => (
        <Image
          key={`${uri}-${i}`}
          source={{ uri }}
          contentFit="cover"
          transition={120}
          style={[
            st.poster,
            {
              left: i * step,
              width,
              height,
              borderRadius: radius,
              borderColor: theme.secondary,
              zIndex: shown.length - i,
              opacity: i === 0 ? 1 : 0.82,
            },
          ]}
        />
      ))}
      {extra > 0 && (
        <View style={[st.more, { left: width - 36 }]}>
          <Text style={st.moreText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
});

export default PosterStack;

const st = StyleSheet.create({
  poster: { position: "absolute", top: 0, borderWidth: 1.5 },
  more: {
    position: "absolute",
    bottom: 6,
    zIndex: 10,
    minWidth: 30,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { color: "#fff", fontSize: 11, fontWeight: "900" },
});
