import { TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../../context/AuthContext";
import { markEpisodeWatched, removeTvWatch } from "../../services/libraryActions";
import { showLibraryError } from "../../utils/libraryErrorText";
import WatchHistorySheet from "@components/modals/WatchHistorySheet";
import WatchedDateSheet from "@components/detail/WatchedDateSheet";
import Toast from "@components/AppToast";
import { useTheme } from "../../context/ThemeContext";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import LottieView from "lottie-react-native";
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
  watchEvents = [],
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  // TMDB henüz yayınlanmamış bölümlerde air_date'i null döner. `new Date(null)`
  // Invalid Date değil, epoch (1970-01-01) üretir; korumasız bırakılırsa
  // "Yayın Tarihi" kutusu "1 Ocak 1970" gösterir ve dokunulunca Firestore'a
  // dateAdded: "1970-01-01" yazılır. undefined ise Intl.format doğrudan atar.
  const [modalVisible, setModalVisible] = useState(false);
  const [watchHistoryVisible, setWatchHistoryVisible] = useState(false);

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  // Bölümü izlendi işaretle — tek kapı: services/libraryActions (sıralı yazma:
  // art arda bölüm işaretleme aynı belgede yarışmaz).
  const markEpisodeAsWatched = async (date = null) => {
    if (!user?.uid || !date) return;
    try {
      setIsLoading(true);
      await markEpisodeWatched({
        uid: user.uid,
        showMeta: {
          id: showId,
          name: showName,
          showEpisodeCount,
          showSeasonCount,
          imagePath: showPosterPath,
          genres: genres || [],
        },
        seasonMeta: {
          seasonNumber,
          seasonPosterPath: seasonPosterPath || null,
          seasonEpisodes,
        },
        episode: {
          episodeNumber,
          episodePosterPath: episodePosterPath || null,
          episodeName: episodeName || "Unknown",
          episodeRatings: episodeRatings || 0,
          episodeMinutes: episodeMinutes || 0,
          releaseDate: showReleaseDate || null,
        },
        watchDate: date,
      });
      closeModal();
      Toast.show({
        type: "success",
        text1: i18nText(
          "autoI18n.bolum_izlendi_olarak_isaretlendi",
          "Bölüm izlendi olarak işaretlendi.",
        ),
      });
    } catch (error) {
      showLibraryError(error, { source: "watched_add_episode" });
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
            setWatchHistoryVisible(true);
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

      <WatchedDateSheet
        visible={modalVisible}
        onClose={closeModal}
        subtitle={`${showName || ""} · S${seasonNumber} B${episodeNumber}`}
        pickerSubtitle={i18nText(
          "autoI18n.bu_bolumu_ne_zaman_izlediniz",
          "Bu bölümü ne zaman izlediniz?",
        )}
        releaseDate={showReleaseDate || undefined}
        minDate={showReleaseDate || undefined}
        mediaType="tv"
        scope="episode"
        busy={isLoading}
        onConfirm={markEpisodeAsWatched}
      />

      <WatchHistorySheet
        visible={watchHistoryVisible}
        onClose={() => setWatchHistoryVisible(false)}
        title={`${showName || ""} · S${seasonNumber} B${episodeNumber}`}
        events={watchEvents}
        busy={isLoading}
        onAddAgain={() => {
          setWatchHistoryVisible(false);
          setTimeout(openModal, 300);
        }}
        onDeleteEvent={async (event) => {
          if (!user?.uid || !event?.id) return;
          try {
            setIsLoading(true);
            await removeTvWatch({ uid: user.uid, showId, eventId: event.id });
            Toast.show({
              type: "success",
              text1: i18nText("autoI18n.izleme_kaydi_silindi", "Seçilen izleme kaydı silindi."),
            });
            if (watchEvents.length <= 1) setWatchHistoryVisible(false);
          } catch (error) {
            showLibraryError(error, { source: "watched_add_remove_watch" });
          } finally {
            setIsLoading(false);
          }
        }}
      />
    </View>
  );
}

