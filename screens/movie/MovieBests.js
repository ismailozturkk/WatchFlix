import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import PosterImage from "../../components/PosterImage";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
const { width, height } = Dimensions.get("window");
import { MovieBestsSkeleton } from "../../components/Skeleton";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import PaginatedRail from "../../components/PaginatedRail";
import { SeeAllButton } from "../../components/SeeAllHeader";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import Ionicons from "@expo/vector-icons/Ionicons";
import { i18nText } from "../../utils/i18nText";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

// Stable, module-scope item component → no remount → no flicker.
const MovieBestCard = memo(function MovieBestCard({ item, navigation, theme, getTmdbUrl }) {
  const rp = useRailPosterStyle();
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
      onPress={() => navigation.push("MovieDetails", { id: item.id })}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <PosterImage
          path={item.poster_path}
          type="movie"
          size={200}
          style={[
            styles.similarPoster,
            { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`moviebest-${item.id}`}
          transition={120}
        />

        <View style={[styles.relaseDate, { backgroundColor: theme.secondaryt }]}>
          <Text style={[styles.similarRatingText, { color: theme.colors.orange }]}>
            {item.vote_average.toFixed(1)}
          </Text>
        </View>
        <ListBadges
          mediaId={item.id}
          mediaType="movie"
          theme={theme}
          style={{ position: "absolute", left: 2, bottom: 8 }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function MovieBests({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  const {
    loadingBests,
    movieBests,
    categorieBests,
    selectedCategoryBests,
    setSelectedCategoryBests,
    getCategoryTitleBests,
    pageBest,
    totalPagesBest,
    loadMoreBests,
    loadingMoreBests,
    activateMovieSection,
  } = useMovie();

  useEffect(() => {
    activateMovieSection("bests");
  }, [activateMovieSection]);

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      onPress={() => setSelectedCategoryBests(item)}
      style={[
        styles.categoryItem,
        {
          borderColor:
            selectedCategoryBests === item
              ? theme.text.primary
              : theme.text.muted,
        },
        {
          paddingVertical: 7,
          borderRadius: 13,
          paddingHorizontal: 12,
          backgroundColor: theme.primary,
        },
      ]}
    >
      <Text
        style={[
          styles.categoryText,
          {
            color:
              selectedCategoryBests === item
                ? theme.text.primary
                : theme.text.secondary,
          },
        ]}
      >
        {getCategoryTitleBests(item)}
      </Text>
    </TouchableOpacity>
  );
  if (loadingBests) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <View
          style={{
            paddingLeft: 15,
            justifyContent: "center",
          }}
        >
          <FlatList
            data={categorieBests}
            renderItem={renderCategory}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.categoriesList,
              { backgroundColor: theme.secondary },
            ]}
          />
        </View>

        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieBestsSkeleton />}
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
      <MovieBestCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View
        style={{
          paddingLeft: 15,
          paddingRight: 12,
          marginBottom: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, justifyContent: "center" }}>
          <FlatList
            data={categorieBests}
            renderItem={renderCategory}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.categoriesList,
              { backgroundColor: theme.secondary },
            ]}
          />
        </View>
        <SeeAllButton
          onPress={() =>
            navigation.navigate("SeeAllScreen", {
              mediaType: "movie",
              section: "bests",
              title: i18nText("autoI18n.en_iyi_filmler", "En İyi Filmler"),
            })
          }
        />
      </View>
      <PaginatedRail
        data={movieBests}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreBests}
        loadingMore={loadingMoreBests}
        hasMore={pageBest < totalPagesBest}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  categoriesList: {
    borderRadius: 15,
    paddingVertical: 3,
    paddingHorizontal: 3,
    marginBottom: 10,
    gap: 3,
  },
  categoryItem: {
    paddingVertical: 15,
  },

  categoryText: {
    fontSize: 14,
    fontWeight: "600",
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
    height: width * 0.6,
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
    bottom: 10,
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
