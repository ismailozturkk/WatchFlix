// components/tierList/TierMiniPreview.js
//
// Kartlardaki küçük tier list önizlemesi: kademe başına renkli etiket çipi + ilk afişler + "+N". Tablolarım ekranı,
// Eğlence kartı ve sohbet balonu kullanır. Dokunma yok (kartın kendisi dokunulur).
//
//   tiers: [{ label, color, items: [media] }]   posterUriOf(media, width) → adres | null
//   tone: "surface" (tema zemini) | "onColor" (gradyan / koyu kart üstü)
//
// En çok `maxRows` kademe (varsayılan 6) ve satır başına SIĞDIĞI KADAR afiş (en çok `maxPosters`, varsayılan 12)
// çizilir: genişlik onLayout ile ölçülür, taşan yapım varsa "+N" için yer bırakılır (fitPosterCount). Ölçüm
// gelmeden üst sınır çizilir; satır taşanı kırpar.

import React, { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { tierInkOf } from "@utils/tierList";
import usePosterCorner from "@hooks/usePosterCorner";

const POSTER_W = 18;
const POSTER_H = 27;
const GAP = 3;
const CHIP_W = 54;
const ROW_GAP = 6;
const EDGE = 4; // afiş şeridinin sağ boşluğu
const EXTRA_W = 26; // "+NN" yazısı (sol boşluğuyla)

/** `width` genişliğindeki şeride sığan afiş sayısı (en çok `max`); kalan varsa "+N"ye yer bırakılır. */
export function fitPosterCount(total, width, max) {
  const cap = Math.min(total, max);
  if (!(width > 0)) return cap;
  const slots = (room) => Math.max(0, Math.floor((room + GAP) / (POSTER_W + GAP)));
  if (total <= max && total <= slots(width)) return total;
  return Math.min(cap, slots(width - EXTRA_W));
}

function TierMiniPreview({ tiers, posterUriOf, maxRows = 6, maxPosters = 12, tone = "surface", mutedColor, moreLabel, style }) {
  const corner = usePosterCorner("fun");
  const [width, setWidth] = useState(0);
  const shown = tiers.slice(0, maxRows);
  const hiddenRows = tiers.length - shown.length;
  const onColor = tone === "onColor";
  const muted = mutedColor || (onColor ? "rgba(255,255,255,0.8)" : "rgba(127,127,127,0.9)");
  const stripWidth = width ? width - CHIP_W - ROW_GAP - EDGE : 0;
  const onLayout = (event) => {
    const next = event.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  };
  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {shown.map((tier, index) => {
        const posters = tier.items.slice(0, fitPosterCount(tier.items.length, stripWidth, maxPosters));
        const extra = tier.items.length - posters.length;
        return (
          <View key={`${tier.label}-${index}`} style={[styles.row, onColor && styles.rowOnColor]}>
            <View style={[styles.chip, { backgroundColor: tier.color }]}>
              <Text style={[styles.chipText, { color: tierInkOf(tier.color) }]} numberOfLines={1} allowFontScaling={false}>
                {tier.label}
              </Text>
            </View>
            <View style={styles.posters}>
              {posters.map((media) => {
                const uri = posterUriOf(media, POSTER_W);
                return (
                  <View key={`${media.media_type}_${media.id}`} style={[styles.poster, { borderRadius: corner(3) }]}>
                    {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={uri} /> : null}
                  </View>
                );
              })}
              {extra > 0 ? (
                <Text style={[styles.extra, { color: muted }]} numberOfLines={1} allowFontScaling={false}>
                  {`+${extra}`}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      {hiddenRows > 0 && moreLabel ? (
        <Text style={[styles.more, { color: muted }]} allowFontScaling={false}>
          {moreLabel(hiddenRows)}
        </Text>
      ) : null}
    </View>
  );
}

export default memo(TierMiniPreview);

const styles = StyleSheet.create({
  wrap: { gap: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: ROW_GAP, minHeight: POSTER_H + 4, borderRadius: 6, overflow: "hidden", backgroundColor: "rgba(127,127,127,0.12)" },
  rowOnColor: { backgroundColor: "rgba(0,0,0,0.22)" },
  chip: { width: CHIP_W, alignSelf: "stretch", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  chipText: { fontSize: 10.5, fontWeight: "900" },
  posters: { flex: 1, flexDirection: "row", alignItems: "center", gap: GAP, minWidth: 0, paddingRight: EDGE, overflow: "hidden" },
  poster: { width: POSTER_W, height: POSTER_H, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(127,127,127,0.3)" },
  extra: { fontSize: 10.5, fontWeight: "800", marginLeft: 2 },
  more: { fontSize: 10.5, fontWeight: "800", marginTop: 1, marginLeft: 2 },
});
