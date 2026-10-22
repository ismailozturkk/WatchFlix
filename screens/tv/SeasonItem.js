import React, { useState, useCallback, memo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import Toast from "@components/AppToast";
import Reminder from "../../components/Reminder";
import { markSeasonWatched, removeTvWatch } from "../../services/libraryActions";
import { showLibraryError, showWatchSpreadNotice } from "../../utils/libraryErrorText";
import WatchHistorySheet from "@components/modals/WatchHistorySheet";
import WatchedDateSheet from "@components/detail/WatchedDateSheet";
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
import { i18nText } from "../../utils/i18nText";

// ─── Puan rengi ───────────────────────────────────────────────────────────────
const getRatingColor = (r) => {
  if (r >= 8) return "#29b864";
  if (r >= 6) return "#f5c518";
  if (r >= 4) return "#ff6400";
  return "#e33";
};

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
  const { getTmdbUrl } = useImageQualitySettings();

  const [play] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [watchHistoryVisible, setWatchHistoryVisible] = useState(false);

  const scaleValue = React.useRef(new Animated.Value(1)).current;
  const showReleaseDateTime = season.air_date || null;

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
  const closeModal = useCallback(() => setModalVisible(false), []);

  // Kart başlığının yanında kullanılan kısa tarih ("5 Oca 2020") — uzun ay
  // adları tek satırlık başlık satırını taşırıyordu.
  const formatDateShort = useCallback(
    (timestamp) => {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat(language, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
    },
    [language]
  );

  // ── Sezonu izlendi işaretle — tek kapı: services/libraryActions ───────────
  // Sezonun bölümlerini TMDB'den çekme, yayınlanmamış bölümleri eleme, sıralı
  // yazma ve hata sınıflaması orada; burada yalnız arayüz durumu var.
  const addSeasonToFirestore = useCallback(
    async (_isDelete = false, date = null) => {
      if (!user?.uid || !date) return;
      try {
        setIsLoading(true);
        const watchResult = await markSeasonWatched({
          uid: user.uid,
          details,
          season,
          watchDate: date,
          apiKey: API_KEY,
          language,
        });
        const { status } = watchResult;
        if (status === "empty-season") {
          Toast.show({
            type: "warning",
            text1: i18nText(
              "autoI18n.bolum_bilgisi_bulunamadi",
              "Bu dizinin bölüm bilgisi bulunamadı.",
            ),
          });
          return;
        }
        setModalVisible(false);
        if (!showWatchSpreadNotice(watchResult)) {
          Toast.show({
            type: "success",
            text1: i18nText(
              "autoI18n.sezon_izlendi_olarak_isaretlendi",
              "Sezon izlendi olarak işaretlendi.",
            ),
          });
        }
      } catch (e) {
        // Sessiz kalınırsa kullanıcı sezonu işaretlediğini sanıp ekrandan
        // çıkıyor; aynı dosyadaki onDeleteEvent ile aynı geri bildirim.
        showLibraryError(e, { source: "season_item_mark" });
      } finally {
        setIsLoading(false);
      }
    },
    [user, details, season, language, API_KEY]
  );

  // ── İzlenme buton rengi & ilerleme ────────────────────────────────────────
  const watchBtnColor = watchStateColor(watchState, theme);
  const progressColor =
    watchState === WATCH_STATE.FULL
      ? theme.colors?.green
      : theme.colors?.orange;
  const progressWidth = `${Math.round(seasonEpisodeWatch * 100)}%`;

  // Başlığın yanına gelen tek satırlık bilgi: "10 Bölüm · 5 Oca 2020"
  const seasonMetaText = [
    season.episode_count
      ? `${season.episode_count} ${t.episode}`
      : t.episodeCountUnknown,
    season.air_date ? formatDateShort(season.air_date) : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
                {/* Başlık + bölüm/tarih (tek satır) + izlenme butonu */}
                <View style={styles.infoTopRow}>
                  <View style={styles.titleRow}>
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.seasonTitle,
                        { color: theme.text?.primary ?? "#fff" },
                      ]}
                      numberOfLines={1}
                    >
                      {season.name}
                    </Text>
                    {!!seasonMetaText && (
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.seasonMeta,
                          { color: theme.text?.secondary ?? "#aaa" },
                        ]}
                        numberOfLines={1}
                      >
                        {`· ${seasonMetaText}`}
                      </Text>
                    )}
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
                        allowFontScaling={false}
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
                    allowFontScaling={false}
                    style={[
                      styles.notRatedText,
                      { color: theme.text?.muted ?? "#555" },
                    ]}
                    numberOfLines={1}
                  >
                    {t.notYetRated}
                  </Text>
                )}

                {/* Özet */}
                <Text
                  allowFontScaling={false}
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
          setTimeout(openModal, 300);
        }}
        onDeleteEvent={async (event) => {
          if (!user?.uid || !event?.id) return;
          try {
            setIsLoading(true);
            await removeTvWatch({ uid: user.uid, showId: details.id, eventId: event.id });
            Toast.show({
              type: "success",
              text1: i18nText("autoI18n.izleme_kaydi_silindi", "Seçilen izleme kaydı silindi."),
            });
            if (watchEvents.length <= 1) setWatchHistoryVisible(false);
          } catch (error) {
            showLibraryError(error, { source: "season_item_remove_watch" });
          } finally {
            setIsLoading(false);
          }
        }}
      />

      <WatchedDateSheet
        visible={modalVisible}
        onClose={closeModal}
        subtitle={`${details?.name || ""} · ${season.season_number}. ${i18nText("autoI18n.sezon", "Sezon")}`}
        pickerSubtitle={i18nText(
          "autoI18n.bu_sezonu_ne_zaman_izlediniz",
          "Bu sezonu ne zaman izlediniz?",
        )}
        releaseDate={showReleaseDateTime}
        minDate={showReleaseDateTime}
        mediaType="tv"
        scope="season"
        busy={isLoading}
        onConfirm={(date) => addSeasonToFirestore(false, date)}
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
    alignItems: "center",
    marginBottom: 4,
  },
  // Sezon adı + bölüm/tarih aynı satırda; ikisi de daralabilir, uzun
  // isimler/ay adları satırı taşırmak yerine "…" ile kırpılır.
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    gap: 5,
  },
  seasonTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  seasonMeta: {
    fontSize: 11,
    lineHeight: 15,
    flexShrink: 1,
  },
  watchBtn: {
    marginTop: 0,
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
    ...StyleSheet.absoluteFill,
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

});

// memo: TvShowsDetails her re-render olduğunda tüm sezon kartlarının
// yeniden çizilmesini engeller (props referansları stabil).
export default memo(SeasonItem);
