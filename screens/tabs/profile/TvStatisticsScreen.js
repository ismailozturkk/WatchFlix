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
import ScreenDecor from "../../../components/ScreenDecor";
import {
  StatsHeroCard,
  StatsScreenHeader,
  StatsFilterBar,
  StatsFilterModal,
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
    watchedTvCount,
    totalMinutesTimeTv,
    mostWatchedGenreTv,
    secondWatchedGenreTv,
    thirdWatchedGenreTv,
    topTvGenres,
    totalEpisodesCount,
    totalSeasonsCount,
    uniqueTvCount,
    uniqueEpisodesCount,
    uniqueSeasonsCount,
    selectedDateTv,
    setSelectedDateTv,
    borderColorTv,
    rankLevelTv,
    rankNameTv,
    mostRewatchedTv,
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

  // Üç sütunun altında da aynı etiket kullanılıyor; profil anahtarındaki
  // "Tekrarsız" ile birebir aynı sözcük olması bilinçli.
  const tekrarsizLabel = i18nText("autoI18n.tekrarsiz", "Tekrarsız");

  const chartDataByPeriod = useMemo(
    () => Object.fromEntries(["daily", "monthly", "yearly"].map((period) => [
      period,
      buildWatchChartData(
        groupedDataTv,
        (item) => item.episodeMinutes,
        language === "en" ? "en-US" : "tr-TR",
        period,
      ),
    ])),
    [groupedDataTv, language],
  );

  const heroGenres = useMemo(
    () => topTvGenres || [mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv].filter((g) => g && g !== "-"),
    [topTvGenres, mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv],
  );

  // Filtre modalı için tüm türler (izlenme sıklığına göre azalan).
  const allGenres = useMemo(() => {
    const counts = {};
    (groupedDataTv || []).forEach((section) =>
      (section.data || []).forEach((item) =>
        (item.genres || []).forEach((g) => {
          if (g) counts[g] = (counts[g] || 0) + 1;
        }),
      ),
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);
  }, [groupedDataTv]);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groupedDataTv || [])
      .map((section) => ({
        title: section.title,
        items: (section.data || [])
          .filter(
            (item) =>
              !q ||
              item.showName?.toLowerCase().includes(q) ||
              item.episodeName?.toLowerCase().includes(q) ||
              item.seasonNumber == search,
          )
          .filter(
            (item) =>
              selectedGenre == null || (item.genres || []).includes(selectedGenre),
          ),
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
  }, [groupedDataTv, search, selectedDateTv, selectedGenre, getTmdbUrl, navigation]);

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
        primarySubLabel={`${tekrarsizLabel}: ${uniqueTvCount}`}
        secondaryCount={totalEpisodesCount}
        secondaryLabel={t.profileScreen.tvShowEpisodetotalCount}
        secondarySubLabel={`${tekrarsizLabel}: ${uniqueEpisodesCount}`}
        tertiaryCount={totalSeasonsCount}
        tertiaryLabel={t.profileScreen.tvShowSeasonCount}
        tertiarySubLabel={`${tekrarsizLabel}: ${uniqueSeasonsCount}`}
        chartDataByPeriod={chartDataByPeriod}
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
        rewatchItems={(mostRewatchedTv || []).map(({ item, count }) => ({
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
      selectedDate={selectedDateTv}
      selectedGenre={selectedGenre}
      formatDate={formatDate}
      onOpenFilters={onOpenFilters}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.25} />
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
      <StatsFilterModal
        visible={filterVisible}
        onClose={onCloseFilters}
        theme={theme}
        dates={uniqueDatesTv}
        selectedDate={selectedDateTv}
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

export default TvStatisticsScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
