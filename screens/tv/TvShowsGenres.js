import React, { useEffect, useRef } from "react";
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
import { useTheme } from "../../context/ThemeContext";
import { useTvShow } from "../../context/TvShowContex";
import { MovieSkeleton } from "../../components/Skeleton";
import { useListStatus } from "../../modules/UseListStatus";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
const { width, height } = Dimensions.get("window");
export default function TvShowsGenres({ navigation }) {
  const { theme } = useTheme();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  const {
    selectedGenres,
    pageGenres,
    moviesGenres,
    genres,
    loadingGenres,
    setSelectedGenres,
    setPageGenres,
    activateTvSection,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("genres");
  }, [activateTvSection]);

  // Animated import'unun eklendiğinden emin olun
  const scaleValuesRef = useRef({});
  const getScaleValue = (itemId) => {
    if (!scaleValuesRef.current[itemId]) {
      scaleValuesRef.current[itemId] = new Animated.Value(1);
    }
    return scaleValuesRef.current[itemId];
  };

  const onPressIn = (itemId) => {
    Animated.timing(getScaleValue(itemId), {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (itemId) => {
    Animated.timing(getScaleValue(itemId), {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const toggleGenre = (genreId) => {
    setSelectedGenres(
      (prev) =>
        prev.includes(genreId)
          ? prev.filter((id) => id !== genreId) // Seçiliyse kaldır
          : [...prev, genreId], // Seçili değilse ekle
    );
  };
  if (loadingGenres || moviesGenres.length < 1) {
    return (
      <View style={styles.container}>
        <FlatList
          data={genres}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.genreButton,
                {
                  backgroundColor: selectedGenres.includes(item.id)
                    ? theme.accent
                    : theme.secondary,
                },
              ]}
              onPress={() => toggleGenre(item.id)}
            >
              <Text
                allowFontScaling={false}
                style={[styles.genreText, { color: theme.text.primary }]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        />
        <View
          style={{
            flexDirection: "row",
            gap: 5,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            allowFontScaling={false}
            style={[styles.genreText, { color: theme.text.muted }]}
          >
            ●●●
          </Text>
          {pageGenres > 5 && (
            <>
              <TouchableOpacity
                onPress={() => setPageGenres(pageGenres - 5)}
                style={[
                  styles.pageButton,
                  {
                    backgroundColor: theme.secondary,
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.genreText, { color: theme.text.primary }]}
                >
                  {pageGenres - 5}
                </Text>
              </TouchableOpacity>
              <Text
                allowFontScaling={false}
                style={[styles.genreText, { color: theme.text.muted }]}
              >
                ●
              </Text>
            </>
          )}

          {pageGenres > 2 && (
            <TouchableOpacity
              onPress={() => setPageGenres(pageGenres - 2)}
              style={[
                styles.pageButton,
                {
                  backgroundColor: theme.secondary,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.genreText, { color: theme.text.primary }]}
              >
                {pageGenres - 2}
              </Text>
            </TouchableOpacity>
          )}
          {pageGenres > 1 && (
            <TouchableOpacity
              onPress={() => setPageGenres(pageGenres - 1)}
              style={[
                styles.pageButton,
                {
                  backgroundColor: theme.secondary,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.genreText, { color: theme.text.primary }]}
              >
                {pageGenres - 1}
              </Text>
            </TouchableOpacity>
          )}
          <Text
            style={[
              styles.genreText,
              {
                color: theme.text.secondary,
                width: 25,
                height: 20,
                textAlign: "center",
              },
            ]}
          >
            {pageGenres}
          </Text>
          <TouchableOpacity
            onPress={() => setPageGenres(pageGenres + 1)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.genreText, { color: theme.text.primary }]}
            >
              {pageGenres + 1}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPageGenres(pageGenres + 2)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.genreText, { color: theme.text.primary }]}
            >
              {pageGenres + 2}
            </Text>
          </TouchableOpacity>
          <Text
            allowFontScaling={false}
            style={[styles.genreText, { color: theme.text.muted }]}
          >
            ●
          </Text>
          <TouchableOpacity
            onPress={() => setPageGenres(pageGenres + 5)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.genreText, { color: theme.text.primary }]}
            >
              {pageGenres + 5}
            </Text>
          </TouchableOpacity>
          <Text
            allowFontScaling={false}
            style={[styles.genreText, { color: theme.text.muted }]}
          >
            ●●●
          </Text>
        </View>
      </View>
    );
  }

  const MovieItem = ({ item, index }) => {
    const { inWatchList, inFavorites, isWatched, isInOtherLists } =
      useListStatus(item.id, "tv");
    return (
      <TouchableOpacity
        style={styles.similarItem}
        activeOpacity={0.8}
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: getScaleValue(item.id) }],
            },
          ]}
        >
          <Image
            source={
              item.poster_path
                ? {
                    uri: getTmdbUrl(item.poster_path, 'poster', 200),
                  }
                : require("../../assets/image/no_image.png")
            }
            style={[styles.similarPoster, { shadowColor: theme.shadow }]}
            cachePolicy="memory-disk"
            transition={120}
          />

          <View
            style={[
              styles.similarRating,
              { backgroundColor: theme.secondaryt },
            ]}
          >
            <Text allowFontScaling={false} style={styles.similarRatingText}>
              {item.vote_average.toFixed(1)}
            </Text>
          </View>

          <View
            style={{
              justifyContent: "center",
              alignItems: "center",
              position: "absolute",
              left: 2,
              bottom: 8,
            }}
          >
            <View
              style={{
                gap: 3,
                backgroundColor: theme.secondaryt,
                paddingVertical: 3,
                paddingHorizontal: 1,
                borderRadius: 7,
              }}
            >
              {inWatchList && (
                <TouchableOpacity
                  onPress={() => {
                    //updateTvSeriesList("watchList", "tv");
                  }}
                >
                  <Ionicons
                    name="bookmark"
                    size={12}
                    color={theme.colors.blue}
                  />
                </TouchableOpacity>
              )}
              {isWatched && (
                <TouchableOpacity
                  onPress={() => {
                    //updateTvSeriesList("watchedTv", "tv");
                  }}
                >
                  <Ionicons name="eye" size={12} color={theme.colors.green} />
                </TouchableOpacity>
              )}
              {inFavorites && (
                <TouchableOpacity
                  onPress={() => {
                    //updateTvSeriesList("favorites", "tv");
                  }}
                >
                  <Ionicons name="heart" size={12} color={theme.colors.red} />
                </TouchableOpacity>
              )}
              {isInOtherLists && (
                <TouchableOpacity
                  onPress={() => {
                    //updateMovieList("favorites", "movie");
                  }}
                >
                  <Ionicons name="grid" size={12} color={theme.colors.orange} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };
  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return <MovieItem item={item} navigation={navigation} />;
  };
  return (
    <View style={styles.container}>
      <FlatList
        data={genres}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.genreButton,
              {
                backgroundColor: selectedGenres.includes(item.id)
                  ? theme.accent
                  : theme.secondary,
              },
            ]}
            onPress={() => toggleGenre(item.id)}
          >
            <Text
              allowFontScaling={false}
              style={[styles.genreText, { color: theme.text.primary }]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />
      <FlatList
        data={moviesGenres}
        horizontal
        contentContainerStyle={{ paddingHorizontal: 15 }}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews
        renderItem={renderMovieItem}
      />
      <View
        style={{
          flexDirection: "row",
          gap: 5,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={[styles.genreText, { color: theme.text.muted }]}
        >
          ●●●
        </Text>
        {pageGenres > 5 && (
          <>
            <TouchableOpacity
              onPress={() => setPageGenres(pageGenres - 5)}
              style={[
                styles.pageButton,
                {
                  backgroundColor: theme.secondary,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.genreText, { color: theme.text.primary }]}
              >
                {pageGenres - 5}
              </Text>
            </TouchableOpacity>
            <Text
              allowFontScaling={false}
              style={[styles.genreText, { color: theme.text.muted }]}
            >
              ●
            </Text>
          </>
        )}

        {pageGenres > 2 && (
          <TouchableOpacity
            onPress={() => setPageGenres(pageGenres - 2)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.genreText, { color: theme.text.primary }]}
            >
              {pageGenres - 2}
            </Text>
          </TouchableOpacity>
        )}
        {pageGenres > 1 && (
          <TouchableOpacity
            onPress={() => setPageGenres(pageGenres - 1)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.genreText, { color: theme.text.primary }]}
            >
              {pageGenres - 1}
            </Text>
          </TouchableOpacity>
        )}
        <Text
          style={[
            styles.genreText,
            {
              color: theme.text.secondary,
              width: 25,
              height: 20,
              textAlign: "center",
            },
          ]}
        >
          {pageGenres}
        </Text>
        <TouchableOpacity
          onPress={() => setPageGenres(pageGenres + 1)}
          style={[
            styles.pageButton,
            {
              backgroundColor: theme.secondary,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.genreText, { color: theme.text.primary }]}
          >
            {pageGenres + 1}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPageGenres(pageGenres + 2)}
          style={[
            styles.pageButton,
            {
              backgroundColor: theme.secondary,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.genreText, { color: theme.text.primary }]}
          >
            {pageGenres + 2}
          </Text>
        </TouchableOpacity>
        <Text
          allowFontScaling={false}
          style={[styles.genreText, { color: theme.text.muted }]}
        >
          ●
        </Text>
        <TouchableOpacity
          onPress={() => setPageGenres(pageGenres + 5)}
          style={[
            styles.pageButton,
            {
              backgroundColor: theme.secondary,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.genreText, { color: theme.text.primary }]}
          >
            {pageGenres + 5}
          </Text>
        </TouchableOpacity>
        <Text
          allowFontScaling={false}
          style={[styles.genreText, { color: theme.text.muted }]}
        >
          ●●●
        </Text>
      </View>
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
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 5,
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
  similarItem: {
    width: width * 0.4,
    height: width * 0.62,
    marginRight: 10,
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
  similarRating: {
    position: "absolute",
    bottom: 10,
    right: 5,
    width: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 12,
    marginBottom: 2,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    fontWeight: "bold",
  },
});
