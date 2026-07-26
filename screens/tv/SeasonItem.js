import React, { useState, useCallback, memo } from "react";
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
import axios from "axios";
import Toast from "react-native-toast-message";
import Reminder from "../../components/Reminder";
import { markSeason, removeTvWatchEvent } from "../../services/watchedTvService";
import WatchHistorySheet from "@components/modals/WatchHistorySheet";
import {
  getWatchState,
  isAired,
  WATCH_STATE,
  watchStateColor,
} from "../../utils/watchState";
import LottieView from "lottie-react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Octicons from "@expo/vector-icons/Octicons";
import RatingStars from "../../components/RatingStars";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import {
  useApiSettings,
  useImageQualitySettings,
} from "../../context/AppSettingsContext";
import { LinearGradient } from "expo-linear-gradient";
import DrumDatePickerModal from "@components/modals/DatePickerModal";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Entypo from "@expo/vector-icons/Entypo";
import { i18nText } from "../../utils/i18nText";

const { width } = Dimensions.get("window");

// ─── Puan rengi ───────────────────────────────────────────────────────────────
const getRatingColor = (r) => {
  if (r >= 8) return "#29b864";
  if (r >= 6) return "#f5c518";
  if (r >= 4) return "#ff6400";
  return "#e33";
};

// ─── Tarih Modal (ayrı memoize bileşen) ──────────────────────────────────────
const DatePickerModal = memo(
  ({
    visible,
    onClose,
    onDatePicker,
    onNow,
    onRelease,
    selectedDate,
    releaseDate,
    formatDate,
    theme,
    isDatePickerVisible,
    onConfirm,
    onCancelPicker,
    formatDateSave,
  }) => (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      transparent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={StyleSheet.absoluteFill}
        />
      </TouchableOpacity>

      <View style={[styles.sheet, { backgroundColor: theme.secondary }]}>
        <View
          style={[
            styles.handle,
            { backgroundColor: theme.border ?? "rgba(255,255,255,0.15)" },
          ]}
        />

        <Text
          style={[styles.sheetTitle, { color: theme.text?.primary ?? "#fff" }]}
        >
          {i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}
        </Text>
        <Text
          style={[
            styles.sheetSubtitle,
            { color: theme.text?.secondary ?? "#aaa" },
          ]}
        >
          {i18nText("autoI18n.bu_sezonu_ne_zaman_izlediniz", "Bu sezonu ne zaman izlediniz?")}
        </Text>

        <View style={styles.optionsRow}>
          {/* Tarih Seç */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: theme.primary }]}
            onPress={onDatePicker}
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
              {i18nText("autoI18n.tarih_sec", "Tarih Seç")}
            </Text>
            <Text
              style={[
                styles.optionDate,
                { color: theme.text?.secondary ?? "#aaa" },
              ]}
            >
              {selectedDate
                ? formatDate(selectedDate)
                : i18nText("autoI18n.gun_seciniz", "Gün seçiniz")}
            </Text>
          </TouchableOpacity>

          {/* Şimdi */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: theme.primary }]}
            onPress={onNow}
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
              {i18nText("autoI18n.simdi", "Şimdi")}
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
            onPress={onRelease}
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
              {i18nText("autoI18n.yayin_tarihi", "Yayın Tarihi")}
            </Text>
            <Text
              style={[
                styles.optionDate,
                { color: theme.text?.secondary ?? "#aaa" },
              ]}
            >
              {formatDate(releaseDate)}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.cancelBtn,
            { borderColor: theme.border ?? "rgba(255,255,255,0.1)" },
          ]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.cancelBtnText,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
          >
            {i18nText("autoI18n.iptal", "İptal")}
          </Text>
        </TouchableOpacity>

        <DrumDatePickerModal
          visible={isDatePickerVisible}
          value={
            selectedDate || (formatDateSave ? formatDateSave(new Date()) : "")
          }
          onConfirm={(iso) => onConfirm(iso)}
          onClose={onCancelPicker}
          title={i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}
          subtitle="Bu sezonu ne zaman izlediniz?"
          confirmLabel="Tarihi Onayla"
          minDate={releaseDate}
          maxDate={new Date()}
        />
      </View>
    </Modal>
  )
);

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
const SeasonItem = ({
  season,
  details,
  navigation,
  watchedCount = 0,
  watchEvents = [],
}) => {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { API_KEY } = useApiSettings();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  const [play, setPlay] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [watchHistoryVisible, setWatchHistoryVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const scaleValue = React.useRef(new Animated.Value(1)).current;
  const showReleaseDateTime = new Date(season.air_date);

  // İzlenme durumu — üstteki tek abonelikten gelen watchedCount'tan TÜRETİLİR.
  const totalEpisodes = season.episode_count || 0;
  const aired = isAired(season.air_date);
  const watchState = getWatchState({
    aired,
    watched: watchedCount,
    total: totalEpisodes,
  });
  const isWatched =
    watchState === WATCH_STATE.PARTIAL || watchState === WATCH_STATE.FULL;
  const seasonEpisodeWatch =
    totalEpisodes > 0 ? Math.min(1, watchedCount / totalEpisodes) : 0;

  // ── Animasyon ─────────────────────────────────────────────────────────────
  const onPressIn = useCallback(() => {
    Animated.timing(scaleValue, {
      toValue: 0.96,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [scaleValue]);

  const onPressOut = useCallback(() => {
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [scaleValue]);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const openModal = useCallback(() => setModalVisible(true), []);
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedDate(null);
  }, []);
  const showDatePicker = useCallback(() => setDatePickerVisibility(true), []);
  const hideDatePicker = useCallback(() => setDatePickerVisibility(false), []);

  const handleConfirm = useCallback(
    (date) => {
      // date artık ISO string ("YYYY-MM-DD") veya Date objesi olabilir
      const isoDate = typeof date === "string" ? date : formatDateSave(date);
      setSelectedDate(isoDate);
      addSeasonToFirestore(false, isoDate);
      hideDatePicker();
    },
    [hideDatePicker, formatDateSave]
  );

  // ── Tarih yardımcıları ────────────────────────────────────────────────────
  const formatDate = useCallback(
    (timestamp) =>
      new Intl.DateTimeFormat(language, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(timestamp)),
    [language]
  );

  const formatDateSave = useCallback((timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  }, []);

  // ── Firestore: sezon ekle / sil — kanonik servis (race-free) ─────────────
  const addSeasonToFirestore = useCallback(
    async (_isDelete = false, date = null) => {
      if (!user?.uid) return;
      try {
        setIsLoading(true);
        setModalVisible(false);

        if (!date) return;
        const response = await axios.get(
          `https://api.themoviedb.org/3/tv/${details.id}/season/${season.season_number}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: { accept: "application/json", Authorization: API_KEY },
          }
        );
        const episodeDate = formatDateSave(date);
        const episodesData = response.data.episodes.map((ep) => ({
          episodeNumber: ep.episode_number,
          episodePosterPath: ep.still_path,
          episodeName: ep.name,
          episodeRatings: parseFloat(ep.vote_average?.toFixed(1)) || 0,
          episodeMinutes: ep.runtime,
        }));
        await markSeason(
          user.uid,
          {
            id: details.id,
            name: details.name,
            showEpisodeCount: details.number_of_episodes,
            showSeasonCount: details.number_of_seasons,
            imagePath: details.poster_path,
            genres: details.genres ? details.genres.map((g) => g.name) : [],
          },
          {
            seasonNumber: season.season_number,
            seasonPosterPath: season.poster_path,
            seasonEpisodes: season.episode_count,
          },
          episodesData,
          episodeDate
        );
      } catch (e) {
        if (__DEV__)
          console.error(
            i18nText(
              "autoI18n.sezon_eklenirken_hata",
              "Sezon eklenirken hata:"
            ),
            e
          );
      } finally {
        setIsLoading(false);
      }
    },
    [user, details, season, language, API_KEY, formatDateSave]
  );

  // ── İzlenme buton rengi & ilerleme ────────────────────────────────────────
  const watchBtnColor = watchStateColor(watchState, theme);
  const progressColor =
    watchState === WATCH_STATE.FULL
      ? theme.colors?.green
      : theme.colors?.orange;
  const progressWidth = `${Math.round(seasonEpisodeWatch * 100)}%`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() =>
          navigation.navigate("SeasonDetails", {
            showId: details.id,
            seasonNumber: season.season_number,
            showName: details.name,
            showEpisodeCount: details.number_of_episodes,
            showSeasonCount: details.number_of_seasons,
            showPosterPath: details.poster_path,
            genres: details.genres ? details.genres.map((g) => g.name) : [],
          })
        }
      >
        <Animated.View
          style={[
            styles.seasonCard,
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
              {/* Havai fişek */}
              {season.id === play && (
                <>
                  <LottieView
                    style={[styles.fireworks, { left: "50%", right: 0 }]}
                    source={require("@lottie/6_fireworks.json")}
                    autoPlay
                    loop={false}
                  />
                  <LottieView
                    style={[styles.fireworks, { left: 0, right: "50%" }]}
                    source={require("@lottie/6_fireworks.json")}
                    autoPlay
                    loop={false}
                  />
                </>
              )}

              {/* ── Poster ─────────────────────────────────────────────── */}
              {season.poster_path ? (
                <View style={styles.posterWrapper}>
                  <Image
                    source={{
                      uri: getTmdbUrl(season.poster_path, "poster", 200),
                    }}
                    style={styles.seasonPoster}
                  />
                  {/* Poster sağ kenar gradyanı – kart rengiyle yatay kaynaşma */}
                  <LinearGradient
                    colors={["transparent", theme.secondary]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    locations={[0.1, 1]}
                    style={styles.posterGradient}
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.noPosterBox,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Ionicons
                    name="image-outline"
                    size={36}
                    color={theme.text?.muted ?? "#555"}
                  />
                </View>
              )}

              {/* ── Sağ: Bilgiler ──────────────────────────────────────── */}
              <View style={styles.infoCol}>
                {/* Başlık + izlenme butonu */}
                <View style={styles.infoTopRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={[
                        styles.seasonTitle,
                        { color: theme.text?.primary ?? "#fff" },
                      ]}
                      numberOfLines={1}
                    >
                      {season.name}
                    </Text>
                    <Text
                      style={[
                        styles.seasonMeta,
                        { color: theme.text?.secondary ?? "#aaa" },
                      ]}
                    >
                      {season.episode_count
                        ? `${season.episode_count} ${t.episode}`
                        : t.episodeCountUnknown}
                      {season.air_date
                        ? `  ·  ${formatDate(season.air_date)}`
                        : ""}
                    </Text>
                  </View>

                  {/* İzlenme / Ekle / Hatırlat butonu (4 durum) */}
                  <View style={styles.watchBtn}>
                    {isLoading ? (
                      <LottieView
                        source={require("@lottie/loading15.json")}
                        style={{ width: 32, height: 32 }}
                        autoPlay
                        loop
                      />
                    ) : watchState === WATCH_STATE.UNAIRED ? (
                      // Sezon henüz yayınlanmadı → çan / Hatırlat (premiyer)
                      <Reminder
                        showId={details.id}
                        showName={details.name}
                        showPosterPath={details.poster_path}
                        seasonNumber={season.season_number}
                        episodeNumber={1}
                        episodeName={season.name}
                        airDate={season.air_date}
                        seasonPosterPath={season.poster_path}
                        type="tv"
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() =>
                          isWatched ? setWatchHistoryVisible(true) : openModal()
                        }
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {isWatched ? (
                          <Octicons
                            name="check-circle-fill"
                            size={26}
                            color={watchBtnColor}
                          />
                        ) : (
                          <FontAwesome6
                            name="circle-plus"
                            size={26}
                            color={theme.text?.secondary ?? "#aaa"}
                          />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Puan */}
                {season.vote_average > 0 ? (
                  <View style={styles.ratingRow}>
                    <View
                      style={[
                        styles.ratingPill,
                        {
                          borderColor:
                            getRatingColor(season.vote_average) + "55",
                          backgroundColor:
                            getRatingColor(season.vote_average) + "18",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingPillText,
                          { color: getRatingColor(season.vote_average) },
                        ]}
                      >
                        ★ {season.vote_average.toFixed(1)}
                      </Text>
                    </View>
                    <RatingStars rating={season.vote_average} />
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.notRatedText,
                      { color: theme.text?.muted ?? "#555" },
                    ]}
                  >
                    {t.notYetRated}
                  </Text>
                )}

                {/* Özet */}
                <Text
                  style={[
                    styles.overviewText,
                    { color: theme.text?.secondary ?? "#aaa" },
                  ]}
                  numberOfLines={2}
                >
                  {season.overview || t.noOverviewAvailable}
                </Text>
              </View>

              {/* ── İlerleme çubuğu – kart alt kenarı ─────────────────── */}
              {seasonEpisodeWatch > 0 && (
                <View pointerEvents="none" style={styles.progressClipLayer}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: progressWidth,
                          backgroundColor: progressColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </>
          ) : (
            /* Henüz tarihi belli olmayan sezon */
            <View style={styles.comingSoonBox}>
              <Text
                style={[
                  styles.comingSoonTitle,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                {i18nText("autoI18n.yeni_sezon_geliyor", "Yeni Sezon Geliyor")}
              </Text>
              <Text
                style={[
                  styles.comingSoonSub,
                  { color: theme.text?.muted ?? "#555" },
                ]}
              >
                {i18nText("autoI18n.tarih_belirsiz", "Tarih Belirsiz")}
              </Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* ── Tarih Modal ──────────────────────────────────────────────────── */}
      <WatchHistorySheet
        visible={watchHistoryVisible}
        onClose={() => setWatchHistoryVisible(false)}
        title={`${details?.name || ""} · ${season.season_number}. ${i18nText("autoI18n.sezon", "Sezon")}`}
        events={watchEvents}
        busy={isLoading}
        onAddAgain={() => {
          setWatchHistoryVisible(false);
          setTimeout(openModal, 180);
        }}
        onDeleteEvent={async (event) => {
          if (!user?.uid || !event?.id) return;
          try {
            setIsLoading(true);
            await removeTvWatchEvent(user.uid, details.id, event.id);
            Toast.show({
              type: "success",
              text1: i18nText("autoI18n.izleme_kaydi_silindi", "Seçilen izleme kaydı silindi."),
            });
            if (watchEvents.length <= 1) setWatchHistoryVisible(false);
          } catch (error) {
            Toast.show({ type: "error", text1: i18nText("autoI18n.hata_2", "Hata: ") + error.message });
          } finally {
            setIsLoading(false);
          }
        }}
      />

      <DatePickerModal
        visible={modalVisible}
        onClose={closeModal}
        onDatePicker={showDatePicker}
        onNow={() => addSeasonToFirestore(false, new Date())}
        onRelease={() => addSeasonToFirestore(false, showReleaseDateTime)}
        selectedDate={selectedDate}
        releaseDate={showReleaseDateTime}
        formatDate={formatDate}
        theme={theme}
        isDatePickerVisible={isDatePickerVisible}
        onConfirm={handleConfirm}
        onCancelPicker={hideDatePicker}
        formatDateSave={formatDateSave}
      />
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Sezon Kartı ───────────────────────────────────────────────────────────
  seasonCard: {
    height: 120,
    flexDirection: "row",
    borderRadius: 16,
    marginVertical: 18,
    overflow: "visible", // poster top:-15 taşması için
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  fireworks: {
    position: "absolute",
    height: 150,
    top: 0,
    zIndex: 5,
  },

  // ── Poster ────────────────────────────────────────────────────────────────
  posterWrapper: {
    width: 88,
    height: 148, // top:-15 + 120 kart + 13 alt taşma = 148
    marginTop: -14, // kartın üstüne taşır (orijinal efekt)
    borderRadius: 12,
    overflow: "hidden", // köşeleri kırp
    position: "relative",
    // gölge
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  seasonPoster: {
    width: "100%",
    height: "100%",
    resizeMode: "cover", // poster doldurucu
  },
  posterGradient: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 32, // biraz daha geniş geçiş
  },
  noPosterBox: {
    width: 88,
    height: 148,
    marginTop: -14,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Bilgi Kolonu ──────────────────────────────────────────────────────────
  infoCol: {
    flex: 1,
    marginLeft: 4,
    paddingRight: 12,
    paddingVertical: 8,
    justifyContent: "space-between",
  },
  infoTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  seasonTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  seasonMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  watchBtn: {
    marginTop: 2,
  },

  // ── Puan ──────────────────────────────────────────────────────────────────
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  ratingPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  ratingPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  notRatedText: {
    fontSize: 11,
    marginBottom: 4,
  },

  // ── Özet ──────────────────────────────────────────────────────────────────
  overviewText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "300",
  },

  // ── İlerleme çubuğu ───────────────────────────────────────────────────────
  progressClipLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: "hidden",
    zIndex: 4,
  },
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 92, // posterWrapper genişliği + marginLeft
    right: 0,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },

  // ── Coming Soon ───────────────────────────────────────────────────────────
  comingSoonBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  comingSoonSub: {
    fontSize: 12,
  },

  // ── Modal / Bottom Sheet ───────────────────────────────────────────────────
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

// memo: TvShowsDetails her re-render olduğunda tüm sezon kartlarının
// yeniden çizilmesini engeller (props referansları stabil).
export default memo(SeasonItem);
