// components/hub/MatchWidget.js
//
// Hub'daki "Zevk Çemberleri" kartı (Faz 4). HubScreen yalnız `match.available` iken (bayrak açık +
// 18+ kanıtlı) çizer. Katılmamışsa davet; katıldıysa kulvar başına güç çubuğu + TEK sonraki adım.
// Dokununca: katıldıysa Önerilerim (screens/match/MatchScreen), değilse Ayarlar > Zevk Çemberleri.
// Güç: hooks/useMatchStrength (yeni okuma yok).
//
// Ölçüm: services/matchAnalytics.js (kimlik/skor yok).

import React, { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import HubCard, { GlassPill, HubArrow } from "@components/hub/HubCard";
import { useLanguage } from "@context/LanguageContext";
import { trackLaneView } from "@services/matchAnalytics";
import useMatchStrength from "@hooks/useMatchStrength";
import { getMatchCopy, stepText } from "@utils/matchCopy";

const COLORS = ["#8B5CF6", "#6D28D9", "#3B0764"];
const SHADOW = "#6D28D9";

function MatchWidget({ navigation, match }) {
  const { language } = useLanguage();
  const copy = getMatchCopy(language);
  const strength = useMatchStrength({ enabled: !!match?.optedIn });
  const lanes = match?.optedIn ? match.lanes.filter((lane) => strength?.[lane]) : [];

  useEffect(() => {
    for (const lane of lanes) trackLaneView(lane, strength[lane]);
  }, [lanes.join(","), strength]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HubCard
      colors={COLORS}
      shadowColor={SHADOW}
      cardStyle={styles.card}
      onPress={() => navigation.navigate(match?.optedIn ? "MatchScreen" : "MatchSettingsScreen")}
      accessibilityRole="button"
      accessibilityLabel={`${copy.hub.title}, ${match?.optedIn ? copy.hub.hint : copy.hub.notJoined}`}
    >
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon family="Ionicons" name="people-circle-outline" size={140} color="rgba(255,255,255,0.08)" />
      </View>
      <View style={styles.badges}>
        <GlassPill icon="people" text={copy.hub.title} tone="dark" />
      </View>

      {lanes.length ? (
        <View style={styles.rows}>
          {lanes.map((lane) => {
            const info = strength[lane];
            return (
              <View key={lane} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} allowFontScaling={false} numberOfLines={1}>
                    {copy.hub.strengthLabel(copy.lanes[lane], info.strength)}
                  </Text>
                  {info.eligible ? <AppIcon family="Ionicons" name="checkmark-circle" size={16} color="#FFFFFF" /> : null}
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(3, info.strength)}%` }]} />
                </View>
                <Text style={styles.step} allowFontScaling={false} numberOfLines={2}>
                  {stepText(copy, info.next)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.title} allowFontScaling={false} numberOfLines={2}>
          {copy.hub.notJoined}
        </Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText} allowFontScaling={false} numberOfLines={2}>
          {match?.optedIn ? copy.hub.hint : copy.hub.openSettings}
        </Text>
        <HubArrow color={SHADOW} size={34} />
      </View>
    </HubCard>
  );
}

export default memo(MatchWidget);

const styles = StyleSheet.create({
  card: { padding: 16 },
  watermark: { position: "absolute", right: -18, bottom: -26, transform: [{ rotate: "-10deg" }] },
  badges: { flexDirection: "row", alignItems: "center", gap: 6 },
  rows: { gap: 12, marginTop: 14 },
  row: { gap: 6 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  track: { height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999, backgroundColor: "#FFFFFF" },
  step: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 16, fontWeight: "600" },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 12,
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14 },
  footerText: { flex: 1, color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },
});
