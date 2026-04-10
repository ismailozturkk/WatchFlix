import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Animated,
  Pressable,
  TextInput,
} from "react-native";
import React, { useEffect, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

//import {  } from "react-native-safe-area-context";
import MovieOscar from "../movie/MovieOscar";
import MovieProviders from "../movie/MovieProvders";
import MovieNowPlaying from "../movie/MovieNowPlaying";
import MovieGenres from "../movie/MovieGenres";
import MovieUpcoming from "../movie/MovieUpcoming";
import { useTheme } from "../../context/ThemeContext";
import { useSnow } from "../../context/SnowContext";
import LottieView from "lottie-react-native";
import MovieBests from "../movie/MovieBests";
import MovieTrends from "../movie/MovieTrends";
import MovieCollection from "../movie/MovieCollection";
import { useMovie } from "../../context/MovieContex";
import { useState } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import IconBacground from "../../components/IconBacground";

export default function MovieScreen({ navigation }) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();

  const { showSnow } = useAppSettings();
  const [refreshing, setRefreshing] = useState(false);

  const {
    fetchSeriesTrends,
    fetchMoviesBests,
    fetchMoviesOscar,
    fetchMoviesCollection,
    fetchMoviesByGenres,
    fetchMovieUpcoming,
    fetchMoviNowPlaying,
  } = useMovie();

  const onRefresh = async () => {
    setRefreshing(true);
    (await fetchSeriesTrends(),
      await fetchMoviesBests(),
      await fetchMoviesOscar(),
      await fetchMoviesCollection(),
      await fetchMoviesByGenres(),
      await fetchMovieUpcoming(),
      await fetchMoviNowPlaying(),
      setRefreshing(false));
  };
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 5,
    }).start();
  }, []);

  const closeSearch = () => {
    Animated.timing(translateY, {
      toValue: 10,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {});
  };
  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <IconBacground opacity={0.3} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          {
            //backgroundColor: theme.primary
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {showSnow &&
          [0, 1, 2, 3].map((item, index) => (
            <LottieView
              key={index}
              style={[
                index === 0
                  ? styles.lottie
                  : index === 1
                    ? styles.lottie0
                    : index === 2
                      ? styles.lottie1
                      : styles.lottie2,
              ]}
              source={require("../../LottieJson/snow.json")}
              autoPlay={true}
              loop
            />
          ))}

        <Pressable
          onPress={() =>
            navigation.navigate("MovieSearch", { autoFocus: true })
          }
          style={styles.fakeSearchContainer}
        >
          <View
            style={[styles.searchInput, { backgroundColor: theme.secondary }]}
            placeholderTextColor={theme.text.muted}
            placeholder={t.SearchScreen.searchMovies}
          >
            <Ionicons name="search" size={20} color={theme.text.muted} />
            <Text allowFontScaling={false} style={{ color: theme.text.muted }}>
              {t.searchMovies}
            </Text>
          </View>
        </Pressable>
        <MovieTrends navigation={navigation} />
        <MovieBests navigation={navigation} />
        <MovieOscar navigation={navigation} />
        <MovieCollection navigation={navigation} />
        <MovieProviders navigation={navigation} />
        <MovieNowPlaying navigation={navigation} />
        <MovieGenres navigation={navigation} />
        <MovieUpcoming navigation={navigation} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 75,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  lottie0: {
    position: "absolute",
    height: 1000,
    top: 1000,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  lottie1: {
    position: "absolute",
    height: 1000,
    top: 2000,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  fakeSearchContainer: {
    paddingTop: 50,
    paddingHorizontal: 15,
    zIndex: 10, // Listenin üstünde kalması için
  },
  searchInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
});
