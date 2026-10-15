import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import { GlowBackdrop } from "@components/game/ui";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import BackButton from "@components/BackButton";

/**
 * Oyun ekranlarının ortak kabuğu: üstte vurgu ışığı, geri + başlık satırı,
 * kaydırılan içerik ve (isteğe bağlı) altta SABİT aksiyon çubuğu.
 *
 * `footer`: Başlat gibi birincil aksiyon uzun içeriğin altında kaybolmasın
 * diye kaydırma alanının DIŞINDA durur (kurulum ekranı kullanır).
 */
export function GameScreenShell({
  navigation,
  title,
  subtitle,
  children,
  scroll = true,
  onBack,
  headerRight,
  footer,
  glow = true,
}) {
  const { theme } = useTheme();
  // scroll=false durumunda icerik tum alani kaplar; boylece icerideki bir
  // FlatList sanallastirma yapabilir (Part 14.2).
  const content = <View style={[styles.content, !scroll && styles.contentFill]}>{children}</View>;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.primary }]}>
      {glow ? <GlowBackdrop color={theme.accent} /> : null}
      <View style={styles.header}>
        <BackButton absolute={false} onPress={onBack || (() => navigation.goBack())} />
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, footer && styles.scrollContentWithFooter]}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer ? (
        <View style={[styles.footer, { backgroundColor: theme.primary, borderTopColor: theme.border }]}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );
}

export function GameNavCard({ icon, title, description, onPress, accent, disabled = false, trailing }) {
  const { theme } = useTheme();
  const color = accent || theme.accent;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <View style={[styles.cardIcon, { backgroundColor: `${color}20` }]}>
        <AppIcon family="Ionicons" name={icon} size={23} color={color} />
      </View>
      <View style={styles.cardCopy}>
        <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{title}</Text>
        {description ? <Text style={[styles.cardDescription, { color: theme.text.muted }]}>{description}</Text> : null}
      </View>
      {trailing || <AppIcon family="Ionicons" name="chevron-forward" size={19} color={theme.text.muted} />}
    </TouchableOpacity>
  );
}

export const gameSharedStyles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.7, marginBottom: 10, marginTop: 10, textTransform: "uppercase" },
  primaryButton: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, paddingHorizontal: 20 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  metricRow: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14 },
  metricValue: { fontSize: 22, fontWeight: "900" },
  metricLabel: { fontSize: 11, fontWeight: "700", marginTop: 4 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 70, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "900", letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: "650", marginTop: 2 },
  scrollContent: { paddingBottom: 34 },
  scrollContentWithFooter: { paddingBottom: 18 },
  content: { paddingHorizontal: 16, gap: 12 },
  contentFill: { flex: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth },
  card: { minHeight: 76, borderRadius: 18, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "850" },
  cardDescription: { fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 3 },
});
