import { Modal, StyleSheet, TouchableOpacity, View, Text } from "react-native";
import React, { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../../context/AuthContext";
import { markEpisodes, unmarkEpisode } from "../../services/watchedTvService";
import { useTheme } from "../../context/ThemeContext";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import DatePickerModal from "@components/modals/DatePickerModal";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";


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
  // İzlenme durumu üstteki tek abonelikten (useWatchedShow) controlled gelir.
  isWatched = false,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { language } = useLanguage();
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
    // date artık ISO string ("YYYY-MM-DD") veya Date objesi olabilir
    const isoDate = typeof date === "string" ? date : formatDateSave(date);
    setSelectedDate(isoDate);
    markEpisodeAsWatched(isoDate);
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

  // İşaretle / kaldır — kanonik subcollection servisine yönlendirir (race-free).
  const markEpisodeAsWatched = async (date = null) => {
    if (!user?.uid) return;
    try {
      setIsLoading(true);
      closeModal();

      if (isWatched) {
        await unmarkEpisode(user.uid, showId, seasonNumber, episodeNumber);
        return;
      }

      if (!date) return;
      const episodeDate = formatDateSave(date);
      await markEpisodes(
        user.uid,
        {
          id: showId,
          name: showName,
          showEpisodeCount,
          showSeasonCount,
          imagePath: showPosterPath,
          genres: genres || [],
        },
        {
          seasonNumber,
          seasonPosterPath: seasonPosterPath || null,
          seasonEpisodes,
        },
        [
          {
            episodeNumber,
            episodePosterPath: episodePosterPath || null,
            episodeName: episodeName || "Unknown",
            episodeRatings: episodeRatings || 0,
            episodeMinutes: episodeMinutes || 0,
          },
        ],
        episodeDate,
      );
    } catch (error) {
      console.error(i18nText("autoI18n.hata_3", "Hata:"), error);
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
            source={require("@lottie/loading15.json")}
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
          >{i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}</Text>
          <Text
            style={[
              styles.sheetSubtitle,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
          >{i18nText("autoI18n.bu_bolumu_ne_zaman_izlediniz", "Bu bölümü ne zaman izlediniz?")}</Text>

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
              >{i18nText("autoI18n.tarih_sec", "Tarih Seç")}</Text>
              <Text
                style={[
                  styles.optionDate,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                {selectedDate ? formatDate(selectedDate) : i18nText("autoI18n.gun_seciniz", "Gün seçiniz")}
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
              >{i18nText("autoI18n.simdi", "Şimdi")}</Text>
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
              >{i18nText("autoI18n.yayin_tarihi", "Yayın Tarihi")}</Text>
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
            >{i18nText("autoI18n.iptal", "İptal")}</Text>
          </TouchableOpacity>

          <DatePickerModal
            visible={isDatePickerVisible}
            value={selectedDate || formatDateSave(new Date())}
            onConfirm={(iso) => handleConfirm(iso)}
            onClose={hideDatePicker}
            title={i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}
            subtitle={i18nText("autoI18n.bu_bolumu_ne_zaman_izlediniz", "Bu bölümü ne zaman izlediniz?")}
            confirmLabel="Tarihi Onayla"
            minDate={showReleaseDateTime}
            maxDate={new Date()}
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
