import { tmdbLanguageOf } from "../../utils/appLanguages";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Animated,
  InteractionManager,
} from "react-native";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import BackButton from "../../components/BackButton";

import React, {
  memo,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { fetchSeasonRatings, fetchTitleRatings } from "../../services/externalRatings";
import { mergeEpisodeRatings, pickMainRating } from "../../utils/externalRatings";
import { getRatingColors } from "../../utils/ratingColors";
import { TV_GRAPH_GRID_SIZES } from "../../utils/tvGraphGrid";
import TvGraphGrid from "../../components/tv/TvGraphGrid";

import {
  useApiSettings,
  useImageQualitySettings,
} from "../../context/AppSettingsContext";
import ScreenDecor from "../../components/ScreenDecor";
import GlassPressable from "../../components/common/GlassPressable";
import GlassTouchable from "../../components/common/GlassTouchable";
import usePosterUri from "../../hooks/usePosterUri";
import useBackdropUri from "../../hooks/useBackdropUri";

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
//
// Izgaranın kendisi (sanallaştırılmış liste, satır/hücre) components/tv/TvGraphGrid.js'te.
const GRID_SIZES = TV_GRAPH_GRID_SIZES;

const GRID_MODE_ICONS = [
  { key: "default", icon: "expand-outline" },
  { key: "compact", icon: "contract-outline" },
  { key: "heatmap", icon: "grid-outline" },
];

// ─── Üst Çubuk ────────────────────────────────────────────────────────────────
// Geri düğmesi eskiden `top={8}` ile mutlak konumlanıyordu. Mutlak öğe, üst kabın
// (SafeAreaView) iç boşluğunu yok sayar; yani düğme güvenli alanın İÇİNE, durum
// çubuğu / bildirim alanına düşüyordu. Artık akışın içinde bir satır: güvenli alan
// boşluğunu SafeAreaView veriyor, düğme onun altında kalıyor.
const TopBar = ({ children }) => (
  <View style={styles.topBar}>
    <BackButton absolute={false} />
    {children}
  </View>
);

// Izgara boyutu seçici: panelin içinden çıkıp üst çubuğa taşındı (panelin sağ
// kenarındaki dikey yığın, seçili bölümde kapat düğmesiyle çakışmasın diye
// `top: 44` kaydırması gerektiriyordu).
const GridModeSwitch = memo(function GridModeSwitch({ options, value, onChange, theme }) {
  return (
    <View
      style={[
        styles.modeSwitch,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <GlassPressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            hitSlop={3}
            style={({ pressed }) => [
              styles.modeBtn,
              active && { backgroundColor: theme.accent },
              pressed && !active && styles.modeBtnPressed,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={16}
              color={active ? "#fff" : theme.text.primary}
            />
          </GlassPressable>
        );
      })}
    </View>
  );
});

// ─── Skeleton Loading ─────────────────────────────────────────────────────────
// Eskiden 84+ ayrı <Skeleton> vardı ve her biri kendi sonsuz Animated.loop'unu
// çalıştırıyordu. Şimdi TEK bir nabız değeri, yalnız kapsayıcının saydamlığını
// sürer; içerik düz View'lardan oluşur.
const SKELETON_COLUMNS = 7;
const SKELETON_ROWS = 12;

const SkeletonLoading = ({ theme }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  const block = (width, height, radius = 6) => ({
    width,
    height,
    borderRadius: radius,
    backgroundColor: theme.between,
  });
  const grid = GRID_SIZES.default;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <TopBar />
      <Animated.View style={[styles.skeletonBody, { opacity }]}>
        <View
          style={[
            styles.infoPanelWrapper,
            styles.skeletonPanel,
            { backgroundColor: theme.secondary },
          ]}
        >
          <View style={block(90, 130, 10)} />
          <View style={{ flex: 1, marginLeft: 14, gap: 10 }}>
            <View style={block(180, 22)} />
            <View style={block(120, 14)} />
            <View style={block(80, 18)} />
            <View style={block(140, 12)} />
          </View>
        </View>
        <View style={styles.skeletonGrid}>
          {Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {Array.from({ length: SKELETON_COLUMNS }, (_, colIndex) => (
                <View
                  key={colIndex}
                  style={{
                    width: grid.cell,
                    height: grid.cell,
                    margin: grid.margin,
                    borderRadius: grid.radius,
                    backgroundColor: theme.secondary,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

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
  const autoGridRef = useRef(false);
  const gridChangeHandleRef = useRef(null);

  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const posterUri = usePosterUri();
  const backdropUri = useBackdropUri();
  const { API_KEY } = useApiSettings();

  // Animasyon ref'i – panel geçişi için
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Veri Çekme ────────────────────────────────────────────────────────────
  // Bu ekran N+1 istek yapıyor (dizi + her sezon + OMDb). fetchAllSeasons hem
  // effect'ten hem "tekrar dene" düğmesinden çağrıldığı için düz bir `cancelled`
  // bayrağı yetmiyor; çalışma jetonu ile eski zincirler bayatlatılıyor. Aksi
  // hâlde dil değişince geciken eski yanıt yeni veriyi eziyor ve unmount
  // sonrası setState yapılıyordu. Ayrıca süren TMDB istekleri AbortController
  // ile iptal edilir: ekrandan çıkan kullanıcı için 30+ sezon isteği boşuna
  // bitmesin.
  const runIdRef = useRef(0);
  const abortRef = useRef(null);

  const fetchAllSeasons = useCallback(async () => {
    const runId = ++runIdRef.current;
    const isStale = () => runId !== runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const request = (url, params) =>
      axios.get(url, {
        params,
        signal: controller.signal,
        headers: { accept: "application/json", Authorization: API_KEY },
      });
    const tmdbLanguage = tmdbLanguageOf(language);

    setLoading(true);
    setError(null);
    try {
      const { data: show } = await request(
        `https://api.themoviedb.org/3/tv/${id}`,
        { language: tmdbLanguage, append_to_response: "external_ids" },
      );

      // IMDb puanları OMDb'den, Cloud Function proxy'si üzerinden (anahtar sunucuda; services/externalRatings.js).
      // Ulaşılamazsa null döner ve TMDB puanı kullanılır.
      const imdbId = show.external_ids?.imdb_id;
      const validSeasons = (show.seasons ?? []).filter(
        (s) => s.season_number !== 0,
      );

      // Dizi puanı ile sezonlar birbirinden bağımsız: art arda değil birlikte
      // beklenir. Her sezonun TMDB isteği ile IMDb bölüm puanı da paralel
      // (eskiden önce TMDB, SONRA OMDb bekleniyordu — sezon başına iki kat gecikme).
      const titleRatingsPromise = fetchTitleRatings(imdbId);
      const seasonPromises = validSeasons.map(async (season) => {
        const [tmdbRes, seasonRatings] = await Promise.all([
          request(
            `https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}`,
            { language: tmdbLanguage },
          ),
          fetchSeasonRatings(imdbId, season.season_number),
        ]);
        return {
          ...tmdbRes.data,
          episodes: mergeEpisodeRatings(tmdbRes.data.episodes, seasonRatings?.episodes),
        };
      });

      const [titleRatings, seasonsData] = await Promise.all([
        titleRatingsPromise,
        Promise.all(seasonPromises),
      ]);
      if (isStale()) return;

      const imdbMainInfo = pickMainRating(titleRatings, show);
      setShowDetail({
        ...show,
        vote_average: imdbMainInfo.rating,
        imdb_votes: imdbMainInfo.votes,
      });

      // ── Otomatik ızgara boyutu (ilk başarılı yükleme) ──
      // ≤7 sezon → default, 8–11 → compact, >11 → heatmap
      if (!autoGridRef.current) {
        autoGridRef.current = true;
        const count = validSeasons.length;
        const autoMode =
          count <= 7 ? "default" : count <= 11 ? "compact" : "heatmap";
        setGridMode(autoMode);
        setRenderGridMode(autoMode);
      }

      setTVShows(seasonsData);
    } catch (err) {
      // İptal edilen istek hata değil (ekran kapandı / yeni çalışma başladı).
      if (axios.isCancel?.(err) || isStale()) return;
      setError(err.message);
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
      abortRef.current?.abort();
      abortRef.current = null;
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

  // Izgara boyutu: düğme vurgusu ANINDA, ağır yeniden çizim etkileşimden sonra.
  const handleGridModeChange = useCallback((mode) => {
    if (gridChangeHandleRef.current) {
      gridChangeHandleRef.current.cancel();
    }
    setGridMode(mode);
    gridChangeHandleRef.current = InteractionManager.runAfterInteractions(() => {
      setRenderGridMode(mode);
      gridChangeHandleRef.current = null;
    });
  }, []);

  const gridOptions = useMemo(
    () =>
      GRID_MODE_ICONS.map((option) => ({
        ...option,
        label: t.tvGraphGrid[option.key === "default" ? "standard" : option.key],
      })),
    [t],
  );

  // Hücre başına değil, dil başına bir kez çözülen etiketler (erişilebilirlik + eksenler).
  const gridLabels = useMemo(
    () => ({
      season: i18nText("season", "Sezon"),
      episode: i18nText("episode", "Bölüm"),
      rating: i18nText("rating", "Puan"),
      seasonLetter: t.season[0],
      episodeLetter: t.episode[0],
    }),
    [t],
  );

  // ── Render Koşulları ──────────────────────────────────────────────────────
  if (loading) return <SkeletonLoading theme={theme} />;

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
        <TopBar />
        <View style={styles.errorBody}>
          <Text style={styles.errorTitle}>{t.mistake}</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <GlassTouchable style={styles.retryButton} onPress={fetchAllSeasons}>
            <Text style={styles.retryButtonText}>{t.tryAgain}</Text>
          </GlassTouchable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <ScreenDecor scope="details" iconOpacity={0.25} />

      <TopBar>
        <GridModeSwitch
          options={gridOptions}
          value={gridMode}
          onChange={handleGridModeChange}
          theme={theme}
        />
      </TopBar>

      {/* ── Üst Bilgi Paneli ─────────────────────────────────────────────── */}
      <View style={styles.infoPanelWrapper}>
        {/* Backdrop */}
        <Image
          source={{
            uri: selectedEpisodeData?.still_path
              ? getTmdbUrl(selectedEpisodeData.still_path, 'backdrop', 1000)
              : backdropUri("tv", showDetail.id, showDetail.backdrop_path),
          }}
          style={styles.panelBackdrop}
          blurRadius={1}
        />
        <View style={styles.panelOverlay} />

        <Animated.View
          style={[
            styles.infoPanelContainer,
            // Sağ kenar yalnız seçili bölümde kapat düğmesi için ayrılır.
            { opacity: fadeAnim, paddingRight: selectedEpisode ? 52 : 14 },
          ]}
        >
          {/* Sol: Poster veya Bölüm Görseli */}
          <Image
            source={{
              uri: selectedEpisodeData?.still_path
                ? getTmdbUrl(selectedEpisodeData.still_path, 'poster', 200)
                : posterUri("tv", showDetail.id, showDetail.poster_path),
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
      <TvGraphGrid
        seasons={tvShows}
        grid={grid}
        gridKey={renderGridMode}
        selected={selectedEpisode}
        onPress={handleEpisodePress}
        borderColor={theme.primary}
        headerColor={theme.text.secondary}
        labels={gridLabels}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Üst Çubuk ───────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
  },
  modeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 3,
    borderRadius: 13,
    borderWidth: 1,
  },
  modeBtn: {
    width: 34,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modeBtnPressed: { backgroundColor: "rgba(127,127,127,0.18)" },

  // ── Bilgi Paneli ────────────────────────────────────────────────────────
  infoPanelWrapper: {
    marginHorizontal: 12,
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
  closeBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Izgara (yalnız satır düzeni; hücre stilleri TvGraphGrid.js'te) ────────
  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  // ── Yükleniyor ──────────────────────────────────────────────────────────
  skeletonBody: { flex: 1 },
  skeletonPanel: {
    flexDirection: "row",
    padding: 14,
    alignItems: "center",
    minHeight: 154,
  },
  skeletonGrid: {
    flex: 1,
    overflow: "hidden",
    paddingTop: 10,
    paddingHorizontal: 12,
  },

  // ── Hata ────────────────────────────────────────────────────────────────
  errorBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
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
