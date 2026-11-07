// components/tv/TvGraphSnapshot.js
//
// Paylaşılan BÖLÜM GRAFİĞİNİN ızgarası (gövde utils/tvGraphShare.js). Yerleşimi çağıran planlar
// (planTvGraphLayout — kutuya göre klasik sütun / bantlı sütun / kayan şerit); bu bileşen yalnız çizer.
// Renkler TvGraphDetailScreen ile ortak (utils/ratingColors). Puansız bölüm soluk kare ("–").
// Plan yükseklikten taşıyorsa (`overflow`) kesilir; alttaki solma ve "tamamı" yazısı karttadır.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getRatingColors } from "../../utils/ratingColors";
import { balancedLineSize } from "../../utils/tvGraphShare";

const EMPTY_BG = "rgba(255,255,255,0.08)";
const LABEL = "rgba(255,255,255,0.62)";

const Cell = memo(function Cell({ rating, size, showText }) {
  const colors = rating > 0 ? getRatingColors(rating) : null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(size * 0.2, 6),
        backgroundColor: colors ? colors.bg : EMPTY_BG,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showText ? (
        <Text
          allowFontScaling={false}
          style={{ color: colors ? colors.text : LABEL, fontSize: Math.min(11, size * 0.36), fontWeight: "800" }}
        >
          {rating > 0 ? rating.toFixed(1) : "–"}
        </Text>
      ) : null}
    </View>
  );
});

function Columns({ seasons, plan }) {
  const { cell, gap, headerH, labelStep } = plan;
  const headerFont = Math.max(7, Math.min(10, cell * 0.4));
  return plan.groups.map((group, bandIndex) => (
    <View key={bandIndex} style={bandIndex > 0 ? { marginTop: plan.bandGap } : null}>
      <View style={[styles.row, { gap, height: headerH }]}>
        {group.seasons.map((index, col) => (
          <View key={index} style={{ width: cell, alignItems: "center" }}>
            {col % labelStep === 0 ? (
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.label, { fontSize: headerFont, width: cell * labelStep + gap * (labelStep - 1) }]}>
                {`S${seasons[index].s}`}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <View style={{ gap }}>
        {Array.from({ length: group.rows }, (_, episode) => (
          <View key={episode} style={[styles.row, { gap }]}>
            {group.seasons.map((index) => {
              const rating = seasons[index].r[episode];
              return rating === undefined ? (
                <View key={index} style={{ width: cell, height: cell }} />
              ) : (
                <Cell key={index} rating={rating} size={cell} showText={plan.showText} />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  ));
}

function Rows({ seasons, plan }) {
  const { cell, gap, perLine, labelW, labelStep } = plan;
  const labelFont = Math.max(6.5, Math.min(10, cell * 0.42));
  return seasons.map((season, index) => {
    const lineCount = plan.lines[index];
    const size = balancedLineSize(season.r.length, perLine, lineCount);
    return (
      <View
        key={season.s}
        testID={`tvgraph-season-row-${season.s}`}
        style={[styles.seasonRow, index > 0 && { marginTop: plan.stripGap }]}
      >
        <View style={{ width: labelW, height: cell, justifyContent: "center" }}>
          {index % labelStep === 0 ? (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.label, { fontSize: labelFont, textAlign: "left" }]}>
              {`S${season.s}`}
            </Text>
          ) : null}
        </View>
        <View style={{ gap }}>
          {Array.from({ length: lineCount }, (_, line) => (
            <View key={line} style={[styles.row, { gap }]}>
              {season.r.slice(line * size, (line + 1) * size).map((rating, episode) => (
                <Cell key={episode} rating={rating} size={cell} showText={plan.showText} />
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  });
}

function TvGraphSnapshot({ seasons, plan }) {
  if (!plan) return null;
  return (
    <View
      style={{ width: plan.width, height: plan.overflow ? undefined : plan.height, overflow: "hidden", alignSelf: "center" }}
      testID={`tvgraph-snapshot-${plan.mode}`}
    >
      {plan.mode === "columns" ? <Columns seasons={seasons} plan={plan} /> : <Rows seasons={seasons} plan={plan} />}
    </View>
  );
}

export default memo(TvGraphSnapshot);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  // Uzun sezon 10'ar bölümlük birden çok satıra bölündüğünde sezon etiketi
  // bloğun ortasına düşmez; ilk yatay satırın solunda başlar.
  seasonRow: { flexDirection: "row", alignItems: "flex-start" },
  label: { color: LABEL, fontWeight: "800", textAlign: "center" },
});
