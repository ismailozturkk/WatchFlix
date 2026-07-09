import React from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import SectionHeader from "@components/detail/SectionHeader";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";

/* İzleme platformları: bölgeye göre flatrate sağlayıcı kartları.
   providers = details["watch/providers"].results[region] */
export default function MovieProvidersSection({ providers }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();

  if (!providers) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title={t.watchProviders} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.providersRow}>
          {providers.flatrate?.map((p) => (
            <View
              key={p.provider_id}
              style={[
                styles.providerCard,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
            >
              <Image
                source={{ uri: getTmdbUrl(p.logo_path, "poster", 200) }}
                style={styles.providerLogo}
              />
              <Text
                allowFontScaling={false}
                style={[styles.providerName, { color: theme.text.secondary }]}
                numberOfLines={1}
              >
                {p.provider_name}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  providersRow: { flexDirection: "row", gap: 12, paddingVertical: 4 },
  providerCard: {
    alignItems: "center",
    width: 72,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
  },
  providerLogo: { width: 44, height: 44, borderRadius: 10 },
  providerName: { fontSize: 10, textAlign: "center", fontWeight: "500" },
});
