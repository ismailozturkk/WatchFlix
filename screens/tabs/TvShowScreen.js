import { RefreshControl, ScrollView, StyleSheet } from "react-native";
//import {  } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useSnow } from "../../context/SnowContext";
import LottieView from "lottie-react-native";
import TvShowsOnTheAir from "../tv/TvShowsOnTheAir";
import TvShowsAiringToday from "../tv/TvShowsAiringToday";
import TvShowsGenres from "../tv/TvShowsGenres";
import TvShowsProvders from "../tv/TvShowsProvders";
import TvShowsTrends from "../tv/TvShowsTrends";
import TvShowBests from "../tv/TvShowBests";
import { useState } from "react";
import { useTvShow } from "../../context/TvShowContex";
import { useAppSettings } from "../../context/AppSettingsContext";
export default function TvShowScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useAppSettings();
  const [refreshing, setRefreshing] = useState(false);

  const {
    fetchSeriesTrends,
    fetchSeriesBest,
    fetchAiringToday,
    fetchProviders,
    fetchTvByGenres,
    fetchOnTheAir,
  } = useTvShow();

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSeriesTrends(),
      await fetchSeriesBest(),
      await fetchAiringToday(),
      await fetchProviders(),
      await fetchTvByGenres(),
      await fetchOnTheAir(),
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
      {/* <PopularTvShows navigation={navigation} /> */}
      <TvShowsTrends navigation={navigation} />
      <TvShowBests navigation={navigation} />
      <TvShowsProvders navigation={navigation} />
      <TvShowsGenres navigation={navigation} />
      <TvShowsOnTheAir navigation={navigation} />
      <TvShowsAiringToday navigation={navigation} />
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
