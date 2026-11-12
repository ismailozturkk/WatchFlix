import { tmdbLanguageOf } from "../../utils/appLanguages";
import {
  StyleSheet,
  Text,
  View,
  Image,
  Animated,
  useWindowDimensions,
} from "react-native";
import { runAfterInteractions } from "../../utils/afterInteractions";
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
import TvGraphShareSheet from "../../components/tv/TvGraphShareSheet";
import ShareToChatSheet from "../../components/chat/ShareToChatSheet";
import GlassIconButton from "../../components/common/GlassIconButton";
import { useAuth } from "../../context/AuthContext";
import { buildTvGraphShare } from "../../utils/tvGraphShare";

import {
  useApiSettings,
  useImageQualitySettings,
} from "../../context/AppSettingsContext";
import ScreenDecor from "../../components/ScreenDecor";
import GlassPressable from "../../components/common/GlassPressable";
import GlassTouchable from "../../components/common/GlassTouchable";
import usePosterUri from "../../hooks/usePosterUri";
import { usePosterResolver } from "../../context/PosterChoicesContext";
import useBackdropUri from "../../hooks/useBackdropUri";


// Bölüm grafiği: aynı anda en fazla bu kadar sezon isteği (TMDB + dış puan).
const SEASON_CONCURRENCY = 4;

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
// `compact`: dikey düzende kartın solundaki dar rayda (bkz. RAIL_* sabitleri).
const GridModeSwitch = memo(function GridModeSwitch({ options, value, onChange, theme, vertical = false, compact = false }) {
  return (
    <View
      style={[
        styles.modeSwitch,
        vertical && styles.modeSwitchVertical,
        compact && styles.modeSwitchCompact,
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
              compact && styles.modeBtnCompact,
              active && { backgroundColor: theme.accent },
              pressed && !active && styles.modeBtnPressed,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={compact ? 15 : 16}
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
      <View style={styles.headRow}>
        <View style={styles.headRail}>
          <BackButton absolute={false} size={RAIL_BTN} fallbackRadius={10} />
        </View>
        <Animated.View
          style={[
            styles.infoPanelWrapper,
            styles.infoPanelWrapperHead,
            styles.skeletonPanel,
            { backgroundColor: theme.secondary, opacity },
          ]}
        >
          <View style={block(POSTER_W, POSTER_H, 8)} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <View style={block(150, 18)} />
            <View style={block(110, 12)} />
            <View style={block(80, 20)} />
            <View style={block(130, 10)} />
          </View>
        </Animated.View>
      </View>
      <Animated.View style={[styles.skeletonBody, { opacity }]}>
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
  // Yatay (genişlik > yükseklik): butonlar sol rayda sütun, bilgi kartı yanında,
  // ızgara sağda tüm yükseklikte. Dikey: üst çubuk + kompakt kart + ızgara.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const wide = windowWidth > windowHeight;
  const { getTmdbUrl } = useImageQualitySettings();
  const posterUri = usePosterUri();
  const backdropUri = useBackdropUri();
  const { API_KEY } = useApiSettings();
  const { user } = useAuth() || {};
  // Özel afiş: paylaşım gövdesine gönderenin SEÇTİĞİ afiş yazılır (panelde gördüğüyle aynı; seçim yoksa TMDB afişi).
  const resolvePoster = usePosterResolver();

  // ── Paylaşım ──────────────────────────────────────────────────────────────
  // Grafik anlık görüntüsü (utils/tvGraphShare): sohbet kartı ve Paylaşımlar gönderisi aynı gövdeyi taşır;
  // alıcı yeniden çekmeden çizer. Seçim sayfası kapandıktan sonra uygulanır (iOS iki Modal kuralı).
  const [shareOpen, setShareOpen] = useState(false);
  const [chatShare, setChatShare] = useState(null);
  const graphShare = useMemo(
    () =>
      showDetail && tvShows.length ? buildTvGraphShare({ show: showDetail, seasons: tvShows, resolvePoster }) : null,
    [showDetail, tvShows, resolvePoster],
  );
  const handleShareChoice = useCallback(
    (choice) => {
      if (!graphShare) return;
      if (choice === "chat") {
        setChatShare({ ...graphShare, host: user?.displayName?.split(" ")[0] || "" });
        return;
      }
      if (choice !== "feed") return;
      const name = showDetail?.name || "";
      // Gönderi küçük resimleri de grafikteki afişle aynı (özel afiş dahil).
      const posterPath = graphShare.poster_path || showDetail.poster_path || null;
      navigation.navigate("ShareContentScreen", {
        composePost: {
          composeKey: `tvgraph-${id}-${Date.now()}`,
          postType: "tvgraph",
          title: i18nText("autoI18n.tvgraph_gonderi_basligi", "{{title}} bölüm grafiği", { title: name }).slice(0, 100),
          content: "",
          tvGraph: graphShare,
          // Dizinin kendisi: gönderi küçük resimleri + eski sürümlerde inceleme gibi görünür.
          selectedMedia: [
            {
              id: showDetail.id,
              media_type: "tv",
              type: "tv",
              title: name,
              name,
              poster_path: posterPath,
              poster: posterPath ? getTmdbUrl(posterPath, "poster", 500) : null,
              first_air_date: showDetail.first_air_date,
              year: showDetail.first_air_date ? String(showDetail.first_air_date).slice(0, 4) : "",
              genre_ids: showDetail.genres?.map((g) => g.id).filter(Boolean) || [],
            },
          ],
        },
      });
    },
    [graphShare, user, showDetail, navigation, id, getTmdbUrl],
  );

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
      const titleRatingsPromise = fetchTitleRatings(imdbId).catch(() => null);
      // Yol haritası Y13: en fazla SEASON_CONCURRENCY sezon aynı anda (30 sezonlu
      // dizide 60+ eşzamanlı istek yerine). Bir sezon düşerse tüm görünüm
      // hataya gitmez: o sezon boş bölümlerle çizilir, gerisi korunur.
      const loadSeason = async (season) => {
        const [tmdbRes, seasonRatings] = await Promise.all([
          request(
            `https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}`,
            { language: tmdbLanguage },
          ),
          fetchSeasonRatings(imdbId, season.season_number).catch(() => null),
        ]);
        return {
          ...tmdbRes.data,
          episodes: mergeEpisodeRatings(tmdbRes.data.episodes, seasonRatings?.episodes),
        };
      };
      const seasonsData = new Array(validSeasons.length);
      let failed = 0;
      let next = 0;
      const worker = async () => {
        while (next < validSeasons.length && !isStale()) {
          const index = next++;
          const season = validSeasons[index];
          try {
            seasonsData[index] = await loadSeason(season);
          } catch (err) {
            if (axios.isCancel?.(err)) throw err;
            failed += 1;
            seasonsData[index] = { ...season, episodes: [] };
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(SEASON_CONCURRENCY, validSeasons.length) }, worker),
      );
      if (validSeasons.length > 0 && failed === validSeasons.length) {
        throw new Error("seasons_unavailable");
      }
      const titleRatings = await titleRatingsPromise;
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
      // Panel içeriği ANINDA değişir; eskiden opaklık 1 → 0 → 1 inip çıkıyordu ve
      // YENİ içerik sönüp geri geliyordu (sekme gibi git-gel / titreme). Şimdi
      // yumuşak bir belirme: 0,45'ten 1'e. Art arda dokunuşta önceki animasyon
      // durdurulur, aksi halde iki animasyon opaklığı çekiştirir.
      fadeAnim.stopAnimation();
      fadeAnim.setValue(0.45);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

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
    gridChangeHandleRef.current = runAfterInteractions(() => {
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
          <Text style={[styles.errorTitle, { color: theme.text.primary }]}>{t.mistake}</Text>
          <Text style={[styles.errorMessage, { color: theme.text.muted }]}>{error}</Text>
          <GlassTouchable style={styles.retryButton} onPress={fetchAllSeasons}>
            <Text style={styles.retryButtonText}>{t.tryAgain}</Text>
          </GlassTouchable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Paylaş + ızgara boyutu her iki düzende de geri düğmesinin altında SÜTUN:
  // dikeyde bilgi kartının solunda dar ray (kartla aynı boy), yatayda ekran boyu ray.
  const shareButton = graphShare ? (
    <GlassIconButton
      icon="share-outline"
      iconSize={18}
      size={wide ? 40 : RAIL_BTN}
      fallbackRadius={wide ? 12 : 10}
      color={theme.text.primary}
      accessibilityLabel={i18nText("autoI18n.tvgraph_paylas", "Grafiği paylaş")}
      onPress={() => setShareOpen(true)}
      testID="tvgraph-share-button"
    />
  ) : null;
  const modeSwitch = (
    <GridModeSwitch
      options={gridOptions}
      value={gridMode}
      onChange={handleGridModeChange}
      theme={theme}
      vertical
      compact={!wide}
    />
  );

  const closeSelectedEpisode = () => {
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
  };

  const openEpisodeDetails = () => {
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
  };

  const episodeColors =
    selectedEpisodeData?.vote_average > 0
      ? getRatingColors(selectedEpisodeData.vote_average)
      : null;

  // ── Üst Bilgi Paneli ──
  // Dikey: SABİT yükseklikli yatay kart (PANEL_HEIGHT) — içerik değişince ızgara
  // oynamasın. Yatay: sol rayın yanında, ekran boyu dikey kart (görsel üstte,
  // bilgiler altta); ızgara sağda tüm yüksekliği kullanır.
  const infoPanel = (
    <View style={[styles.infoPanelWrapper, wide ? styles.infoPanelWrapperWide : styles.infoPanelWrapperHead]}>
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
          wide && styles.infoPanelContainerWide,
          { opacity: fadeAnim },
        ]}
      >
        {/* Afiş / bölüm görseli — dikeyde SABİT genişlikli yuva: metin sütununun
            sol kenarı seçimde sağa sola oynamaz. */}
        <View style={[styles.panelMediaSlot, wide && styles.panelMediaSlotWide]}>
          <Image
            source={{
              uri: selectedEpisodeData?.still_path
                ? getTmdbUrl(selectedEpisodeData.still_path, wide ? 'backdrop' : 'poster', wide ? 500 : 200)
                : posterUri("tv", showDetail.id, showDetail.poster_path),
            }}
            style={
              selectedEpisodeData
                ? [styles.panelStill, wide && styles.panelStillWide]
                : [styles.panelPoster, wide && styles.panelPosterWide]
            }
          />
        </View>

        {/* Bilgiler */}
        <View style={[styles.panelInfo, wide && styles.panelInfoWide]}>
          {selectedEpisodeData ? (
            // ── Bölüm Bilgisi ── (tarih rozet satırında: ayrı satır yok)
            <>
              <View style={styles.panelBadgeRow}>
                <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                  <Text style={styles.badgeText}>
                    S{selectedEpisode.season} · E{selectedEpisode.index + 1}
                  </Text>
                </View>
                {selectedEpisodeData.runtime > 0 && (
                  <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                    <Text style={styles.badgeText}>
                      {selectedEpisodeData.runtime} {t.minutes}
                    </Text>
                  </View>
                )}
                {selectedEpisodeData.air_date ? (
                  <Text style={styles.badgeDate} numberOfLines={1}>
                    {selectedEpisodeData.air_date}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.panelTitle} numberOfLines={wide ? 2 : 1}>
                {selectedEpisodeData.name}
              </Text>

              {selectedEpisodeData.overview ? (
                <Text style={styles.panelOverview} numberOfLines={wide ? 5 : 4}>
                  {selectedEpisodeData.overview}
                </Text>
              ) : null}

              <View style={styles.panelBottomRow}>
                {episodeColors && (
                  <View style={[styles.ratingBadge, { backgroundColor: episodeColors.bg }]}>
                    <Text style={[styles.ratingBadgeText, { color: episodeColors.text }]}>
                      ★ {selectedEpisodeData.vote_average.toFixed(1)}
                    </Text>
                  </View>
                )}
                <GlassPressable
                  glass={false}
                  accessibilityRole="button"
                  style={styles.detailBtn}
                  onPress={openEpisodeDetails}
                >
                  <Text style={styles.detailBtnText}>{t.detail} →</Text>
                </GlassPressable>
              </View>
            </>
          ) : (
            // ── Dizi Bilgisi ──
            <>
              <Text style={styles.panelTitle} numberOfLines={2}>
                {showDetail.name}
              </Text>
              <Text style={styles.panelSubtitle} numberOfLines={1}>
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
                <Text style={styles.voteCount} numberOfLines={1}>
                  {showDetail.imdb_votes} {i18nText("votes", "oy")}
                </Text>
              </View>
              <Text style={styles.hintText} numberOfLines={1}>
                {i18nText("autoI18n.bolume_dokun_bolum_bilgisi", "Bölüme dokun → bölüm bilgisi")}
              </Text>
            </>
          )}
        </View>

        {/* Seçili bölümü kapat */}
        {selectedEpisode && (
          <GlassPressable
            glass={false}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
            hitSlop={8}
            style={styles.closeBtn}
            onPress={closeSelectedEpisode}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </GlassPressable>
        )}
      </Animated.View>
    </View>
  );

  // ── Değerlendirme Izgarası ──
  const gridView = (
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
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <ScreenDecor scope="details" iconOpacity={0.25} />

      {wide ? (
        // Yatay: [geri / paylaş / boyut sütunu] [bilgi kartı] [ızgara]
        <View style={styles.wideBody}>
          <View style={styles.sideRail}>
            <BackButton absolute={false} />
            {shareButton}
            {modeSwitch}
          </View>
          {infoPanel}
          <View style={styles.wideGrid}>{gridView}</View>
        </View>
      ) : (
        // Dikey: [geri / paylaş / boyut sütunu | bilgi kartı] → altta ızgara
        <>
          <View style={styles.headRow}>
            <View style={styles.headRail}>
              <BackButton absolute={false} size={RAIL_BTN} fallbackRadius={10} />
              {shareButton}
              {modeSwitch}
            </View>
            {infoPanel}
          </View>
          {gridView}
        </>
      )}

      <TvGraphShareSheet
        visible={shareOpen}
        graph={graphShare}
        theme={theme}
        onClose={() => setShareOpen(false)}
        onDismissed={handleShareChoice}
      />
      <ShareToChatSheet
        visible={!!chatShare}
        share={chatShare}
        onClose={() => setChatShare(null)}
        onSent={() => setChatShare(null)}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
// Bilgi panelinin sabit yüksekliği (dikeyde dizi kartı = bölüm kartı; bkz. infoPanelContainer).
// 9 Kas: 196 → 122 (kullanıcı isteği: dikeyde daha kompakt). Bölüm kartının en uzun
// hâli: rozet satırı (tarih dahil) 18 + 1 satır başlık 20 + 2 satır özet 28 +
// alt satır 24 + 3 boşluk 12 = 102 + dikey dolgu 2×10.
//
// 9 Kas (2): dikeyde üst çubuk kalktı; geri + paylaş + boyut seçici kartın SOLUNDA
// sütun (ray). Kart yüksekliği = rayın yüksekliği → ikisi alt/üst hizalı biter.
//   ray = geri 30 + paylaş 30 + boyut seçici 82 + 2 boşluk × 5 = 152
// Bölüm kartının en uzun hâli: rozet 18 + başlık 20 + 4 satır özet 56 + alt satır 24
// + 3 boşluk 12 = 130 ≤ 152 − 2×10.
const RAIL_BTN = 30;
const RAIL_GAP = 5;
const RAIL_MODE_W = 28;
const RAIL_MODE_H = 24;
const RAIL_SWITCH_PAD = 2;
// 3 düğme + 2 aralık (2) + iç dolgu + kenarlık (1+1)
const RAIL_SWITCH_H = RAIL_MODE_H * 3 + 2 * 2 + RAIL_SWITCH_PAD * 2 + 2; // 82
const PANEL_PAD_V = 10;
const PANEL_HEIGHT = RAIL_BTN * 2 + RAIL_SWITCH_H + RAIL_GAP * 2; // 152
const POSTER_H = PANEL_HEIGHT - PANEL_PAD_V * 2; // 132
const POSTER_W = Math.round((POSTER_H * 2) / 3); // 88
const MEDIA_SLOT_W = 96;
// Yatay düzende bilgi kartının genişliği (sol rayın yanında, ekran boyu).
const WIDE_PANEL_W = 260;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Üst Çubuk ───────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 12,
    paddingTop: 4,
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
  modeSwitchVertical: { flexDirection: "column" },
  modeSwitchCompact: { padding: RAIL_SWITCH_PAD, borderRadius: 13 },
  modeBtn: {
    width: 34,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modeBtnPressed: { backgroundColor: "rgba(127,127,127,0.18)" },
  modeBtnCompact: { width: RAIL_MODE_W, height: RAIL_MODE_H, borderRadius: 9 },

  // ── Dikey düzen: ray + kart satırı ──────────────────────────────────────
  headRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingLeft: 10,
    paddingRight: 12,
    paddingTop: 4,
  },
  headRail: { alignItems: "center", gap: RAIL_GAP },

  // ── Yatay düzen ─────────────────────────────────────────────────────────
  wideBody: { flex: 1, flexDirection: "row" },
  sideRail: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  wideGrid: { flex: 1 },

  // ── Bilgi Paneli ────────────────────────────────────────────────────────
  infoPanelWrapper: {
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  infoPanelWrapperHead: { flex: 1, marginHorizontal: 0 },
  infoPanelWrapperWide: {
    width: WIDE_PANEL_W,
    marginHorizontal: 0,
    marginTop: 6,
    marginBottom: 12,
    alignSelf: "stretch",
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
    paddingVertical: PANEL_PAD_V,
    paddingLeft: 10,
    // Sağ boşluk SABİT (kapat düğmesi yeri hep ayrılı): seçimde değişirse metin
    // sütunu daralıp satır kaydırıyordu.
    paddingRight: 40,
    alignItems: "center",
    // SABİT yükseklik: dizi kartı ile bölüm kartı aynı boyda olmalı. İçerik
    // uzunluğuna göre değişirse panelin altındaki bütün ızgara aşağı yukarı oynuyordu.
    height: PANEL_HEIGHT,
    overflow: "hidden",
  },
  // Yatay: ekran boyu dikey kart; görsel üstte, bilgiler altta. Izgara yanda
  // olduğu için yükseklik değişimi ızgarayı oynatmaz.
  infoPanelContainerWide: {
    flex: 1,
    height: undefined,
    flexDirection: "column",
    alignItems: "stretch",
    padding: 12,
  },
  panelMediaSlot: {
    width: MEDIA_SLOT_W,
    alignItems: "center",
    justifyContent: "center",
  },
  panelMediaSlotWide: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  panelPoster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  panelPosterWide: { width: 80, height: 120, borderRadius: 10 },
  panelStill: {
    width: MEDIA_SLOT_W,
    height: 54,
    borderRadius: 8,
    backgroundColor: "#111",
    alignSelf: "center",
  },
  panelStillWide: {
    width: "100%",
    height: undefined,
    aspectRatio: 16 / 9,
    borderRadius: 10,
  },
  panelInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    gap: 4,
    justifyContent: "center",
  },
  panelInfoWide: {
    marginLeft: 0,
    gap: 6,
    justifyContent: "flex-start",
  },
  panelBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "600",
  },
  badgeDate: {
    flexShrink: 1,
    fontSize: 10.5,
    lineHeight: 14,
    color: "rgba(255,255,255,0.6)",
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 20,
  },
  panelSubtitle: {
    fontSize: 12,
    lineHeight: 15,
    color: "rgba(255,255,255,0.6)",
  },
  panelOverview: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 14,
  },
  panelBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingBadge: {
    backgroundColor: "rgb(255,165,0)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  ratingBadgeText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "700",
  },
  voteCount: {
    flexShrink: 1,
    fontSize: 11.5,
    color: "rgba(255,255,255,0.5)",
  },
  hintText: {
    fontSize: 10.5,
    lineHeight: 13,
    color: "rgba(255,255,255,0.32)",
    fontStyle: "italic",
  },
  detailBtn: {
    backgroundColor: "rgba(129, 206, 254, 0.25)",
    paddingHorizontal: 11,
    paddingVertical: 3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(129, 206, 254, 0.4)",
  },
  detailBtnText: {
    color: "#81cefe",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
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
    paddingHorizontal: 12,
    paddingVertical: PANEL_PAD_V,
    alignItems: "center",
    height: PANEL_HEIGHT,
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
