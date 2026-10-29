// components/hub/Top100Widget.js
//
// Eğlence'deki "Seelogd Top 100" kartı (Günün Sorusu'nun altında): en çok oy alan ilk üç yapım kürsü gibi yan yana (oy sayılarıyla),
// toplam Seelogd oyu ve kendi oy sayın. Dokununca tam liste (screens/fun/Top100Screen) açılır.
// Veri hooks/useTop100'den; ekranla aynı bellek önbelleğini paylaşır.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import HubCard, { GlassPill, HubArrow } from "@components/hub/HubCard";
import useTop100 from "@hooks/useTop100";
import { useLanguage } from "@context/LanguageContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { getTop100Copy } from "@utils/top100Copy";
import { showsTotalVotes } from "@utils/top100";

const COLORS = ["#F59E0B", "#B45309", "#431407"];
const SHADOW = "#B45309";
const MEDALS = ["#FFD76A", "#E5E7EB", "#F0A15E"];
// Kürsü sırası: 2 · 1 · 3 (ortadaki en yüksek).
const PODIUM = [1, 0, 2];

function Top100Widget({ navigation }) {
  const { language } = useLanguage();
  const copy = getTop100Copy(language);
  const { getTmdbUrl } = useImageQualitySettings();
  const { status, ranked, totalVotes, used } = useTop100();
  const top = ranked.slice(0, 3);
  const mine = used;

  return (
    <HubCard
      colors={COLORS}
      shadowColor={SHADOW}
      cardStyle={styles.card}
      onPress={() => navigation.navigate("Top100Screen")}
      accessibilityRole="button"
      accessibilityLabel={`${copy.screenTitle}, ${copy.open}`}
    >
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon family="Ionicons" name="podium-outline" size={140} color="rgba(255,255,255,0.08)" />
      </View>

      <View style={styles.badges}>
        <GlassPill icon="trophy" iconColor={MEDALS[0]} text={copy.eyebrow} tone="dark" />
        {showsTotalVotes(totalVotes) ? <GlassPill icon="people" text={copy.totalVotes(totalVotes)} /> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.copy}>
          <Text style={styles.title} allowFontScaling={false} numberOfLines={2}>
            {copy.widgetTitle}
          </Text>
          <Text style={styles.sub} allowFontScaling={false} numberOfLines={3}>
            {copy.widgetSub}
          </Text>
        </View>

        <View style={styles.podium}>
          {PODIUM.map((index) => {
            const row = top[index];
            const lead = index === 0;
            return (
              <View key={index} style={[styles.slot, lead && styles.slotLead]}>
                <View style={[styles.poster, lead && styles.posterLead]}>
                  {row?.poster_path ? (
                    <Image
                      source={{ uri: getTmdbUrl(row.poster_path, "poster", 200) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={160}
                    />
                  ) : status === "error" ? (
                    <AppIcon family="Ionicons" name="film-outline" size={18} color="rgba(255,255,255,0.5)" />
                  ) : null}
                </View>
                <View style={[styles.medal, { backgroundColor: MEDALS[index] }]}>
                  <Text style={styles.medalText} allowFontScaling={false}>
                    {index + 1}
                  </Text>
                </View>
                {row ? (
                  <Text style={styles.score} allowFontScaling={false}>
                    {copy.num(row.votes)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText} allowFontScaling={false} numberOfLines={1}>
          {mine > 0 ? copy.myVotes(mine) : copy.open}
        </Text>
        <HubArrow color={SHADOW} size={34} />
      </View>
    </HubCard>
  );
}

export default memo(Top100Widget);

const POSTER_W = 50;
const LEAD_W = 60;

const styles = StyleSheet.create({
  card: { padding: 16 },
  watermark: { position: "absolute", right: -18, bottom: -26, transform: [{ rotate: "-10deg" }] },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, rowGap: 6 },
  body: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 12 },
  copy: { flex: 1, minWidth: 0, alignSelf: "center" },
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
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  slot: { alignItems: "center", width: POSTER_W },
  slotLead: { width: LEAD_W, marginBottom: 8 },
  // Genişlik ÇİFT, yükseklik = 1,5 × genişlik (2:3 afiş, kırpılmasın — bkz. shareKit PosterEdge dersi).
  poster: {
    width: POSTER_W,
    height: POSTER_W * 1.5,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  posterLead: { width: LEAD_W, height: LEAD_W * 1.5, borderRadius: 12 },
  medal: {
    marginTop: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#7C2D12",
  },
  medalText: { color: "#431407", fontSize: 11, fontWeight: "900" },
  score: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "800", marginTop: 3, fontVariant: ["tabular-nums"] },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  footerText: { flex: 1, color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
