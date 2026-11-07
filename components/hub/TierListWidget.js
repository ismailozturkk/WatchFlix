// components/hub/TierListWidget.js
//
// Eğlence'deki "Tier list" kartı (Meydan okumaların altında). Tablo varsa en son düzenlenenin mini önizlemesi
// (en çok 6 kademe, satıra sığan en çok 12 afiş), yoksa davet metni ve pastel kademe şeridi. Dokununca
// screens/fun/TierListsScreen açılır; hiç tablo yoksa oluşturma sayfası açık gelir. Veri hooks/useTierLists'ten
// (cihaz-yerel, ağ yok).

import React, { memo, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import HubCard, { GlassPill, HubArrow } from "@components/hub/HubCard";
import TierMiniPreview from "@components/tierList/TierMiniPreview";
import { useLanguage } from "@context/LanguageContext";
import usePosterUri from "@hooks/usePosterUri";
import useTierLists from "@hooks/useTierLists";
import { tierListShareView } from "@utils/tierList";
import { getTierListCopy } from "@utils/tierListCopy";

const COLORS = ["#C2410C", "#9A3412", "#431407"];
const SHADOW = "#9A3412";
const STRIP = [
  ["S", "#FF7F7F"],
  ["A", "#FFBF7F"],
  ["B", "#FFDF7F"],
  ["C", "#FFFF7F"],
  ["D", "#BFFF7F"],
];

function TierListWidget({ navigation }) {
  const { language } = useLanguage();
  const copy = getTierListCopy(language);
  const posterUri = usePosterUri();
  const { lists } = useTierLists();
  const latest = lists[0] || null;
  const posterUriOf = useCallback((media, width) => posterUri(media.media_type, media.id, media.poster_path, width), [posterUri]);

  return (
    <HubCard
      colors={COLORS}
      shadowColor={SHADOW}
      cardStyle={styles.card}
      onPress={() => navigation.navigate("TierListsScreen", latest ? undefined : { create: true })}
      accessibilityRole="button"
      accessibilityLabel={`${copy.sectionTitle}, ${latest ? copy.widgetOpen : copy.widgetCreate}`}
    >
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon family="Ionicons" name="podium-outline" size={140} color="rgba(255,255,255,0.08)" />
      </View>

      <View style={styles.badges}>
        <GlassPill icon="podium" text={copy.eyebrow} tone="dark" />
        {lists.length ? <GlassPill icon="albums" text={copy.widgetCount(lists.length)} /> : null}
      </View>

      {latest ? (
        <View style={styles.latest}>
          <Text style={styles.latestTitle} allowFontScaling={false} numberOfLines={1}>
            {latest.title || copy.untitled}
          </Text>
          <TierMiniPreview
            tiers={tierListShareView(latest).tiers}
            posterUriOf={posterUriOf}
            tone="onColor"
            moreLabel={copy.moreTiers}
          />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.copy}>
            <Text style={styles.title} allowFontScaling={false} numberOfLines={2}>
              {copy.widgetTitle}
            </Text>
            <Text style={styles.sub} allowFontScaling={false} numberOfLines={3}>
              {copy.widgetSub}
            </Text>
          </View>
          <View style={styles.strip}>
            {STRIP.map(([label, color]) => (
              <View key={label} style={[styles.stripCell, { backgroundColor: color }]}>
                <Text style={styles.stripText} allowFontScaling={false}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText} allowFontScaling={false} numberOfLines={1}>
          {latest ? copy.widgetOpen : copy.widgetCreate}
        </Text>
        <HubArrow color={SHADOW} size={34} />
      </View>
    </HubCard>
  );
}

export default memo(TierListWidget);

const styles = StyleSheet.create({
  card: { padding: 16 },
  watermark: { position: "absolute", right: -18, bottom: -26, transform: [{ rotate: "-10deg" }] },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, rowGap: 6 },
  latest: { gap: 8, marginTop: 12 },
  latestTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  body: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  sub: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 16, fontWeight: "600", marginTop: 5 },
  strip: { gap: 3, width: 44 },
  stripCell: { height: 16, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  stripText: { color: "#1A1A1A", fontSize: 10, fontWeight: "900" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  footerText: { flex: 1, color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
