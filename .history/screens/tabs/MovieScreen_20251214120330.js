import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from "react-native";
import React from "react";
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
export default function MovieScreen({ navigation }) {
  const { theme } = useTheme();
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
    await fetchSeriesTrends(),
      await fetchMoviesBests(),
      await fetchMoviesOscar(),
      await fetchMoviesCollection(),
      await fetchMoviesByGenres(),
      await fetchMovieUpcoming(),
      await fetchMoviNowPlaying(),
      setRefreshing(false);
  };

  return (
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
      <LottieView
        style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay={true}
        loop
      />
      <LottieView
        style={[styles.lottie0, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay={true}
        loop
      />
      <LottieView
        style={[styles.lottie1, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay={true}
        loop
      />
      <MovieTrends navigation={navigation} />
      <MovieBests navigation={navigation} />
      <MovieOscar navigation={navigation} />
      <MovieCollection navigation={navigation} />
      <MovieProviders navigation={navigation} />
      <MovieNowPlaying navigation={navigation} />
      <MovieGenres navigation={navigation} />
      <MovieUpcoming navigation={navigation} />
    </ScrollView>
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
});
