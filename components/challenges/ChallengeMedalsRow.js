// components/challenges/ChallengeMedalsRow.js
//
// Profilde rozet şeridinin altındaki ince satır: tamamlanan meydan okumaların madalyaları (üst üste binmiş en çok
// beş) + sayı. Hiç madalya yoksa HİÇ çizilmez (profil kalabalıklaşmasın; davet Eğlence kartında). Dokununca
// screens/fun/ChallengesScreen açılır. Bölüm görünürlüğü profilin "badges" bölümüne bağlı.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassTouchable from "@components/common/GlassTouchable";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import useWatchChallenges from "@hooks/useWatchChallenges";
import { getWatchChallengesCopy } from "@utils/watchChallengesCopy";
import { getChallenge } from "@utils/watchChallenges";
import { ChallengeMedal } from "./ChallengeParts";

const SHOWN = 5;
const SIZE = 26;

function ChallengeMedalsRow({ onPress, style }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getWatchChallengesCopy(language);
  const { completed } = useWatchChallenges();
  if (!completed.length) return null;

  // Aynı görev birden çok kez bitmiş olabilir (maraton); şeritte her görev bir kez.
  const unique = [...new Map(completed.map((run) => [run.id, run])).values()].slice(0, SHOWN);

  return (
    <GlassTouchable
      glass={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={copy.medalsA11y(completed.length)}
      style={[styles.row, { backgroundColor: theme.secondary, borderColor: theme.border }, style]}
    >
      <View style={styles.stack}>
        {unique.map((run, index) => (
          <ChallengeMedal
            key={run.id}
            challenge={getChallenge(run.id)}
            size={SIZE}
            style={[styles.medal, index > 0 && styles.overlap, { borderColor: theme.secondary, zIndex: SHOWN - index }]}
          />
        ))}
      </View>
      <Text style={[styles.text, { color: theme.text.primary }]} numberOfLines={1}>
        {copy.medalsTitle}
      </Text>
      <Text style={[styles.count, { color: theme.text.secondary }]}>{completed.length}</Text>
      <AppIcon family="Ionicons" name="chevron-forward" size={16} color={theme.text.muted} />
    </GlassTouchable>
  );
}

export default memo(ChallengeMedalsRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stack: { flexDirection: "row", alignItems: "center" },
  medal: { borderRadius: SIZE / 2, borderWidth: 2 },
  overlap: { marginLeft: -9 },
  text: { flex: 1, fontSize: 13, fontWeight: "800" },
  count: { fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
});
