// components/tierList/TierListShareCard.js
//
// "Görsel olarak paylaş" kartı (captureRef hedefi): TierMaker düzeni — koyu zemin, solda pastel etiket hücresi,
// sağda sarmalanan afişler; üstte başlık, altta Seelogd imzası. Genişlik sabit 360 dp (yakalama 1080 px = 3x);
// boy içerikle büyür (çağıran onLayout ile ölçüp yakalamaya verir).
//
// Afişler yüklenmeden yakalanırsa boş kutu çıkar: her görselin onLoad / onError'u sayılır, hepsi bitince
// `onReady` bir kez çağrılır (görsel yoksa hemen). Ağ takılırsa çağıran zaman aşımıyla yine yakalar.

import React, { forwardRef, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { tierInkOf } from "@utils/tierList";
import usePosterCorner from "@hooks/usePosterCorner";

export const SHARE_CARD_W = 360;
const PAD = 14;
const LABEL_W = 70;
const COLS = 6;
const GAP = 3;
const POSTER_W = Math.floor((SHARE_CARD_W - PAD * 2 - LABEL_W - GAP * 2 - GAP * (COLS - 1)) / COLS);
const POSTER_H = Math.round(POSTER_W * 1.5);
const BG = "#1A1A17";
const ROW_BG = "#2A2A26";

const TierListShareCard = forwardRef(function TierListShareCard({ view, posterUriOf, copy, onReady, onLayout }, ref) {
  const corner = usePosterCorner("fun");
  const uris = useMemo(
    () => view.tiers.flatMap((tier) => tier.items.map((media) => posterUriOf(media, POSTER_W * 3))),
    [view, posterUriOf],
  );
  const pending = useRef(0);
  const fired = useRef(false);
  const total = view.tiers.reduce((sum, tier) => sum + tier.items.length, 0);

  useEffect(() => {
    fired.current = false;
    pending.current = uris.filter(Boolean).length;
    if (!pending.current) {
      fired.current = true;
      onReady?.();
    }
    // onReady çağıranın sabit geri çağrısı; yalnız görsel kümesi değişince sayaç sıfırlanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uris]);

  const settle = () => {
    pending.current -= 1;
    if (pending.current <= 0 && !fired.current) {
      fired.current = true;
      onReady?.();
    }
  };

  let cursor = 0;
  return (
    <View ref={ref} collapsable={false} onLayout={onLayout} style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={2}>
          {view.title || copy.untitled}
        </Text>
        <Text style={styles.count}>{copy.cardCount(total)}</Text>
      </View>

      <View style={styles.board}>
        {view.tiers.map((tier, index) => (
          <View key={`${tier.label}-${index}`} style={[styles.row, index > 0 && styles.rowGap]}>
            <View style={[styles.label, { backgroundColor: tier.color }]}>
              <Text style={[styles.labelText, { color: tierInkOf(tier.color) }]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.55}>
                {tier.label}
              </Text>
            </View>
            <View style={styles.items}>
              {tier.items.map((media) => {
                const uri = uris[cursor];
                cursor += 1;
                return (
                  <View key={`${media.media_type}_${media.id}`} style={[styles.poster, { borderRadius: corner(2) }]}>
                    {uri ? (
                      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={settle} onError={settle} />
                    ) : (
                      <Text style={styles.fallback} numberOfLines={4}>
                        {media.title}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.foot}>
        <View style={styles.dots}>
          {["#FF7F7F", "#FFBF7F", "#FFFF7F", "#7FFF7F", "#7FBFFF"].map((color) => (
            <View key={color} style={[styles.dot, { backgroundColor: color }]} />
          ))}
        </View>
        <Text style={styles.brand}>{copy.cardFooter}</Text>
      </View>
    </View>
  );
});

export default TierListShareCard;

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_W, backgroundColor: BG, padding: PAD, gap: 12 },
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, color: "#FFFFFF", fontSize: 20, fontWeight: "900", letterSpacing: -0.3, lineHeight: 24 },
  count: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "800" },
  board: { borderRadius: 6, overflow: "hidden" },
  row: { flexDirection: "row", minHeight: POSTER_H + GAP * 2, backgroundColor: ROW_BG },
  rowGap: { marginTop: 2 },
  label: { width: LABEL_W, alignItems: "center", justifyContent: "center", padding: 5 },
  labelText: { fontSize: 14, fontWeight: "800", textAlign: "center", lineHeight: 17 },
  items: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start", gap: GAP, padding: GAP },
  poster: { width: POSTER_W, height: POSTER_H, borderRadius: 2, overflow: "hidden", backgroundColor: "#3A3A35", justifyContent: "center" },
  fallback: { color: "rgba(255,255,255,0.8)", fontSize: 7, fontWeight: "700", textAlign: "center", padding: 2 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  brand: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
});
