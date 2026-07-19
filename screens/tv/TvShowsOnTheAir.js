import React, { memo, useEffect, useMemo, useRef } from "react";
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  View,
  Dimensions,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { MovieUpComingSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import SeeAllHeader from "../../components/SeeAllHeader";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
//import { API_KEY } from "@env";
import { useTvShow } from "../../context/TvShowContex";
import { useLanguage } from "../../context/LanguageContext";
import ListBadges from "../../components/ListBadges";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const TvOnTheAirCard = memo(function TvOnTheAirCard({ item, navigation, theme, getTmdbUrl }) {
  const rp = useRailPosterStyle();
  const { posterBadges } = useListLayoutSettings();
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
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <PosterImage
          path={item.poster_path}
          type="tv"
          size={200}
          style={[
            styles.similarPoster,
            { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`tvontheair-${item.id}`}
          transition={120}
        />

        {posterBadges?.releaseDate !== false && (
          <View style={[styles.relaseDateCount, { backgroundColor: theme.secondaryt }]}>
            <Text style={[styles.similarRatingText, { color: theme.text.secondary }]}>
              {item.first_air_date}
            </Text>
          </View>
        )}
        {posterBadges?.tmdbRating !== false && (
          <View style={[styles.relaseDate, { backgroundColor: theme.secondaryt }]}>
            <Text style={[styles.similarRatingText, { color: theme.colors.orange }]}>
              {item.vote_average}
            </Text>
          </View>
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

export default function TvShowsOnTheAir({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const {
    pageOnTheAir,
    moviesOnTheAir,
    totalPagesOnTheAir,
    loadingOnTheAir,
    loadMoreOnTheAir,
    loadingMoreOnTheAir,
    activateTvSection,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("onTheAir");
  }, [activateTvSection]);


  if (loadingOnTheAir) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text
            allowFontScaling={false}
            style={[styles.title, { color: theme.text.secondary }]}
          >
            {t.tvShowScreens.onTheAir}
          </Text>
        </View>

        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieUpComingSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        />
      </View>
    );
  }
  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <TvOnTheAirCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };
  return (
    <View style={styles.container}>
      <SeeAllHeader
        title={t.tvShowScreens.onTheAir}
        onPress={() =>
          navigation.navigate("SeeAllScreen", {
            mediaType: "tv",
            section: "onTheAir",
            title: t.tvShowScreens.onTheAir,
          })
        }
      />
      <PaginatedRail
        data={moviesOnTheAir}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreOnTheAir}
        loadingMore={loadingMoreOnTheAir}
        hasMore={pageOnTheAir < totalPagesOnTheAir}
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
  pageButton: {
    width: 25,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  genreButton: {
    marginVertical: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  genreText: {
    color: "white",
    fontWeight: "bold",
  },
  dropdown: {
    width: 170,
    height: 30,
    paddingHorizontal: 8,
  },
  icon: {
    marginRight: 10,
  },
  label: {
    position: "absolute",
    backgroundColor: "white",
    left: 22,
    top: 8,
    zIndex: 999,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  placeholderStyle: {
    fontSize: 16,
  },
  selectedTextStyle: {
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
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
  similarTitle: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 5,
  },
  relaseDate: {
    position: "absolute",
    top: 5,
    right: 5,
    paddingHorizontal: 5,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  relaseDateCount: {
    position: "absolute",
    top: 5,
    left: 5,
    paddingHorizontal: 5,
    //width: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 11,
    marginBottom: 2,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 18,
    uppercase: true,
    marginBottom: 15,
    marginLeft: 15,
    fontWeight: "700",
  },
});
