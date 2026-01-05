import { Modal, StyleSheet, TouchableOpacity, View, Text } from "react-native";
import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLanguage } from "../../context/LanguageContext";

export default function WatchedAdd({
  showId,
  seasonNumber,
  showEpisodeCount,
  showSeasonCount,
  showPosterPath,
  showName,
  seasonPosterPath,
  seasonEpisodes,
  episodeNumber,
  episodeName,
  episodeRatings,
  episodeMinutes,
  episodePosterPath,
  showReleaseDate,
  genres,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [isWatched, setIsWatched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const showReleaseDateTime = new Date(showReleaseDate);
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
    markEpisodeAsWatched(date);
    hideDatePicker();
  };
  // 📌 Bölümün izlenip izlenmediğini kontrol eden fonksiyon
  const checkIfWatched = async () => {
    try {
      setIsLoading(true);
      const userRef = doc(db, "Lists", user.uid);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const watchedTv = data.watchedTv || [];

        // 1️⃣ Diziyi bul
        const tvShow = watchedTv.find((show) => show.id === showId);
        if (!tvShow) return setIsWatched(false);

        // 2️⃣ Sezonu bul
        const season = tvShow.seasons.find(
          (s) => s.seasonNumber === seasonNumber
        );
        if (!season) return setIsWatched(false);

        // 3️⃣ Bölümü bul
        const episode = season.episodes.find(
          (ep) => ep.episodeNumber === episodeNumber
        );
        setIsWatched(!!episode);
      }
    } catch (error) {
      console.error("Hata:", error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    checkIfWatched();
  }, []);
  // Tarihi stringe çevir
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
  const markEpisodeAsWatched = async (selectedDate = null) => {
    try {
      setIsLoading(true);
      closeModal();

      const userRef = doc(db, "Lists", user.uid);
      const docSnap = await getDoc(userRef);

      let data = docSnap.exists() ? docSnap.data() : { watchedTv: [] };
      let watchedTv = data.watchedTv || [];

      let tvShowIndex = watchedTv.findIndex((show) => show.id === showId);

      if (isWatched) {
        // 🔴 SİLME
        if (tvShowIndex !== -1) {
          let show = watchedTv[tvShowIndex];
          let seasons = show.seasons || [];
          let seasonIndex = seasons.findIndex(
            (season) => season.seasonNumber === seasonNumber
          );

          if (seasonIndex !== -1) {
            let season = seasons[seasonIndex];
            let episodes = season.episodes || [];
            let episodeIndex = episodes.findIndex(
              (ep) => ep.episodeNumber === episodeNumber
            );

            if (episodeIndex !== -1) {
              episodes.splice(episodeIndex, 1);
              season.seasonEpisodeCount = episodes.length;

              if (episodes.length === 0) {
                seasons.splice(seasonIndex, 1);
              } else {
                season.episodes = episodes;
              }

              show.seasons = seasons;
              show.seasonCount = seasons.length;
              show.episodeCount = seasons.reduce(
                (acc, s) => acc + (s.episodes?.length || 0),
                0
              );

              if (show.episodeCount === 0) {
                watchedTv.splice(tvShowIndex, 1);
              } else {
                watchedTv[tvShowIndex] = show;
              }
            }
          }
        }

        await updateDoc(userRef, { watchedTv });
        setIsWatched(false);
        checkIfWatched();
        return;
      }

      // 🟢 EKLEME
      if (!selectedDate) return;
      const episodeDate = formatDateSave(selectedDate);

      if (tvShowIndex === -1) {
        watchedTv.push({
          id: showId,
          name: showName,
          showEpisodeCount: showEpisodeCount,
          showSeasonCount: showSeasonCount,
          imagePath: showPosterPath,
          type: "tv",
          addedShowDate: episodeDate,
          genres: genres || [],
          seasonCount: 1,
          episodeCount: 1,
          seasons: [
            {
              seasonNumber: seasonNumber,
              seasonPosterPath: seasonPosterPath || null,
              seasonEpisodes: seasonEpisodes,
              addedSeasonDate: episodeDate,
              seasonEpisodeCount: 1,
              episodes: [
                {
                  episodeNumber: episodeNumber,
                  episodePosterPath: episodePosterPath || null,
                  episodeName: episodeName || "Unknown",
                  episodeRatings: episodeRatings || 0,
                  episodeMinutes: episodeMinutes || 0,
                  episodeWatchTime: episodeDate,
                },
              ],
            },
          ],
        });
      } else {
        let show = watchedTv[tvShowIndex];
        if (!show.addedShowDate) show.addedShowDate = episodeDate;

        let seasons = show.seasons || [];
        let seasonIndex = seasons.findIndex(
          (season) => season.seasonNumber === seasonNumber
        );

        if (seasonIndex === -1) {
          // Yeni sezon ekleniyor
          seasons.push({
            seasonNumber: seasonNumber,
            seasonPosterPath: seasonPosterPath || null,
            seasonEpisodes: seasonEpisodes,
            addedSeasonDate: episodeDate,
            seasonEpisodeCount: 1,
            episodes: [
              {
                episodeNumber: episodeNumber,
                episodePosterPath: episodePosterPath || null,
                episodeName: episodeName || "Unknown",
                episodeRatings: episodeRatings || 0,
                episodeMinutes: episodeMinutes || 0,
                episodeWatchTime: episodeDate,
              },
            ],
          });
        } else {
          let season = seasons[seasonIndex];
          if (!season.addedSeasonDate) season.addedSeasonDate = episodeDate;

          let episodes = season.episodes || [];
          let episodeIndex = episodes.findIndex(
            (ep) => ep.episodeNumber === episodeNumber
          );

          if (episodeIndex === -1) {
            episodes.push({
              episodeNumber: episodeNumber,
              episodePosterPath: episodePosterPath || null,
              episodeName: episodeName || "Unknown",
              episodeRatings: episodeRatings || 0,
              episodeMinutes: episodeMinutes || 0,
              episodeWatchTime: episodeDate,
            });
            season.episodes = episodes;
            season.seasonEpisodeCount = episodes.length;
          }
        }

        show.seasons = seasons
          .map((season) => ({
            ...season,
            episodes: (season.episodes || []).sort(
              (a, b) => a.episodeNumber - b.episodeNumber
            ),
          }))
          .sort((a, b) => a.seasonNumber - b.seasonNumber);

        show.seasonCount = show.seasons.length;
        show.episodeCount = show.seasons.reduce(
          (acc, s) => acc + (s.episodes?.length || 0),
          0
        );

        watchedTv[tvShowIndex] = show;
      }

      await updateDoc(userRef, { watchedTv });
      setIsWatched(true);
      checkIfWatched();
    } catch (error) {
      console.error("Hata:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          if (isWatched) {
            // Eğer bölüm zaten izlendiyse, doğrudan sil
            markEpisodeAsWatched();
          } else {
            // Eğer bölüm yoksa, modal aç
            openModal();
          }
        }}
        style={{ zIndex: 10 }}
      >
        {isLoading ? (
          <LottieView
            source={require("../../LottieJson/loading15.json")}
            style={{ width: 34, height: 34 }}
            autoPlay
            loop
          />
        ) : isWatched ? (
          <Ionicons
            name="checkmark-circle"
            size={34}
            color={theme.colors.green}
          />
        ) : (
          <FontAwesome6
            name="circle-plus"
            size={28}
            color={theme.text.secondary}
          />
        )}
      </TouchableOpacity>
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
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
            }}
          />
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
            }}
            onPress={closeModal}
          />
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
                onPress={() => markEpisodeAsWatched(new Date())}
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
                onPress={() => markEpisodeAsWatched(showReleaseDateTime)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
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
