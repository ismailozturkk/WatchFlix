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
  size = 48,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [isWatched, setIsWatched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const showReleaseDateTime = new Date(showReleaseDate);
  const [modalVisible, setModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const openModal = () => setModalVisible(true);
  const closeModal = () => {
    setModalVisible(false);
    setSelectedDate(null);
  };

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);

  const handleConfirm = (date) => {
    setSelectedDate(date);
    markEpisodeAsWatched(date);
    hideDatePicker();
  };

  const checkIfWatched = async () => {
    try {
      setIsLoading(true);
      const userRef = doc(db, "Lists", user.uid);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const watchedTv = data.watchedTv || [];
        const tvShow = watchedTv.find((show) => show.id === showId);
        if (!tvShow) return setIsWatched(false);
        const season = tvShow.seasons.find(
          (s) => s.seasonNumber === seasonNumber,
        );
        if (!season) return setIsWatched(false);
        const episode = season.episodes.find(
          (ep) => ep.episodeNumber === episodeNumber,
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
        if (tvShowIndex !== -1) {
          let show = watchedTv[tvShowIndex];
          let seasons = show.seasons || [];
          let seasonIndex = seasons.findIndex(
            (season) => season.seasonNumber === seasonNumber,
          );

          if (seasonIndex !== -1) {
            let season = seasons[seasonIndex];
            let episodes = season.episodes || [];
            let episodeIndex = episodes.findIndex(
              (ep) => ep.episodeNumber === episodeNumber,
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
                0,
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
          (season) => season.seasonNumber === seasonNumber,
        );

        if (seasonIndex === -1) {
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
            (ep) => ep.episodeNumber === episodeNumber,
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
              (a, b) => a.episodeNumber - b.episodeNumber,
            ),
          }))
          .sort((a, b) => a.seasonNumber - b.seasonNumber);

        show.seasonCount = show.seasons.length;
        show.episodeCount = show.seasons.reduce(
          (acc, s) => acc + (s.episodes?.length || 0),
          0,
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
      {/* ── Tetikleyici Buton ─────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => {
          if (isWatched) {
            markEpisodeAsWatched();
          } else {
            openModal();
          }
        }}
        style={{ zIndex: 10 }}
      >
        {isLoading ? (
          <LottieView
            source={require("../../LottieJson/loading15.json")}
            style={{ width: size, height: size }}
            autoPlay
            loop
          />
        ) : isWatched ? (
          <Ionicons
            name="checkmark-circle"
            size={size}
            color={theme.colors.green}
          />
        ) : (
          <FontAwesome6
            name="circle-plus"
            size={size - 6}
            color={theme.text.secondary}
          />
        )}
      </TouchableOpacity>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        onRequestClose={closeModal}
        animationType="slide"
        transparent
      >
        {/* Arka plan karartması – dokunulunca kapat */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeModal}
        >
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.75)"]}
            style={StyleSheet.absoluteFill}
          />
        </TouchableOpacity>

        {/* Kart */}
        <View style={[styles.sheet, { backgroundColor: theme.secondary }]}>
          {/* Üst çizgi */}
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.border ?? "rgba(255,255,255,0.15)" },
            ]}
          />

          {/* Başlık */}
          <Text
            style={[
              styles.sheetTitle,
              { color: theme.text?.primary ?? "#fff" },
            ]}
          >
            İzleme Tarihi
          </Text>
          <Text
            style={[
              styles.sheetSubtitle,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
          >
            Bu bölümü ne zaman izlediniz?
          </Text>

          {/* Seçenekler */}
          <View style={styles.optionsRow}>
            {/* Tarih Seç */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.primary }]}
              onPress={showDatePicker}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.optionIconBg,
                  { backgroundColor: "rgba(100,180,255,0.15)" },
                ]}
              >
                <Ionicons name="calendar-outline" size={26} color="#64b4ff" />
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  { color: theme.text?.primary ?? "#fff" },
                ]}
              >
                Tarih Seç
              </Text>
              <Text
                style={[
                  styles.optionDate,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                {selectedDate ? formatDate(selectedDate) : "Gün seçiniz"}
              </Text>
            </TouchableOpacity>

            {/* Şimdi */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.primary }]}
              onPress={() => markEpisodeAsWatched(new Date())}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.optionIconBg,
                  { backgroundColor: "rgba(41,184,100,0.15)" },
                ]}
              >
                <Entypo name="stopwatch" size={26} color="#29b864" />
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  { color: theme.text?.primary ?? "#fff" },
                ]}
              >
                Şimdi
              </Text>
              <Text
                style={[
                  styles.optionDate,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                {formatDate(new Date())}
              </Text>
            </TouchableOpacity>

            {/* Yayın Tarihi */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.primary }]}
              onPress={() => markEpisodeAsWatched(showReleaseDateTime)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.optionIconBg,
                  { backgroundColor: "rgba(255,165,0,0.15)" },
                ]}
              >
                <MaterialCommunityIcons
                  name="movie-play-outline"
                  size={26}
                  color="#ffa500"
                />
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  { color: theme.text?.primary ?? "#fff" },
                ]}
              >
                Yayın Tarihi
              </Text>
              <Text
                style={[
                  styles.optionDate,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                {formatDate(showReleaseDateTime)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* İptal butonu */}
          <TouchableOpacity
            style={[
              styles.cancelBtn,
              { borderColor: theme.border ?? "rgba(255,255,255,0.1)" },
            ]}
            onPress={closeModal}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.cancelBtnText,
                { color: theme.text?.secondary ?? "#aaa" },
              ]}
            >
              İptal
            </Text>
          </TouchableOpacity>

          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirm}
            onCancel={hideDatePicker}
            minimumDate={new Date(showReleaseDateTime)}
            maximumDate={new Date()}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Modal ───────────────────────────────────────────────────────────────
  backdrop: {
    flex: 1,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 13,
    marginBottom: 20,
  },

  // ── Seçenek Kartları ────────────────────────────────────────────────────
  optionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  optionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  optionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  optionDate: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
  },

  // ── İptal ───────────────────────────────────────────────────────────────
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
