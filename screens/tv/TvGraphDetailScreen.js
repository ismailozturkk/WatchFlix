import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Skeleton from "../../components/SkeletonGraph";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import LottieView from "lottie-react-native";
import { useTheme } from "../../context/ThemeContext";
import { useAppSettings } from "../../context/AppSettingsContext";

// ─── Rating Renk Sistemi ──────────────────────────────────────────────────────
const RATING_TIERS = [
  { min: 9, bg: "rgb(0, 88, 74)", text: "#fff" },
  { min: 8, bg: "rgb(41, 184, 100)", text: "#000" },
  { min: 7, bg: "rgba(119, 255, 171, 1)", text: "#000" },
  { min: 6, bg: "rgb(255, 255, 0)", text: "#000" },
  { min: 5, bg: "rgb(255, 100, 0)", text: "#000" },
  { min: 4, bg: "rgb(255, 0, 0)", text: "#fff" },
  { min: -Infinity, bg: "rgb(99, 0, 204)", text: "#fff" },
];

const getRatingColors = (rating) => {
  const tier =
    RATING_TIERS.find((t) => rating >= t.min) ??
    RATING_TIERS[RATING_TIERS.length - 1];
  return { bg: tier.bg, text: tier.text };
};

// ─── Bölüm Hücresi (Memoize) ──────────────────────────────────────────────────
const EpisodeCell = React.memo(
  ({
    episode,
    seasonNumber,
    episodeIndex,
    isSelected,
    onPress,
    borderColor,
  }) => {
    const { bg, text } = getRatingColors(episode.vote_average);
    const rating = episode.vote_average
      ? episode.vote_average.toFixed(1)
      : "N/A";

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={[
          styles.cell,
          {
            backgroundColor: bg,
            borderWidth: 1.5,
            borderColor: isSelected ? "#fff" : borderColor,
            transform: [{ scale: isSelected ? 1.08 : 1 }],
          },
        ]}
      >
        <Text style={[styles.cellSeasonLabel, { color: text, opacity: 0.55 }]}>
          S{seasonNumber}
        </Text>
        <Text style={[styles.cellRating, { color: text }]}>{rating}</Text>
        <Text style={[styles.cellEpisodeLabel, { color: text, opacity: 0.55 }]}>
          E{episodeIndex + 1}
        </Text>
      </TouchableOpacity>
    );
  },
);

// ─── Skeleton Loading ─────────────────────────────────────────────────────────
const SkeletonLoading = ({ theme }) => (
  <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
    <View
      style={[styles.infoPanelContainer, { backgroundColor: theme.secondary }]}
    >
      <Skeleton
        width={90}
        height={130}
        style={{ borderRadius: 10, backgroundColor: theme.between }}
      />
      <View style={{ flex: 1, marginLeft: 14, gap: 10 }}>
        <Skeleton
          width={180}
          height={22}
          style={{ backgroundColor: theme.between, borderRadius: 6 }}
        />
        <Skeleton
          width={120}
          height={14}
          style={{ backgroundColor: theme.between, borderRadius: 6 }}
        />
        <Skeleton
          width={80}
          height={18}
          style={{ backgroundColor: theme.between, borderRadius: 6 }}
        />
        <Skeleton
          width={140}
          height={12}
          style={{ backgroundColor: theme.between, borderRadius: 6 }}
        />
      </View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ margin: 10 }}>
        {[...Array(12)].map((_, rowIndex) => (
          <View key={rowIndex} style={[styles.row, { gap: 0 }]}>
            {[...Array(7)].map((_, colIndex) => (
              <View
                key={colIndex}
                style={[styles.cell, { backgroundColor: theme.secondary }]}
              >
                <Skeleton
                  width={50}
                  height={50}
                  style={{ backgroundColor: theme.between, borderRadius: 8 }}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  </SafeAreaView>
);

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
const TvGraphDetailScreen = ({ route, navigation }) => {
  const { id } = route.params;
  const [showDetail, setShowDetail] = useState(null);
  const [tvShows, setTVShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  // { season: number, index: number } | null

  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { showSnow, imageQuality, API_KEY } = useAppSettings();

  // Animasyon ref'i – panel geçişi için
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Veri Çekme ────────────────────────────────────────────────────────────
  const fetchAllSeasons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tvShowResponse = await axios.get(
        `https://api.themoviedb.org/3/tv/${id}`,
        {
          params: {
            language: language === "tr" ? "tr-TR" : "en-US",
            append_to_response: "external_ids",
          },
          headers: { accept: "application/json", Authorization: API_KEY },
        },
      );

      const imdbId = tvShowResponse.data.external_ids?.imdb_id;
      let imdbMainInfo = {
        rating: tvShowResponse.data.vote_average,
        votes: tvShowResponse.data.vote_count,
      };

      if (imdbId) {
        try {
          const omdbMainRes = await axios.get(
            `https://www.omdbapi.com/?i=${imdbId}&apikey=38aaeabe`,
          );
          if (omdbMainRes.data.Response === "True") {
            imdbMainInfo = {
              rating:
                omdbMainRes.data.imdbRating !== "N/A"
                  ? parseFloat(omdbMainRes.data.imdbRating)
                  : tvShowResponse.data.vote_average,
              votes:
                omdbMainRes.data.imdbVotes || tvShowResponse.data.vote_count,
            };
          }
        } catch (e) {
          console.log("OMDb Ana Hata:", e);
        }
      }

      setShowDetail({
        ...tvShowResponse.data,
        vote_average: imdbMainInfo.rating,
        imdb_votes: imdbMainInfo.votes,
      });

      const validSeasons = tvShowResponse.data.seasons.filter(
        (s) => s.season_number !== 0,
      );

      const seasonPromises = validSeasons.map(async (season) => {
        const tmdbRes = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );

        let omdbEpisodes = [];
        if (imdbId) {
          try {
            const omdbRes = await axios.get(
              `https://www.omdbapi.com/?i=${imdbId}&Season=${season.season_number}&apikey=38aaeabe`,
            );
            omdbEpisodes = omdbRes.data.Episodes || [];
          } catch (e) {
            console.log("OMDb Sezon Hata:", e);
          }
        }

        const enrichedEpisodes = tmdbRes.data.episodes.map((ep) => {
          const omdbEp = omdbEpisodes.find(
            (o) => parseInt(o.Episode) === ep.episode_number,
          );
          return {
            ...ep,
            vote_average:
              omdbEp && omdbEp.imdbRating !== "N/A"
                ? parseFloat(omdbEp.imdbRating)
                : ep.vote_average,
          };
        });

        return { ...tmdbRes.data, episodes: enrichedEpisodes };
      });

      const seasonsData = await Promise.all(seasonPromises);
      setTVShows(seasonsData);
    } catch (err) {
      setError(err.message);
      console.error("Genel Hata:", err);
    } finally {
      setLoading(false);
    }
  }, [id, language, API_KEY]);

  useEffect(() => {
    fetchAllSeasons();
  }, [fetchAllSeasons]);

  // ── Bölüm Seçimi ─────────────────────────────────────────────────────────
  const handleEpisodePress = useCallback(
    (seasonNum, epIndex) => {
      const key = `${seasonNum}-${epIndex}`;
      const currentKey = selectedEpisode
        ? `${selectedEpisode.season}-${selectedEpisode.index}`
        : null;

      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (currentKey === key) {
        setSelectedEpisode(null);
      } else {
        setSelectedEpisode({ season: seasonNum, index: epIndex });
      }
    },
    [selectedEpisode, fadeAnim],
  );

  // ── Seçili Bölüm Verisi ───────────────────────────────────────────────────
  const selectedEpisodeData = useMemo(() => {
    if (!selectedEpisode) return null;
    const season = tvShows.find(
      (s) => s.season_number === selectedEpisode.season,
    );
    return season?.episodes[selectedEpisode.index] ?? null;
  }, [selectedEpisode, tvShows]);

  const maxEpisodes = useMemo(
    () => Math.max(...tvShows.map((s) => s.episodes.length), 0),
    [tvShows],
  );

  // ── Render Koşulları ──────────────────────────────────────────────────────
  if (loading) return <SkeletonLoading theme={theme} />;

  if (error) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme.primary,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={styles.errorTitle}>{t.mistake}</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAllSeasons}>
          <Text style={styles.retryButtonText}>{t.tryAgain}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      {/* Kar Efekti */}
      {showSnow && (
        <LottieView
          style={styles.lottie}
          source={require("../../LottieJson/snow.json")}
          autoPlay
          loop
        />
      )}

      {/* ── Üst Bilgi Paneli ─────────────────────────────────────────────── */}
      <View style={styles.infoPanelWrapper}>
        {/* Backdrop */}
        <Image
          source={{
            uri: selectedEpisodeData?.still_path
              ? `https://image.tmdb.org/t/p/${imageQuality.backdrop}${selectedEpisodeData.still_path}`
              : `https://image.tmdb.org/t/p/${imageQuality.backdrop}${showDetail.backdrop_path}`,
          }}
          style={styles.panelBackdrop}
          blurRadius={1}
        />
        <View style={styles.panelOverlay} />

        <Animated.View
          style={[styles.infoPanelContainer, { opacity: fadeAnim }]}
        >
          {/* Sol: Poster veya Bölüm Görseli */}
          <Image
            source={{
              uri: selectedEpisodeData?.still_path
                ? `https://image.tmdb.org/t/p/${imageQuality.poster}${selectedEpisodeData.still_path}`
                : `https://image.tmdb.org/t/p/${imageQuality.poster}${showDetail.poster_path}`,
            }}
            style={selectedEpisodeData ? styles.panelStill : styles.panelPoster}
          />

          {/* Sağ: Bilgiler */}
          <View style={styles.panelInfo}>
            {selectedEpisodeData ? (
              // ── Bölüm Bilgisi ──
              <>
                <View style={styles.panelBadgeRow}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: "rgba(255,255,255,0.15)" },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      S{selectedEpisode.season} · E{selectedEpisode.index + 1}
                    </Text>
                  </View>
                  {selectedEpisodeData.runtime > 0 && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: "rgba(255,255,255,0.1)" },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {selectedEpisodeData.runtime} {t.minutes}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.panelTitle} numberOfLines={2}>
                  {selectedEpisodeData.name}
                </Text>

                <Text style={styles.panelSubtitle}>
                  {selectedEpisodeData.air_date}
                </Text>

                {selectedEpisodeData.overview ? (
                  <Text style={styles.panelOverview} numberOfLines={2}>
                    {selectedEpisodeData.overview}
                  </Text>
                ) : null}

                <View style={styles.panelBottomRow}>
                  {selectedEpisodeData.vote_average > 0 && (
                    <View
                      style={[
                        styles.ratingBadge,
                        {
                          backgroundColor: getRatingColors(
                            selectedEpisodeData.vote_average,
                          ).bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingBadgeText,
                          {
                            color: getRatingColors(
                              selectedEpisodeData.vote_average,
                            ).text,
                          },
                        ]}
                      >
                        ★ {selectedEpisodeData.vote_average.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() =>
                      navigation.navigate("EpisodeDetails", {
                        showId: id,
                        seasonNumber: selectedEpisode.season,
                        episodeNumber: selectedEpisodeData.episode_number,
                      })
                    }
                  >
                    <Text style={styles.detailBtnText}>{t.detail} →</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // ── Dizi Bilgisi ──
              <>
                <Text style={styles.panelTitle} numberOfLines={2}>
                  {showDetail.name}
                </Text>
                <Text style={styles.panelSubtitle}>
                  {showDetail.first_air_date}
                  {" · "}
                  {showDetail.status === "Ended"
                    ? showDetail.last_air_date
                    : "Devam ediyor"}
                </Text>
                <View style={styles.panelBottomRow}>
                  <View style={styles.ratingBadge}>
                    <Text style={[styles.ratingBadgeText, { color: "#fff" }]}>
                      ★ {showDetail.vote_average.toFixed(1)}
                    </Text>
                  </View>
                  <Text style={styles.voteCount}>
                    {showDetail.imdb_votes} oy
                  </Text>
                </View>
                <Text style={styles.hintText}>
                  Bölüme dokun → bölüm bilgisi
                </Text>
              </>
            )}
          </View>

          {/* Seçili bölümü kapat */}
          {selectedEpisode && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 120,
                  useNativeDriver: true,
                }).start(() => {
                  setSelectedEpisode(null);
                  Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                  }).start();
                });
              }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* ── Değerlendirme Izgarası ────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40, paddingVertical: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          contentContainerStyle={{ paddingHorizontal: 12 }}
          showsHorizontalScrollIndicator={false}
        >
          <View style={{ minWidth: tvShows.length * 54 }}>
            {/* Sezon Başlık Satırı */}
            <View style={[styles.row, { marginBottom: 4 }]}>
              {tvShows.map((season) => (
                <View key={season.season_number} style={styles.seasonHeader}>
                  <Text style={styles.seasonHeaderText}>
                    S{season.season_number}
                  </Text>
                </View>
              ))}
            </View>

            {/* Bölüm Hücreleri */}
            {[...Array(maxEpisodes)].map((_, epIndex) => (
              <View key={epIndex} style={styles.row}>
                {tvShows.map((season) =>
                  season.episodes[epIndex] ? (
                    <EpisodeCell
                      key={season.season_number}
                      episode={season.episodes[epIndex]}
                      seasonNumber={season.season_number}
                      episodeIndex={epIndex}
                      isSelected={
                        selectedEpisode?.season === season.season_number &&
                        selectedEpisode?.index === epIndex
                      }
                      onPress={() =>
                        handleEpisodePress(season.season_number, epIndex)
                      }
                      borderColor={theme.primary}
                    />
                  ) : (
                    <View key={season.season_number} style={styles.emptyCell}>
                      <Text style={styles.emptyCellDot}>·</Text>
                    </View>
                  ),
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  lottie: {
    position: "absolute",
    top: 0,
    left: -60,
    right: -60,
    bottom: -200,
    zIndex: 0,
  },

  // ── Bilgi Paneli ────────────────────────────────────────────────────────
  infoPanelWrapper: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 18,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  panelBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  panelOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 10, 20, 0.72)",
  },
  infoPanelContainer: {
    flexDirection: "row",
    padding: 14,
    alignItems: "center",
    minHeight: 140,
  },
  panelPoster: {
    width: 82,
    height: 122,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  panelStill: {
    width: 120,
    height: 68,
    borderRadius: 10,
    backgroundColor: "#111",
    alignSelf: "center",
  },
  panelInfo: {
    flex: 1,
    marginLeft: 14,
    gap: 6,
  },
  panelBadgeRow: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 22,
  },
  panelSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  panelOverview: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 15,
  },
  panelBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  ratingBadge: {
    backgroundColor: "rgb(255,165,0)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ratingBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  voteCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  hintText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    fontStyle: "italic",
    marginTop: 2,
  },
  detailBtn: {
    backgroundColor: "rgba(129, 206, 254, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(129, 206, 254, 0.4)",
  },
  detailBtnText: {
    color: "#81cefe",
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Izgara ──────────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  seasonHeader: {
    width: 54,
    paddingVertical: 2,
    alignItems: "center",
  },
  seasonHeaderText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cell: {
    width: 50,
    height: 50,
    marginVertical: 2,
    marginHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },
  cellSeasonLabel: {
    position: "absolute",
    top: 3,
    left: 4,
    fontSize: 8,
    fontWeight: "700",
  },
  cellRating: {
    fontSize: 14,
    fontWeight: "800",
  },
  cellEpisodeLabel: {
    position: "absolute",
    bottom: 3,
    right: 4,
    fontSize: 8,
    fontWeight: "700",
  },
  emptyCell: {
    width: 50,
    height: 50,
    marginVertical: 2,
    marginHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCellDot: {
    color: "rgba(255,255,255,0.15)",
    fontSize: 24,
  },

  // ── Hata ────────────────────────────────────────────────────────────────
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#1a6b3c",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default TvGraphDetailScreen;
