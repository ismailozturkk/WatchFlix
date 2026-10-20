import React from "react";
import { StyleSheet, View, Text, ScrollView } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { i18nText } from "../utils/i18nText";

// Stat kutusu aksanları — ListsViewScreen/profil kart paletiyle uyumlu.
const ENDED_ACCENT = "#f87171";
const CONTINUING_ACCENT = "#34d399";
const TYPE_ACCENT = "#4fc3f7";
const COUNTRY_ACCENT = "#a78bfa";
const COMPANY_ACCENT = "#fbbf24";

// Dizi künye kartı: durum / tip / ülke stat kutuları + yapım şirketi çipleri.
// Yayıncı (networks) bölümü TvShowsDetails'te ayrı bir bölüm olarak gösterilir.
export default function TVShowItem({ item }) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const unknown = i18nText("autoI18n.bilinmiyor", "Bilinmiyor");
  const isEnded = item.status === "Ended";

  const stats = [
    {
      key: "status",
      label: t.status,
      value: isEnded ? t.tvStatusEnd : t.tvStatusCon,
      icon: isEnded ? "flag" : "play",
      accent: isEnded ? ENDED_ACCENT : CONTINUING_ACCENT,
    },
    {
      key: "type",
      label: t.type,
      value: item.type || unknown,
      icon: "film",
      accent: TYPE_ACCENT,
    },
    {
      key: "country",
      label: t.country,
      value:
        item.origin_country?.length > 0
          ? item.origin_country.join(", ")
          : unknown,
      icon: "globe",
      accent: COUNTRY_ACCENT,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      {/* ── Durum / Tip / Ülke ── */}
      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <View
                style={[styles.statDivider, { backgroundColor: theme.border }]}
              />
            )}
            <View style={styles.statItem}>
              <View
                style={[styles.statIconDot, { backgroundColor: s.accent + "1C" }]}
              >
                <Ionicons name={s.icon} size={14} color={s.accent} />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { color: theme.text.muted }]}
              >
                {s.label}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { color: theme.text.primary }]}
                numberOfLines={1}
              >
                {s.value}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* ── Yapım şirketleri ── */}
      {item.production_companies?.length > 0 && (
        <>
          <View
            style={[styles.sectionDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.companyHeader}>
            <Ionicons name="business" size={12} color={COMPANY_ACCENT} />
            <Text
              allowFontScaling={false}
              style={[styles.companyLabel, { color: theme.text.muted }]}
            >
              {t.productCompanies}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.companyChips}
          >
            {item.production_companies.map((company) => (
              <View
                key={company.id}
                style={[
                  styles.companyChip,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.companyChipText,
                    { color: theme.text.secondary },
                  ]}
                  numberOfLines={1}
                >
                  {company.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },

  // ── Stat kutuları ──────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 4,
    opacity: 0.6,
  },
  statIconDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  // ── Yapım şirketleri ───────────────────────────────────────────────────────
  sectionDivider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.6,
  },
  companyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  companyLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  companyChips: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  companyChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 180,
  },
  companyChipText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
});
