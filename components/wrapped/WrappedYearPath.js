// components/wrapped/WrappedYearPath.js
//
// Watchify Wrapped — dört sütunlu zikzak yıl yolu.
// Yıllar ilk satırda soldan sağa, sonraki satırda sağdan sola ilerler. Böylece
// kronolojik sıra, satırlar arasında kopmadan devam eden bir "yılan" yolu olur.

import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import AppIcon from "../AppIcon";

const MAX_COLUMNS = 4;
const MAX_VISIBLE_ROWS = 7;
const NODE_W = 68;
const NODE_H = 48;
const PAD_X = 38;
const FIRST_ROW_Y = 40;
const ROW_STEP = 64;
const ROW_ZIGZAG = 7;
const PATH_BOTTOM_PAD = 34;
const MAX_PATH_HEIGHT =
  FIRST_ROW_Y +
  (MAX_VISIBLE_ROWS - 1) * ROW_STEP +
  ROW_ZIGZAG +
  PATH_BOTTOM_PAD;

const WrappedYearPath = memo(function WrappedYearPath({
  years = [],
  selectedYear,
  onSelect,
  width = 300,
  accent = "#1DB954",
  selectedText = "yılı seçildi",
}) {
  const columns = Math.min(MAX_COLUMNS, Math.max(2, years.length));

  const { positions, path, contentHeight } = useMemo(() => {
    const stepX = columns > 1 ? (width - PAD_X * 2) / (columns - 1) : 0;
    const points = years.map((year, index) => {
      const row = Math.floor(index / columns);
      const indexInRow = index % columns;
      const visualColumn = row % 2 === 0 ? indexInRow : columns - 1 - indexInRow;
      return {
        year,
        row,
        cx: PAD_X + visualColumn * stepX,
        cy:
          FIRST_ROW_Y +
          row * ROW_STEP +
          (visualColumn % 2 === 0 ? -ROW_ZIGZAG : ROW_ZIGZAG),
      };
    });

    const d = points.reduce((result, point, index) => {
      if (index === 0) return `M ${point.cx} ${point.cy}`;
      const previous = points[index - 1];
      if (previous.row === point.row) return `${result} L ${point.cx} ${point.cy}`;

      const midY = (previous.cy + point.cy) / 2;
      return `${result} C ${previous.cx} ${midY}, ${point.cx} ${midY}, ${point.cx} ${point.cy}`;
    }, "");

    const rowCount = Math.max(1, Math.ceil(years.length / columns));
    return {
      positions: points,
      path: d,
      contentHeight:
        FIRST_ROW_Y +
        (rowCount - 1) * ROW_STEP +
        ROW_ZIGZAG +
        PATH_BOTTOM_PAD,
    };
  }, [columns, width, years]);

  const viewportHeight = Math.min(contentHeight, MAX_PATH_HEIGHT);

  return (
    <View style={[styles.wrapper, { width }]}>
      <View
        style={[
          styles.pathShell,
          {
            height: viewportHeight,
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={contentHeight > MAX_PATH_HEIGHT}
          nestedScrollEnabled
          contentContainerStyle={{ width, height: contentHeight }}
        >
          <Svg
            width={width}
            height={contentHeight}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="wrappedYearRoad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.82" />
                <Stop offset="0.5" stopColor={accent} stopOpacity="0.9" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.38" />
              </LinearGradient>
            </Defs>
            <Path
              d={path}
              stroke="rgba(5,8,18,0.28)"
              strokeWidth={12}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={path}
              stroke="url(#wrappedYearRoad)"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 8"
            />
          </Svg>

          {positions.map((point, index) => {
            const active = point.year === selectedYear;
            return (
              <Pressable
                key={point.year}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={String(point.year)}
                onPress={() => onSelect?.(point.year)}
                style={({ pressed }) => [
                  styles.node,
                  {
                    left: point.cx - NODE_W / 2,
                    top: point.cy - NODE_H / 2,
                    backgroundColor: active ? "#FFFFFF" : "rgba(24,25,45,0.86)",
                    borderColor: active ? "#FFFFFF" : "rgba(255,255,255,0.42)",
                    transform: [{ scale: pressed ? 0.94 : active ? 1.08 : 1 }],
                  },
                  active && styles.nodeActive,
                ]}
              >
                {index === 0 && !active ? (
                  <View style={[styles.latestDot, { backgroundColor: accent }]} />
                ) : null}
                {active ? (
                  <View style={[styles.check, { backgroundColor: accent }]}>
                    <AppIcon name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                ) : null}
                <Text
                  allowFontScaling={false}
                  style={[styles.year, { color: active ? "#090B14" : "#FFFFFF" }]}
                >
                  {point.year}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.nodeCaption,
                    { color: active ? accent : "rgba(255,255,255,0.55)" },
                  ]}
                >
                  WRAPPED
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.selectedBar}>
        <View style={[styles.selectedIcon, { backgroundColor: accent }]}>
          <AppIcon name="sparkles" size={12} color="#FFFFFF" />
        </View>
        <Text allowFontScaling={false} style={styles.selectedText}>
          <Text style={styles.selectedYear}>{selectedYear}</Text> {selectedText}
        </Text>
      </View>
    </View>
  );
});

export default WrappedYearPath;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 10,
  },
  pathShell: {
    width: "100%",
    overflow: "hidden",
  },
  node: {
    position: "absolute",
    width: NODE_W,
    height: NODE_H,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  nodeActive: {
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 9,
  },
  year: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  nodeCaption: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  check: {
    position: "absolute",
    top: -6,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  latestDot: {
    position: "absolute",
    top: 6,
    right: 7,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  selectedBar: {
    minHeight: 30,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  selectedIcon: {
    width: 21,
    height: 21,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
  },
  selectedYear: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
