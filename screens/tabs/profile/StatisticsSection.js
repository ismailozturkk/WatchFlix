import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { WatchedInfoSkeleton } from "../../../components/Skeleton";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import { LinearGradient } from "expo-linear-gradient";

const StatisticsSection = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    watchedMovieCount,
    totalWatchedTime,
    watchedTvCount,
    totalEpisodesCount,
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
  } = useProfileScreen();

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
      <View style={styles.section}>
        <Text
          allowFontScaling={false}
          style={[styles.sectionTitle, { color: theme.text.muted }]}
        >
          ISTATISTIKLER
        </Text>
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
                  {watchedMovieCount}
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
                    {watchedTvCount}
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
                    {totalEpisodesCount}
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
  section: {
    width: "90%",
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
    textTransform: "uppercase",
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
