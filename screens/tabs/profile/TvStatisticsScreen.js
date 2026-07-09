import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfileStats } from "../../../context/ProfileStatsContext";
import { useTheme } from "../../../context/ThemeContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";
import BackButton from "../../../components/BackButton";
import {
  StatsHeroCard,
  StatsScreenHeader,
  StatsFilterBar,
  StatsDateSection,
  StatsEmptyState,
  StatsCollapsingList,
} from "../../../components/profile/StatsComponents";

const sectionKeyExtractor = (_item, index) => `tv-${index}`;

const TvStatisticsScreen = ({ navigation }) => {
  const {
    formatDate,
    groupedDataTv,
    uniqueDatesTv,
    t,
    formatTotalDurationTime,
    timeDisplayMode,
    handleTimeClick,
    totalWatchedTimeTv,
    watchedTvCount,
    totalMinutesTimeTv,
    mostWatchedGenreTv,
    secondWatchedGenreTv,
    thirdWatchedGenreTv,
    totalEpisodesCount,
    totalSeasonsCount,
    selectedDateTv,
    setSelectedDateTv,
    borderColorTv,
    rankLevelTv,
    rankNameTv,
  } = useProfileStats();

  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const insets = useSafeAreaInsets();

  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const timeLabels = useMemo(
    () => ({
      years: t.profileScreen.years,
      months: t.profileScreen.months,
      days: t.profileScreen.days,
      hours: t.profileScreen.hours,
      minutes: t.profileScreen.minutes,
    }),
    [t],
  );

  const heroGenres = useMemo(
    () => [mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv],
    [mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv],
  );

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groupedDataTv || [])
      .map((section) => ({
        title: section.title,
        items: q
          ? section.data.filter(
              (item) =>
                item.showName?.toLowerCase().includes(q) ||
                item.episodeName?.toLowerCase().includes(q) ||
                item.seasonNumber == search,
            )
          : section.data,
      }))
      .filter((s) => s.items.length > 0)
      .filter((s) => selectedDateTv == null || s.title === selectedDateTv)
      .map((s) => ({
        title: s.title,
        data: [],
        genres: [...new Set(s.items.flatMap((e) => e.genres || []).filter(Boolean))],
        totalMinutes: s.items.reduce((acc, item) => acc + (item.episodeMinutes || 0), 0),
        posters: s.items.map((item) => ({
          key: String(item.id),
          imageUri: item.seasonPosterPath
            ? getTmdbUrl(item.seasonPosterPath, "poster", 200)
            : null,
          title: item.episodeName,
          subtitle: item.showName,
          minutes: item.episodeMinutes,
          onPress: () => navigation.navigate("TvShowsDetails", { id: item.showId }),
        })),
      }));
  }, [groupedDataTv, search, selectedDateTv, getTmdbUrl, navigation]);

  const renderSectionHeader = useCallback(
    ({ section }) => (
      <StatsDateSection
        theme={theme}
        title={section.title}
        posters={section.posters}
        genres={section.genres}
        totalMinutes={section.totalMinutes}
        minutesLabel={t.minutes}
        formatDate={formatDate}
        rankColor={borderColorTv}
      />
    ),
    [theme, t.minutes, formatDate, borderColorTv],
  );

  const onToggleSearch = useCallback(() => setSearchVisible((v) => !v), []);
  const onToggleExpand = useCallback(() => setExpanded((v) => !v), []);
  const onSelectDate = useCallback(
    (d) => {
      setSearchVisible(false);
      setSelectedDateTv(d);
    },
    [setSelectedDateTv],
  );

  const collapsing = (
    <>
      <StatsScreenHeader
        theme={theme}
        title={i18nText("autoI18n.dizi_istatistikleri", "Dizi İstatistikleri")}
        eyebrow={i18nText("autoI18n.dizi_arsivi", "Dizi arşivi")}
        subtitle={i18nText(
          "autoI18n.dizi_izleme_yolculugu_ozeti",
          "Dizi ve bölüm geçmişinin ayrıntılı özeti",
        )}
        icon="tv-outline"
        accentColor={borderColorTv}
      />

      <StatsHeroCard
        theme={theme}
        primaryCount={watchedTvCount}
        primaryLabel={t.profileScreen.tvShowWatched}
        secondaryCount={totalEpisodesCount}
        secondaryLabel={t.profileScreen.tvShowEpisodetotalCount}
        tertiaryCount={totalSeasonsCount}
        tertiaryLabel={t.profileScreen.tvShowSeasonCount}
        time={totalWatchedTimeTv || {}}
        timeLabels={timeLabels}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        rankColor={borderColorTv}
        rankLevel={rankLevelTv}
        rankName={rankNameTv}
        totalMinutes={totalMinutesTimeTv}
        timeDisplayMode={timeDisplayMode}
        onTimePress={handleTimeClick}
        formatDuration={formatTotalDurationTime}
        genres={heroGenres}
      />
    </>
  );

  const pinned = (
    <StatsFilterBar
      theme={theme}
      searchVisible={searchVisible}
      onToggleSearch={onToggleSearch}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t.searchMovies}
      dates={uniqueDatesTv}
      selectedDate={selectedDateTv}
      onSelectDate={onSelectDate}
      formatDate={formatDate}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatsCollapsingList
        theme={theme}
        topInset={insets.top + 6}
        sections={sections}
        keyExtractor={sectionKeyExtractor}
        renderSectionHeader={renderSectionHeader}
        collapsing={collapsing}
        pinned={pinned}
        ListEmptyComponent={
          <StatsEmptyState
            theme={theme}
            icon="tv-outline"
            title={i18nText("autoI18n.henuz_dizi_yok", "Henüz izlenen dizi yok")}
          />
        }
      />
      <BackButton />
    </View>
  );
};

export default TvStatisticsScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
