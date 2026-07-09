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
import React, { memo, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { useTheme } from "../../context/ThemeContext";
import RatingStars from "../../components/RatingStars";
import { useLanguage } from "../../context/LanguageContext";
import { MovieOscarSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import Ionicons from "@expo/vector-icons/Ionicons";

const { width } = Dimensions.get("window");

// Vertical year text — pure, depends only on its `metin` prop.
const DikeyMetin = memo(function DikeyMetin({ metin }) {
  return (
    <View style={styles.containerYears}>
      {metin.split("").map((karakter, index) => (
        <Text allowFontScaling={false} key={index} style={styles.text}>
          {karakter}
        </Text>
      ))}
    </View>
  );
});

// Stable, module-scope item component → no remount → no flicker.
const MovieOscarCard = memo(function MovieOscarCard({ item, index, navigation, theme, getTmdbUrl }) {
  const rp = useRailPosterStyle();
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      style={[styles.similarItem, { width: rp.posterWidth + width * 0.04, height: rp.posterHeight }]}
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => navigation.push("MovieDetails", { id: item.id })}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <View style={{ flexDirection: "row" }}>
          <View style={{ justifyContent: "space-around" }}>
            <Image
              source={require("../../assets/image/pngwing.com.png")}
              style={{ width: 10, height: 40 }}
              cachePolicy="memory-disk"
              transition={120}
            />
            <DikeyMetin metin={`${2026 - index}`} />
          </View>
          <PosterImage
            path={item.poster_path}
            type="movie"
            size={200}
            style={[
              styles.similarPoster,
              { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
            ]}
            cachePolicy="memory-disk"
            recyclingKey={`movieoscar-${item.id}`}
            transition={120}
          />
          <View style={[styles.similarRating, { backgroundColor: theme.secondaryt }]}>
            <Text allowFontScaling={false} style={styles.similarRatingText}>
              {item.vote_average.toFixed(1)}
            </Text>
          </View>
        </View>

        <ListBadges
          mediaId={item.id}
          mediaType="movie"
          theme={theme}
          style={{ position: "absolute", left: 20, bottom: 8 }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function MovieOscar({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const { moviesOscar, loadingOscar, errorOscar, activateMovieSection } = useMovie();

  useEffect(() => {
    activateMovieSection("oscar");
  }, [activateMovieSection]);

  if (loadingOscar) {
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
          renderItem={() => <MovieOscarSkeleton />}
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

  if (errorOscar) {
    return <Text>Error: {errorOscar}</Text>;
  }
  const renderMovieItem = ({ item, index }) => {
    if (!item.poster_path) return null;
    return (
      <MovieOscarCard
        item={item}
        index={index}
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
        {t.movieScreens.oscar}
      </Text>
      <FlatList
        data={moviesOscar}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        showsHorizontalScrollIndicator={false}
        renderItem={renderMovieItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews
      />
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
    width: width * 0.44,
    height: width * 0.62,
    marginRight: 15,
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
    bottom: 8,
    right: 3,
    width: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 12,
    marginBottom: 2,
  },
  text: {
    fontSize: 26,
    lineHeight: 33, // Karakterler arasındaki boşluğu ayarlamak için kullanılabilir
    fontWeight: "bold",
    color: "#ffd700",
    textAlign: "center",
  },
});
