import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import PosterImage from "../../components/PosterImage";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useTheme } from "../../context/ThemeContext";
import RatingStars from "../../components/RatingStars";
import { useLanguage } from "../../context/LanguageContext";
import { MovieCollectionSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import Ionicons from "@expo/vector-icons/Ionicons";

const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const MovieCollectionCard = memo(function MovieCollectionCard({ item, navigation, theme, getTmdbUrl }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      style={styles.movieCollectionItem}
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => navigation.push("MovieDetails", { id: item.id })}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <View style={{ flexDirection: "row" }}>
          <PosterImage
            path={item.poster_path}
            type="movie"
            size={200}
            style={[styles.movieCollectionPoster, { shadowColor: theme.shadow }]}
            cachePolicy="memory-disk"
            recyclingKey={`moviecollection-${item.id}`}
            transition={120}
          />
          <View style={[styles.similarRating, { backgroundColor: theme.secondaryt }]}>
            <Text allowFontScaling={false} style={styles.similarRatingText}>
              {item.vote_average?.toFixed(1) ?? ""}
            </Text>
          </View>
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

export default function MovieCollection({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const {
    moviesCollection,
    loadingCollection,
    errorCollection,
    activateMovieSection,
  } = useMovie();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  useEffect(() => {
    activateMovieSection("collection");
  }, [activateMovieSection]);

  const [selectedMovieCollection, setSelectedMovieCollection] = useState(null);

  // Press-scale for the inline collection-selector posters (rendered as inline
  // JSX, not a custom component type, so they don't cause remount flicker).
  const [scaleValues, setScaleValues] = useState({});
  useEffect(() => {
    const newScaleValues = {};
    if (selectedMovieCollection && selectedMovieCollection.length > 0) {
      selectedMovieCollection.forEach((item) => {
        newScaleValues[item.id] = new Animated.Value(1);
      });
      setScaleValues(newScaleValues);
    }
  }, [selectedMovieCollection]);

  const onPressIn = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  if (loadingCollection) {
    return (
      <View style={styles.container}>
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.secondary }]}
        >
          {t.movieScreens.oscar}
        </Text>

        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieCollectionSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews
        />
      </View>
    );
  }

  if (errorCollection) {
    return <Text>Error: {errorCollection}</Text>;
  }

  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <MovieCollectionCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Text
        allowFontScaling={false}
        style={[styles.title, { color: theme.text.secondary }]}
      >
        Seri Filmler
      </Text>

      {selectedMovieCollection === null ? (
        <FlatList
          data={moviesCollection}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.similarItem}
              activeOpacity={0.8}
              onPressIn={() => onPressIn(item.id)}
              onPressOut={() => onPressOut(item.id)}
              onPress={() => setSelectedMovieCollection(item)}
            >
              <Animated.View
                style={[
                  {
                    transform: [{ scale: scaleValues[item.id] || 1 }],
                  },
                ]}
              >
                <View
                  style={[
                    {
                      flexDirection: "row",
                    },
                  ]}
                >
                  <PosterImage
                    path={item.poster_path}
                    type="movie"
                    size={200}
                    style={[
                      styles.similarPoster,
                      { shadowColor: theme.shadow },
                    ]}
                    cachePolicy="memory-disk"
                    transition={120}
                  />
                </View>
              </Animated.View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={80}
          windowSize={5}
          removeClippedSubviews
        />
      ) : (
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity
            style={styles.movieCollectionSeriesItem}
            activeOpacity={0.8}
            onPressIn={() => onPressIn(selectedMovieCollection.id)}
            onPressOut={() => onPressOut(selectedMovieCollection.id)}
            onPress={() => setSelectedMovieCollection(null)}
          >
            <Animated.View
              style={[
                {
                  transform: [
                    { scale: scaleValues[selectedMovieCollection.id] || 1 },
                  ],
                },
              ]}
            >
              <View
                style={[
                  {
                    flexDirection: "row",
                  },
                ]}
              >
                <PosterImage
                  path={selectedMovieCollection.poster_path}
                  type="movie"
                  size={200}
                  style={[styles.similarPoster, { shadowColor: theme.shadow }]}
                  cachePolicy="memory-disk"
                  transition={120}
                />
              </View>
            </Animated.View>
          </TouchableOpacity>
          <FlatList
            data={selectedMovieCollection.parts}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            showsHorizontalScrollIndicator={false}
            renderItem={renderMovieItem}
            horizontal
            keyExtractor={(item) => item?.id}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={80}
            windowSize={5}
            removeClippedSubviews
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  containerYears: {
    marginRight: 5,
    justifyContent: "center",
  },
  movieItem: {
    width: 200,
    margin: 10,
    padding: 10,
    backgroundColor: "#ddd",
    borderRadius: 5,
  },
  similarItem: {
    width: width * 0.4,
    height: width * 0.62,
    marginRight: 15,
  },
  movieCollectionItem: {
    width: width * 0.3,
    height: width * 0.6,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  movieCollectionSeriesItem: {
    width: width * 0.4,
    height: width * 0.6,
    marginLeft: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  similarPoster: {
    width: width * 0.4,
    height: width * 0.6,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  movieCollectionPoster: {
    width: "100%",
    height: width * 0.45,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    uppercase: true,
    marginBottom: 15,
    marginLeft: 15,
    fontWeight: "700",
  },
  similarTitle: {
    color: "#fff",
    fontSize: 14,
    paddingLeft: width * 0.05,
  },
  similarRating: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 12,
  },
  text: {
    fontSize: 10,
    lineHeight: 10, // Karakterler arasındaki boşluğu ayarlamak için kullanılabilir
    fontWeight: "500",
    color: "#ffd700",
    textAlign: "center",
  },
});
