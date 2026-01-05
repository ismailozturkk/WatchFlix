import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Modal,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import axios from "axios";
import LottieView from "lottie-react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Octicons from "@expo/vector-icons/Octicons";
import RatingStars from "../../components/RatingStars";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as Progress from "react-native-progress";
//import { API_KEY } from "@env";
import { useAppSettings } from "../../context/AppSettingsContext";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Entypo from "@expo/vector-icons/Entypo";
const { width } = Dimensions.get("window");
const SeasonItem = ({ season, details, navigation }) => {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const [play, setPlay] = useState("");
  const { user } = useAuth();
  const [isWatched, setIsWatched] = useState(false);
  const [seasonEpisodeWatch, setSeasonEpisodeWatch] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { API_KEY } = useAppSettings();
  const showReleaseDateTime = new Date(season.air_date);

  const [scaleValue] = useState(new Animated.Value(1));

  const onPressIn = () => {
    Animated.timing(scaleValue, {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
  // Modal ve tarih seçici state'leri
  const [modalVisible, setModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  // Modal aç
  const openModal = () => setModalVisible(true);
  const closeModal = () => {
    setModalVisible(false);
    setSelectedDate(null);
  };

  // Tarih seçici aç/kapat
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);

  // Tarih seçilince
  const handleConfirm = (date) => {
    setSelectedDate(date);
    addSeasonToFirestore(false, date);
    hideDatePicker();
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };
  const formatDateSave = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };
  const [watchStatus, setWatchStatus] = useState("none"); // "none", "full", "partial"
  useEffect(() => {
    const userRef = doc(db, "Lists", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (!docSnap.exists()) {
        setIsWatched(false);
        setWatchStatus("none"); // özel durum
        setSeasonEpisodeWatch(0);
        return;
      }

      const data = docSnap.data();
      const watchedTv = data.watchedTv || [];
      const tvShow = watchedTv.find((show) => show.id === details.id);

      if (!tvShow) {
        setIsWatched(false);
        setWatchStatus("none");
        setSeasonEpisodeWatch(0);

        return;
      }

      const seasonWatched = tvShow.seasons.find(
        (s) => s.seasonNumber === season.season_number
      );

      if (!seasonWatched) {
        setIsWatched(false);
        setWatchStatus("none");
        setSeasonEpisodeWatch(0);

        return;
      }

      const watchedCount = seasonWatched.episodes.length;
      const totalCount = season.episode_count;

      if (watchedCount === totalCount) {
        setIsWatched(true);
        setWatchStatus("full"); // tamamı izlenmiş
      } else if (watchedCount > 0) {
        setIsWatched(true);
        setWatchStatus("partial"); // kısmen izlenmiş
      } else {
        setIsWatched(false);
        setWatchStatus("none");
        setSeasonEpisodeWatch(0);
      }

      setSeasonEpisodeWatch(watchedCount / totalCount);
    });

    return () => unsubscribe();
  }, []);

  const markEpisodeAsWatched = async ({
    showId,
    showName,
    showEpisodeCount,
    showSeasonCount,
    showPosterPath,
    seasonNumber,
    seasonPosterPath,
    seasonEpisodes,
    showReleaseDate,
    genres,
    episodesData = [],
  }) => {
    try {
      const userRef = doc(db, "Lists", user.uid);
      const docSnap = await getDoc(userRef);

      let data = docSnap.exists() ? docSnap.data() : { watchedTv: [] };
      let watchedTv = data.watchedTv || [];

      let tvShowIndex = watchedTv.findIndex((show) => show.id === showId);

      const newEpisodes = episodesData.map((ep) => ({
        episodeNumber: ep.episodeNumber,
        episodePosterPath: ep.episodePosterPath || null,
        episodeName: ep.episodeName || "Unknown",
        episodeRatings: ep.episodeRatings || 0,
        episodeMinutes: ep.episodeMinutes || 0,
        episodeWatchTime: showReleaseDate || 0,
      }));

      if (tvShowIndex === -1) {
        watchedTv.push({
          id: showId,
          name: showName,
          showEpisodeCount,
          showSeasonCount,
          imagePath: showPosterPath,
          addedShowDate: showReleaseDate,
          genres,
          type: "tv",
          seasons: [
            {
              seasonNumber,
              seasonPosterPath: seasonPosterPath || null,
              seasonEpisodes,
              addedSeasonDate: showReleaseDate,
              episodes: newEpisodes,
            },
          ],
        });
      } else {
        let show = watchedTv[tvShowIndex];
        let seasons = show.seasons || [];
        let seasonIndex = seasons.findIndex(
          (s) => s.seasonNumber === seasonNumber
        );

        if (seasonIndex === -1) {
          seasons.push({
            seasonNumber,
            seasonPosterPath: seasonPosterPath || null,
            seasonEpisodes,
            addedSeasonDate: showReleaseDate,
            episodes: newEpisodes,
          });
        } else {
          const existingEpisodes = seasons[seasonIndex].episodes || [];
          const mergedEpisodes = [
            ...existingEpisodes,
            ...newEpisodes.filter(
              (ne) =>
                !existingEpisodes.some(
                  (ee) => ee.episodeNumber === ne.episodeNumber
                )
            ),
          ];

          seasons[seasonIndex].episodes = mergedEpisodes.sort(
            (a, b) => a.episodeNumber - b.episodeNumber
          );
        }

        watchedTv[tvShowIndex].seasons = seasons.sort(
          (a, b) => a.seasonNumber - b.seasonNumber
        );
      }

      await updateDoc(userRef, { watchedTv });
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  const addSeasonToFirestore = async (
    isDelete = false,
    selectedDate = null
  ) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setModalVisible(false);

      const userRef = doc(db, "Lists", user.uid);
      const docSnap = await getDoc(userRef);

      let data = docSnap.exists() ? docSnap.data() : { watchedTv: [] };
      let watchedTv = data.watchedTv || [];
      let tvShowIndex = watchedTv.findIndex((show) => show.id === details.id);

      if (isDelete) {
        if (tvShowIndex !== -1) {
          let show = watchedTv[tvShowIndex];
          let seasons = show.seasons || [];
          let seasonIndex = seasons.findIndex(
            (s) => s.seasonNumber === season.season_number
          );
          if (seasonIndex !== -1) {
            seasons.splice(seasonIndex, 1);
            if (seasons.length === 0) {
              watchedTv.splice(tvShowIndex, 1);
            }
          }
          await updateDoc(userRef, { watchedTv });
          setIsWatched(false);
        }
        return;
      }

      if (!selectedDate) return;

      const response = await axios.get(
        `https://api.themoviedb.org/3/tv/${details.id}/season/${season.season_number}`,
        {
          params: { language: language === "tr" ? "tr-TR" : "en-US" },
          headers: {
            accept: "application/json",
            Authorization: API_KEY,
          },
        }
      );

      const episodeDate = formatDateSave(selectedDate);

      const episodesData = response.data.episodes.map((ep) => ({
        episodeNumber: ep.episode_number,
        episodePosterPath: ep.still_path,
        episodeName: ep.name,
        episodeRatings: parseFloat(ep.vote_average?.toFixed(1)) || 0,
        episodeMinutes: ep.runtime,
      }));

      await markEpisodeAsWatched({
        showId: details.id,
        showReleaseDate: episodeDate,
        seasonNumber: season.season_number,
        showName: details.name,
        showEpisodeCount: details.number_of_episodes,
        showSeasonCount: details.number_of_seasons,
        showPosterPath: details.poster_path,
        seasonPosterPath: season.poster_path,
        seasonEpisodes: season.episode_count,
        genres: details.genres ? details.genres.map((g) => g.name) : [],
        episodesData,
      });

      setIsWatched(true);
    } catch (error) {
      console.error("Sezon eklenirken hata oluştu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={() => onPressIn(season.id)}
      onPressOut={() => onPressOut(season.id)}
      onPress={() =>
        navigation.navigate("SeasonDetails", {
          showId: details.id,
          seasonNumber: season.season_number,
          showName: details.name,
          showEpisodeCount: details.number_of_episodes,
          showSeasonCount: details.number_of_seasons,
          showPosterPath: details.poster_path,
          genres: details.genres ? details.genres.map((g) => g.name) : [], // <-- EKLENDİ,
        })
      }
    >
      <Animated.View
        style={[
          styles.seasonItem,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            shadowColor: theme.shadow,
            transform: [{ scale: scaleValue }],
          },
        ]}
      >
        {season.poster_path || season.air_date ? (
          <>
            {season.id === play && (
              <>
                <LottieView
                  style={{
                    position: "absolute",
                    height: 150,
                    top: 0,
                    left: "50%",
                    right: 0,
                    zIndex: 5,
                  }}
                  source={require("../../LottieJson/6_fireworks.json")}
                  opacity={1}
                  autoPlay={season.id === play}
                  loop={false}
                />
                <LottieView
                  style={{
                    position: "absolute",
                    height: 150,
                    top: 0,
                    left: 0,
                    right: "50%",
                    zIndex: 5,
                  }}
                  source={require("../../LottieJson/6_fireworks.json")}
                  opacity={1}
                  autoPlay={season.id === play}
                  loop={false}
                />
              </>
            )}
            {season.poster_path ? (
              <Image
                source={{
                  uri: `https://image.tmdb.org/t/p/w500${season.poster_path}`,
                }}
                style={[styles.seasonPoster, { shadowColor: theme.shadow }]}
              />
            ) : (
              <View
                style={[
                  styles.noImageContainer,
                  { backgroundColor: theme.secondary },
                ]}
              >
                <Ionicons name="image" size={80} color={theme.text.muted} />
              </View>
            )}
            <View style={styles.seasonInfo}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ width: "80%" }}>
                  <Text
                    style={[styles.seasonTitle, { color: theme.text.primary }]}
                  >
                    {season.name}
                  </Text>
                  <Text
                    style={[styles.seasonMeta, { color: theme.text.secondary }]}
                  >
                    {season.episode_count
                      ? `${season.episode_count} ${t.episode}`
                      : t.episodeCountUnknown}{" "}
                    •{" "}
                    {season.air_date
                      ? formatDate(season.air_date)
                      : t.dateUnknown}
                  </Text>
                </View>
                <View>
                  <TouchableOpacity
                    onPress={() => {
                      if (isWatched) {
                        // Silme işlemi
                        addSeasonToFirestore(true); // true parametresi silme için
                      } else {
                        // Ekleme işlemi için modal aç
                        openModal();
                      }
                    }}
                    style={{ zIndex: 6 }}
                  >
                    {isLoading ? (
                      <LottieView
                        source={require("../../LottieJson/loading15.json")}
                        style={{ width: 34, height: 34 }}
                        autoPlay
                        loop
                      />
                    ) : isWatched ? (
                      <Octicons
                        name="check-circle-fill"
                        size={28}
                        color={
                          seasonEpisodeWatch === 1
                            ? watchStatus === "full"
                              ? theme.colors.green
                              : theme.colors.red
                            : theme.colors.orange
                        }
                      />
                    ) : (
                      <FontAwesome6
                        name="circle-plus"
                        size={28}
                        color={theme.text.secondary}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {season.vote_average > 0 ? (
                <View style={styles.seasonRating}>
                  <Text
                    style={[
                      styles.seasonRatingText,
                      { color: theme.text.primary },
                    ]}
                  >
                    {season.vote_average.toFixed(1)} / 10
                  </Text>
                  <RatingStars rating={season.vote_average} />
                </View>
              ) : (
                <Text
                  style={[styles.seasonRatingText, { color: theme.text.muted }]}
                >
                  {t.notYetRated}
                </Text>
              )}
              <Text
                style={[styles.seasonOverview, { color: theme.text.secondary }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {season.overview || t.noOverviewAvailable}
              </Text>
            </View>
            <Progress.Bar
              key={`progress-${seasonEpisodeWatch}`}
              style={{
                position: "absolute",
                bottom: 0,
                left: 102,
                zIndex: -3,
                width: "71%",
              }}
              progress={seasonEpisodeWatch}
              width={width * 0.67}
              height={1}
              borderWidth={0}
              animationConfig={{ bounciness: 100 }}
              color={
                seasonEpisodeWatch === 1
                  ? watchStatus === "full"
                    ? theme.colors.green
                    : theme.secondary
                  : theme.colors.orange
              }
            />
          </>
        ) : (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Text
              style={{
                color: theme.text.secondary,
                fontWeight: "bold",
                fontSize: 36,
              }}
            >
              Yeni Sezon Geliyor
            </Text>
            <Text style={{ color: theme.text.between }}>Tarih Belirsiz</Text>
          </View>
        )}
      </Animated.View>
      <Modal
        visible={modalVisible} // artık state'e bağlı
        onRequestClose={closeModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[
              "rgba(0,0,0,0)",
              "rgba(0,0,0,0)",
              "rgba(0,0,0,0.7)",
              "rgba(0,0,0,0.9)",
            ]}
            style={styles.positionStyle}
          />
          <TouchableOpacity style={styles.positionStyle} onPress={closeModal} />
          <View
            style={[styles.modalContent, { backgroundColor: theme.secondary }]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 5,
              }}
            >
              {/* İleride başka seçenekler de ekleyebilirsin */}
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.primary }]}
                onPress={showDatePicker}
              >
                <Ionicons
                  name="calendar-outline"
                  size={48}
                  color={theme.text.primary}
                />
                <Text style={[styles.inputText, { color: theme.text.primary }]}>
                  {selectedDate ? formatDate(selectedDate) : "Tarih seçiniz"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.primary }]}
                onPress={() => addSeasonToFirestore(false, new Date())}
              >
                <Entypo name="stopwatch" size={48} color={theme.text.primary} />
                <Text style={[styles.inputText, { color: theme.text.primary }]}>
                  Şimdi
                </Text>
                <Text
                  style={[
                    styles.inputTextDate,
                    { color: theme.text.secondary },
                  ]}
                >
                  {formatDate(new Date())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.primary }]}
                onPress={() => addSeasonToFirestore(false, showReleaseDateTime)}
              >
                <MaterialCommunityIcons
                  name="movie-play-outline"
                  size={48}
                  color={theme.text.primary}
                />
                <Text style={[styles.inputText, { color: theme.text.primary }]}>
                  Yayınlanma Tarih
                </Text>
                <Text
                  style={[
                    styles.inputTextDate,
                    { color: theme.text.secondary },
                  ]}
                >
                  {formatDate(showReleaseDateTime)}
                </Text>
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirm}
                onCancel={hideDatePicker}
                minimumDate={new Date(showReleaseDateTime)} // 1 Ocak 2000'den önce seçilemez
                maximumDate={new Date()} // Bugünden ileri seçilemez
              />

              {/* Buraya başka butonlar veya seçenekler ekleyebilirsin */}
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  seasonItem: {
    height: 120,
    flexDirection: "row",
    borderRadius: 10,
    marginVertical: 20,
    //borderWidth: 1,
    overflow: "visible",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  positionStyle: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },

  seasonPoster: {
    top: -15,
    left: -1,
    width: 100,
    height: 150,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  seasonInfo: {
    flex: 1,
    padding: 10,
    marginLeft: 10,
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  seasonMeta: {
    fontSize: 12,
    marginBottom: 5,
  },
  seasonRating: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    gap: 5,
  },
  seasonRatingText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  seasonOverview: {
    fontSize: 12,
    lineHeight: 16,
  },
  noImageContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#222",
    borderTopRightRadius: 16,
    borderTopLeftRadius: 16,
    padding: 18,

    alignItems: "center",
  },
  input: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    minWidth: 100,
    gap: 5,
    alignItems: "center",
  },

  inputText: {
    fontSize: 14,
    color: "#fff",
  },
  inputTextDate: {
    fontSize: 12,
    color: "#999",
  },
});

export default SeasonItem;
