// components/wrapped/WrappedYearPath.js
//
// Watchify Wrapped — yıl seçici "kıvrımlı yol" (yatay zigzag).
// Yıllar soldan sağa, yukarı/aşağı dönüşlerle ilerleyen bir yol boyunca
// düğümler olarak dizilir; yatay kaydırılabilir ve bir yıla basınca o düğüm
// görünümde ortalanır. SVG yolu çizer (dokunmaz); düğümler RN Pressable.

import React, { memo, useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

const NODE_R = 24;
const SEL_R = 30;
const STEP_X = 86;   // düğümler arası yatay mesafe (kompakt → 3-5 yıl görünür)
const AMP = 26;      // zigzag dikey genlik
const PAD_X = 48;    // kenar boşluğu (ilk/son düğüm ortalanabilsin)

const WrappedYearPath = memo(function WrappedYearPath({
  years = [],
  selectedYear,
  onSelect,
  width = 300,
}) {
  const n = years.length;
  const scrollRef = useRef(null);
  const midY = SEL_R + AMP + 8;
  const height = midY * 2;

  const positions = years.map((y, i) => ({
    year: y,
    cx: PAD_X + i * STEP_X,
    cy: midY + (i % 2 === 0 ? -AMP : AMP),
  }));
  const contentW = Math.max(width, PAD_X * 2 + (n - 1) * STEP_X);

  // Yumuşak yatay kıvrımlı yol (yatay teğetli S eğrileri)
  let d = "";
  positions.forEach((p, i) => {
    if (i === 0) {
      d += `M ${p.cx} ${p.cy}`;
    } else {
      const prev = positions[i - 1];
      const midX = (prev.cx + p.cx) / 2;
      d += ` C ${midX} ${prev.cy}, ${midX} ${p.cy}, ${p.cx} ${p.cy}`;
    }
  });

  const centerOn = useCallback(
    (i) => {
      const p = positions[i];
      if (!p || !scrollRef.current) return;
      const x = Math.max(0, Math.min(contentW - width, p.cx - width / 2));
      scrollRef.current.scrollTo({ x, animated: true });
    },
    [positions, contentW, width],
  );

  // Seçili yılı mount'ta / değişince ortala
  useEffect(() => {
    const i = years.indexOf(selectedYear);
    if (i < 0) return undefined;
    const t = setTimeout(() => centerOn(i), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, n]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ width, height }}
      contentContainerStyle={{ width: contentW, height }}
    >
      <Svg width={contentW} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="wrappedRoad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.14" />
          </LinearGradient>
        </Defs>
        <Path d={d} stroke="rgba(255,255,255,0.16)" strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={d} stroke="url(#wrappedRoad)" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="2 12" />
      </Svg>

      {positions.map((p, i) => {
        const active = p.year === selectedYear;
        const r = active ? SEL_R : NODE_R;
        return (
          <Pressable
            key={p.year}
            onPress={() => {
              onSelect?.(p.year);
              centerOn(i);
            }}
            style={[
              styles.node,
              active && styles.nodeActive,
              {
                left: p.cx - r,
                top: p.cy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: active ? "#fff" : "rgba(255,255,255,0.14)",
                borderColor: active ? "#fff" : "rgba(255,255,255,0.45)",
              },
            ]}
          >
            <Text
              style={[styles.nodeText, { color: active ? "#000" : "#fff", fontSize: active ? 16 : 14 }]}
              allowFontScaling={false}
            >
              {p.year}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

export default WrappedYearPath;

const styles = StyleSheet.create({
  node: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  nodeActive: {
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 11,
    elevation: 10,
  },
  nodeText: { fontWeight: "900", letterSpacing: -0.5 },
});
