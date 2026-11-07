// components/hub/LeagueWidget.js
//
// Eğlence'nin en üstündeki "Haftalık Lig" kartı: ligin adı ve rengi, bu haftaki sıran ve XP'n, kalan süre.
// Bu hafta henüz XP kazanmadıysan katılma çağrısı; geçen haftanın sonucu (yükseldin / düştün / kaldın) altta.
// Dokununca lig ekranı (screens/fun/LeagueScreen) açılır. Veri hooks/useLeague'den; ekranla aynı önbellek.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import HubCard, { GlassPill, HubArrow } from "@components/hub/HubCard";
import useLeague from "@hooks/useLeague";
import { useLanguage } from "@context/LanguageContext";
import { getLeagueCopy } from "@utils/leagueCopy";
import { lastResultLine, tierVisual, timeLeftLabel } from "@utils/leagueVisuals";
import { weekIdOf } from "@utils/leagueRules";

function LeagueWidget({ navigation }) {
  const { language } = useLanguage();
  const copy = getLeagueCopy(language);
  const { status, user, rank, size, lastResult } = useLeague();
  const tier = user?.tier ?? 0;
  const visual = tierVisual(tier);
  const joined = !!user?.joined;
  const leagueName = copy.league(copy.tiers[tier]);
  const week = weekIdOf(Date.now());
  const footer =
    user?.pendingWeek ? copy.pending : lastResult && !joined ? lastResultLine(copy, lastResult) : copy.open;

  return (
    <HubCard
      colors={visual.colors}
      shadowColor={visual.colors[1]}
      cardStyle={styles.card}
      onPress={() => navigation.navigate("LeagueScreen")}
      accessibilityRole="button"
      accessibilityLabel={`${copy.screenTitle}, ${leagueName}${rank ? `, ${copy.rank(rank)}` : ""}`}
    >
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon family="Ionicons" name={visual.icon} size={150} color="rgba(255,255,255,0.08)" />
      </View>

      <View style={styles.badges}>
        <GlassPill icon="podium" iconColor={visual.medal} text={copy.eyebrow} tone="dark" />
        <GlassPill icon="time-outline" text={timeLeftLabel(copy, week)} />
      </View>

      <View style={styles.body}>
        <View style={styles.copy}>
          <Text style={styles.title} allowFontScaling={false} numberOfLines={1}>
            {status === "error" && !user ? copy.screenTitle : leagueName}
          </Text>
          <Text style={styles.sub} allowFontScaling={false} numberOfLines={2}>
            {status === "loading" && !user
              ? copy.loading
              : joined
                ? [rank ? copy.rankOf(rank, size) : null, copy.xp(user.xp)].filter(Boolean).join(" · ")
                : copy.joinSub}
          </Text>
        </View>
        <View style={[styles.emblem, { borderColor: visual.medal }]}>
          <AppIcon family="Ionicons" name={visual.icon} size={30} color={visual.medal} />
          {joined && rank ? (
            <Text style={styles.emblemRank} allowFontScaling={false}>
              {rank}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText} allowFontScaling={false} numberOfLines={1}>
          {footer}
        </Text>
        <HubArrow color={visual.colors[1]} size={34} />
      </View>
    </HubCard>
  );
}

export default memo(LeagueWidget);

const styles = StyleSheet.create({
  card: { padding: 16 },
  watermark: { position: "absolute", right: -20, bottom: -30, transform: [{ rotate: "-10deg" }] },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, rowGap: 6 },
  body: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  sub: { color: "rgba(255,255,255,0.88)", fontSize: 12.5, lineHeight: 17, fontWeight: "700", marginTop: 4 },
  emblem: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  emblemRank: {
    position: "absolute",
    bottom: -8,
    minWidth: 26,
    paddingHorizontal: 6,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  footerText: { flex: 1, color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
