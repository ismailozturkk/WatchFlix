import React from "react";
import { StyleSheet, View, Text, Image, ScrollView } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
export default function TVShowItem({ item }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.secondary, shadowColor: theme.shadow },
      ]}
    >
      <View style={styles.statusInfo}>
        <View style={styles.statusItem}>
          <Text style={[styles.statusLabel, { color: theme.text.secondary }]}>
            {t.status}
          </Text>
          <Text style={[styles.statusValue, { color: theme.text.primary }]}>
            {item.status === "Ended" ? t.tvStatusEnd : t.tvStatusCon}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={[styles.statusLabel, { color: theme.text.secondary }]}>
            {t.type}
          </Text>
          <Text style={[styles.statusValue, { color: theme.text.primary }]}>
            {item.type || "Bilinmiyor"}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={[styles.statusLabel, { color: theme.text.secondary }]}>
            {t.country}
          </Text>
          <Text style={[styles.statusValue, { color: theme.text.primary }]}>
            {item.origin_country?.length > 0
              ? item.origin_country.join(", ")
              : "Bilinmiyor"}
          </Text>
        </View>
      </View>

      {item.networks?.length > 0 && (
        <View style={styles.networkInfo}>
          <Text style={[styles.networkLabel, { color: theme.text.secondary }]}>
            {t.network}
          </Text>
          <ScrollView
            contentContainerStyle={styles.networkContainerList}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {item.networks.map((network) => (
              <View key={network.id} style={styles.networkContainer}>
                <Image
                  source={{
                    uri: `https://image.tmdb.org/t/p/original/${network.logo_path}`,
                  }}
                  style={styles.logoPath}
                />
                <Text
                  style={[styles.networkValue, { color: theme.text.primary }]}
                >
                  {network.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {item.production_companies?.length > 0 && (
        <View style={styles.companyInfo}>
          <Text style={[styles.companyLabel, { color: theme.text.secondary }]}>
            {t.productCompanies}
          </Text>
          <Text style={[styles.companyValue, { color: theme.text.primary }]}>
            {item.production_companies
              .map((company) => company.name)
              .join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },

  statusInfo: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  statusItem: {
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 5,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  networkInfo: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  networkLabel: {
    fontSize: 12,
    marginBottom: 5,
  },
  networkValue: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  companyInfo: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  companyLabel: {
    fontSize: 12,
    marginBottom: 5,
  },
  companyValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  logoPath: {
    width: 80,
    height: 30,
    resizeMode: "contain",
  },
  networkContainerList: {
    justifyContent: "center",
    alignContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  networkContainer: {
    justifyContent: "center",
    alignContent: "center",
    gap: 10,
  },
});
