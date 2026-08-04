import React, { useRef, useMemo, useState } from "react";
import { i18nText } from "@utils/i18nText";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { WatchedInfoSkeleton } from "../../../components/Skeleton";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileStats } from "../../../context/ProfileStatsContext";
import { LinearGradient } from "expo-linear-gradient";
import { countShows, getAvailableYears, toDate } from "../../../utils/wrapped";
import { getWrappedStrings } from "../../../utils/wrappedStrings";

const COUNT_MODES = ["total", "unique"];

const StatisticsSection = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const {
    displayMovieCount,
    statsCountMode,
    toggleStatsCountMode,
    totalWatchedTime,
    displayTvCount,
    displayEpisodesCount,
    totalWatchedTimeTv,
    totalMinutesTime,
    totalMinutesTimeTv,
    isloadingShowInfo,
    isloadingMovieInfo,
    timeDisplayMode,
    handleTimeClick,
    formatTotalDurationTime,
    borderColorTv,
    borderColorMovie,
    rankNameTv,
    rankNameMovie,
    listItems,
    flatEpisodesTv,
  } = useProfileStats();

  // ── Seelogd Wrapped giriş kartı verisi ──
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
      (m) => m?.type === "movie" && toDate(m?.dateAdded)?.getFullYear() === latestWrappedYear
    );
    const epsInYear = (flatEpisodesTv || []).filter(
      (e) => toDate(e?.episodeWatchTime)?.getFullYear() === latestWrappedYear
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

  const strokeWidth = 14;
  const radius = 62;
  const circleConfig = {
    strokeWidth,
    radius,
    strokeDasharray: Math.PI * 2 * radius,
    strokeLinecap: "round",
    activeStrokeOpacity: 1,
    inActiveStrokeOpacity: 0.05,
  };

  const scaleAnimTv = useRef(new Animated.Value(1)).current;
  const scaleAnimMovie = useRef(new Animated.Value(1)).current;

  const onPressIn = (item) => {
    Animated.timing(item === "tv" ? scaleAnimTv : scaleAnimMovie, {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (item) => {
    Animated.timing(item === "tv" ? scaleAnimTv : scaleAnimMovie, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const props = {
    activeStrokeWidth: 10,
    inActiveStrokeWidth: 10,
    inActiveStrokeOpacity: 0.05,
  };
  const totalTime = totalMinutesTime ?? 0;
  const totalTimeTv = totalMinutesTimeTv ?? 0;
  const rawProgressTv = (totalTimeTv % 10080) / 10080;
  const rawProgressMovie = (totalTime % 10080) / 10080;
  const safeProgressTv = parseInt(
    Math.min(Math.max(rawProgressTv, 0), 1).toFixed(3) * 100,
  );
  const safeProgressMovie = parseInt(
    Math.min(Math.max(rawProgressMovie, 0), 1).toFixed(3) * 100,
  );
  return (
    <>
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
                  <View style={[styles.wrappedBar, { height: "90%", backgroundColor: "rgba(255, 215, 0, 0.22)" }]} />
                  <View style={[styles.wrappedBar, { height: "60%" }]} />
                  <View style={[styles.wrappedBar, { height: "100%", backgroundColor: "rgba(56, 189, 248, 0.25)" }]} />
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
                name="sparkles"
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

              {/* Film · dizi · bölüm çipleri.
                  CTA'nın yanında değil, kartın tüm genişliğinde: üç çip yan yana
                  ~230px yer istiyor, CTA'nın solunda 200px'ten az kalıyordu.
                  Sıfır olan çip gizlenir; getAvailableYears yalnız verisi olan
                  yılları döndürdüğü için en az bir çip her zaman görünür. */}
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
      <Modal
        visible={archiveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setArchiveModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setArchiveModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
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
                  (m) => m?.type === "movie" && toDate(m?.dateAdded)?.getFullYear() === yr
                ).length;
                const epsInYr = (flatEpisodesTv || []).filter(
                  (e) => toDate(e?.episodeWatchTime)?.getFullYear() === yr
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
                                {language === "en" ? "NEW" : "SON"}
                              </Text>
                            </View>
                          )}
                        </View>
                        {/* Sıfır olan tür yazılmaz: sadece film izlenen yıl
                            "42 film" olarak okunur, "42 film • 0 dizi" değil. */}
                        <Text style={[styles.yearCardSub, { color: theme.text.muted }]}>
                          {[
                            mInYr > 0 && `${mInYr} ${language === "en" ? "movies" : "film"}`,
                            tvsInYr > 0 && `${tvsInYr} ${language === "en" ? "shows" : "dizi"}`,
                            epsInYr.length > 0 &&
                              `${epsInYr.length} ${language === "en" ? "episodes" : "bölüm"}`,
                          ]
                            .filter(Boolean)
                            .join("  •  ")}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.launchBtn, { backgroundColor: theme.accent }]}>
                      <Text style={styles.launchBtnText}>
                        {language === "en" ? "Watch" : "İzle"}
                      </Text>
                      <Ionicons name="play" size={11} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text
            allowFontScaling={false}
            style={[styles.sectionTitle, { color: theme.text.muted }]}
          >
            {i18nText("autoI18n.istatistikler_upper", "İSTATİSTİKLER")}
          </Text>

          {/* Tekrarlı / tekrarsız anahtarı — kartlardaki sayıları belirler.
              Süre her iki kipte de aynı kalır, o dakikalar gerçekten harcandı. */}
          <View
            style={[
              styles.countModeSwitch,
              { backgroundColor: theme.primary, borderColor: theme.border },
            ]}
          >
            {COUNT_MODES.map((mode) => {
              const active = statsCountMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (!active) toggleStatsCountMode();
                  }}
                  style={[
                    styles.countModeButton,
                    active && { backgroundColor: theme.accent },
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.countModeText,
                      { color: active ? "#FFFFFF" : theme.text.muted },
                    ]}
                  >
                    {mode === "total"
                      ? i18nText("autoI18n.tekrarli", "Tekrarlı")
                      : i18nText("autoI18n.tekrarsiz", "Tekrarsız")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {isloadingShowInfo ? (
          <WatchedInfoSkeleton />
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleAnimMovie }] }}>
            <TouchableOpacity
              onPress={() => {
                navigation.navigate("MovieStatisticsScreen");
              }}
              onPressIn={() => onPressIn("movie")}
              onPressOut={() => onPressOut("movie")}
              activeOpacity={0.8}
              style={[
                styles.watchStats,
                {
                  backgroundColor: theme.border,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <LinearGradient
                colors={[
                  theme.accent + 20,
                  theme.border,
                  theme.border,
                  theme.accent + 20,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
              />
              <View
                style={[
                  styles.watchStatsView11,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.textSecondary,
                    {
                      color: theme.text.secondary,
                    },
                  ]}
                >
                  {displayMovieCount}
                </Text>
                <Text
                  style={[
                    styles.textMuted,
                    {
                      color: theme.text.muted,
                    },
                  ]}
                >
                  {t.profileScreen.movieWatched}
                </Text>
              </View>
              <View
                style={[
                  styles.watchStatsView21,

                  {
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTime?.years}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.years}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTime?.months}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.months}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTime?.days}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.days}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTime?.hours}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.hours}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTime?.minutes}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.minutes}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <TouchableOpacity
        onPress={() => handleTimeClick()}
        activeOpacity={0.8}
        style={[
          styles.totalDurationContainer,
          {
            backgroundColor: theme.primary,
            shadowColor: theme.shadow,
            borderColor: theme.border,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.durationItem}>
          <Ionicons
            name="time-outline"
            size={18}
            color={theme.text.secondary}
          />
          <View>
            <Text
              allowFontScaling={false}
              style={[styles.durationValue, { color: theme.accent }]}
            >
              {formatTotalDurationTime(
                (totalMinutesTimeTv || 0) + (totalMinutesTime || 0),
                timeDisplayMode,
              )}
            </Text>
            <Text style={[styles.durationLabel, { color: theme.text.muted }]}>
              {t.profileScreen.totalDuration}
            </Text>
          </View>
        </View>
        <View style={styles.durationItem}>
          <Ionicons
            name="film-outline"
            size={18}
            color={theme.text.secondary}
          />
          <View>
            <Text style={[styles.durationValue, { color: borderColorMovie }]}>
              {formatTotalDurationTime(totalMinutesTime || 0, timeDisplayMode)}
            </Text>
            <Text style={[styles.durationLabel, { color: theme.text.muted }]}>
              {t.movies} {rankNameMovie}
            </Text>
          </View>
        </View>
        <View style={styles.durationItem}>
          <Ionicons name="tv-outline" size={18} color={theme.text.secondary} />
          <View>
            <Text
              allowFontScaling={false}
              style={[styles.durationValue, { color: borderColorTv }]}
            >
              {formatTotalDurationTime(
                totalMinutesTimeTv || 0,
                timeDisplayMode,
              )}
            </Text>
            <Text style={[styles.durationLabel, { color: theme.text.muted }]}>
              {t.tvShows} {rankNameTv}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        {isloadingMovieInfo ? (
          <WatchedInfoSkeleton />
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleAnimTv }] }}>
            <TouchableOpacity
              onPressIn={() => onPressIn("tv")}
              onPressOut={() => onPressOut("tv")}
              activeOpacity={0.8}
              onPress={() => {
                navigation.navigate("TvStatisticsScreen");
              }}
              style={[
                styles.watchStats,
                {
                  backgroundColor: theme.border,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <LinearGradient
                colors={[
                  theme.accent + 20,
                  theme.border,
                  theme.border,
                  theme.accent + 20,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
              />
              <View
                style={[
                  styles.watchStatsView12,
                  {
                    flexDirection: "row",
                    justifyContent: "space-around",
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {displayTvCount}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.tvShowCount}
                  </Text>
                </View>

                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {displayEpisodesCount}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.tvShowEpisodetotalCount}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.watchStatsView22,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTimeTv?.years}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.years}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTimeTv?.months}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.months}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTimeTv?.days}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.days}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTimeTv?.hours}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.hours}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {totalWatchedTimeTv?.minutes}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.minutes}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  wrappedCard: {
    width: "90%",
    borderRadius: 24,
    marginBottom: 18,
    alignSelf: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 14,
  },
  wrappedGradient: {
    minHeight: 146,
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  wrappedSheen: { position: "absolute", top: 0, left: 0, right: 0, height: "70%" },
  wrappedGlowOrbPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -55,
    bottom: -75,
    backgroundColor: "rgba(138,43,226,0.35)",
  },
  wrappedGlowOrbSecondary: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    left: -40,
    top: -50,
    backgroundColor: "rgba(108,99,255,0.25)",
  },
  wrappedChartLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  wrappedBarChartGroup: {
    position: "absolute",
    right: 48,
    bottom: 0,
    height: 100,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    opacity: 0.85,
  },
  wrappedBar: {
    width: 9,
    borderRadius: 4.5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  wrappedChartIcon: {
    position: "absolute",
    right: -10,
    top: -15,
    transform: [{ rotate: "-6deg" }],
  },
  wrappedTrendIcon: {
    position: "absolute",
    left: 15,
    bottom: -10,
  },
  wrappedMotif: {
    position: "absolute",
    right: -15,
    bottom: -25,
    transform: [{ rotate: "-12deg" }],
  },
  wrappedTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wrappedBrandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  wrappedBrandText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  wrappedYearPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
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
    marginBottom: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "flex-end",
  },
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
  wrappedCtaText: { color: "#16091F", fontSize: 10, fontWeight: "900" },

  section: {
    width: "90%",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
    textTransform: "uppercase",
  },
  countModeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    marginBottom: 10,
    marginRight: 6,
  },
  countModeButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  countModeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  watchStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 7,
    gap: 5,
    borderRadius: 18,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
  },
  watchStatsView11: {
    width: "43%",

    justifyContent: "center",
    alignItems: "center",
    padding: 5,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10,
  },
  watchStatsView12: {
    width: "43%",
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10,
  },
  watchStatsView21: {
    width: "55%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 5,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10,
  },
  watchStatsView22: {
    width: "55%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 5,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10,
  },
  textSecondary: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
  },
  textMuted: {
    textAlign: "center",
    fontSize: 12,
  },

  totalDurationContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "90%",
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 12,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  durationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  durationValue: {
    fontSize: 12,
    fontWeight: "bold",
  },
  durationLabel: {
    fontSize: 10,
    textTransform: "uppercase",
  },
});

export default StatisticsSection;
