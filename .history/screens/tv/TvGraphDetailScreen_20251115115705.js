import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import React, { useEffect, useState } from "react";
import Skeleton from "../../components/SkeletonGraph";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import LottieView from "lottie-react-native";
import { useTheme } from "../../context/ThemeContext";
import { useSnow } from "../../context/SnowContext";
import { useAppSettings } from "../../context/AppSettingsContext";

const TvGraphDetailScreen = ({ route, navigation }) => {
  const { id } = route.params;
  const [showDetail, setShowDetail] = useState(null);
  const [tvShows, setTVShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seasonsLenght, setSeasonsLenght] = useState(null);
  const [error, setError] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { showSnow } = useAppSettings();

  useEffect(() => {
    const fetchAllSeasons = async () => {
      try {
        const tvShowResponse = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: {
              accept: "application/json",
              Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhOGQ3NjQ0YzNjMjVjMDQzMDgzODgyMTRkOTJjY2UyOSIsIm5iZiI6MTczMDIxMjE0OC45MTg2ODksInN1YiI6IjY1OGEwMTdlNjg4Y2QwNTdlYjg1NzA2NSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.tvfmFX1OxyT_u37Z_bYU-APBZmvokqg1HZNFljGe-to`,
            },
          }
        );
        setShowDetail(tvShowResponse.data);
        setSeasonsLenght(
          tvShowResponse.data.seasons
            .filter((season) => season.season_number !== 0) // Sezon numarası 0 olanları filtrele
            .map((season) => 1).length
        );

        const seasonPromises = tvShowResponse.data.seasons
          .filter((season) => season.season_number !== 0) // Sezon numarası 0 olanları filtrele
          .map((season) =>
            axios.get(
              `https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}`,
              {
                params: { language: language === "tr" ? "tr-TR" : "en-US" },
                headers: {
                  accept: "application/json",
                  Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhOGQ3NjQ0YzNjMjVjMDQzMDgzODgyMTRkOTJjY2UyOSIsIm5iZiI6MTczMDIxMjE0OC45MTg2ODksInN1YiI6IjY1OGEwMTdlNjg4Y2QwNTdlYjg1NzA2NSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.tvfmFX1OxyT_u37Z_bYU-APBZmvokqg1HZNFljGe-to`,
                },
              }
            )
          );

        const seasonsData = await Promise.all(seasonPromises);
        setTVShows(seasonsData.map((response) => response.data));
      } catch (err) {
        setError(err);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllSeasons();
  }, [id]);

  const renderSkeletonLoading = () => {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.primary }]}
      >
        <View style={styles.item}>
          <Skeleton width={100} height={150} style={styles.posterSkeleton} />
          <View style={styles.seriesInfo}>
            <Skeleton width={200} height={24} style={{ marginBottom: 8 }} />
            <Skeleton width={150} height={16} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={20} />
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.containerScroll}>
            {[...Array(5)].map((_, rowIndex) => (
              <View key={rowIndex} style={styles.row}>
                {[...Array(6)].map((_, colIndex) => (
                  <View key={colIndex} style={styles.cell}>
                    <Skeleton width={35} height={18} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  if (loading) {
    return renderSkeletonLoading();
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorTitle}>{t.mistake}</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchAllSeasons();
          }}
        >
          <Text style={styles.retryButtonText}>{t.tryAgain}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  // En uzun sezonun bölüm sayısını bul
  const maxEpisodes = Math.max(
    ...tvShows.map((season) => season.episodes.length)
  );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <LottieView
        style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay={true}
        loop
      />
      <View style={styles.item}>
        <Image
          source={{
            uri: `https://image.tmdb.org/t/p/w500${showDetail.backdrop_path}`,
          }}
          style={styles.backDrop}
        />
        <Image
          source={{
            uri: `https://image.tmdb.org/t/p/w500${showDetail.poster_path}`,
          }}
          style={styles.poster}
        />
        <View style={styles.seriesInfo}>
          <Text style={styles.showName}>{showDetail.name}</Text>
          <Text style={styles.showDate}>
            {showDetail.first_air_date} -{" "}
            {showDetail.status == "Ended"
              ? showDetail.last_air_date
              : "Devam ediyor"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.voteAverage}>
              {showDetail.vote_average.toFixed(1)}
            </Text>
            <Text style={styles.voteCount}>({showDetail.vote_count})</Text>
          </View>
        </View>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: tvShows.length * 45 }}>
            {/* Sezon Başlıkları */}
            <View style={styles.row}>
              <Text style={[styles.cell, styles.header]}></Text>
              {tvShows.map((season, index) => (
                <Text
                  key={index}
                  style={[
                    styles.cell,
                    styles.header,
                    { color: theme.text.primary },
                  ]}
                >
                  S-{season.season_number}
                </Text>
              ))}
            </View>

            {/* Bölüm Puanları */}
            {[...Array(maxEpisodes)].map((_, episodeIndex) => (
              <View key={episodeIndex} style={styles.row}>
                <Text
                  style={[
                    styles.cell,
                    styles.header,
                    { color: theme.text.primary },
                  ]}
                >
                  {t.e}
                  {episodeIndex + 1}
                </Text>
                {tvShows.map((season) => (
                  <View key={season.season_number} style={styles.cell}>
                    {season.episodes[episodeIndex] ? (
                      <View>
                        {selectedEpisode ===
                          `${season.season_number}-${episodeIndex}` && (
                          <View
                            style={[
                              styles.seasonEpisodeInfo,
                              episodeIndex < 6 ? { top: 20 } : { bottom: 20 },
                              tvShows.length == season.season_number &&
                              season.season_number > 6
                                ? { left: -80 }
                                : season.season_number === 1
                                  ? { left: 0 }
                                  : { left: -40 },
                            ]}
                          >
                            <Text
                              style={{ color: "white", textAlign: "center" }}
                            >
                              {season.episodes[episodeIndex].name}
                            </Text>
                            <Text
                              style={{ color: "white", textAlign: "center" }}
                            >
                              {season.episodes[episodeIndex].runtime}{" "}
                              {t.minutes}
                            </Text>
                            <Text
                              style={{ color: "white", textAlign: "center" }}
                            >
                              {t.PublicationDate}{" "}
                              {season.episodes[episodeIndex].air_date}
                            </Text>
                            <Text
                              style={{ color: "white", textAlign: "center" }}
                            >
                              {season.episodes[episodeIndex].vote_count}{" "}
                              {t.evaluation}
                            </Text>
                            <TouchableOpacity
                              style={styles.btnEpisodeNavigate}
                              onPress={() =>
                                navigation.navigate("EpisodeDetails", {
                                  showId: id,
                                  seasonNumber: season.season_number,
                                  episodeNumber:
                                    season.episodes[episodeIndex]
                                      .episode_number,
                                })
                              }
                            >
                              <Text
                                style={{ color: "white", textAlign: "center" }}
                              >
                                {t.detail}
                              </Text>
                              <LottieView
                                style={{ width: 32, height: 32 }}
                                source={require("../../LottieJson/yon.json")}
                                autoPlay
                                loop
                              />
                            </TouchableOpacity>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => {
                            selectedEpisode ===
                            `${season.season_number}-${episodeIndex}`
                              ? setSelectedEpisode(null)
                              : setSelectedEpisode(
                                  `${season.season_number}-${episodeIndex}`
                                );
                          }}
                        >
                          <Text
                            style={[
                              getRatingStyle(
                                season.episodes[episodeIndex].vote_average
                              ),
                              styles.rating,
                              selectedEpisode ===
                                `${season.season_number}-${episodeIndex}` && {
                                width: 60,
                                height: 30,
                                borderColor: "white",
                                fontSize: 12,
                                borderWidth: 1.5,
                              },
                            ]}
                          >
                            {season.episodes[episodeIndex].vote_average
                              ? season.episodes[
                                  episodeIndex
                                ].vote_average.toFixed(1)
                              : "N/A"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.noData}>●</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
};

const getRatingStyle = (rating) => {
  if (rating >= 9) return styles.awesome;
  if (rating >= 8) return styles.great;
  if (rating >= 7) return styles.good;
  if (rating >= 6) return styles.regular;
  if (rating >= 5) return styles.bad;
  return styles.poor;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 0,
    padding: 10,
    paddingTop: 30,
  },
  lottie: {
    position: "absolute",
    top: 0,
    left: -60,
    right: -60,
    bottom: -200,
    zIndex: 0,
  },
  containerScroll: {
    flex: 1,
  },
  item: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 15,
    padding: 10,
    marginVertical: 10,
  },
  seriesInfo: { flex: 1 },

  showName: {
    fontSize: 20,
    color: "white",
    marginLeft: 10,
  },
  showDate: {
    fontSize: 12,
    color: "rgb(144, 164, 174)",
    marginLeft: 10,
  },
  voteAverage: {
    fontSize: 18,
    fontWeight: "500",
    color: "orange",
    marginLeft: 10,
  },
  voteCount: {
    fontSize: 12,
    color: "rgb(144, 164, 174)",
    marginLeft: 5,
  },
  poster: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  backDrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 15,
    opacity: 0.5, // Adjust opacity as needed (e.g., 0.3 for 30%)
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  cell: {
    padding: 0,
    width: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
  },
  seasonEpisodeInfo: {
    position: "absolute",
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: " rgba(57, 57, 91,0.9)",
    padding: 4,
    borderRadius: 10,
    zIndex: 3,
  },
  btnEpisodeNavigate: {
    width: "100%",
    borderRadius: 5,
    paddingHorizontal: 5,
    backgroundColor: "rgba(129, 206, 254,0.3)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rating: {
    width: 50,
    height: 25,
    borderRadius: 6,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  header: {
    fontWeight: "bold",
    textAlign: "center",
    color: "#fff",
  },
  activityIndicator: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  loading: {},
  awesome: {
    backgroundColor: "rgb(0, 88, 74)",
    color: "#fff",
  },
  great: {
    backgroundColor: "rgb(41, 184, 100)",
    color: "#000",
  },
  good: {
    backgroundColor: "rgb(255, 255, 0)",
    color: "#000",
  },
  regular: {
    backgroundColor: "rgb(255, 100, 0)",
    color: "#000",
  },
  bad: {
    backgroundColor: "rgb(255, 0, 0)",
    color: "#fff",
  },
  poor: {
    backgroundColor: "rgb(99, 0, 204)",
    color: "#fff",
  },
  noData: {
    color: "#888",
  },
});

export default TvGraphDetailScreen;
