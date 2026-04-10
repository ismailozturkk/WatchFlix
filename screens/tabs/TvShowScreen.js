import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Pressable,
  Text,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useSnow } from "../../context/SnowContext";
import LottieView from "lottie-react-native";
import TvShowsOnTheAir from "../tv/TvShowsOnTheAir";
import TvShowsAiringToday from "../tv/TvShowsAiringToday";
import TvShowsGenres from "../tv/TvShowsGenres";
import TvShowsProvders from "../tv/TvShowsProvders";
import TvShowsTrends from "../tv/TvShowsTrends";
import TvShowBests from "../tv/TvShowBests";
import TvOngoingSection from "../tv/TvOngoingSection";
import { useState } from "react";
import { useTvShow } from "../../context/TvShowContex";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import IconBacground from "../../components/IconBacground";

export default function TvShowScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useAppSettings();
  const { t } = useLanguage();
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
    (await fetchSeriesTrends(),
      await fetchSeriesBest(),
      await fetchAiringToday(),
      await fetchProviders(),
      await fetchTvByGenres(),
      await fetchOnTheAir(),
      setRefreshing(false));
  };
  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <IconBacground opacity={0.3} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.container]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Snow */}
        {showSnow &&
          [0, 1, 2, 3].map((item, index) => (
            <LottieView
              key={index}
              style={[
                index === 0
                  ? styles.lottie
                  : index === 1
                    ? styles.lottie0
                    : styles.lottie1,
              ]}
              source={require("../../LottieJson/snow.json")}
              autoPlay={true}
              loop
            />
          ))}

        {/* Arama çubuğu */}
        <Pressable
          onPress={() =>
            navigation.navigate("TvShowSearch", { autoFocus: true })
          }
          style={styles.fakeSearchContainer}
        >
          <View
            style={[styles.searchInput, { backgroundColor: theme.secondary }]}
            placeholderTextColor={theme.text.muted}
            placeholder={t.SearchScreen.searchTvShows}
          >
            <Ionicons name="search" size={20} color={theme.text.muted} />
            <Text allowFontScaling={false} style={{ color: theme.text.muted }}>
              {t.SearchScreen.searchTvShows}
            </Text>
          </View>
        </Pressable>

        {/* Devam Eden Dizilerim — TvShowBests/TvShowsGenres ile aynı görünüm */}

        <TvShowsTrends navigation={navigation} />
        <TvOngoingSection navigation={navigation} />
        <TvShowBests navigation={navigation} />
        <TvShowsProvders navigation={navigation} />
        <TvShowsGenres navigation={navigation} />
        <TvShowsOnTheAir navigation={navigation} />
        <TvShowsAiringToday navigation={navigation} />
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
    zIndex: 10,
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
