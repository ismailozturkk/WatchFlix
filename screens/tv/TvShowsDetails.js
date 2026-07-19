import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Modal,
  Animated,
  Platform,
  Pressable,
  Linking,
  FlatList,
} from "react-native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { DetailsSkeleton } from "../../components/Skeleton";
import RatingStars from "../../components/RatingStars";
import Ionicons from "@expo/vector-icons/Ionicons";
import TVShowItem from "../../components/TVShowItem";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSnow } from "../../context/SnowContext";
import { getDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Toast from "react-native-toast-message";
import SeasonItem from "./SeasonItem";
import SeasonDeck from "./SeasonDeck";
import * as Progress from "react-native-progress";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useAppSettings, useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import WatchedDateSheet from "@components/detail/WatchedDateSheet";
import ListViewTv from "../../components/ListViewTv";
import PosterImage from "../../components/PosterImage";
import { BlurView } from "expo-blur";
import ListBadges from "../../components/ListBadges";
import YoutubePlayer from "react-native-youtube-iframe";
import { useListStatusContext } from "../../context/ListStatusContext";
import {
  addToList,
  removeFromList,
  PREDEFINED_MOVIE_LISTS,
} from "../../services/listItemsService";
import IconBacground from "../../components/IconBacground";
import ImageGalleryModal from "@components/modals/ImageGalleryModal";
import TrailerSection from "@components/video/TrailerSection";
import PaginatedRail from "../../components/PaginatedRail";
import CommentSheetModal from "@components/modals/CommentSheetModal";
import RatingSheetModal from "@components/modals/RatingSheetModal";
import RatingSummary from "@components/RatingSummary";
import { i18nText } from "../../utils/i18nText";
import { useWatchedShow } from "../../hooks/useWatchedShow";
import { markShow, unmarkShow } from "../../services/watchedTvService";
import AIChatScreen from "../AIChatScreen";
import {
  getWatchState,
  isAired,
  WATCH_STATE,
  watchStateColor,
} from "../../utils/watchState";
import Reminder from "../../components/Reminder";


const { height, width } = Dimensions.get("window");
const BACKDROP_HEIGHT = width * (9 / 16);
// Fragman oynatıcısı: 16:9 oranını koruyarak cihaza göre boyutlanır
// (tablette aşırı genişlememesi için üst sınır var).
const VIDEO_WIDTH = Math.min(width - 24, 720);
const VIDEO_HEIGHT = Math.round((VIDEO_WIDTH * 9) / 16);

/* ─── Section header (aynı MovieDetails stili) ── */
const SectionHeader = ({ title, right, theme }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
    <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
      {title}
    </Text>
    {right}
  </View>
);

/* ─── Benzer dizi kartı ── */
// Kart kendi press animasyonunu yönetir; memo sayesinde ekran re-render
// olduğunda 40 kart yeniden çizilmez.
const SimilarTvShow = memo(function SimilarTvShow({ item, navigation, theme }) {
  const { getTmdbUrl } = useImageQualitySettings();
  const { posterBadges } = useListLayoutSettings();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(scale, {
      toValue: 0.93,
      duration: 150,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.9}
        style={styles.similarItem}
        onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
      >
        <PosterImage
          path={item.poster_path}
          type="tv"
          size={200}
          iconSize={46}
          style={[styles.similarPoster, { borderColor: theme.border + "55" }]}
        />
        {posterBadges?.tmdbRating !== false && (
          <View
            style={[styles.ratingPill, { backgroundColor: "rgba(0,0,0,0.72)" }]}
          >
            <Ionicons name="star" size={9} color="#FFD700" />
            <Text allowFontScaling={false} style={styles.ratingPillText}>
              {item.vote_average.toFixed(1)}
            </Text>
          </View>
        )}
        <View style={styles.stats}>
          <ListBadges
            mediaId={item.id}
            mediaType="tv"
            theme={theme}
            style={{
              gap: 3,
              paddingVertical: 4,
              paddingHorizontal: 2,
              borderRadius: 10,
              backgroundColor: "rgba(0,0,0,0.72)",
            }}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ─── Ana bileşen ── */
export default function TvShowsDetails({ route, navigation }) {
  const { id } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  // Sezon carousel'i: 5+ sezonda tek tek sayfalı görünüm; "Tümünü Gör" düz listeye açar.
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  // Ana kadro (credits.cast) — MovieDetail ile aynı bölüm/kart yapısı.
  const [showFullCast, setShowFullCast] = useState(false);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { API_KEY, showSnow } = useAppSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { allLists, statusIndex } = useListStatusContext();
  // İzleme sağlayıcıları bölgesi — MovieDetail ile aynı seçim.
  const providerRegion = language === "tr" ? "TR" : "US";

  // Tek abonelik: bu dizinin tüm izlenme durumu (kök-dizi yerine subcollection).
  const watched = useWatchedShow(id);

  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const overviewHeightAnim = useRef(new Animated.Value(80)).current;
  const overviewOpacity = useRef(new Animated.Value(1)).current;
  const HALF_W = (width - 30 - 10) / 2;
  const FULL_W = width - 30;
  const overviewWidthAnim = useRef(new Animated.Value(HALF_W)).current;

  const toggleOverview = () => {
    const opening = !overviewExpanded;
    setOverviewExpanded(opening);
    Animated.parallel([
      Animated.timing(overviewHeightAnim, {
        toValue: opening ? 500 : 80,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(overviewWidthAnim, {
        toValue: opening ? FULL_W : HALF_W,
        duration: 280,
        useNativeDriver: false,
      }),
    ]).start();
  };
  const [isLoading, setIsLoading] = useState(false);

  const [PosterModalVisible, setPosterModalVisible] = useState(false);
  const [backdropModalVisible, setBacdropModalVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);

  /* ── Format helpers ── */
  const formatDate = (ts) => {
    if (!ts) return "";
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(ts));
  };
  const formatDateSave = (ts) => {
    if (typeof ts === "string" && /^\d{4}-\d{2}-\d{2}/.test(ts)) {
      return ts.slice(0, 10);
    }
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /* ── listStates — useMemo: snapshot başına bir kez, ekstra render yok ── */
  const listStates = useMemo(() => {
    const s = {};
    const m = statusIndex?.tv?.[id] || {};
    s.favorites = !!m.inFavorites;
    s.watchList = !!m.inWatchList;
    s.watchedMovies = !!m.isWatched;
    if (allLists) {
      Object.entries(allLists).forEach(([k, v]) => {
        if (
          PREDEFINED_MOVIE_LISTS.includes(k) ||
          k === "watchedTv" ||
          k === "customLists"
        )
          return;
        if (Array.isArray(v))
          s[k] = v.some((i) => i.id === id && i.type === "tv");
      });
    }
    return s;
  }, [allLists, statusIndex, id]);

  /* ── Fetch details ── */
  useEffect(() => {
    // Aynı ekran örneği yeni id ile yeniden kullanılabildiği için geç gelen
    // eski yanıtın yeni diziyi ezmemesi adına cancelled bayrağı gerekli.
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.request({
          method: "GET",
          url: `https://api.themoviedb.org/3/tv/${id}`,
          params: {
            language: language === "tr" ? "tr-TR" : "en-US",
            append_to_response:
              "account_states,alternative_titles,changes,credits,external_ids,images,keywords,lists,recommendations,release_dates,similar,translations,videos,watch/providers",
          },
          headers: { accept: "application/json", Authorization: API_KEY },
        });
        if (!cancelled) setDetails(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [id, language]);

  // Önerilen/Benzer rayları: append_to_response yalnız ilk sayfayı getirir.
  // Ana ekran raylarındaki gibi (PaginatedRail) sona yaklaşınca sonraki TMDB
  // sayfası çekilip mevcut listenin sonuna eklenir.
  const [railState, setRailState] = useState({
    recommendations: { items: [], page: 1, totalPages: 1, loading: false },
    similar: { items: [], page: 1, totalPages: 1, loading: false },
  });
  const railBusyRef = useRef({ recommendations: false, similar: false });

  useEffect(() => {
    const seed = (block) => ({
      items: block?.results || [],
      page: block?.page || 1,
      totalPages: block?.total_pages || 1,
      loading: false,
    });
    railBusyRef.current = { recommendations: false, similar: false };
    setRailState({
      recommendations: seed(details?.recommendations),
      similar: seed(details?.similar),
    });
  }, [details]);

  const loadMoreRail = useCallback(
    async (kind) => {
      const rail = railState[kind];
      if (railBusyRef.current[kind] || rail.page >= rail.totalPages) return;
      railBusyRef.current[kind] = true;
      setRailState((cur) => ({
        ...cur,
        [kind]: { ...cur[kind], loading: true },
      }));
      try {
        const res = await axios.request({
          method: "GET",
          url: `https://api.themoviedb.org/3/tv/${id}/${kind}`,
          params: {
            language: language === "tr" ? "tr-TR" : "en-US",
            page: rail.page + 1,
          },
          headers: { accept: "application/json", Authorization: API_KEY },
        });
        const fresh = res.data?.results || [];
        setRailState((cur) => {
          const current = cur[kind];
          const seen = new Set(current.items.map((it) => it.id));
          return {
            ...cur,
            [kind]: {
              items: [...current.items, ...fresh.filter((it) => !seen.has(it.id))],
              page: res.data?.page || rail.page + 1,
              totalPages: res.data?.total_pages || current.totalPages,
              loading: false,
            },
          };
        });
      } catch {
        setRailState((cur) => ({
          ...cur,
          [kind]: { ...cur[kind], loading: false },
        }));
      } finally {
        railBusyRef.current[kind] = false;
      }
    },
    [railState, id, language, API_KEY],
  );

  /* ── İzlenme durumu — useWatchedShow'dan TÜRETİLİR (subcollection) ── */
  const watchedEpisodeCount = watched.aggregates.watchedEpisodeCount;
  const showTotalEpisodes = details?.number_of_episodes || 0;
  const showAired = isAired(details?.first_air_date);
  const showWatchState = getWatchState({
    aired: showAired,
    watched: watchedEpisodeCount,
    total: showTotalEpisodes,
  });
  const isSeasonWatched =
    showTotalEpisodes > 0
      ? Math.min(1, watchedEpisodeCount / showTotalEpisodes)
      : 0;

  /* ── updateTvSeriesList ── */
  const updateTvSeriesList = async (listType, type) => {
    if (!user?.uid || !details) return;
    const isPredefined = PREDEFINED_MOVIE_LISTS.includes(listType);
    const getName = (l) =>
      ({
        favorites: t.tvShowsDetails?.favorites,
        watchList: t.tvShowsDetails?.watchList,
        watchedMovies: t.tvShowsDetails?.watched,
        watchedTv: t.tvShowsDetails?.watchedTv,
      })[l] || l;
    const toastRemove = () =>
      Toast.show({
        type: "warning",
        text1: i18nText("autoI18n.tv_removed_from_list", "Dizi {{list}} listesinden kaldırıldı!", { list: getName(listType) }),
      });
    const toastAdd = () =>
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.tv_added_to_list", "Dizi {{list}} listesine eklendi!", { list: getName(listType) }),
      });

    try {
      if (isPredefined) {
        // Yeni model: her öğe ayrı doküman (listItemsService).
        const isIn = !!listStates[listType];
        if (isIn) {
          await removeFromList(user.uid, listType, type, details.id);
          toastRemove();
        } else {
          await addToList(user.uid, listType, {
            id: details.id,
            type,
            name: details.name,
            imagePath: details.poster_path,
            dateAdded: formatDateSave(new Date()),
            genres: details.genres?.map((g) => g.name) || [],
          });
          toastAdd();
        }
        return;
      }

      // Özel listeler — eski kök-array yolu (Part B'de listItemsService'e taşınacak).
      const ref = doc(db, "Lists", user.uid);
      const snap = await getDoc(ref);
      let data = snap.exists() ? snap.data() : {};
      if (!snap.exists()) await setDoc(ref, data);
      let list = data[listType] || [];
      const idx = list.findIndex((i) => i.id === details.id && i.type === type);
      if (idx !== -1) {
        list.splice(idx, 1);
        toastRemove();
      } else {
        list.push({
          id: details.id,
          dateAdded: formatDateSave(new Date()),
          imagePath: details.poster_path,
          name: details.name,
          type,
          genres: details.genres?.map((g) => g.name) || [],
        });
        toastAdd();
      }
      await updateDoc(ref, { [listType]: list });
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.hata_2", "Hata: ") + e.message });
    }
  };

  /* ── Modal helpers ── */
  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);
  const handleConfirm = (date) => addShowToFirestore(date);
  // Overview accordion (sadece özet, tam genişlik)
  const [expandedCard, setExpandedCard] = useState(null);
  const overviewAnim = React.useRef(new Animated.Value(0)).current;

  const toggleCard = (card) => {
    const isOpening = expandedCard !== card;
    if (isOpening) {
      Animated.timing(overviewAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: false,
      }).start();
      setExpandedCard(card);
    } else {
      Animated.timing(overviewAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
      setExpandedCard(null);
    }
  };
  /* ── Diziyi komple işaretle (tüm sezonların bölümlerini çek → markShow) ── */
  const addShowToFirestore = async (selDate = null) => {
    if (!user?.uid || !details?.seasons || !selDate) return;
    try {
      setIsLoading(true);
      closeModal();
      const eDate = formatDateSave(selDate);
      const seasonsWithEpisodes = [];
      for (const seasonObj of details.seasons) {
        if (!seasonObj.season_number || seasonObj.episode_count === 0) continue;
        const res = await axios.get(
          `https://api.themoviedb.org/3/tv/${details.id}/season/${seasonObj.season_number}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );
        seasonsWithEpisodes.push({
          seasonNumber: seasonObj.season_number,
          seasonPosterPath: seasonObj.poster_path || null,
          seasonEpisodes: seasonObj.episode_count,
          episodes: res.data.episodes.map((ep) => ({
            episodeNumber: ep.episode_number,
            episodePosterPath: ep.still_path || null,
            episodeName: ep.name || "Unknown",
            episodeRatings: parseFloat(ep.vote_average?.toFixed(1)) || 0,
            episodeMinutes: ep.runtime || 0,
          })),
        });
      }
      await markShow(
        user.uid,
        {
          id: details.id,
          name: details.name,
          showEpisodeCount: details.number_of_episodes,
          showSeasonCount: details.number_of_seasons,
          imagePath: details.poster_path,
          genres: details.genres?.map((g) => g.name) || [],
        },
        seasonsWithEpisodes,
        eDate,
      );
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.dizi_bolumleri_izlendi_olarak_isaretlendi", "Dizi bölümleri izlendi olarak işaretlendi"),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Dizinin tüm izlenme kaydını kaldır ── */
  const removeShowFromFirestore = async () => {
    if (!user?.uid || !details) return;
    try {
      setIsLoading(true);
      await unmarkShow(user.uid, details.id);
      Toast.show({
        type: "warning",
        text1: i18nText("autoI18n.dizi_izleme_listesinden_silindi", "Dizi izleme listesinden silindi"),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── renderVideo ── */

  const renderSimilarTvShow = useCallback(
    ({ item }) => (
      <SimilarTvShow item={item} navigation={navigation} theme={theme} />
    ),
    [navigation, theme],
  );

  const openReviewComposer = useCallback(() => {
    if (!details) return;
    const title = details.name || "";
    navigation.navigate("ShareContentScreen", {
      composePost: {
        composeKey: `tv-${id}-${Date.now()}`,
        postType: "review",
        title: title ? `${title} incelemesi` : i18nText("autoI18n.yeni_inceleme", "Yeni inceleme"),
        content: "",
        selectedMedia: [
          {
            id: details.id,
            media_type: "tv",
            type: "tv",
            title,
            name: title,
            poster_path: details.poster_path,
            poster: details.poster_path
              ? getTmdbUrl(details.poster_path, "poster", 500)
              : null,
            first_air_date: details.first_air_date,
            year: details.first_air_date ? String(details.first_air_date).slice(0, 4) : "",
            genre_ids: details.genres?.map((g) => g.id).filter(Boolean) || [],
          },
        ],
      },
    });
  }, [details, getTmdbUrl, id, navigation]);

  const aiPrompt = useMemo(() => {
    if (!details?.name) return "";
    const year = details.first_air_date ? ` (${String(details.first_air_date).slice(0, 4)})` : "";
    return `${details.name}${year} dizisi hakkında spoiler vermeden bilgi ver. Konusu, türü, sezon yapısı, öne çıkan oyuncuları, atmosferi, kimlere uygun olduğu ve neden izlenebileceğini kısa başlıklarla anlat.`;
  }, [details]);

  // Oyuncu kartı — MovieDetail.renderCastMember ile birebir aynı yapı.
  const renderCastMember = useCallback(
    ({ item }) => (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("ActorViewScreen", { personId: item.id })
        }
        activeOpacity={0.8}
      >
        <View style={styles.castItem}>
          <Image
            source={
              item.profile_path
                ? { uri: getTmdbUrl(item.profile_path, 'poster', 200) }
                : require("../../assets/image/user.png")
            }
            style={[styles.castImage, { borderColor: theme.border }]}
          />
          <Text
            allowFontScaling={false}
            style={[styles.castName, { color: theme.text.primary }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.castCharacter, { color: theme.text.muted }]}
            numberOfLines={1}
          >
            {item.character}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [navigation, theme, getTmdbUrl],
  );

  if (loading) return <DetailsSkeleton />;
  if (!details)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.primary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.text.primary }}>{t.loading}</Text>
      </View>
    );

  const watchedColor = watchStateColor(showWatchState, theme);

  // Gerçek sezonlar (season_number 0 = özel bölümler hariç).
  const seasonList = details.seasons.filter((s) => s.season_number > 0);
  const useSeasonDeck = seasonList.length > 5 && !showAllSeasons;

  // İzleme seçenekleri satırı: bölge sağlayıcıları + sonuna yayıncılar.
  // Aynı isimli platform (ör. Netflix hem sağlayıcı hem yayıncı) iki kez
  // görünmesin diye sağlayıcı listesinde olan yayıncılar elenir.
  const regionProviders = details["watch/providers"]?.results?.[providerRegion];
  const flatrateProviders = regionProviders?.flatrate ?? [];
  const providerNames = new Set(
    flatrateProviders.map((p) => (p.provider_name || "").toLowerCase()),
  );
  const rowNetworks = (details.networks || []).filter(
    (nw) => !providerNames.has((nw.name || "").toLowerCase()),
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <IconBacground opacity={0.25} />
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HERO / BACKDROP ── */}
        <View style={styles.heroContainer}>
          {details.backdrop_path ? (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => setBacdropModalVisible(true)}
            >
              <Image
                source={{
                  uri: getTmdbUrl(details.backdrop_path, 'backdrop', 1000),
                }}
                style={styles.backdrop}
              />
            </TouchableOpacity>
          ) : (
            <View
              style={[styles.noBackdrop, { backgroundColor: theme.secondary }]}
            >
              <Ionicons name="tv-outline" size={64} color={theme.text.muted} />
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.15)", theme.primary]}
            locations={[0.3, 0.65, 1]}
            style={styles.heroGradient}
            pointerEvents="none"
          />

        </View>

        {/* ── POSTER + INFO HEADER ── */}
        <View style={styles.infoHeader}>
          <TouchableOpacity
            style={styles.posterShadow}
            onPress={() => setPosterModalVisible(true)}
            activeOpacity={0.92}
          >
            {details.poster_path ? (
              <Image
                source={{
                  uri: getTmdbUrl(details.poster_path, 'poster', 200),
                }}
                style={[styles.poster, { borderColor: theme.border + "80" }]}
              />
            ) : (
              <View
                style={[styles.noPoster, { backgroundColor: theme.secondary }]}
              >
                <Ionicons
                  name="image-outline"
                  size={40}
                  color={theme.text.muted}
                />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text
              allowFontScaling={false}
              style={[styles.title, { color: theme.text.primary }]}
            >
              {details.name}
            </Text>
            {details.tagline ? (
              <Text
                allowFontScaling={false}
                style={[styles.tagline, { color: theme.accent }]}
                numberOfLines={2}
              >
                "{details.tagline}"
              </Text>
            ) : null}
            <View style={styles.genreRow}>
              {details.genres.slice(0, 3).map((g) => (
                <View
                  key={g.id}
                  style={[
                    styles.genreChip,
                    {
                      backgroundColor: theme.accent + "22",
                      borderColor: theme.accent + "44",
                    },
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[styles.genreChipText, { color: theme.accent }]}
                  >
                    {g.name}
                  </Text>
                </View>
              ))}
            </View>
            {/* Rating row — hybrid (TMDB + uygulama oyları), dokununca puan ver */}
            <View style={styles.ratingRow}>
              <RatingSummary
                mediaType="tv"
                mediaId={id}
                tmdbAvg={details.vote_average}
                tmdbCount={details.vote_count}
                releaseDate={details.first_air_date}
                onPressRate={() => setRatingModalVisible(true)}
              />
            </View>
          </View>
        </View>

        {/* ── BODY ── */}
        <View style={styles.body}>
          {/* ListViewTv + progress bar */}
          <View style={{ marginBottom: 8 }}>
            <ListViewTv
              isSeasonWatched={isSeasonWatched}
              showWatchState={showWatchState}
              onMarkWatched={openModal}
              onUnmarkWatched={removeShowFromFirestore}
              watchedOverride={
                showWatchState === WATCH_STATE.UNAIRED ? (
                  <Reminder
                    showId={details.id}
                    showName={details.name}
                    showPosterPath={details.poster_path}
                    seasonNumber={1}
                    episodeNumber={1}
                    episodeName={details.name}
                    airDate={details.first_air_date}
                    seasonPosterPath={details.poster_path}
                    type="tv"
                  />
                ) : null
              }
              navigation={navigation}
              updateList={updateTvSeriesList}
              openModal={openModal}
              addShowToFirestore={addShowToFirestore}
              isLoading={isLoading}
              listStates={listStates}
              type="tv"
              sharedItem={{
                id: details.id,
                type: "tv",
                name: details.name,
                imagePath: details.poster_path,
                genres: details.genres?.map((g) => g.name) || [],
              }}
            />
            <View
              style={{ marginTop: -12, marginHorizontal: 4, marginBottom: 8 }}
            >
              <Progress.Bar
                progress={isSeasonWatched || 0}
                width={width - 30}
                height={3}
                borderWidth={0}
                borderRadius={2}
                animationConfig={{ bounciness: 10 }}
                color={watchedColor}
                unfilledColor={theme.border}
              />
            </View>
          </View>

          <View style={styles.detailActionRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={openReviewComposer}
              style={[
                styles.detailActionBtn,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.detailActionIcon,
                  { backgroundColor: (theme.colors?.blue || theme.accent) + "20" },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={theme.colors?.blue || theme.accent}
                />
              </View>
              <View style={styles.detailActionCopy}>
                <Text
                  allowFontScaling={false}
                  style={[styles.detailActionTitle, { color: theme.text.primary }]}
                >
                  {i18nText("autoI18n.inceleme", "İnceleme")}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.detailActionSub, { color: theme.text.muted }]}
                  numberOfLines={1}
                >
                  {i18nText("autoI18n.hubda_paylas", "Hub'da paylaş")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setAiVisible(true)}
              style={[
                styles.detailActionBtn,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.detailActionIcon,
                  { backgroundColor: (theme.colors?.purple || theme.accent) + "20" },
                ]}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={18}
                  color={theme.colors?.purple || theme.accent}
                />
              </View>
              <View style={styles.detailActionCopy}>
                <Text
                  allowFontScaling={false}
                  style={[styles.detailActionTitle, { color: theme.text.primary }]}
                >
                  {i18nText("autoI18n.yapay_zeka", "Yapay Zeka")}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.detailActionSub, { color: theme.text.muted }]}
                  numberOfLines={1}
                >
                  {i18nText("autoI18n.bilgi_al", "Bilgi al")}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── STAT KARTLARI ── */}
          <View
            style={[
              styles.statRow,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View style={styles.statPill}>
              <View
                style={[
                  styles.statIconWrap,
                  { backgroundColor: theme.accent + "18" },
                ]}
              >
                <Ionicons
                  name="layers-outline"
                  size={16}
                  color={theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statVal, { color: theme.text.primary }]}
              >
                {details.number_of_seasons || 0}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.seasons}
              </Text>
            </View>
            <View
              style={[styles.statDivider, { backgroundColor: theme.border }]}
            />
            <View style={styles.statPill}>
              <View
                style={[
                  styles.statIconWrap,
                  {
                    backgroundColor:
                      (theme.colors?.blue || theme.accent) + "18",
                  },
                ]}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={16}
                  color={theme.colors?.blue || theme.accent}
                />
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.statVal, { color: theme.text.primary }]}
                >
                  {details.number_of_episodes || 0}
                </Text>
                {watchedEpisodeCount > 0 && (
                  <Text
                    allowFontScaling={false}
                    style={[styles.statValSub, { color: theme.text.muted }]}
                  >
                    /{watchedEpisodeCount}
                  </Text>
                )}
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.episode}
              </Text>
            </View>
            <View
              style={[styles.statDivider, { backgroundColor: theme.border }]}
            />
            <View style={styles.statPill}>
              <View
                style={[
                  styles.statIconWrap,
                  {
                    backgroundColor:
                      (theme.colors?.green || theme.accent) + "18",
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={theme.colors?.green || theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[
                  styles.statVal,
                  { color: theme.text.primary, fontSize: 13 },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatDate(details.first_air_date)}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.tvShowsDetails?.airDate}
              </Text>
            </View>
          </View>

          {/* ── YORUMLAR BUTONU ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setCommentModalVisible(true)}
            style={[
              styles.commentsBtn,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.commentsIconWrap,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <MaterialCommunityIcons
                name="comment-text-multiple-outline"
                size={18}
                color={theme.accent}
              />
            </View>
            <Text
              allowFontScaling={false}
              style={[styles.commentsBtnText, { color: theme.text.primary }]}
            >
              {t.comments || i18nText("autoI18n.yorumlar", "Yorumlar")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
          </TouchableOpacity>

          {/* ── TV SHOW ITEM ── */}
          <View style={styles.section}>
            <TVShowItem item={details} navigation={navigation} />
          </View>

          {/* ── SEZON GRAFİK KARTI ── */}
          {details.seasons.filter((s) => s.season_number > 0).length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.seasons} theme={theme} />
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("TvGraphDetailScreen", { id })
                }
                activeOpacity={0.88}
                style={[styles.graphCard, { borderColor: theme.border }]}
              >
                {details.backdrop_path && (
                  <Image
                    source={{
                      uri: getTmdbUrl(details.backdrop_path, 'backdrop', 1000),
                    }}
                    style={styles.graphBackdrop}
                    blurRadius={2}
                  />
                )}
                <LinearGradient
                  colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.72)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.graphContent}>
                  {details.poster_path && (
                    <Image
                      source={{
                        uri: getTmdbUrl(details.poster_path, 'poster', 200),
                      }}
                      style={styles.graphPoster}
                    />
                  )}
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text
                      allowFontScaling={false}
                      style={[styles.graphTitle, { color: "#fff" }]}
                    >
                      {details.name}
                    </Text>
                    <View style={styles.graphStats}>
                      {[
                        {
                          icon: "layers-outline",
                          val: details.number_of_seasons,
                          lbl: t.seasons,
                        },
                        {
                          icon: "play-circle-outline",
                          val: details.number_of_episodes,
                          lbl: t.episode,
                        },
                        {
                          icon: "star-outline",
                          val: details.vote_count,
                          lbl: t.votes,
                        },
                      ].map(({ icon, val, lbl }) => (
                        <View key={lbl} style={styles.graphStatItem}>
                          <Ionicons
                            name={icon}
                            size={14}
                            color="rgba(255,255,255,0.7)"
                          />
                          <Text
                            allowFontScaling={false}
                            style={styles.graphStatVal}
                          >
                            {val || 0}
                          </Text>
                          <Text
                            allowFontScaling={false}
                            style={styles.graphStatLbl}
                          >
                            {lbl}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={[styles.graphChevron]}>
                      <Ionicons
                        name="bar-chart-outline"
                        size={13}
                        color="rgba(255,255,255,0.7)"
                      />
                      <Text
                        allowFontScaling={false}
                        style={styles.graphChevronText}
                      >{i18nText("autoI18n.detayli_istatistikler", "Detaylı İstatistikler")}</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="rgba(255,255,255,0.6)"
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ── ÖZET ACCORDION ── */}
          <View style={{ marginBottom: 24 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => toggleCard("overview")}
              style={[
                styles.accordionCard,
                {
                  backgroundColor: theme.secondary,
                  borderColor:
                    expandedCard === "overview"
                      ? theme.accent + "88"
                      : theme.border,
                },
              ]}
            >
              <View style={styles.accordionHeader}>
                <View
                  style={[
                    styles.sectionAccent,
                    { backgroundColor: theme.accent },
                  ]}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.accordionTitle, { color: theme.text.primary }]}
                >
                  {t.overview || i18nText("autoI18n.ozet", "Özet")}
                </Text>
                <Ionicons
                  name={
                    expandedCard === "overview" ? "chevron-up" : "chevron-down"
                  }
                  size={14}
                  color={
                    expandedCard === "overview"
                      ? theme.accent
                      : theme.text.muted
                  }
                />
              </View>
              <Animated.View
                style={{
                  maxHeight: overviewAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [52, 400],
                  }),
                  overflow: "hidden",
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.accordionBody,
                    { color: theme.text.secondary },
                  ]}
                  numberOfLines={expandedCard === "overview" ? null : 2}
                >
                  {details.overview || i18nText("autoI18n.ozet_bulunmuyor", "Özet bulunmuyor.")}
                </Text>
              </Animated.View>
              {expandedCard !== "overview" && (
                <Text
                  allowFontScaling={false}
                  style={[styles.accordionMore, { color: theme.accent }]}
                >{i18nText("autoI18n.devami", "devamı...")}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── İZLEME PLATFORMLARI + YAYINCI ── */}
          {/* Tek yatay satır: önce bölge sağlayıcıları (linkli), sonda yayıncılar. */}
          {(flatrateProviders.length > 0 || rowNetworks.length > 0) && (
            <View style={styles.section}>
              <SectionHeader title={t.watchProviders} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.providersRow}>
                  {flatrateProviders.map((p) => (
                    <TouchableOpacity
                      key={`p-${p.provider_id}`}
                      activeOpacity={0.8}
                      disabled={!regionProviders?.link}
                      onPress={() => {
                        if (regionProviders?.link)
                          Linking.openURL(regionProviders.link).catch(() => {});
                      }}
                      style={[
                        styles.providerCard,
                        {
                          backgroundColor: theme.secondary,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Image
                        source={{
                          uri: getTmdbUrl(p.logo_path, 'poster', 200),
                        }}
                        style={styles.providerLogo}
                      />
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.providerName,
                          { color: theme.text.secondary },
                        ]}
                        numberOfLines={1}
                      >
                        {p.provider_name}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* Yayıncılar — satırın sonunda. Logoları çoğunlukla
                      koyu/tek renk olduğundan beyaz zeminli kutuda gösterilir. */}
                  {rowNetworks.map((n) => (
                    <View
                      key={`n-${n.id}`}
                      style={[
                        styles.providerCard,
                        {
                          backgroundColor: theme.secondary,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.networkLogoWrap}>
                        {n.logo_path ? (
                          <Image
                            source={{
                              uri: getTmdbUrl(n.logo_path, 'poster', 200),
                            }}
                            style={styles.networkLogo}
                            resizeMode="contain"
                          />
                        ) : (
                          <Ionicons name="tv-outline" size={20} color="#666" />
                        )}
                      </View>
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.providerName,
                          { color: theme.text.secondary },
                        ]}
                        numberOfLines={1}
                      >
                        {n.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── VİDEOLAR ── */}
          <TrailerSection mediaType="tv" id={id} apiKey={API_KEY} />

          {/* ── OYUNCULAR (ana kadro) ── */}
          {details.credits?.cast?.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title={t.cast}
                theme={theme}
                right={
                  details.credits.cast.length > 6 && (
                    <TouchableOpacity
                      onPress={() => setShowFullCast(!showFullCast)}
                      style={styles.seeAllBtn}
                    >
                      <Text
                        style={[styles.seeAllText, { color: theme.accent }]}
                      >
                        {showFullCast ? t.collapse : t.showAll}
                      </Text>
                    </TouchableOpacity>
                  )
                }
              />
              <FlatList
                data={
                  showFullCast
                    ? details.credits.cast
                    : details.credits.cast.slice(0, 10)
                }
                renderItem={renderCastMember}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: 12 }}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews
              />
            </View>
          )}

          {/* ── SEZONLAR LİSTESİ ── */}
          {/* 5'ten fazla sezon: deste görünümü (dikey kaydırmalı yığın) +
              "Tümünü Gör"; aksi halde klasik düz liste. */}
          <View style={styles.section}>
            <SectionHeader title={t.seasons} theme={theme} />
            {seasonList.length > 0 ? (
              useSeasonDeck ? (
                <>
                  <SeasonDeck
                    seasons={seasonList}
                    details={details}
                    navigation={navigation}
                    getWatchedCount={(sn) => watched.seasonWatchedCount(sn)}
                    theme={theme}
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowAllSeasons(true)}
                    style={[
                      styles.seeAllSeasonsBtn,
                      {
                        backgroundColor: theme.secondary,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.seeAllSeasonsText,
                        { color: theme.text.primary },
                      ]}
                    >
                      {i18nText("autoI18n.tumunu_gor", "Tümünü Gör")} (
                      {seasonList.length})
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={15}
                      color={theme.text.muted}
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {seasonList.map((season) => (
                    <SeasonItem
                      key={season.id}
                      season={season}
                      details={details}
                      navigation={navigation}
                      watchedCount={watched.seasonWatchedCount(season.season_number)}
                    />
                  ))}
                  {seasonList.length > 5 && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setShowAllSeasons(false)}
                      style={[
                        styles.seeAllSeasonsBtn,
                        {
                          backgroundColor: theme.secondary,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.seeAllSeasonsText,
                          { color: theme.text.primary },
                        ]}
                      >
                        {i18nText("autoI18n.daha_az_goster", "Daha az göster")}
                      </Text>
                      <Ionicons
                        name="chevron-up"
                        size={15}
                        color={theme.text.muted}
                      />
                    </TouchableOpacity>
                  )}
                </>
              )
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="film-outline"
                  size={28}
                  color={theme.text.muted}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.emptyText, { color: theme.text.muted }]}
                >
                  {t.noSeasonInfo}
                </Text>
              </View>
            )}
          </View>

          {/* ── ÖNERİLEN DİZİLER ── */}
          {railState.recommendations.items.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.recommendedTvShows} theme={theme} />
              <PaginatedRail
                data={railState.recommendations.items}
                renderItem={renderSimilarTvShow}
                keyExtractor={(item) => item.id.toString()}
                onLoadMore={() => loadMoreRail("recommendations")}
                loadingMore={railState.recommendations.loading}
                hasMore={
                  railState.recommendations.page <
                  railState.recommendations.totalPages
                }
                contentContainerStyle={{ paddingVertical: 4, gap: 10 }}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
              />
            </View>
          )}

          {/* ── BENZER DİZİLER ── */}
          {railState.similar.items.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.similarTvShows} theme={theme} />
              <PaginatedRail
                data={railState.similar.items}
                renderItem={renderSimilarTvShow}
                keyExtractor={(item) => item.id.toString()}
                onLoadMore={() => loadMoreRail("similar")}
                loadingMore={railState.similar.loading}
                hasMore={railState.similar.page < railState.similar.totalPages}
                contentContainerStyle={{ paddingVertical: 4, gap: 10 }}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
              />
            </View>
          )}

          {/* TMDB kritikleri kaldırıldı — yorumlar uygulamanın kendi yorum
              modalında gösteriliyor. */}
        </View>
      </ScrollView>

      {/* Kar: scroll boyunca N adet yerine tek sabit overlay (MovieScreen paterni) */}
      {showSnow && (
        <View style={styles.snowOverlay} pointerEvents="none">
          <LottieView
            style={{ flex: 1 }}
            source={require("@lottie/snow.json")}
            autoPlay
            loop
          />
        </View>
      )}

      {/* ─── ÜST OVERLAY BUTONLARI (her zaman tıklanabilir) ─── */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <BlurView tint="dark" intensity={60} style={styles.backBtnBlur}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </BlurView>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.storyBtn}
        onPress={() =>
          navigation.navigate("StoryShareScreen", {
            id,
            type: "tv",
            title: details.name,
            year: details.first_air_date
              ? String(details.first_air_date).slice(0, 4)
              : "",
            rating: details.vote_average,
            genres: details.genres?.map((g) => g.name) || [],
            backdrop_path: details.backdrop_path,
            poster_path: details.poster_path,
            tagline: details.tagline || "",
          })
        }
        activeOpacity={0.8}
      >
        <BlurView tint="dark" intensity={60} style={styles.backBtnBlur}>
          <Ionicons name="share-social-outline" size={20} color="#fff" />
        </BlurView>
      </TouchableOpacity>

      {/* ═══ MODALS ═══ */}

      {/* İzleme tarihi */}
      <WatchedDateSheet
        visible={modalVisible}
        onClose={closeModal}
        subtitle={i18nText(
          "autoI18n.bu_diziyi_ne_zaman_izlediniz",
          "Bu diziyi ne zaman izlediniz?",
        )}
        pickerSubtitle={i18nText(
          "autoI18n.bu_diziyi_ne_zaman_izlemeye_basladiniz",
          "Bu diziyi ne zaman izlemeye başladınız?",
        )}
        releaseDate={details?.first_air_date}
        minDate={details?.first_air_date}
        mediaType="tv"
        busy={isLoading}
        onConfirm={handleConfirm}
      />

      {/* Poster / Backdrop galerisi (tüm görseller + indir) */}
      <ImageGalleryModal
        visible={PosterModalVisible || backdropModalVisible}
        onClose={() => {
          setPosterModalVisible(false);
          setBacdropModalVisible(false);
        }}
        mediaId={id}
        mediaType="tv"
        imageType={PosterModalVisible ? "poster" : "backdrop"}
        initialImage={
          PosterModalVisible ? details.poster_path : details.backdrop_path
        }
      />

      {/* Yorumlar (film ile aynı yapı, TvComment koleksiyonu) */}
      <Modal
        animationType="none"
        transparent
        visible={commentModalVisible}
        onRequestClose={() => setCommentModalVisible(false)}
        statusBarTranslucent
      >
        <CommentSheetModal
          visible={commentModalVisible}
          onClose={() => setCommentModalVisible(false)}
          movieId={id}
          details={details}
          collectionName="TvComment"
        />
      </Modal>

      {/* Derecelendirme */}
      <Modal
        animationType="none"
        transparent
        visible={ratingModalVisible}
        onRequestClose={() => setRatingModalVisible(false)}
        statusBarTranslucent
      >
      <RatingSheetModal
          visible={ratingModalVisible}
          onClose={() => setRatingModalVisible(false)}
          mediaType="tv"
          mediaId={id}
          tmdbAvg={details.vote_average}
          tmdbCount={details.vote_count}
          details={details}
          releaseDate={details.first_air_date}
        />
      </Modal>

      <AIChatScreen
        visible={aiVisible}
        onClose={() => setAiVisible(false)}
        initialPrompt={aiPrompt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Yorumlar butonu */
  commentsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 4,
    marginBottom: 16,
  },
  commentsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  commentsBtnText: { flex: 1, fontSize: 15, fontWeight: "700" },

  /* Hero */
  heroContainer: { height: BACKDROP_HEIGHT, position: "relative" },
  backdrop: { width: "100%", height: "100%", resizeMode: "cover" },
  noBackdrop: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BACKDROP_HEIGHT * 0.7,
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 36,
    left: 16,
    zIndex: 50,
    elevation: 50,
  },
  storyBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 36,
    right: 16,
    zIndex: 50,
    elevation: 50,
  },
  backBtnBlur: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  snowOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },

  /* Info header */
  infoHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: -BACKDROP_HEIGHT * 0.28,
    gap: 14,
    alignItems: "flex-end",
    marginBottom: 20,
  },
  posterShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  poster: { width: 110, height: 165, borderRadius: 14, borderWidth: 1.5 },
  noPoster: {
    width: 110,
    height: 165,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  titleBlock: { flex: 1, paddingBottom: 4, gap: 4 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  tagline: { fontSize: 12, fontStyle: "italic", lineHeight: 17 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  genreChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  genreChipText: { fontSize: 11, fontWeight: "600" },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  ratingNum: { fontSize: 16, fontWeight: "700" },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  voteCount: { fontSize: 12, fontWeight: "500" },

  /* Body */
  body: { paddingHorizontal: 15 },

  /* Stat row */
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statPill: { flex: 1, alignItems: "center", gap: 5 },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: { fontSize: 15, fontWeight: "700" },
  statValSub: { fontSize: 11, marginBottom: 2 },
  statLbl: { fontSize: 11 },
  statDivider: { width: 1, height: 44, opacity: 0.4 },

  detailActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  detailActionBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  detailActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailActionCopy: { flex: 1, minWidth: 0 },
  detailActionTitle: { fontSize: 13.5, fontWeight: "800" },
  detailActionSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  /* Sections */
  section: { marginBottom: 28 },

  /* Yayıncı + izleme sağlayıcıları — MovieDetail provider kartlarıyla aynı */
  providersRow: { flexDirection: "row", gap: 12, paddingVertical: 4 },
  providerCard: {
    alignItems: "center",
    width: 72,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
  },
  providerLogo: { width: 44, height: 44, borderRadius: 10 },
  providerName: { fontSize: 10, textAlign: "center", fontWeight: "500" },
  networkLogoWrap: {
    width: 52,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  networkLogo: { width: 42, height: 26 },

  /* Cast — MovieDetail kart boyutlarıyla aynı */
  castItem: { width: width * 0.2, alignItems: "center" },
  castImage: {
    width: width * 0.2,
    height: width * 0.2 * 1.5,
    borderRadius: 16,
    marginBottom: 7,
    borderWidth: 1.5,
  },
  castName: {
    fontSize: 11.5,
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 15,
  },
  castCharacter: { fontSize: 10.5, textAlign: "center", lineHeight: 14 },
  seeAllBtn: { paddingHorizontal: 4 },
  seeAllText: { fontSize: 13, fontWeight: "600" },

  /* Sezon yığını altındaki Tümünü Gör / Daha az göster butonu */
  seeAllSeasonsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  seeAllSeasonsText: { fontSize: 13, fontWeight: "700" },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionAccent: { width: 3, height: 18, borderRadius: 2 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    flex: 1,
  },

  /* Graph card */
  graphCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    height: 160,
  },
  graphBackdrop: { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  graphContent: {
    flex: 1,
    flexDirection: "row",
    padding: 14,
    gap: 12,
    alignItems: "center",
  },
  graphPoster: { width: 80, height: 120, borderRadius: 10 },
  graphTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  graphStats: { flexDirection: "row", gap: 16 },
  graphStatItem: { alignItems: "center", gap: 2 },
  graphStatVal: { color: "#fff", fontSize: 14, fontWeight: "700" },
  graphStatLbl: { color: "rgba(255,255,255,0.6)", fontSize: 10 },
  graphChevron: { flexDirection: "row", alignItems: "center", gap: 5 },
  graphChevronText: { color: "rgba(255,255,255,0.65)", fontSize: 12, flex: 1 },

  /* Overview */
  /* Accordion */
  accordionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  accordionTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
  accordionBody: { fontSize: 13, lineHeight: 20 },
  accordionMore: { fontSize: 11, fontWeight: "600", marginTop: 6 },

  /* Empty */
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyText: { fontSize: 14 },

  /* Similar */
  similarItem: { width: width * 0.38 },
  similarPoster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  ratingPill: {
    position: "absolute",
    bottom: 8,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratingPillText: { color: "#FFD700", fontSize: 11, fontWeight: "700" },
  listDots: {
    position: "absolute",
    top: 7,
    left: 7,
    flexDirection: "row",
    gap: 4,
  },
  stats: {
    position: "absolute",
    bottom: 8,
    left: 6,
    zIndex: 10,
  },

  /* Videos */
  videoItem: { width: width * 0.62 },
  videoThumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
  },
  videoImage: { width: "100%", height: "100%" },
  playIconContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  videoTypeBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  videoTypeBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  videoTitle: { fontSize: 13, marginTop: 9, fontWeight: "600", lineHeight: 18 },

  /* Video modal */
  videoModal: { flex: 1, justifyContent: "center", alignItems: "center" },
  videoModalContent: { backgroundColor: "#000", position: "relative", width: VIDEO_WIDTH, alignSelf: "center" },
  videoCloseBtn: { position: "absolute", top: -52, right: 12, zIndex: 10 },
  videoCloseBtnBlur: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

});
