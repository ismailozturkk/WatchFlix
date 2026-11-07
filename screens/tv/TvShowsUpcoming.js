import React, { memo, useEffect, useRef } from "react";
import {
  TouchableOpacity,
  StyleSheet,
  View,
  Dimensions,
  Animated,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { RailSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import SectionHeader from "../../components/home/SectionHeader";
import TvUpcomingRangeChips from "../../components/home/TvUpcomingRangeChips";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { useTvShow } from "../../context/TvShowContex";
import { useLanguage } from "../../context/LanguageContext";
import ListBadges from "../../components/ListBadges";
import { CountdownBadge, ReleaseDateBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import { useListLayoutSettings } from "../../context/AppSettingsContext";
const { width } = Dimensions.get("window");

// "Yaklaşan Diziler": ilk bölümü seçili pencereye düşen YENİ diziler (sorgu: utils/tvUpcoming.js).
// Kart "Yaklaşan Filmler"deki gibi geri sayım + çıkış tarihi taşır; tarih dizinin ilk yayın günü.

// Stable, module-scope item component → no remount → no flicker.
const TvUpcomingCard = memo(function TvUpcomingCard({ item, navigation, theme }) {
  const rp = useRailPosterStyle();
  const { posterBadges } = useListLayoutSettings();
  const { openQuickActions } = useMediaQuickActions();
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      style={[styles.similarItem, { width: rp.itemWidth, height: rp.itemHeight }]}
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
      onLongPress={() =>
        openQuickActions({ item, mediaType: "tv", navigation })
      }
      delayLongPress={350}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <PosterImage
          path={item.poster_path}
          type="tv"
          mediaId={item.id}
          size={200}
          style={[
            styles.similarPoster,
            { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`tvupcoming-${item.id}`}
          transition={120}
        />

        {posterBadges?.countdown !== false && (
          <CountdownBadge date={item.first_air_date} style={POSTER_BADGE_POS.topLeft} />
        )}
        {posterBadges?.releaseDate !== false && (
          <ReleaseDateBadge date={item.first_air_date} style={POSTER_BADGE_POS.topRight} />
        )}
        <ListBadges
          mediaId={item.id}
          mediaType="tv"
          theme={theme}
          style={{ position: "absolute", left: 2, bottom: 8 }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function TvShowsUpcoming({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    seriesUpcoming,
    pageUpcoming,
    totalPagesUpcoming,
    loadingUpcoming,
    loadingMoreUpcoming,
    loadMoreUpcoming,
    selectedUpcomingRange,
    setSelectedUpcomingRange,
    activateTvSection,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("upcoming");
  }, [activateTvSection]);

  // Başlık iki durumda da AYNI öğeden gelir: yükleme ile yüklenmiş dal arasında başlık
  // yüksekliği değişirse ray aşağı zıplar.
  const upcomingHeader = (
    <SectionHeader
      section="upcoming"
      mediaType="tv"
      title={t.tvShowScreens.upcoming}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "tv",
          section: "upcoming",
          title: t.tvShowScreens.upcoming,
        })
      }
    >
      <TvUpcomingRangeChips range={selectedUpcomingRange} onSelectRange={setSelectedUpcomingRange} />
    </SectionHeader>
  );

  if (loadingUpcoming) {
    return (
      <View style={styles.container}>
        {upcomingHeader}
        <RailSkeleton showReleaseDate />
      </View>
    );
  }
  const renderItem = ({ item }) => {
    if (!item.poster_path) return null;
    return <TvUpcomingCard item={item} navigation={navigation} theme={theme} />;
  };
  return (
    <View style={styles.container}>
      {upcomingHeader}
      <PaginatedRail
        data={seriesUpcoming}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        onLoadMore={loadMoreUpcoming}
        loadingMore={loadingMoreUpcoming}
        hasMore={pageUpcoming < totalPagesUpcoming}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  similarItem: {
    width: width * 0.4,
    height: width * 0.62,
    marginRight: 10,
    marginBottom: 5,
  },
  similarPoster: {
    width: width * 0.4,
    height: width * 0.6,
    borderRadius: 15,
    marginBottom: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
});
