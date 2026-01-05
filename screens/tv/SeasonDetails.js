import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from "react-native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { SearchSkeleton } from "../../components/Skeleton";
import RatingStars from "../../components/RatingStars";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Octicons from "@expo/vector-icons/Octicons";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import WatchedAdd from "./WatchedAdd";
import * as Progress from "react-native-progress";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import AntDesign from "@expo/vector-icons/AntDesign";
//import { API_KEY } from "@env";
import { useAppSettings } from "../../context/AppSettingsContext";
import Reminder from "../../components/Reminder";
const { height, width } = Dimensions.get("window");

export default function SeasonDetails({ route, navigation }) {
  const {
    showId,
    seasonNumber,
    showName,
    showEpisodeCount,
    showSeasonCount,
    showPosterPath,
    genres,
  } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const [lineCount, setLineCount] = useState(0);
  const [numberOfLines, setNumberOfLines] = useState(false);
  const [playSeason, setPlaySeason] = useState(false);
  const [play, setPlay] = useState("");
  const { user } = useAuth();
  const { API_KEY, showSnow } = useAppSettings();
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };
  const calculateDateDifference = (airDate) => {
    if (!airDate) return null;

    const airDateTime = new Date(airDate).getTime();
    const currentTime = Date.now();
    const difference = airDateTime - currentTime;

    // If air date is in the past
    if (difference < 0) {
      return {
        text: formatDate(airDate),
        isRemaining: false,
      };
    }

    // If air date is in the future
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;

    let text;
    if (months > 0) {
      text =
        remainingDays > 0
          ? `${months} ${months === 1 ? t.month : t.month} ${remainingDays} ${remainingDays === 1 ? t.days : t.days}`
          : `${months} ${months === 1 ? t.month : t.month}`;
    } else if (days > 0) {
      text = `${days} ${days === 1 ? t.days : t.days}`;
    } else {
      text = t.today;
    }

    return {
      text,
      isRemaining: true,
    };
  };

  const adjustOpacity = (rgbColor, opacity) => {
    const rgb = rgbColor.match(/\d+/g); // RGB değerlerini alır
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  };

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      const options = {
        method: "GET",
        url: `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}`,
        params: { language: language === "tr" ? "tr-TR" : "en-US" },
        headers: {
          accept: "application/json",
          Authorization: API_KEY,
        },
      };

      try {
        const response = await axios.request(options);
        setDetails(response.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [showId, seasonNumber, t.language]);

  const [isSeasonWatched, setIsSeasonWatched] = useState();
  const [isLoading, setIsLoading] = useState(false);

  const checkIfWatched = () => {
    if (!user || !showId || !seasonNumber) return; // 🛑 Hatalı durumları engelle

    const userRef = doc(db, "Lists", user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const watchedTv = data.watchedTv || [];
          const tvShow = watchedTv.find((show) => show.id === showId);

          if (tvShow && tvShow.seasons && tvShow.seasons[seasonNumber - 1]) {
            const season = tvShow.seasons[seasonNumber - 1];
            const seasonEpisodeCount = season.episodes.length;
            const seasonEpisodes = season.seasonEpisodes;

            if (seasonEpisodeCount && seasonEpisodes) {
              setIsSeasonWatched(seasonEpisodeCount / seasonEpisodes);
            } else {
              console.error("seasonEpisodeCount veya seasonEpisodes undefined");
            }
          } else {
            setIsSeasonWatched(0);
          }
        } else {
          console.error("docSnap.exists() false");
        }
      },
      (error) => {
        console.error("Hata:", error);
      }
    );

    return unsubscribe;
  };
  useEffect(() => {
    const unsubscribe = checkIfWatched();
    return () => unsubscribe && unsubscribe();
  }, [user, showId, seasonNumber]);
  if (!details) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <Text style={[styles.loadingText, { color: theme.text.primary }]}>
          {t.loading}
        </Text>
      </View>
    );
  }
  if (loading) {
    return <SearchSkeleton />;
  }
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" />
      {isSeasonWatched == 1 && (
        <LottieView
          style={{
            position: "absolute",
            height: 600,
            left: 0,
            right: 0,
            zIndex: 1,
          }}
          source={require("../../LottieJson/confetti_2.json")}
          opacity={1}
          autoPlay={isSeasonWatched == 1}
          loop={false}
        />
      )}
      <View style={styles.headerContainer}>
        {details.poster_path ? (
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/original${details.poster_path}`,
            }}
            style={styles.poster}
          />
        ) : (
          <View
            style={[
              styles.noImageContainer,
              { backgroundColor: theme.secondary },
            ]}
          >
            <Ionicons name="image" size={180} color={theme.text.muted} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", theme.primary]}
          style={styles.gradient}
        />
      </View>
      <View style={[styles.content, { backgroundColor: theme.primary }]}>
        <View style={styles.header}>
          {details.episodes.map((ep, index) => {
            if ((index + 7) % 7 === 0 || index < 4) {
              return (
                <LottieView
                  key={ep.episode_number}
                  style={[
                    styles.lottie,
                    {
                      display: showSnow ? "flex" : "none",
                      top: 1000 * Math.floor(index < 7 ? index : index / 7),
                    },
                  ]}
                  source={require("../../LottieJson/snow.json")}
                  autoPlay={true}
                  loop
                />
              );
            }
            return null;
          })}
          <Text style={[styles.showName, { color: theme.text.primary }]}>
            {showName}
          </Text>
          <Text style={[styles.seasonName, { color: theme.text.primary }]}>
            {details.name}
          </Text>
          <Text style={[styles.seasonInfo, { color: theme.text.secondary }]}>
            {details.air_date ? formatDate(details.air_date) : t.dateUnknown} •{" "}
            {details.episodes.length} {t.episode}
          </Text>
        </View>
        {details.vote_average > 0 && (
          <View style={styles.rating}>
            <Text style={[styles.ratingText, { color: theme.text.primary }]}>
              {details.vote_average.toFixed(1)} / 10
            </Text>
            <RatingStars rating={details.vote_average} />
          </View>
        )}
        {!isLoading && (
          <Progress.Bar
            progress={isSeasonWatched}
            width={width * 0.93}
            height={3}
            borderWidth={0}
            borderBottomWidth={isSeasonWatched == 0 ? 0 : 1}
            borderColor={
              isSeasonWatched === 1 ? theme.colors.green : theme.colors.orange
            }
            animationConfig={{ bounciness: 10 }}
            color={
              isSeasonWatched === 1 ? theme.colors.green : theme.colors.orange
            }
            style={{ marginBottom: 10 }}
          />
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            {t.overview}
          </Text>
          <Text
            style={[styles.overview, { color: theme.text.secondary }]}
            numberOfLines={numberOfLines ? null : 5}
            ellipsizeMode="tail"
            onTextLayout={(event) => {
              const { lines } = event.nativeEvent;
              setLineCount(lines.length); // Satır sayısını güncelle
            }}
          >
            {details.overview || t.noOverviewAvailable}
          </Text>
          {lineCount > 5 ? (
            <TouchableOpacity
              onPress={() => setNumberOfLines(!numberOfLines)}
              style={{
                width: "100%",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 10,
              }}
              activeOpacity={0.8}
            >
              {numberOfLines ? (
                <MaterialIcons
                  name="keyboard-arrow-up"
                  size={40}
                  color={theme.text.primary}
                  style={{
                    width: 40,
                    backgroundColor: theme.secondary,
                    borderRadius: 15,
                    shadowColor: theme.shadow,
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    shadowOpacity: 0.94,
                    shadowRadius: 10.32,
                    elevation: 5,
                  }}
                />
              ) : (
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={40}
                  color={theme.text.primary}
                  style={{
                    width: 40,
                    backgroundColor: theme.secondary,
                    borderRadius: 15,
                    shadowColor: theme.shadow,
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    shadowOpacity: 0.94,
                    shadowRadius: 10.32,
                    elevation: 5,
                  }}
                />
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            {t.episode}
          </Text>
          {details.episodes.map((episode) => (
            <TouchableOpacity
              key={episode.id}
              style={[
                styles.episodeItem,
                {
                  backgroundColor: theme.secondary,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate("EpisodeDetails", {
                  showId,
                  showName,
                  seasonNumber,
                  seasonEpisodes: details.episodes.length,
                  episodeNumber: episode.episode_number,
                  showEpisodeCount,
                  showSeasonCount,
                  showPosterPath,
                  seasonPosterPath: details.poster_path,
                  genres: genres,
                })
              }
            >
              {episode.id === play && (
                <>
                  <LottieView
                    style={{
                      position: "absolute",
                      height: 200,
                      top: 0,
                      left: "50%",
                      right: 0,
                      zIndex: 5,
                    }}
                    source={require("../../LottieJson/6_fireworks.json")}
                    opacity={1}
                    autoPlay={episode.id === play}
                    loop={false}
                  />
                  <LottieView
                    style={{
                      position: "absolute",
                      height: 200,
                      top: 0,
                      left: 0,
                      right: "50%",
                      zIndex: 5,
                    }}
                    source={require("../../LottieJson/6_fireworks.json")}
                    opacity={1}
                    autoPlay={episode.id === play}
                    loop={false}
                  />
                </>
              )}
              {episode.still_path ? (
                <>
                  <Image
                    source={{
                      uri: `https://image.tmdb.org/t/p/w500${episode.still_path}`,
                    }}
                    style={styles.episodeImage}
                  />
                  <View
                    style={[
                      styles.runtimeView,
                      {
                        backgroundColor: adjustOpacity(theme.secondary, 0.5),
                      },
                    ]}
                  >
                    <Text
                      style={[styles.runtime, { color: theme.text.primary }]}
                    >
                      {episode.runtime} {t.time}
                    </Text>
                  </View>
                </>
              ) : (
                <View
                  style={[
                    styles.noEpisodeImage,
                    { backgroundColor: theme.border },
                  ]}
                >
                  <Ionicons name="image" size={60} color={theme.text.muted} />
                </View>
              )}
              <View style={styles.episodeInfo}>
                <View
                  style={{
                    flexDirection: "row",
                    //justifyContent: "space-between",
                  }}
                >
                  <View style={{ width: "85%" }}>
                    <View style={{ flexDirection: "row" }}>
                      <Text
                        style={[
                          styles.episodeNumber,
                          {
                            color: theme.text.secondary, // default color for past dates
                          },
                        ]}
                      >
                        {episode.episode_number}. {t.episode} •{" "}
                      </Text>
                      <Text
                        style={[
                          styles.episodeNumber,
                          {
                            color: episode.air_date
                              ? calculateDateDifference(episode.air_date)
                                  ?.isRemaining
                                ? theme.text.primary // or any color you want for remaining dates
                                : theme.text.secondary // default color for past dates
                              : theme.text.secondary,
                            backgroundColor: episode.air_date
                              ? calculateDateDifference(episode.air_date)
                                  ?.isRemaining
                                ? theme.notesColor.blueBackground // or any color you want for remaining dates
                                : null // default color for past dates
                              : null,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                            borderRadius: 10,
                          },
                        ]}
                      >
                        {episode.air_date
                          ? calculateDateDifference(episode.air_date)?.text
                          : t.dateUnknown}
                      </Text>
                      {calculateDateDifference(episode.air_date)
                        ?.isRemaining ? (
                        <>
                          <Text
                            style={[
                              styles.episodeNumber,
                              {
                                color: theme.text.secondary, // default color for past dates
                              },
                            ]}
                          >
                            {" "}
                            •{" "}
                          </Text>

                          <Reminder
                            showId={showId}
                            episodeId={episode.id}
                            showName={showName}
                            showPosterPath={showPosterPath}
                            seasonNumber={seasonNumber}
                            episodeNumber={episode.episode_number}
                            episodeName={episode.name}
                            airDate={episode.air_date}
                            stillPath={episode.still_path || null}
                            seasonPosterPath={details.poster_path}
                            episodeMinutes={episode.runtime}
                            type={"tv"}
                          />
                        </>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.episodeTitle,
                        { color: theme.text.primary },
                      ]}
                    >
                      {episode.name}
                    </Text>
                  </View>
                  {calculateDateDifference(episode.air_date)
                    ?.isRemaining ? null : (
                    <View>
                      <WatchedAdd
                        showId={showId}
                        showName={showName}
                        showReleaseDate={episode.air_date}
                        seasonNumber={seasonNumber}
                        showPosterPath={showPosterPath}
                        showEpisodeCount={showEpisodeCount}
                        showSeasonCount={showSeasonCount}
                        seasonEpisodes={details.episodes.length}
                        episodeNumber={episode.episode_number}
                        episodeName={episode.name}
                        episodeMinutes={episode.runtime}
                        episodeRatings={episode.vote_average.toFixed(1)}
                        seasonPosterPath={details.poster_path}
                        episodePosterPath={episode.still_path}
                        genres={genres}
                      />
                    </View>
                  )}
                </View>
                {episode.vote_average > 0 ? (
                  <View style={styles.episodeRating}>
                    <Text
                      style={[
                        styles.episodeRatingText,
                        { color: theme.text.primary },
                      ]}
                    >
                      {episode.vote_average.toFixed(1)}
                    </Text>
                    <AntDesign
                      name="star"
                      size={14}
                      color={theme.colors.orange}
                    />
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.episodeRatingText,
                      { color: theme.text.muted },
                    ]}
                  >
                    {t.notYetRated}
                  </Text>
                )}
                <Text
                  style={[
                    styles.overviewEpisode,
                    { color: theme.text.secondary },
                  ]}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {episode.overview}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  headerContainer: {
    height: 300,
    position: "relative",
  },
  poster: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  noImageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  header: {
    width: "85%",
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -120,
    right: -120,
    zIndex: 0,
  },
  showName: {
    fontSize: 20,
    marginBottom: 5,
  },
  seasonName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  seasonInfo: {
    fontSize: 14,
    marginBottom: 10,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
  },
  episodeItem: {
    flexDirection: "row",
    borderRadius: 23,
    marginBottom: 10,
    padding: 3,
    borderWidth: 1,
    zIndex: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  episodeImage: {
    width: 160,
    height: "100%",
    borderRadius: 20,
  },
  runtime: {
    fontSize: 11,
  },
  runtimeView: {
    position: "absolute",
    fontSize: 11,
    top: 7,
    left: 7,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 10,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  noEpisodeImage: {
    width: 160,
    height: 110,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  episodeInfo: {
    flex: 1,
    padding: 10,
  },
  episodeNumber: {
    fontSize: 14,
    marginBottom: 5,
  },
  episodeTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  episodeRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  episodeRatingText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  overviewEpisode: { fontSize: 11, fontWeight: "300", marginTop: 5 },
});
