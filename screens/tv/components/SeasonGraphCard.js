import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import SectionHeader from "@components/detail/SectionHeader";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";

/* Sezon grafik kartı: backdrop üstünde özet istatistikler,
   dokununca TvGraphDetailScreen'e gider. */
export default function SeasonGraphCard({ details, navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();

  if (!details.seasons?.filter((s) => s.season_number > 0).length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title={t.seasons} />
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("TvGraphDetailScreen", { id: details.id })
        }
        activeOpacity={0.88}
        style={[styles.graphCard, { borderColor: theme.border }]}
      >
        {details.backdrop_path && (
          <Image
            source={{ uri: getTmdbUrl(details.backdrop_path, "backdrop", 1000) }}
            style={styles.graphBackdrop}
            blurRadius={2}
          />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.72)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.graphContent}>
          {details.poster_path && (
            <Image
              source={{ uri: getTmdbUrl(details.poster_path, "poster", 200) }}
              style={styles.graphPoster}
            />
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <Text
              allowFontScaling={false}
              style={[styles.graphTitle, { color: "#fff" }]}
            >
              {details.name}
            </Text>
            <View style={styles.graphStats}>
              {[
                {
                  icon: "layers-outline",
                  val: details.number_of_seasons,
                  lbl: t.seasons,
                },
                {
                  icon: "play-circle-outline",
                  val: details.number_of_episodes,
                  lbl: t.episode,
                },
                {
                  icon: "star-outline",
                  val: details.vote_count,
                  lbl: t.votes,
                },
              ].map(({ icon, val, lbl }) => (
                <View key={lbl} style={styles.graphStatItem}>
                  <Ionicons name={icon} size={14} color="rgba(255,255,255,0.7)" />
                  <Text allowFontScaling={false} style={styles.graphStatVal}>
                    {val || 0}
                  </Text>
                  <Text allowFontScaling={false} style={styles.graphStatLbl}>
                    {lbl}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.graphChevron]}>
              <Ionicons
                name="bar-chart-outline"
                size={13}
                color="rgba(255,255,255,0.7)"
              />
              <Text
                allowFontScaling={false}
                style={styles.graphChevronText}
              >{i18nText("autoI18n.detayli_istatistikler", "Detaylı İstatistikler")}</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color="rgba(255,255,255,0.6)"
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  graphCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    height: 160,
  },
  graphBackdrop: { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  graphContent: {
    flex: 1,
    flexDirection: "row",
    padding: 14,
    gap: 12,
    alignItems: "center",
  },
  graphPoster: { width: 80, height: 120, borderRadius: 10 },
  graphTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  graphStats: { flexDirection: "row", gap: 16 },
  graphStatItem: { alignItems: "center", gap: 2 },
  graphStatVal: { color: "#fff", fontSize: 14, fontWeight: "700" },
  graphStatLbl: { color: "rgba(255,255,255,0.6)", fontSize: 10 },
  graphChevron: { flexDirection: "row", alignItems: "center", gap: 5 },
  graphChevronText: { color: "rgba(255,255,255,0.65)", fontSize: 12, flex: 1 },
});
