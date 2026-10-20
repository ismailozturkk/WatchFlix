// components/settings/DevPlanSimulatorCard.js
//
// Ayarlar'da YALNIZ geliştirme build'inde görünen plan simülatörü: etkin planı
// Gerçek / Free / Premium / Max arasında anında değiştirir. Mağaza satın alması
// gerekmeden her premium kapısı, limit ve kilitli ekran denenebilir.
//
// İstemci kapılarını etkiler; sunucu kotası (AI günlük hak, yayın bildirimi)
// gerçek plana göre çalışır — bkz. services/devPlanOverride.js. Release'de
// `isDevPlanSimulatorAvailable()` false olduğu için kart hiç çizilmez.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { alpha } from "@theme/colors";
import { getPremiumPlanDisplayName } from "@utils/premium";
import { useTheme } from "../../context/ThemeContext";
import { usePremium } from "../../context/PremiumContext";
import {
  DEV_PLAN_REAL,
  isDevPlanSimulatorAvailable,
  setDevPlanOverride,
  useDevPlanOverride,
} from "../../services/devPlanOverride";

const CHOICES = [
  { id: DEV_PLAN_REAL, label: "Gerçek" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
  { id: "unlimited", label: "Max" },
];

export default function DevPlanSimulatorCard() {
  const { theme } = useTheme();
  const { plan, realPlan } = usePremium();
  const selected = useDevPlanOverride();

  if (!isDevPlanSimulatorAvailable()) return null;

  const simulating = selected !== DEV_PLAN_REAL;
  const warn = theme.colors.orange || "#F59E0B";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: alpha(warn, 0.16) }]}>
          <AppIcon name="flask-outline" size={15} color={warn} />
        </View>
        <View style={styles.headerCopy}>
          <Text
            allowFontScaling={false}
            style={[styles.title, { color: theme.text.primary }]}
          >
            Plan simülatörü (yalnız geliştirme)
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.sub, { color: theme.text.muted }]}
          >
            {`Etkin: ${getPremiumPlanDisplayName(plan)} · Gerçek: ${getPremiumPlanDisplayName(realPlan)}`}
          </Text>
        </View>
      </View>

      <View style={styles.choices}>
        {CHOICES.map((choice) => {
          const active = choice.id === selected;
          return (
            <Pressable
              key={choice.id}
              onPress={() => setDevPlanOverride(choice.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.choice,
                {
                  backgroundColor: active
                    ? alpha(theme.accent, 0.18)
                    : alpha(theme.text.primary, 0.05),
                  borderColor: active
                    ? alpha(theme.accent, 0.6)
                    : alpha(theme.text.primary, 0.1),
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.choiceText,
                  { color: active ? theme.accent : theme.text.muted },
                ]}
              >
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text
        allowFontScaling={false}
        style={[styles.note, { color: simulating ? warn : theme.text.muted }]}
      >
        {simulating
          ? "Simülasyon açık: yalnız bu cihazdaki kapılar değişir. AI günlük kotası gibi sunucu limitleri gerçek plana göre çalışır."
          : "Simülasyon kapalı: gerçek plan geçerli."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: "hidden",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: "700" },
  sub: { fontSize: 11, marginTop: 2 },
  choices: { flexDirection: "row", gap: 8, marginTop: 12 },
  choice: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  choiceText: { fontSize: 12, fontWeight: "800" },
  note: { fontSize: 10.5, lineHeight: 15, marginTop: 10 },
});
