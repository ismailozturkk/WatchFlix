import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfileStats } from "../../../context/ProfileStatsContext";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";
import { buildWatchChartData } from "../../../utils/watchHistory";
import BackButton from "../../../components/BackButton";
import {
  StatsHeroCard,
  StatsScreenHeader,
  StatsFilterBar,
  StatsFilterModal,
  StatsDateSection,
  StatsEmptyState,
  StatsCollapsingList,
} from "../../../components/profile/StatsComponents";

const sectionKeyExtractor = (_item, index) => `m-${index}`;

const MovieStatisticsScreen = ({ navigation }) => {
  const {
    watchedMovieCount,
    formatDate,
    groupedData,
    uniqueDates,
    t,
    selectedDate,
    setSelectedDate,
    mostWatchedGenre,
    secondWatchedGenre,
    threeWatchedGenre,
    topMovieGenres,
    formatTotalDurationTime,
    timeDisplayMode,
    totalMinutesTime,
    handleTimeClick,
    borderColorMovie,
    rankLevelMovie,
    rankNameMovie,
    mostRewatchedMovies,
  } = useProfileStats();

  const { theme } = useTheme();
  const { language } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();
  const insets = useSafeAreaInsets();

  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [filterVisible, setFilterVisible] = useState(false);

  const chartDataByPeriod = useMemo(
    () => Object.fromEntries(["daily", "monthly", "yearly"].map((period) => [
      period,
      buildWatchChartData(
        groupedData,
        (item) => item.minutes,
        language === "en" ? "en-US" : "tr-TR",
        period,
      ),
    ])),
    [groupedData, language],
  );

  const heroGenres = useMemo(
    () => topMovieGenres || [mostWatchedGenre, secondWatchedGenre, threeWatchedGenre].filter((g) => g && g !== "-"),
    [topMovieGenres, mostWatchedGenre, secondWatchedGenre, threeWatchedGenre],
  );

  // Filtre modalı için tüm türler (izlenme sıklığına göre azalan).
  const allGenres = useMemo(() => {
    const counts = {};
    (groupedData || []).forEach((section) =>
      (section.data || []).forEach((item) =>
        (item.genres || []).forEach((g) => {
          if (g) counts[g] = (counts[g] || 0) + 1;
        }),
      ),
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);
  }, [groupedData]);

  // Tek geçişte filtrele (arama + tür) + bölüm meta'sını (tür/dk) ve normalize
  // poster'ları önceden hesapla. Dış liste yalnızca başlık render eder (data: []).
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groupedData || [])
      .map((section) => ({
        title: section.title,
        items: (section.data || [])
          .filter((item) => !q || item.name?.toLowerCase().includes(q))
          .filter(
            (item) =>
              selectedGenre == null || (item.genres || []).includes(selectedGenre),
          ),
      }))
      .filter((s) => s.items.length > 0)
      .filter((s) => selectedDate == null || s.title === selectedDate)
      .map((s) => ({
        title: s.title,
        data: [],
        genres: [...new Set(s.items.flatMap((m) => m.genres || []).filter(Boolean))],
        totalMinutes: s.items.reduce((acc, item) => acc + (item.minutes || 0), 0),
        posters: s.items.map((item) => ({
          key: String(item.historyId || item.watchEventId || item.id),
          imageUri: item.imagePath ? getTmdbUrl(item.imagePath, "poster", 200) : null,
          title: item.name,
          minutes: item.minutes,
          onPress: () => navigation.navigate("MovieDetails", { id: item.id }),
        })),
      }));
  }, [groupedData, search, selectedDate, selectedGenre, getTmdbUrl, navigation]);

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
  const onSelectGenre = useCallback((g) => setSelectedGenre(g), []);
  const onOpenFilters = useCallback(() => {
    setSearchVisible(false);
    setFilterVisible(true);
  }, []);
  const onCloseFilters = useCallback(() => setFilterVisible(false), []);

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
        chartDataByPeriod={chartDataByPeriod}
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
        rewatchItems={(mostRewatchedMovies || []).map(({ item, count }) => ({
          title: item.name,
          count,
        }))}
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
      selectedDate={selectedDate}
      selectedGenre={selectedGenre}
      formatDate={formatDate}
      onOpenFilters={onOpenFilters}
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
      <StatsFilterModal
        visible={filterVisible}
        onClose={onCloseFilters}
        theme={theme}
        dates={uniqueDates}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        genres={allGenres}
        selectedGenre={selectedGenre}
        onSelectGenre={onSelectGenre}
        formatDate={formatDate}
      />
      <BackButton />
    </View>
  );
};

export default MovieStatisticsScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
