import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { EpisodeSkeleton } from "../../components/Skeleton";
import RatingStars from "../../components/RatingStars";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import { useAuth } from "../../context/AuthContext";
import WatchedAdd from "./WatchedAdd";
//import { API_KEY } from "@env";
import { useAppSettings } from "../../context/AppSettingsContext";

const { width } = Dimensions.get("window");
export default function EpisodeDetails({ route, navigation }) {
  const {
    showId,
    seasonNumber,
    episodeNumber,
    showEpisodeCount,
    showSeasonCount,
    showName,
    seasonEpisodes,
    showPosterPath,
    seasonPosterPath,
    genres,
  } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const [check, setChecked] = useState(false);
  const { API_KEY, showSnow } = useAppSettings();
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      const options = {
        method: "GET",
        url: `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`,
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
  }, [showId, seasonNumber, episodeNumber, language]);

  if (loading) {
    return <EpisodeSkeleton />;
  }

  if (!details) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <Text style={[styles.loadingText, { color: theme.text.primary }]}>
          {t.loading}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" />
      {check && (
        <LottieView
          style={{
            position: "absolute",
            height: 600,
            left: 0,
            right: 0,
            zIndex: 3,
          }}
          source={require("../../LottieJson/confetti_2.json")}
          opacity={1}
          autoPlay={check}
          loop={false}
        />
      )}
      <View style={styles.headerContainer}>
        {details.still_path ? (
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/original${details.still_path}`,
            }}
            style={styles.still}
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
        <LottieView
          style={[
            styles.lottie,
            {
              display: showSnow ? "flex" : "none",
            },
          ]}
          source={require("../../LottieJson/snow.json")}
          autoPlay={true}
          loop
        />
        <View style={styles.header}>
          <View style={styles.tvInformation}>
            <View style={styles.info}>
              <Text
                style={[styles.episodeNumber, { color: theme.text.secondary }]}
              >
                {seasonNumber}. {t.season} {episodeNumber}. {t.episode}
              </Text>
              <Text style={[styles.title, { color: theme.text.primary }]}>
                {details.name}
              </Text>
              <Text style={[styles.airDate, { color: theme.text.secondary }]}>
                {details.air_date
                  ? formatDate(details.air_date)
                  : t.dateUnknown}
                {details.runtime && ` • ${details.runtime} ${t.duration}`}
              </Text>
            </View>

            <View>
              <WatchedAdd
                showId={showId}
                showReleaseDate={details.air_date}
                seasonNumber={seasonNumber}
                episodeNumber={episodeNumber}
                showEpisodeCount={showEpisodeCount}
                showSeasonCount={showSeasonCount}
                showName={showName}
                episodeName={details.name}
                episodeRatings={details.vote_average.toFixed(1)}
                episodeMinutes={details.runtime}
                seasonEpisodes={seasonEpisodes}
                showPosterPath={showPosterPath}
                seasonPosterPath={seasonPosterPath}
                episodePosterPath={details.still_path}
                genres={genres}
              />
            </View>
          </View>

          {details.vote_average > 0 && (
            <View style={styles.rating}>
              <Text style={[styles.ratingText, { color: theme.text.primary }]}>
                {details.vote_average.toFixed(1)} / 10
              </Text>
              <RatingStars rating={details.vote_average} />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            {t.overview}
          </Text>
          <Text style={[styles.overview, { color: theme.text.secondary }]}>
            {details.overview || t.noOverviewAvailable}
          </Text>
        </View>

        {details.guest_stars?.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              {t.guestStars}
            </Text>
            <ScrollView
              contentContainerStyle={styles.castList}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {details.guest_stars.map((actor) => (
                <TouchableOpacity
                  key={actor.id}
                  onPress={() => {
                    navigation.navigate("ActorViewScreen", {
                      personId: actor.id,
                    });
                  }}
                >
                  <View style={styles.castItem}>
                    {actor.profile_path ? (
                      <Image
                        source={{
                          uri: `https://image.tmdb.org/t/p/w500${actor.profile_path}`,
                        }}
                        style={[
                          styles.castImage,
                          { shadowColor: theme.shadow },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.noCastImage,
                          {
                            backgroundColor: theme.secondary,
                            shadowColor: theme.shadow,
                          },
                        ]}
                      >
                        <Ionicons
                          name="person"
                          size={30}
                          color={theme.text.muted}
                        />
                      </View>
                    )}
                    <View style={styles.castInfo}>
                      <Text
                        style={[
                          styles.actorName,
                          { color: theme.text.primary },
                        ]}
                      >
                        {actor.name}
                      </Text>
                      <Text
                        style={[
                          styles.characterName,
                          { color: theme.text.secondary },
                        ]}
                      >
                        {actor.character}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {details.crew?.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              {t.crew}
            </Text>
            <ScrollView
              contentContainerStyle={styles.castList}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {details.crew.map((member) => (
                <TouchableOpacity
                  key={`${member.id}-${member.job}`}
                  onPress={() => {
                    navigation.navigate("ActorViewScreen", {
                      personId: member.id,
                    });
                  }}
                >
                  <View style={styles.castItem}>
                    {member.profile_path ? (
                      <Image
                        source={{
                          uri: `https://image.tmdb.org/t/p/w500${member.profile_path}`,
                        }}
                        style={[
                          styles.castImage,
                          { shadowColor: theme.shadow },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.noCastImage,
                          {
                            backgroundColor: theme.secondary,
                            shadowColor: theme.shadow,
                          },
                        ]}
                      >
                        <Ionicons
                          name="person"
                          size={30}
                          color={theme.text.muted}
                        />
                      </View>
                    )}
                    <View style={styles.castInfo}>
                      <Text
                        style={[
                          styles.actorName,
                          { color: theme.text.primary },
                        ]}
                      >
                        {member.name}
                      </Text>
                      <Text
                        style={[
                          styles.characterName,
                          { color: theme.text.secondary },
                        ]}
                      >
                        {member.job}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
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
  still: {
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
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -120,
    right: -120,
    zIndex: 0,
  },
  header: {
    marginBottom: 20,
  },
  info: { width: "85%" },
  tvInformation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  episodeNumber: {
    fontSize: 16,
    marginBottom: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  airDate: {
    fontSize: 14,
    marginBottom: 10,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 20,
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
  castList: {
    flexDirection: "row",
    gap: 10,
  },
  castItem: {
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    padding: 10,
    overflow: "hidden",
  },
  castImage: {
    width: width * 0.2,
    height: width * 0.2,
    borderRadius: width * 0.1,
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
  noCastImage: {
    width: width * 0.2,
    height: width * 0.2,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: width * 0.1,
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
  castInfo: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  actorName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  characterName: {
    fontSize: 12,
  },
});
