// components/hub/ChallengesWidget.js
//
// Eğlence'deki "Meydan okumalar" kartı (Top 100'ün altında). Süren görev varsa en yakın ikisinin ilerlemesi
// (madalya + ad + çubuk + sayı), yoksa davet metni ve birkaç görevin madalyası. Dokununca
// screens/fun/ChallengesScreen açılır. Veri hooks/useWatchChallenges'tan (yeni dinleyici açmaz).

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import HubCard, { GlassPill, HubArrow } from "@components/hub/HubCard";
import { ChallengeBar, ChallengeMedal } from "@components/challenges/ChallengeParts";
import useWatchChallenges from "@hooks/useWatchChallenges";
import { useLanguage } from "@context/LanguageContext";
import { getWatchChallengesCopy } from "@utils/watchChallengesCopy";
import { getChallenge } from "@utils/watchChallenges";

const COLORS = ["#10B981", "#047857", "#064E3B"];
const SHADOW = "#047857";
const SHOWCASE = ["films52", "decades", "director_525"];
const ROWS = 2;

function ChallengesWidget({ navigation }) {
  const { language } = useLanguage();
  const copy = getWatchChallengesCopy(language);
  const { active, completed } = useWatchChallenges();
  // En çok ilerleyen önce: kartta "neredeyse bitti" görünsün.
  const rows = [...active].sort((a, b) => b.progress.ratio - a.progress.ratio).slice(0, ROWS);

  return (
    <HubCard
      colors={COLORS}
      shadowColor={SHADOW}
      cardStyle={styles.card}
      onPress={() => navigation.navigate("ChallengesScreen")}
      accessibilityRole="button"
      accessibilityLabel={`${copy.screenTitle}, ${copy.open}`}
    >
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon family="Ionicons" name="flag-outline" size={140} color="rgba(255,255,255,0.08)" />
      </View>

      <View style={styles.badges}>
        <GlassPill icon="flag" text={copy.eyebrow} tone="dark" />
        {completed.length ? <GlassPill icon="trophy" text={copy.widgetMedals(completed.length)} /> : null}
      </View>

      {rows.length ? (
        <View style={styles.rows}>
          {rows.map(({ challenge, progress }) => (
            <View key={challenge.id} style={styles.row}>
              <ChallengeMedal challenge={challenge} size={34} />
              <View style={styles.rowCopy}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} allowFontScaling={false} numberOfLines={1}>
                    {copy.titleOf(challenge)}
                  </Text>
                  <Text style={styles.rowCount} allowFontScaling={false}>
                    {copy.count(progress.count, progress.target)}
                  </Text>
                </View>
                <ChallengeBar ratio={progress.ratio} color="#FFFFFF" track="rgba(255,255,255,0.22)" height={5} />
              </View>
            </View>
          ))}
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
          <View style={styles.showcase}>
            {SHOWCASE.map((id, index) => (
              <ChallengeMedal
                key={id}
                challenge={getChallenge(id)}
                size={index === 1 ? 50 : 40}
                style={index === 1 ? styles.showcaseLead : null}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText} allowFontScaling={false} numberOfLines={1}>
          {active.length ? copy.widgetActive(active.length) : copy.open}
        </Text>
        <HubArrow color={SHADOW} size={34} />
      </View>
    </HubCard>
  );
}

export default memo(ChallengesWidget);

const styles = StyleSheet.create({
  card: { padding: 16 },
  watermark: { position: "absolute", right: -18, bottom: -26, transform: [{ rotate: "-10deg" }] },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, rowGap: 6 },
  rows: { gap: 12, marginTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 6 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  rowCount: { color: "#FFFFFF", fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
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
  showcase: { flexDirection: "row", alignItems: "center" },
  showcaseLead: { marginHorizontal: -6, zIndex: 1 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  footerText: { flex: 1, color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
