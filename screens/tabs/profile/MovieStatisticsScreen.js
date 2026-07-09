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

const sectionKeyExtractor = (_item, index) => `m-${index}`;

const MovieStatisticsScreen = ({ navigation }) => {
  const {
    watchedMovieCount,
    totalWatchedTime,
    formatDate,
    groupedData,
    uniqueDates,
    t,
    selectedDate,
    setSelectedDate,
    mostWatchedGenre,
    secondWatchedGenre,
    threeWatchedGenre,
    formatTotalDurationTime,
    timeDisplayMode,
    totalMinutesTime,
    handleTimeClick,
    borderColorMovie,
    rankLevelMovie,
    rankNameMovie,
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
    () => [mostWatchedGenre, secondWatchedGenre, threeWatchedGenre],
    [mostWatchedGenre, secondWatchedGenre, threeWatchedGenre],
  );

  // Tek geçişte filtrele + bölüm meta'sını (tür/dk) ve normalize poster'ları
  // önceden hesapla. Dış liste yalnızca başlık render eder (data: []).
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groupedData || [])
      .map((section) => ({
        title: section.title,
        items: q
          ? section.data.filter((item) => item.name?.toLowerCase().includes(q))
          : section.data,
      }))
      .filter((s) => s.items.length > 0)
      .filter((s) => selectedDate == null || s.title === selectedDate)
      .map((s) => ({
        title: s.title,
        data: [],
        genres: [...new Set(s.items.flatMap((m) => m.genres || []).filter(Boolean))],
        totalMinutes: s.items.reduce((acc, item) => acc + (item.minutes || 0), 0),
        posters: s.items.map((item) => ({
          key: String(item.id),
          imageUri: item.imagePath ? getTmdbUrl(item.imagePath, "poster", 200) : null,
          title: item.name,
          minutes: item.minutes,
          onPress: () => navigation.navigate("MovieDetails", { id: item.id }),
        })),
      }));
  }, [groupedData, search, selectedDate, getTmdbUrl, navigation]);

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
        rankColor={borderColorMovie}
      />
    ),
    [theme, t.minutes, formatDate, borderColorMovie],
  );

  const onToggleSearch = useCallback(() => setSearchVisible((v) => !v), []);
  const onToggleExpand = useCallback(() => setExpanded((v) => !v), []);
  const onSelectDate = useCallback(
    (d) => {
      setSearchVisible(false);
      setSelectedDate(d);
    },
    [setSelectedDate],
  );

  const collapsing = (
    <>
      <StatsScreenHeader
        theme={theme}
        title={i18nText("autoI18n.film_istatistikleri", "Film İstatistikleri")}
        eyebrow={i18nText("autoI18n.film_arsivi", "Film arşivi")}
        subtitle={i18nText(
          "autoI18n.film_izleme_yolculugu_ozeti",
          "İzleme yolculuğunun ayrıntılı özeti",
        )}
        icon="film-outline"
        accentColor={borderColorMovie}
      />

      <StatsHeroCard
        theme={theme}
        primaryCount={watchedMovieCount}
        primaryLabel={t.profileScreen.movieWatched}
        time={totalWatchedTime || {}}
        timeLabels={timeLabels}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        rankColor={borderColorMovie}
        rankLevel={rankLevelMovie}
        rankName={rankNameMovie}
        totalMinutes={totalMinutesTime}
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
      dates={uniqueDates}
      selectedDate={selectedDate}
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
            icon="film-outline"
            title={i18nText("autoI18n.henuz_film_yok", "Henüz izlenen film yok")}
          />
        }
      />
      <BackButton />
    </View>
  );
};

export default MovieStatisticsScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
