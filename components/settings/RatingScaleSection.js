// components/settings/RatingScaleSection.js
//
// Ayarlar > Kişiselleştirme: "Puanlama sistemi" — 10 yıldız (küsuratlı, 8,5) | 5 yıldız (küsuratsız, 9).
// İki modda da değerlendirme 10 üzerinden; 5 yıldızda yarım yıldız = 1 puan.
// Yalnız cihaz tercihi (Keys.ratingScale); saklanan puanlar hep 0-10 (utils/ratingScale).
// Karo düzeni Efektler kartıyla aynı dilde: simge yerine mini yıldız önizlemesi + ad + alt yazı.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppIcon from "@components/AppIcon";
import GlassTouchable from "@components/common/GlassTouchable";
import { alpha } from "@theme/colors";
import useRatingScale, { setRatingScale } from "@hooks/useRatingScale";
import { selectionAsync } from "@services/hapticsService";
import { getRatingScaleCopy } from "@utils/ratingScaleCopy";

// Önizleme: 10'luda 8,5 (8½ yıldız), 5'lide 9 (4½ yıldız).
const PREVIEWS = Object.freeze({
  ten: { count: 10, full: 8, size: 8.5 },
  five: { count: 5, full: 4, size: 13 },
});

const StarPreview = memo(function StarPreview({ scale, color, emptyColor }) {
  const { count, full, size } = PREVIEWS[scale];
  return (
    <View style={styles.preview} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < full ? "star" : i === full ? "star-half" : "star-outline"}
          size={size}
          color={i <= full ? color : emptyColor}
        />
      ))}
    </View>
  );
});

function RatingScaleSection({ colors: C, language }) {
  const scale = useRatingScale();
  const copy = getRatingScaleCopy(language);
  const options = [
    { value: "ten", label: copy.ten, sub: copy.tenSub },
    { value: "five", label: copy.five, sub: copy.fiveSub },
  ];

  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: C.iconAmber }]}>
          <AppIcon name="star-outline" size={16} color={C.amber} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} style={[styles.title, { color: C.text }]}>
            {copy.title}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { color: C.muted }]}>
            {copy.subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.tiles} accessibilityRole="radiogroup">
        {options.map((o) => {
          const active = scale === o.value;
          return (
            <GlassTouchable
              key={o.value}
              testID={`rating-scale-${o.value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${o.label}. ${o.sub}`}
              activeOpacity={0.7}
              onPress={() => {
                if (active) return;
                selectionAsync().catch(() => {});
                setRatingScale(o.value);
              }}
              style={[
                styles.tile,
                {
                  backgroundColor: active ? alpha(C.accent, 0.08) : C.cardAlt,
                  borderColor: active ? C.accent : C.borderMuted,
                },
              ]}
            >
              <StarPreview scale={o.value} color={C.amber} emptyColor={alpha(C.muted, 0.45)} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.tileTitle, { color: active ? C.accentStrong : C.text }]}
              >
                {o.label}
              </Text>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileSub, { color: C.muted }]}>
                {o.sub}
              </Text>
              {active ? (
                <View style={[styles.check, { backgroundColor: C.accent }]}>
                  <AppIcon name="checkmark" size={9} color={C.white} />
                </View>
              ) : null}
            </GlassTouchable>
          );
        })}
      </View>

      <Text allowFontScaling={false} numberOfLines={3} style={[styles.hint, { color: C.muted }]}>
        {copy.hint}
      </Text>
    </View>
  );
}

export default memo(RatingScaleSection);

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden", paddingVertical: 14, paddingHorizontal: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "500" },
  subtitle: { fontSize: 11, marginTop: 2 },
  tiles: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  preview: { flexDirection: "row", alignItems: "center", height: 16, gap: 0.5 },
  tileTitle: { fontSize: 13, fontWeight: "700" },
  tileSub: { fontSize: 10.5, fontWeight: "600" },
  check: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 11, lineHeight: 15, marginTop: 8, textAlign: "center" },
});
