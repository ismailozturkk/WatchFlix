// components/hub/HubWrappedModule.js
//
// Hub sekmesinde yer alan Seelogd Wrapped & Yıllık Arşiv modülü.
// Kullanıcının izleme geçmişine göre en son yılın Wrapped özet kartını
// ve geçmiş yılların arşivine erişim sağlayan modal sheet'i içerir.

import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useProfileStats } from "@context/ProfileStatsContext";
import { countShows, getAvailableYears, toDate } from "@utils/wrapped";
import { getWrappedStrings } from "@utils/wrappedStrings";
import { i18nText } from "@utils/i18nText";

export default function HubWrappedModule({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { listItems, flatEpisodesTv } = useProfileStats();

  const wrappedStr = useMemo(() => getWrappedStrings(language), [language]);

  const wrappedYears = useMemo(() => {
    const movies = (listItems || []).filter((m) => m?.type === "movie");
    return getAvailableYears(movies, flatEpisodesTv || []);
  }, [listItems, flatEpisodesTv]);

  const latestWrappedYear = wrappedYears[0];
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);

  // Karta özel: Yalnızca seçili yılda (latestWrappedYear) izlenen film, dizi ve bölüm sayıları
  const yearStats = useMemo(() => {
    if (!latestWrappedYear) return { movies: 0, tvs: 0, episodes: 0 };
    const moviesInYear = (listItems || []).filter(
      (m) => m?.type === "movie" && toDate(m?.dateAdded)?.getFullYear() === latestWrappedYear,
    );
    const epsInYear = (flatEpisodesTv || []).filter(
      (e) => toDate(e?.episodeWatchTime)?.getFullYear() === latestWrappedYear,
    );
    return {
      movies: moviesInYear.length,
      tvs: countShows(epsInYear),
      episodes: epsInYear.length,
    };
  }, [listItems, flatEpisodesTv, latestWrappedYear]);

  const wrappedPressScale = useRef(new Animated.Value(1)).current;

  const handleWrappedPressIn = () => {
    Animated.spring(wrappedPressScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handleWrappedPressOut = () => {
    Animated.spring(wrappedPressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  if (latestWrappedYear == null && wrappedYears.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {i18nText("autoI18n.wrapped_section", "Wrapped & Arşiv")}
      </Text>

      {latestWrappedYear != null && (
        <Animated.View
          style={[
            styles.wrappedCard,
            {
              shadowColor: theme.accent,
              transform: [{ scale: wrappedPressScale }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            onPressIn={handleWrappedPressIn}
            onPressOut={handleWrappedPressOut}
            onPress={() =>
              navigation.navigate("WrappedScreen", {
                year: latestWrappedYear,
                hideYearPicker: true,
              })
            }
          >
            <LinearGradient
              colors={["#0D051A", "#2E114D", "#6C63FF", "#8A2BE2"]}
              locations={[0, 0.45, 0.85, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.wrappedGradient}
            >
              {/* Cam Pırıltısı (Glass Sheen Overlay) */}
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.04)", "transparent"]}
                locations={[0, 0.4, 1]}
                style={styles.wrappedSheen}
              />

              {/* Kozmik Işık Halkaları (Glow Orbs) */}
              <View pointerEvents="none" style={styles.wrappedGlowOrbPrimary} />
              <View pointerEvents="none" style={styles.wrappedGlowOrbSecondary} />

              {/* Arka Plan Şeffaf Sütun & Grafik Katmanı */}
              <View pointerEvents="none" style={styles.wrappedChartLayer}>
                <View style={styles.wrappedBarChartGroup}>
                  <View style={[styles.wrappedBar, { height: "35%" }]} />
                  <View style={[styles.wrappedBar, { height: "68%" }]} />
                  <View style={[styles.wrappedBar, { height: "45%" }]} />
                  <View
                    style={[
                      styles.wrappedBar,
                      { height: "90%", backgroundColor: "rgba(255, 215, 0, 0.22)" },
                    ]}
                  />
                  <View style={[styles.wrappedBar, { height: "60%" }]} />
                  <View
                    style={[
                      styles.wrappedBar,
                      { height: "100%", backgroundColor: "rgba(56, 189, 248, 0.25)" },
                    ]}
                  />
                  <View style={[styles.wrappedBar, { height: "50%" }]} />
                </View>
                <MaterialCommunityIcons
                  name="chart-bell-curve-cumulative"
                  size={135}
                  color="rgba(255, 255, 255, 0.055)"
                  style={styles.wrappedChartIcon}
                />
                <MaterialCommunityIcons
                  name="chart-timeline-variant"
                  size={75}
                  color="rgba(255, 215, 0, 0.09)"
                  style={styles.wrappedTrendIcon}
                />
              </View>

              {/* Lüks İkon Motifleri */}
              <MaterialCommunityIcons
                name="creation"
                size={110}
                color="rgba(255,255,255,0.075)"
                style={styles.wrappedMotif}
              />

              {/* Üst Bar: Marka ve Yıl Rozetleri */}
              <View style={styles.wrappedTopRow}>
                <View style={styles.wrappedBrandPill}>
                  <MaterialCommunityIcons name="creation" size={12} color="#FFD700" />
                  <Text style={styles.wrappedBrandText} allowFontScaling={false}>
                    SEELOGD · WRAPPED
                  </Text>
                </View>
                <View style={styles.wrappedYearPill}>
                  <MaterialCommunityIcons name="calendar-star" size={12} color="#FFD700" />
                  <Text style={styles.wrappedYearText} allowFontScaling={false}>
                    {latestWrappedYear}
                  </Text>
                </View>
              </View>

              {/* Orta İçerik: başlık + CTA */}
              <View style={styles.wrappedContent}>
                <View style={styles.wrappedTextCol}>
                  <Text style={styles.wrappedTitle} allowFontScaling={false} numberOfLines={2}>
                    {wrappedStr.entrySubtitle}
                  </Text>
                </View>

                {/* Şık CTA Aksiyon Butonu */}
                <View style={styles.wrappedCta}>
                  <Text style={styles.wrappedCtaText} allowFontScaling={false}>
                    {wrappedStr.entryCta}
                  </Text>
                  <View style={styles.wrappedCtaIcon}>
                    <Ionicons name="arrow-forward" size={13} color="#16091F" />
                  </View>
                </View>
              </View>

              {/* Film · dizi · bölüm çipleri */}
              <View style={styles.wrappedSummaryRow}>
                {yearStats.movies > 0 && (
                  <View style={styles.wrappedSummaryChip}>
                    <Ionicons name="film-outline" size={11} color="#FFD700" />
                    <Text style={styles.wrappedSummaryText} allowFontScaling={false}>
                      {yearStats.movies} {language === "en" ? "movies" : "film"}
                    </Text>
                  </View>
                )}
                {yearStats.tvs > 0 && (
                  <View style={styles.wrappedSummaryChip}>
                    <Ionicons name="tv-outline" size={11} color="#38BDF8" />
                    <Text style={styles.wrappedSummaryText} allowFontScaling={false}>
                      {yearStats.tvs} {language === "en" ? "shows" : "dizi"}
                    </Text>
                  </View>
                )}
                {yearStats.episodes > 0 && (
                  <View style={styles.wrappedSummaryChip}>
                    <MaterialCommunityIcons
                      name="play-box-multiple-outline"
                      size={11}
                      color="#34D399"
                    />
                    <Text style={styles.wrappedSummaryText} allowFontScaling={false}>
                      {yearStats.episodes} {language === "en" ? "episodes" : "bölüm"}
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* YILLIK ARŞİV BUTONU */}
      {wrappedYears.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setArchiveModalVisible(true)}
          style={[
            styles.archiveBtn,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.archiveBtnLeft}>
            <View style={[styles.archiveIconWrap, { backgroundColor: theme.accent + "1C" }]}>
              <MaterialCommunityIcons name="calendar-text-outline" size={17} color={theme.accent} />
            </View>
            <View style={styles.archiveTextWrap}>
              <Text style={[styles.archiveBtnTitle, { color: theme.text.primary }]}>
                {language === "en" ? "Yearly Archive" : "Yıllık Arşiv"}
              </Text>
              <Text style={[styles.archiveBtnSub, { color: theme.text.muted }]}>
                {language === "en"
                  ? `Explore past recaps (${wrappedYears.length} ${wrappedYears.length > 1 ? "years" : "year"})`
                  : `Geçmiş yılların sinema özetleri (${wrappedYears.length} Yıl)`}
              </Text>
            </View>
          </View>
          <View style={[styles.archiveBtnRight, { backgroundColor: theme.between }]}>
            <Ionicons name="apps-outline" size={13} color={theme.accent} />
            <Ionicons name="chevron-forward" size={13} color={theme.text.muted} />
          </View>
        </TouchableOpacity>
      )}

      {/* YILLIK ARŞİV MODAL SHEET */}
      <BottomSheetModal
        visible={archiveModalVisible}
        onClose={() => setArchiveModalVisible(false)}
        intensity={35}
        dimColor="rgba(0,0,0,0.42)"
        sheetStyle={[
          styles.modalContent,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        {/* Modal Handle */}
        <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />

        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
              {language === "en" ? "Yearly Wrapped Archive" : "Yıllık Wrapped Arşivi"}
            </Text>
            <Text style={[styles.modalSub, { color: theme.text.muted }]}>
              {language === "en"
                ? "Select a year to watch its custom recap story"
                : "Slayt hikayesini izlemek istediğin yılı seç"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setArchiveModalVisible(false)}
            style={[styles.modalCloseBtn, { backgroundColor: theme.between }]}
          >
            <Ionicons name="close" size={18} color={theme.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Yıllar Listesi */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        >
          {wrappedYears.map((yr) => {
            const isLatest = yr === latestWrappedYear;
            const mInYr = (listItems || []).filter(
              (m) => m?.type === "movie" && toDate(m?.dateAdded)?.getFullYear() === yr,
            ).length;
            const epsInYr = (flatEpisodesTv || []).filter(
              (e) => toDate(e?.episodeWatchTime)?.getFullYear() === yr,
            );
            const tvsInYr = countShows(epsInYr);

            return (
              <TouchableOpacity
                key={yr}
                activeOpacity={0.8}
                onPress={() => {
                  setArchiveModalVisible(false);
                  navigation.navigate("WrappedScreen", {
                    year: yr,
                    hideYearPicker: true,
                  });
                }}
                style={[
                  styles.yearArchiveCard,
                  {
                    backgroundColor: isLatest ? theme.accent + "12" : theme.between,
                    borderColor: isLatest ? theme.accent + "66" : theme.border,
                  },
                ]}
              >
                <View style={styles.yearArchiveLeft}>
                  <View
                    style={[
                      styles.yearBadgeWrap,
                      { backgroundColor: isLatest ? theme.accent : theme.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.yearBadgeText,
                        { color: isLatest ? "#FFFFFF" : theme.text.primary },
                      ]}
                    >
                      {yr}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.yearCardTitle, { color: theme.text.primary }]}>
                        {yr} {language === "en" ? "Recap" : "Özeti"}
                      </Text>
                      {isLatest && (
                        <View style={[styles.latestBadge, { backgroundColor: theme.accent }]}>
                          <Text style={styles.latestBadgeText}>
                            {language === "en" ? "LATEST" : "GÜNCEL"}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.yearCardSub, { color: theme.text.muted }]}>
                      {mInYr} {language === "en" ? "movies" : "film"} · {tvsInYr}{" "}
                      {language === "en" ? "shows" : "dizi"}
                    </Text>
                  </View>
                </View>
                <View style={[styles.launchBtn, { backgroundColor: theme.accent }]}>
                  <Text style={styles.launchBtnText}>
                    {language === "en" ? "Watch" : "İzle"}
                  </Text>
                  <Ionicons name="play" size={12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    marginTop: 18,
  },
  sectionTitle: {
    width: "90%",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  wrappedCard: {
    width: "90%",
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 12,
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  wrappedGradient: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  wrappedSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  wrappedGlowOrbPrimary: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -40,
    left: -30,
    backgroundColor: "rgba(108, 99, 255, 0.35)",
  },
  wrappedGlowOrbSecondary: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    bottom: -50,
    right: -30,
    backgroundColor: "rgba(138, 43, 226, 0.32)",
  },
  wrappedChartLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  wrappedBarChartGroup: {
    position: "absolute",
    left: 14,
    bottom: 12,
    width: 120,
    height: 60,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  wrappedBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  wrappedChartIcon: {
    position: "absolute",
    right: -15,
    top: -20,
  },
  wrappedTrendIcon: {
    position: "absolute",
    right: 40,
    bottom: 10,
  },
  wrappedMotif: {
    position: "absolute",
    right: -10,
    bottom: -15,
  },
  wrappedTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wrappedBrandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.28)",
  },
  wrappedBrandText: {
    color: "#FFD700",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  wrappedYearPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.45)",
  },
  wrappedYearText: { color: "#FFD700", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  wrappedContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  wrappedTextCol: { flex: 1, minWidth: 0 },
  wrappedTitle: {
    color: "#FFFFFF",
    fontSize: 18.5,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  wrappedSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    rowGap: 6,
    marginTop: 10,
  },
  wrappedSummaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  wrappedSummaryText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 9.5,
    fontWeight: "800",
  },
  wrappedCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingLeft: 13,
    paddingRight: 4,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  wrappedCtaText: { color: "#16091F", fontSize: 11.5, fontWeight: "900", letterSpacing: -0.2 },
  wrappedCtaIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(22,9,31,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  archiveBtn: {
    width: "90%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 6,
  },
  archiveBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  archiveIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveTextWrap: { flex: 1 },
  archiveBtnTitle: { fontSize: 13, fontWeight: "800" },
  archiveBtnSub: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  archiveBtnRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },

  // Modal Sheet Stilleri
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: "75%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
    opacity: 0.5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: "900" },
  modalSub: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  yearArchiveCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  yearArchiveLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  yearBadgeWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  yearBadgeText: { fontSize: 13, fontWeight: "900" },
  yearCardTitle: { fontSize: 13.5, fontWeight: "800" },
  yearCardSub: { fontSize: 10.5, fontWeight: "600", marginTop: 2 },
  latestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  latestBadgeText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "900" },
  launchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  launchBtnText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
