// components/decor/UniverseCollectionPill.js
//
// "Evren koleksiyonu N/M" hapı (Kütüphane sekmesi başlığının altında). İzledikçe açılan
// atmosfer evrenlerinin sayacı; dokununca Atmosfer ekranı açılır. Kural:
// utils/universeUnlocks.js, kanca: hooks/useUniverseUnlocks.js.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import GlassTouchable from "../common/GlassTouchable";
import useUniverseUnlocks from "../../hooks/useUniverseUnlocks";
import { i18nText } from "../../utils/i18nText";

export default function UniverseCollectionPill({ navigation, theme }) {
  const { count, total } = useUniverseUnlocks();
  const label = i18nText("autoI18n.evren_koleksiyonu", "Evren koleksiyonu");
  const fill = total ? count / total : 0;
  return (
    <GlassTouchable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${count}/${total}`}
      accessibilityHint={i18nText("autoI18n.evren_koleksiyonu_ipucu", "Atmosfer ayarlarını açar")}
      activeOpacity={0.75}
      onPress={() => navigation?.navigate?.("AtmosphereScreen")}
      style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.secondary }]}
    >
      <AppIcon family="MaterialCommunityIcons" name="orbit" size={14} color={theme.accent} />
      <Text allowFontScaling={false} style={[styles.label, { color: theme.text.secondary }]}>
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.bar, { width: `${Math.round(fill * 100)}%`, backgroundColor: theme.accent }]} />
      </View>
      <Text allowFontScaling={false} style={[styles.count, { color: theme.text.primary }]}>
        {count}/{total}
      </Text>
    </GlassTouchable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 12,
  },
  label: { fontSize: 12, fontWeight: "600" },
  track: { width: 46, height: 4, borderRadius: 2, overflow: "hidden" },
  bar: { height: 4, borderRadius: 2 },
  count: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
