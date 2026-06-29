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
//import { API_KEY } from "@env";
const { width, height } = Dimensions.get("window");
import { MovieUpComingSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import { useTvShow } from "../../context/TvShowContex";
import { memo, useEffect, useMemo, useRef } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

import ListBadges from "../../components/ListBadges";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
//import { API_KEY } from "@env";

// Stable, module-scope item component. Hoisted out of the parent so its
// component type never changes between renders → FlatList re-renders cells
// instead of unmounting/remounting them → no poster flicker.
const TvBestCard = memo(function TvBestCard({ item, navigation, theme, getTmdbUrl }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.similarItem}
      onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <PosterImage
          path={item.poster_path}
          type="tv"
          size={200}
          style={[styles.similarPoster, { shadowColor: theme.shadow }]}
          cachePolicy="memory-disk"
          recyclingKey={`tvbest-${item.id}`}
          transition={120}
        />
        <View
          style={[styles.relaseDateCount, { backgroundColor: theme.secondaryt }]}
        >
          <Text style={[styles.similarRatingText, { color: theme.text.secondary }]}>
            {item.first_air_date}
          </Text>
        </View>
        <View style={[styles.relaseDate, { backgroundColor: theme.secondaryt }]}>
          <Text style={[styles.similarRatingText, { color: theme.colors.orange }]}>
            {item.vote_average.toFixed(1)}
          </Text>
        </View>
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

export default function TvShowBests({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const {
    seriesBest,
    setSelectedCategoryBest,
    selectedCategoryBest,
    pageBest,
    totalPagesBest,
    loadingBest,
    loadMoreBest,
    loadingMoreBest,
    categoriesBest,
    getCategoryTitleBest,
    activateTvSection,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("best");
  }, [activateTvSection]);

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      onPress={() => setSelectedCategoryBest(item)}
      style={[
        styles.categoryItem,
        {
          borderColor:
            selectedCategoryBest === item
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
              selectedCategoryBest === item
                ? theme.text.primary
                : theme.text.muted,
          },
        ]}
      >
        {getCategoryTitleBest(item)}
      </Text>
    </TouchableOpacity>
  );
  if (loadingBest) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <FlatList
          data={categoriesBest}
          renderItem={renderCategory}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />

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
      <TvBestCard
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
          justifyContent: "center",
        }}
      >
        <FlatList
          data={categoriesBest}
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
      <PaginatedRail
        data={seriesBest}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreBest}
        loadingMore={loadingMoreBest}
        hasMore={pageBest < totalPagesBest}
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
  pageButton: {
    width: 25,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
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
  stats: {
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 3,
    bottom: 3,
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
