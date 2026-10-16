import { tmdbLanguageOf } from "../../utils/appLanguages";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Skeleton from "../../components/SkeletonGraph";
import axios from "axios";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { getRatingColors } from "../../utils/ratingColors";
import { TV_GRAPH_GRID_SIZES } from "../../utils/tvGraphGrid";

import {
  useApiSettings,
  useImageQualitySettings,
} from "../../context/AppSettingsContext";
import ScreenDecor from "../../components/ScreenDecor";

// ─── Rating Renk Sistemi ──────────────────────────────────────────────────────
// Ortak katmanlar utils/ratingColors.js'te — story "Bölüm Graph" bloğu da kullanır.

// ─── Izgara Boyutları ─────────────────────────────────────────────────────────
// default/compact: bilgileri hücre içinde gösterir. heatmap: yalnız renk;
// sezonlar üstte, bölümler solda. Sütun genişliği = cell + 2×margin.
//
// BOŞLUK ORANA BAĞLI: `margin` sabit 2 dp yazılıydı, yani kompakt görünümde
// kareler %28 küçülürken aralarındaki boşluk aynı kalıyor ve ızgara
// seyrekleşmiş görünüyordu. Artık boşluk da hücreyle aynı oranda küçülür —
// görünüm yalnızca ÖLÇEKLENİR.
const GRID_SIZES = TV_GRAPH_GRID_SIZES;

// ─── Bölüm Hücresi (Memoize) ──────────────────────────────────────────────────
const EpisodeCell = React.memo(
  ({
    episode,
    seasonNumber,
    episodeIndex,
    isSelected,
    onPress,
    borderColor,
    grid,
  }) => {
    const { bg, text } = getRatingColors(episode.vote_average);
    const rating = episode.vote_average
      ? episode.vote_average.toFixed(1)
      : "N/A";

    // Koordinatlar hücrenin kendi içinde bağlanır — böylece ızgara `onPress`e
    // her render'da yeni bir arrow geçirmek zorunda kalmaz ve memo tutar.
    const handlePress = useCallback(
      () => onPress(seasonNumber, episodeIndex),
      [onPress, seasonNumber, episodeIndex],
    );

    return (
      <TouchableOpacity
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${i18nText("season", "Sezon")} ${seasonNumber}, ${i18nText("episode", "Bölüm")} ${episodeIndex + 1}, ${i18nText("rating", "Puan")} ${rating}`}
        accessibilityState={{ selected: isSelected }}
        activeOpacity={0.75}
        style={[
          styles.cell,
          {
            width: grid.cell,
            height: grid.cell,
            marginVertical: grid.margin,
            marginHorizontal: grid.margin,
            borderRadius: grid.radius,
            backgroundColor: bg,
            borderWidth: 1.5,
            borderColor: isSelected ? "#fff" : borderColor,
            transform: [{ scale: isSelected ? 1.08 : 1 }],
          },
        ]}
      >
        {!grid.colorOnly && <>
        <Text
          style={[
            styles.cellSeasonLabel,
            {
              color: text,
              opacity: 0.55,
              fontSize: grid.label,
              top: grid.labelOffset,
              left: grid.labelOffset + 1,
            },
          ]}
        >
          S{seasonNumber}
        </Text>
        <Text style={[styles.cellRating, { color: text, fontSize: grid.rating }]}>
          {rating}
        </Text>
        <Text
          style={[
            styles.cellEpisodeLabel,
            {
              color: text,
              opacity: 0.55,
              fontSize: grid.label,
              bottom: grid.labelOffset,
              right: grid.labelOffset + 1,
            },
          ]}
        >
          E{episodeIndex + 1}
        </Text>
        </>}
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
  const [gridMode, setGridMode] = useState("default");
  const [renderGridMode, setRenderGridMode] = useState("default");
  const grid = GRID_SIZES[renderGridMode];
  const colWidth = grid.cell + grid.margin * 2; // hücre + iki yandaki boşluk
  const autoGridRef = useRef(false);
  const gridChangeHandleRef = useRef(null);

  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const { API_KEY } = useApiSettings();

  // Animasyon ref'i – panel geçişi için
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Veri Çekme ────────────────────────────────────────────────────────────
  // Bu ekran N+1 istek yapıyor (dizi + her sezon + OMDb). fetchAllSeasons hem
  // effect'ten hem "tekrar dene" düğmesinden çağrıldığı için düz bir `cancelled`
  // bayrağı yetmiyor; çalışma jetonu ile eski zincirler bayatlatılıyor. Aksi
  // hâlde dil değişince geciken eski yanıt yeni veriyi eziyor ve unmount
  // sonrası setState yapılıyordu.
  const runIdRef = useRef(0);

  const fetchAllSeasons = useCallback(async () => {
    const runId = ++runIdRef.current;
    const isStale = () => runId !== runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const tvShowResponse = await axios.get(
        `https://api.themoviedb.org/3/tv/${id}`,
        {
          params: {
            language: tmdbLanguageOf(language),
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
          console.log(i18nText("autoI18n.omdb_ana_hata", "OMDb Ana Hata:"), e);
        }
      }

      if (isStale()) return;
      setShowDetail({
        ...tvShowResponse.data,
        vote_average: imdbMainInfo.rating,
        imdb_votes: imdbMainInfo.votes,
      });

      const validSeasons = tvShowResponse.data.seasons.filter(
        (s) => s.season_number !== 0,
      );

      // ── Otomatik ızgara boyutu (ilk yükleme) ──
      // ≤7 sezon → default, 8–11 → compact, >11 → heatmap
      if (!autoGridRef.current) {
        autoGridRef.current = true;
        const count = validSeasons.length;
        const autoMode =
          count <= 7 ? "default" : count <= 11 ? "compact" : "heatmap";
        setGridMode(autoMode);
        setRenderGridMode(autoMode);
      }

      const seasonPromises = validSeasons.map(async (season) => {
        const tmdbRes = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}`,
          {
            params: { language: tmdbLanguageOf(language) },
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
            console.log(i18nText("autoI18n.omdb_sezon_hata", "OMDb Sezon Hata:"), e);
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
      if (isStale()) return;
      setTVShows(seasonsData);
    } catch (err) {
      if (!isStale()) setError(err.message);
      console.error(i18nText("autoI18n.genel_hata", "Genel Hata:"), err);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [id, language, API_KEY]);

  useEffect(() => {
    fetchAllSeasons();
    // Dil/id değişince ya da ekran kapanınca süren zinciri bayatlat.
    return () => {
      runIdRef.current++;
      // Bekleyen boyut değişimini iptal et
      if (gridChangeHandleRef.current) {
        gridChangeHandleRef.current.cancel();
        gridChangeHandleRef.current = null;
      }
    };
  }, [fetchAllSeasons]);

  // ── Bölüm Seçimi ─────────────────────────────────────────────────────────
  // selectedEpisode'a bağımlı kalırsa her seçimde kimlik değişir ve ızgaradaki
  // yüzlerce EpisodeCell yeniden render edilir; functional updater ile sabit.
  const handleEpisodePress = useCallback(
    (seasonNum, epIndex) => {
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

      setSelectedEpisode((prev) =>
        prev && prev.season === seasonNum && prev.index === epIndex
          ? null
          : { season: seasonNum, index: epIndex },
      );
    },
    [fadeAnim],
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
  const rowLabelWidth = grid.showAxes ? Math.max(30, 12 + String(maxEpisodes).length * 6) : 0;
  const gridOptions = [
    { key: "default", icon: "expand-outline", label: t.tvGraphGrid.standard },
    { key: "compact", icon: "contract-outline", label: t.tvGraphGrid.compact },
    { key: "heatmap", icon: "grid-outline", label: t.tvGraphGrid.heatmap },
  ];

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
      <ScreenDecor scope="details" iconOpacity={0.25} />

      {/* ── Üst Bilgi Paneli ─────────────────────────────────────────────── */}
      <View style={styles.infoPanelWrapper}>
        {/* Backdrop */}
        <Image
          source={{
            uri: selectedEpisodeData?.still_path
              ? getTmdbUrl(selectedEpisodeData.still_path, 'backdrop', 1000)
              : getTmdbUrl(showDetail.backdrop_path, 'backdrop', 1000),
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
                ? getTmdbUrl(selectedEpisodeData.still_path, 'poster', 200)
                : getTmdbUrl(showDetail.poster_path, 'poster', 200),
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
                    onPress={() => {
                      // EpisodeDetails bu meta'yı WatchedAdd → markEpisodes'a
                      // iletir; eksik gönderilirse ilk işaretlemede watchedTv
                      // dokümanı boş adla/0 bölüm sayısıyla oluşur ve sonraki
                      // işaretlemeler bu meta'yı bir daha onarmaz.
                      const seasonMeta = showDetail?.seasons?.find(
                        (s) => s.season_number === selectedEpisode.season,
                      );
                      navigation.navigate("EpisodeDetails", {
                        showId: id,
                        seasonNumber: selectedEpisode.season,
                        episodeNumber: selectedEpisodeData.episode_number,
                        showName: showDetail?.name || "",
                        showEpisodeCount: showDetail?.number_of_episodes || 0,
                        showSeasonCount: showDetail?.number_of_seasons || 0,
                        seasonEpisodes: seasonMeta?.episode_count || 0,
                        showPosterPath: showDetail?.poster_path || null,
                        seasonPosterPath: seasonMeta?.poster_path || null,
                        genres: showDetail?.genres?.map((g) => g.name) || [],
                      });
                    }}
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
                    : i18nText("autoI18n.devam_ediyor", "Devam ediyor")}
                </Text>
                <View style={styles.panelBottomRow}>
                  <View style={styles.ratingBadge}>
                    <Text style={[styles.ratingBadgeText, { color: "#fff" }]}>
                      ★ {showDetail.vote_average.toFixed(1)}
                    </Text>
                  </View>
                  <Text style={styles.voteCount}>
                    {showDetail.imdb_votes} {i18nText("votes", "oy")}
                  </Text>
                </View>
                <Text style={styles.hintText}>{i18nText("autoI18n.bolume_dokun_bolum_bilgisi", "Bölüme dokun → bölüm bilgisi")}</Text>
              </>
            )}
          </View>

          <View style={[styles.gridSizeControls, selectedEpisode && { top: 44 }]}>
            {gridOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.gridSizeBtn,
                  gridMode === option.key && {
                    backgroundColor: theme.accent,
                    borderColor: "rgba(255,255,255,0.8)",
                  },
                ]}
                onPress={() => {
                  if (gridChangeHandleRef.current) {
                    gridChangeHandleRef.current.cancel();
                  }
                  setGridMode(option.key);
                  gridChangeHandleRef.current =
                    InteractionManager.runAfterInteractions(() => {
                      setRenderGridMode(option.key);
                      gridChangeHandleRef.current = null;
                    });
                }}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: gridMode === option.key }}
                hitSlop={3}
              >
                <Ionicons name={option.icon} size={16} color="#fff" />
              </TouchableOpacity>
            ))}
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
          <View style={{ minWidth: rowLabelWidth + tvShows.length * colWidth }}>
            {/* Sezon Başlık Satırı */}
            {grid.showAxes && (
            <View style={[styles.row, { marginBottom: grid.margin * 2 }]}>
              <View style={{ width: rowLabelWidth }} />
              {tvShows.map((season) => (
                <View
                  key={season.season_number}
                  style={[styles.seasonHeader, { width: colWidth }]}
                >
                  <Text
                    style={[
                      styles.seasonHeaderText,
                      { fontSize: grid.headerFont, color: theme.text.secondary },
                    ]}
                  >
                    {t.season[0]}{season.season_number}
                  </Text>
                </View>
              ))}
            </View>
            )}

            {/* Bölüm Hücreleri */}
            {[...Array(maxEpisodes)].map((_, epIndex) => (
              <View key={epIndex} style={styles.row}>
                {grid.showAxes && (
                  <View style={[styles.episodeHeader, { width: rowLabelWidth, height: colWidth }]}>
                    <Text
                      numberOfLines={1}
                      style={[styles.seasonHeaderText, { fontSize: grid.headerFont, color: theme.text.secondary }]}
                    >
                      {t.episode[0]}{epIndex + 1}
                    </Text>
                  </View>
                )}
                {tvShows.map((season) =>
                  season.episodes[epIndex] ? (
                    <EpisodeCell
                      key={season.season_number}
                      episode={season.episodes[epIndex]}
                      seasonNumber={season.season_number}
                      episodeIndex={epIndex}
                      grid={grid}
                      isSelected={
                        selectedEpisode?.season === season.season_number &&
                        selectedEpisode?.index === epIndex
                      }
                      onPress={handleEpisodePress}
                      borderColor={theme.primary}
                    />
                  ) : (
                    <View
                      key={season.season_number}
                      style={[
                        styles.emptyCell,
                        {
                          width: grid.cell,
                          height: grid.cell,
                          marginVertical: grid.margin,
                          marginHorizontal: grid.margin,
                        },
                      ]}
                    >
                      {!grid.colorOnly && <Text
                        style={[styles.emptyCellDot, { fontSize: grid.dot }]}
                      >
                        ·
                      </Text>}
                    </View>
                  ),
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
      <BackButton variant="blur" top={8} />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },


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
    paddingRight: 52,
    alignItems: "center",
    minHeight: 154,
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
  gridSizeControls: {
    position: "absolute",
    top: 10,
    right: 10,
    gap: 6,
  },
  gridSizeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
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
  episodeHeader: {
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 5,
  },
  seasonHeaderText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Buradaki ölçüler YALNIZ SkeletonLoading için geçerli (default boyutlar);
  // gerçek ızgarada hepsi `grid`ten gelen satır içi stille eziliyor.
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
