import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StyleSheet,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { MovieSkeleton } from "../../components/Skeleton";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import PaginatedRail from "../../components/PaginatedRail";
import Ionicons from "@expo/vector-icons/Ionicons";
const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const MovieProvidersCard = memo(function MovieProvidersCard({ item, navigation, theme, getTmdbUrl }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      style={styles.similarItem}
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
          style={[styles.similarPoster, { shadowColor: theme.shadow }]}
          cachePolicy="memory-disk"
          recyclingKey={`movieprovider-${item.id}`}
          transition={120}
        />

        <View style={[styles.similarRating, { backgroundColor: theme.secondaryt }]}>
          <Text allowFontScaling={false} style={styles.similarRatingText}>
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

export default function MovieProviders({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  // Sağlayıcıları çek
  const {
    selectedProvider,
    providers,
    loadingProvider,
    loadingMovieProvider,
    moviesProvider,
    fetchMoviesByProvider,
    activateMovieSection,
    loadMoreProvider,
    loadingMoreProvider,
    pageProvider,
    totalPagesProvider,
  } = useMovie();

  useEffect(() => {
    activateMovieSection("providers");
  }, [activateMovieSection]);

  const renderProvider = ({ item }) => (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 5,
        marginRight: 5,
        gap: 5,
        backgroundColor:
          selectedProvider === item.provider_id
            ? theme.accent
            : theme.secondary,
        borderRadius: 15,
      }}
      onPress={() => fetchMoviesByProvider(item.provider_id)}
    >
      <Image
        source={{
          uri: getTmdbUrl(item.logo_path, 'logo', 150),
        }}
        style={{ width: 30, height: 30, borderRadius: 10 }}
        cachePolicy="memory-disk"
        transition={120}
      />
      <View
        style={{
          justifyContent: "center",
          alignItems: "center",
          height: 40,
        }}
      >
        <Text
          style={{
            color: theme.text.primary,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {item.provider_name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <MovieProvidersCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };
  if (loadingMovieProvider || loadingProvider) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <FlatList
          data={providers}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.provider_id.toString()}
          renderItem={renderProvider}
          contentContainerStyle={{
            paddingHorizontal: 15,
            marginRight: 10,
            marginBottom: 20,
          }}
        />
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieSkeleton />}
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

  return (
    <View style={{ flex: 1, paddingVertical: 10 }}>
      {/* İzleme sağlayıcıları */}

      <FlatList
        data={providers}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.provider_id.toString()}
        renderItem={renderProvider}
        contentContainerStyle={{ paddingHorizontal: 15 }}
      />

      <PaginatedRail
        data={moviesProvider}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        contentContainerStyle={{ paddingHorizontal: 15, marginTop: 20 }}
        onLoadMore={loadMoreProvider}
        loadingMore={loadingMoreProvider}
        hasMore={pageProvider < totalPagesProvider}
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
