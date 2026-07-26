// screens/tabs/settings/settingsUi.js
//
// Ayarlar hub'ı + alt ekranların paylaştığı yardımcılar, scaffold ve stiller.
// Tek kaynak: SettingRow / SectionLabel / Chevron / buildUiColors + ortak `ui`
// StyleSheet + SettingsSubScreen (root + ScreenDecor + ekran-içi BackButton
// başlığı + ScrollView). Böylece her alt ekran aynı görünümü stil tekrarı
// olmadan kullanır.

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import BackButton from "@components/BackButton";
import ScreenDecor from "@components/ScreenDecor";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "../../../theme/colors";

// SettingsScreen'deki palet — tek kaynak burada.
export function buildUiColors(theme) {
  return {
    bg: theme.primary,
    card: theme.secondary,
    cardAlt: theme.between,
    border: theme.border,
    borderMuted: alpha(theme.border, 0.55),
    text: theme.text.primary,
    muted: theme.text.muted,
    accent: theme.accent,
    accentStrong: theme.bold,
    accentDim: alpha(theme.accent, 0.16),
    danger: theme.colors.red,
    dangerDim: alpha(theme.colors.red, 0.12),
    blue: theme.colors.blue,
    purple: theme.colors.purple,
    green: theme.colors.green,
    amber: theme.colors.orange,
    teal: theme.accent,
    iconBlue: alpha(theme.colors.blue, 0.14),
    iconPurple: alpha(theme.colors.purple, 0.14),
    iconGreen: alpha(theme.colors.green, 0.14),
    iconAmber: alpha(theme.colors.orange, 0.14),
    iconTeal: alpha(theme.accent, 0.14),
    white: "#FFFFFF",
    handle: alpha(theme.text.muted, 0.45),
    closeBg: alpha(theme.border, 0.7),
  };
}

export function Chevron({ color }) {
  return <AppIcon family="Ionicons" name="chevron-forward" size={14} color={color} />;
}

export function SectionLabel({ children, color }) {
  return (
    <Text allowFontScaling={false} style={[ui.sectionLabel, { color }]}>
      {children}
    </Text>
  );
}

export function SettingRow({
  colors,
  iconBg,
  iconColor,
  iconName,
  iconFamily = "Ionicons",
  title,
  subtitle,
  right,
  onPress,
  danger,
  last,
}) {
  return (
    <TouchableOpacity
      style={[
        ui.row,
        { borderBottomColor: colors.borderMuted },
        last && { borderBottomWidth: 0 },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={ui.rowLeft}>
        <View style={[ui.iconWrap, { backgroundColor: iconBg }]}>
          <AppIcon family={iconFamily} name={iconName} size={15} color={iconColor} />
        </View>
        <View style={ui.rowTexts}>
          <Text
            allowFontScaling={false}
            style={[ui.rowTitle, { color: danger ? colors.danger : colors.text }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text allowFontScaling={false} style={[ui.rowSub, { color: colors.muted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={ui.rowRight}>{right}</View>
    </TouchableOpacity>
  );
}

/**
 * Alt ayar ekranı iskeleti: arka plan + ekran-içi geri butonu/başlık + scroll.
 *
 * `scrollable={false}` verildiğinde gövde ScrollView'a sarılmaz; kendi
 * kaydırmasını yöneten ekranlar (ör. sanallaştırılmış FlatList) için gerekli —
 * FlatList'i ScrollView içine koymak sanallaştırmayı bozar.
 */
export function SettingsSubScreen({
  title,
  children,
  background = null,
  scrollable = true,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const C = buildUiColors(theme);
  return (
    <View style={[ui.root, { backgroundColor: C.bg }]}>
      <ScreenDecor iconOpacity={0.15} />
      {background}
      <View style={[ui.header, { paddingTop: insets.top + 8 }]}>
        <BackButton absolute={false} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[ui.headerTitle, { color: C.text }]}
        >
          {title}
        </Text>
        <View style={ui.headerSpacer} />
      </View>
      {scrollable ? (
        <ScrollView
          style={ui.scroll}
          contentContainerStyle={ui.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={ui.scroll}>{children}</View>
      )}
    </View>
  );
}

export const ui = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 40 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 110 },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 22,
  },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowRight: { flexDirection: "row", alignItems: "center" },
  rowTexts: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "500" },
  rowSub: { fontSize: 11, marginTop: 2 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
