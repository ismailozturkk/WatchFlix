// components/tv/TvGraphShareCard.js
//
// Paylaşılan BÖLÜM GRAFİĞİ kartı — sohbet balonu (components/chat/SharedTvGraphMessage), Paylaşımlar gönderisi
// (components/feed/PostTvGraphBlock) ve paylaşım penceresinin önizlemesi (CreatePostModal) ortak kullanır.
// Koyu zemin (gelen/giden, açık/koyu tema aynı): afiş + "BÖLÜM GRAFİĞİ" + dizi adı + yıllar · ★ puan, ızgara,
// isteğe bağlı renk açıklaması, alt satır. Izgara iç genişliğe göre planlanır (utils/tvGraphShare.planTvGraphLayout):
// `width` verilirse ilk karede, verilmezse ölçülünce. Plan `maxGraphHeight`ı aşarsa alt kısım solarak kesilir.
// `onPress` varsa kart dokunulur (dizinin canlı grafiği açılır) ve sağ altta "Grafiği aç" yazar.

import React, { memo, useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassPressable from "../common/GlassPressable";
import TvGraphSnapshot from "./TvGraphSnapshot";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { i18nText } from "../../utils/i18nText";
import { RATING_TIERS } from "../../utils/ratingColors";
import { planTvGraphLayout } from "../../utils/tvGraphShare";

export const TV_GRAPH_CARD_BG = "#12161D";
export const TV_GRAPH_ACCENT = "#2DD4BF";
const PADDING = 12;
const BORDER = 1;
// Kartın dış genişliği ile ızgaranın kullanabileceği iç genişlik arasındaki fark
// (dolgu + çerçeve). Çerçeve düşülmezse ızgara sağ kenarda 2 dp kırpılır.
const CHROME = (PADDING + BORDER) * 2;

const LEGEND = RATING_TIERS.map((tier, index) => ({
  bg: tier.bg,
  label: Number.isFinite(tier.min) ? `${tier.min}+` : `<${RATING_TIERS[index - 1]?.min ?? 4}`,
}));

function TvGraphShareCard({
  graph,
  width,
  maxGraphHeight = 320,
  maxCell = 30,
  layoutMode = "auto",
  episodesPerRow,
  fillRowsWidth = false,
  shrinkToGraph = false,
  minWidth = 200,
  footer,
  onPress,
  showLegend = false,
  style,
  testID = "tvgraph-card",
}) {
  const [measured, setMeasured] = useState(null);
  const { getTmdbUrl } = useImageQualitySettings();
  const innerWidth = width ? width - CHROME : measured;
  const plan = useMemo(
    () =>
      graph && innerWidth > 0
        ? planTvGraphLayout(graph.seasons, {
            width: innerWidth,
            maxHeight: maxGraphHeight,
            maxCell,
            layoutMode,
            episodesPerRow,
            fillRowsWidth,
          })
        : null,
    [episodesPerRow, fillRowsWidth, graph, innerWidth, layoutMode, maxGraphHeight, maxCell],
  );
  // Sohbet kartı mevcut `width` değerini üst sınır kabul eder. Kısa grafikler
  // başlık/alt satırı sıkıştırmayacak tabana kadar kendi gerçek genişliğine iner.
  const resolvedWidth =
    width && shrinkToGraph && plan
      ? Math.min(width, Math.max(minWidth, Math.ceil(plan.width + CHROME)))
      : width;
  const onLayout = useCallback(
    (event) => {
      if (width) return;
      const next = Math.floor(event.nativeEvent.layout.width);
      setMeasured((prev) => (prev === next ? prev : next));
    },
    [width],
  );

  if (!graph || !Array.isArray(graph.seasons)) return null;
  const meta = [graph.years, graph.rating ? `★ ${graph.rating.toFixed(1)}` : ""].filter(Boolean).join(" · ");
  const counts = i18nText("autoI18n.tvgraph_n_sezon_bolum", "{{s}} sezon · {{e}} bölüm", {
    s: graph.totalSeasons || graph.seasons.length,
    e: graph.totalEpisodes,
  });
  // Afiş gövdede: gönderenin ÖZEL AFİŞİ (TvGraphDetailScreen çözüp yazar). İzleyenin kendi seçimi burada BİLEREK
  // uygulanmaz — sohbet/gönderi anlık görüntüsü kuralı: herkes gönderenin paylaştığını görür. Boyut izleyenin kalitesi.
  const poster = graph.poster_path ? getTmdbUrl(graph.poster_path, "poster", 92) : null;

  const body = (
    <>
      <View style={styles.header}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <Ionicons name="tv" size={16} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        <View style={styles.headerCopy}>
          <View style={styles.kickerRow}>
            <Ionicons name="grid" size={10} color={TV_GRAPH_ACCENT} />
            <Text allowFontScaling={false} numberOfLines={1} style={styles.kicker}>
              {i18nText("autoI18n.bolum_grafigi_upper", "BÖLÜM GRAFİĞİ")}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.title}>
            {graph.title}
          </Text>
          {meta ? (
            <Text numberOfLines={1} style={styles.meta}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      <View
        onLayout={onLayout}
        style={plan ? { height: Math.min(plan.height, maxGraphHeight), overflow: "hidden" } : null}
      >
        <TvGraphSnapshot seasons={graph.seasons} plan={plan} />
        {plan?.overflow ? (
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(18,22,29,0)", TV_GRAPH_CARD_BG]}
            style={styles.fade}
          >
            <Text allowFontScaling={false} style={styles.fadeText}>
              {i18nText("autoI18n.tvgraph_tamami", "Tamamı için grafiği aç")}
            </Text>
          </LinearGradient>
        ) : null}
      </View>

      {showLegend ? (
        <View style={styles.legend}>
          {LEGEND.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.bg }]} />
              <Text allowFontScaling={false} style={styles.legendText}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text numberOfLines={1} style={styles.footerText}>
          {footer ? `${footer} · ${counts}` : counts}
        </Text>
        {onPress ? (
          <View style={styles.open}>
            <Text allowFontScaling={false} style={styles.openText}>
              {i18nText("autoI18n.tvgraph_ac", "Grafiği aç")}
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.card, resolvedWidth ? { width: resolvedWidth } : null, style]} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <GlassPressable
      glass={false}
      accessibilityRole="button"
      accessibilityLabel={`${i18nText("autoI18n.bolum_grafigi", "Bölüm grafiği")}: ${graph.title}. ${i18nText("autoI18n.tvgraph_ac", "Grafiği aç")}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, resolvedWidth ? { width: resolvedWidth } : null, pressed && styles.pressed, style]}
      testID={testID}
    >
      {body}
    </GlassPressable>
  );
}

export default memo(TvGraphShareCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: PADDING,
    gap: 10,
    overflow: "hidden",
    borderWidth: BORDER,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: TV_GRAPH_CARD_BG,
  },
  pressed: { opacity: 0.88 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  poster: { width: 34, height: 51, borderRadius: 7, backgroundColor: "#222831" },
  posterEmpty: { alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 1 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  kicker: { color: TV_GRAPH_ACCENT, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "900" },
  meta: { color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: "700" },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 56, alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 },
  fadeText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 9, rowGap: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  footerText: { flex: 1, color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "700" },
  open: { flexDirection: "row", alignItems: "center", gap: 2 },
  openText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
