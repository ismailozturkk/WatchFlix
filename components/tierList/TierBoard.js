// components/tierList/TierBoard.js
//
// Kademe satırları (TierMaker düzeni): solda renkli etiket hücresi, sağda sarmalanan afişler. Düzenleyici ve
// salt-okunur görünüm (sohbetten gelen tablo) aynı bileşeni kullanır.
//
//   tiers: [{ id, label, color, items: [{ key, media }] }]
//   posterUriOf(media, width) → adres | null   (düzenleyici özel afiş çözücüsünü, sohbet anlık görüntüyü verir)
//
// Düzenlenebilirken (`editable`):
//   • afişe dokunuş      → onPressItem(key, tierId)
//   • satırın boş alanı  → onPressTier(tierId)     (seçili afiş varsa sona yerleşir)
//   • etiket hücresi     → onPressLabel(tierId)    (kademe sayfası)
// Seçili afiş halkayla, seçim varken satırlar "buraya bırak" ipucuyla (kesik çerçeve) çizilir.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import GlassTouchable from "@components/common/GlassTouchable";
import { tierInkOf } from "@utils/tierList";
import usePosterCorner from "@hooks/usePosterCorner";

export const TIER_POSTER_W = 52;
export const TIER_POSTER_H = 78;
const LABEL_W = 78;
const GAP = 4;

/** Tek afiş hücresi; kenar halkası görselin ÜSTÜNDE ayrı katman (oran 2:3 kalsın, bkz. chat PosterEdge dersi). */
export const TierPoster = memo(function TierPoster({ media, uri, width = TIER_POSTER_W, height = TIER_POSTER_H, selected, accent, dim }) {
  const corner = usePosterCorner("fun");
  const radius = corner(6);
  return (
    <View style={[styles.poster, { width, height, borderRadius: radius, opacity: dim ? 0.35 : 1 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} recyclingKey={uri} />
      ) : (
        <View style={styles.posterFallback}>
          <Text style={styles.posterFallbackText} numberOfLines={4} allowFontScaling={false}>
            {media?.title || "?"}
          </Text>
        </View>
      )}
      {selected ? <View pointerEvents="none" style={[styles.ring, { borderRadius: radius, borderColor: accent }]} /> : null}
    </View>
  );
});

function TierRow({ tier, posterUriOf, editable, selectedKey, accent, theme, last, onPressItem, onPressTier, onPressLabel }) {
  const ink = tierInkOf(tier.color);
  const dropHint = editable && !!selectedKey;
  const label = (
    <Text style={[styles.label, { color: ink }]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6} allowFontScaling={false}>
      {tier.label}
    </Text>
  );
  const items = tier.items.map(({ key, media }) => {
    const poster = (
      <TierPoster media={media} uri={posterUriOf(media, TIER_POSTER_W)} selected={selectedKey === key} accent={accent} />
    );
    return editable ? (
      <GlassTouchable
        key={key}
        glass={false}
        activeOpacity={0.75}
        onPress={() => onPressItem?.(key, tier.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedKey === key }}
        accessibilityLabel={`${media.title}, ${tier.label}`}
        testID={`tier-item-${key}`}
      >
        {poster}
      </GlassTouchable>
    ) : (
      <View key={key} accessible accessibilityLabel={media.title}>
        {poster}
      </View>
    );
  });

  return (
    <View style={[styles.row, !last && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}>
      {editable ? (
        <GlassTouchable
          glass={false}
          activeOpacity={0.8}
          onPress={() => onPressLabel?.(tier.id)}
          accessibilityRole="button"
          accessibilityLabel={tier.label}
          style={[styles.labelCell, { backgroundColor: tier.color }]}
          testID={`tier-label-${tier.id}`}
        >
          {label}
        </GlassTouchable>
      ) : (
        <View style={[styles.labelCell, { backgroundColor: tier.color }]}>{label}</View>
      )}
      {editable ? (
        <GlassTouchable
          glass={false}
          activeOpacity={0.9}
          onPress={() => onPressTier?.(tier.id)}
          accessibilityRole="button"
          accessibilityLabel={tier.label}
          style={[styles.items, dropHint && [styles.dropHint, { borderColor: accent }]]}
          testID={`tier-row-${tier.id}`}
        >
          {items}
        </GlassTouchable>
      ) : (
        <View style={styles.items}>{items}</View>
      )}
    </View>
  );
}

function TierBoard({ tiers, posterUriOf, editable = false, selectedKey = null, theme, onPressItem, onPressTier, onPressLabel, style }) {
  const accent = theme.accent;
  return (
    <View style={[styles.board, { backgroundColor: theme.secondary, borderColor: theme.border }, style]}>
      {tiers.map((tier, index) => (
        <TierRow
          key={tier.id ?? index}
          tier={tier}
          posterUriOf={posterUriOf}
          editable={editable}
          selectedKey={selectedKey}
          accent={accent}
          theme={theme}
          last={index === tiers.length - 1}
          onPressItem={onPressItem}
          onPressTier={onPressTier}
          onPressLabel={onPressLabel}
        />
      ))}
    </View>
  );
}

export default memo(TierBoard);

const styles = StyleSheet.create({
  board: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "stretch", minHeight: TIER_POSTER_H + GAP * 2 },
  labelCell: { width: LABEL_W, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 8 },
  label: { fontSize: 15, fontWeight: "800", textAlign: "center", lineHeight: 19 },
  items: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    gap: GAP,
    padding: GAP,
    minHeight: TIER_POSTER_H + GAP * 2,
  },
  dropHint: { borderWidth: 1, borderStyle: "dashed", borderRadius: 6 },
  poster: { borderRadius: 6, overflow: "hidden", backgroundColor: "rgba(127,127,127,0.25)" },
  posterFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 4 },
  posterFallbackText: { fontSize: 9, fontWeight: "700", textAlign: "center", color: "rgba(255,255,255,0.85)" },
  ring: { ...StyleSheet.absoluteFillObject, borderRadius: 6, borderWidth: 3 },
});
