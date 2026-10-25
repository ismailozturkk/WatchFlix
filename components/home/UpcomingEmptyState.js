// components/home/UpcomingEmptyState.js
//
// "Yaklaşan Filmler" süzgeci sonuç vermediğinde (ör. dijitalde + korku + Korece) rafın ve "Tümü"
// ekranının yerine çizilen kart. Raf boş kalınca kullanıcı süzgecin işlediğini değil rafın bozulduğunu
// sanıyordu; kart nedeni söyler ve tek dokunuşla sıfırlatır. Rafta yüksekliği poster satırına eşitlenir
// (`minHeight`) — sonuç gelip gidince altındaki raflar zıplamasın.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassPressable from "../common/GlassPressable";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { getUpcomingFiltersCopy } from "../../utils/upcomingFiltersCopy";

export default function UpcomingEmptyState({ onReset, minHeight, style }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getUpcomingFiltersCopy(language);
  const accent = theme.accent ?? "#3B82F6";

  return (
    <View
      testID="upcoming-empty"
      style={[styles.card, { minHeight, backgroundColor: theme.secondary, borderColor: theme.border }, style]}
    >
      <View style={[styles.icon, { backgroundColor: alpha(accent, 0.14) }]}>
        <Ionicons name="calendar-clear-outline" size={22} color={accent} />
      </View>
      <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
        {copy.ui.emptyTitle}
      </Text>
      <Text allowFontScaling={false} style={[styles.text, { color: theme.text.muted }]}>
        {copy.ui.emptyText}
      </Text>
      <GlassPressable
        testID="upcoming-empty-reset"
        accessibilityRole="button"
        onPress={onReset}
        style={({ pressed }) => [
          styles.button,
          { borderColor: accent, backgroundColor: alpha(accent, 0.1), opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="refresh" size={15} color={accent} />
        <Text allowFontScaling={false} style={[styles.buttonText, { color: accent }]}>
          {copy.ui.emptyAction}
        </Text>
      </GlassPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  text: { fontSize: 12.5, lineHeight: 17, textAlign: "center", marginTop: 4 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    borderWidth: 1,
  },
  buttonText: { fontSize: 13.5, fontWeight: "700" },
});
