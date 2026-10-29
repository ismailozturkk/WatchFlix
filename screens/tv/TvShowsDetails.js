import { tmdbLanguageOf, tmdbRegionOf } from "../../utils/appLanguages";
import { alpha } from "@theme/colors";
import { isLightSurface } from "@utils/colorUtils";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
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
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { DetailsSkeleton } from "../../components/Skeleton";
import DetailLoadError from "../../components/detail/DetailLoadError";
import DetailHeroStage, {
  computeDetailHeroMetrics,
} from "../../components/detail/DetailHeroStage";
import Ionicons from "@expo/vector-icons/Ionicons";
import TVShowItem from "../../components/TVShowItem";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import Toast from "@components/AppToast";
import SeasonItem from "./SeasonItem";
import SeasonDeck from "./SeasonDeck";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  useAppSettings,
  useImageQualitySettings,
  useListLayoutSettings,
} from "../../context/AppSettingsContext";
import WatchedDateSheet from "@components/detail/WatchedDateSheet";
import WatchHistorySheet from "@components/modals/WatchHistorySheet";
import MediaNoteSheet from "@components/detail/MediaNoteSheet";
import { useMediaNotes, mediaNoteItemKey } from "../../context/MediaNotesContext";
import ListViewTv from "../../components/ListViewTv";
import PosterImage from "../../components/PosterImage";
import GlassIconButton from "../../components/common/GlassIconButton";
import ListBadges from "../../components/ListBadges";
import { useListStatusContext } from "../../context/ListStatusContext";
import { PREDEFINED_MOVIE_LISTS } from "../../services/listItemsService";
import {
  markShowWatched,
  removeTvWatch,
  setListMembership,
} from "../../services/libraryActions";
import { customListHas, listItemFromDetails } from "../../utils/libraryCore";
import { showLibraryError, showWatchSpreadNotice } from "../../utils/libraryErrorText";
import { todayListDate } from "../../utils/mediaFacts";
import ScreenDecor from "../../components/ScreenDecor";
import { LocalBlurTarget, useLocalBlurTarget } from "../../components/common/BlurTarget";

import ImageGalleryModal from "@components/modals/ImageGalleryModal";
import TrailerSection from "@components/video/TrailerSection";
import PaginatedRail from "../../components/PaginatedRail";
import CommentSheetModal from "@components/modals/CommentSheetModal";
import RatingSheetModal from "@components/modals/RatingSheetModal";
import RatingSummary from "@components/RatingSummary";
import ExternalRatingsRow from "@components/detail/ExternalRatingsRow";
import CertificationBadge from "../../components/detail/CertificationBadge";
import { i18nText } from "../../utils/i18nText";
import { useWatchedShow } from "../../hooks/useWatchedShow";
import { refreshShowMeta } from "../../services/refreshShowMeta";
import AIChatScreen from "@screens/chat/AIChatScreen";
import DetailAiActionSheet from "@components/detail/DetailAiActionSheet";
import {
  DetailActionCluster,
  DetailFactsStrip,
  DetailJournalPanel,
  DetailOverviewSection,
  DetailProviderRail,
} from "@components/detail/DetailContentSections";
import { buildDetailAiRequest, detailAiKeywords, DETAIL_AI_ACTION } from "@utils/detailAiRequest";
import NewConversationSheet from "@components/chat/NewConversationSheet";
import {
  getWatchState,
  isAired,
  WATCH_STATE,
  watchStateColor,
} from "../../utils/watchState";
import Reminder from "../../components/Reminder";
import WatchProgressBar from "../../components/tv/WatchProgressBar";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";

import ModalToastHost from "@components/toast/ModalToastHost";
import GlassTouchable from "../../components/common/GlassTouchable";
import usePosterUri from "../../hooks/usePosterUri";
import useBackdropUri from "../../hooks/useBackdropUri";
const { width } = Dimensions.get("window");
const BACKDROP_HEIGHT = width * (9 / 16);

// Fotoğrafı olmayan oyuncu kartındaki ikon: kart genişliğinin (width * 0.2) ~%45'i.
const CAST_PLACEHOLDER_ICON = Math.round(width * 0.09);

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

/* ─── Önerilen dizi kartı ── */
// Kart kendi press animasyonunu yönetir; memo sayesinde ekran re-render
// olduğunda 40 kart yeniden çizilmez.
const RecommendedTvShow = memo(function RecommendedTvShow({
  item,
  navigation,
  theme,
}) {
  const { posterBadges } = useListLayoutSettings();
  const { openQuickActions } = useMediaQuickActions();
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
        style={styles.railItem}
        onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
        onLongPress={() =>
          openQuickActions({ item, mediaType: "tv", navigation })
        }
        delayLongPress={350}
      >
        <PosterImage
          path={item.poster_path}
          type="tv"
          mediaId={item.id}
          size={200}
          iconSize={46}
          style={[styles.railPoster, { borderColor: alpha(theme.border, 0.3333333333333333) }]}
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
  const insets = useSafeAreaInsets();
  // Android 12+: üst düğmeler (geri / paylaş) posteri GERÇEKTEN bulanıklaştırsın
  // diye ekran içeriği yerel bir blur hedefine sarılır; düğmeler onun KARDEŞİ.
  const posterBlur = useLocalBlurTarget();
  // openComments / commentScope: "Etkinliklerim → Yorumlarım" satırından
  // gelindiğinde yorum sayfası doğrudan o yorumun kapsamında (dizi/sezon/bölüm)
  // açılır — kullanıcı kendi yorumunu aramak zorunda kalmasın.
  const { id, openComments = false, commentScope = null } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  // "Tekrar dene" aynı id/dil için isteği yeniden tetikler (bkz. DetailLoadError).
  const [reloadKey, setReloadKey] = useState(0);
  const [commentModalVisible, setCommentModalVisible] = useState(
    !!openComments || !!commentScope,
  );
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const { mediaNotes, checkCanCreateMediaNote } = useMediaNotes();
  const myMediaNote = mediaNotes.find((n) => n.id === mediaNoteItemKey("tv", id)) || null;
  // Sezon carousel'i: 5+ sezonda tek tek sayfalı görünüm; "Tümünü Gör" düz listeye açar.
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  // Ana kadro (credits.cast) — MovieDetail ile aynı bölüm/kart yapısı.
  const [showFullCast, setShowFullCast] = useState(false);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { API_KEY } = useAppSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const posterUri = usePosterUri();
  const backdropUri = useBackdropUri();
  const { allLists, statusIndex } = useListStatusContext();
  // İzleme sağlayıcıları bölgesi — MovieDetail ile aynı seçim.
  const providerRegion = tmdbRegionOf(language);

  // Tek abonelik: bu dizinin tüm izlenme durumu (kök-dizi yerine subcollection).
  const watched = useWatchedShow(id);

  const [isLoading, setIsLoading] = useState(false);

  const [PosterModalVisible, setPosterModalVisible] = useState(false);
  const [backdropModalVisible, setBacdropModalVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [watchHistoryVisible, setWatchHistoryVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [aiActionSheetVisible, setAiActionSheetVisible] = useState(false);
  const [aiAction, setAiAction] = useState(DETAIL_AI_ACTION.INFO);
  const [sendVisible, setSendVisible] = useState(false);

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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
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
        if (Array.isArray(v)) s[k] = customListHas(allLists, k, id, "tv");
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
            language: tmdbLanguageOf(language),
            append_to_response:
              "account_states,alternative_titles,changes,credits,external_ids,images,keywords,lists,recommendations,content_ratings,translations,videos,watch/providers",
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
  }, [id, language, reloadKey]);

  // Önerilen diziler rayı: append_to_response yalnız ilk sayfayı getirir.
  // Ana ekran raylarındaki gibi (PaginatedRail) sona yaklaşınca sonraki TMDB
  // sayfası çekilip mevcut listenin sonuna eklenir.
  const [railState, setRailState] = useState({
    items: [],
    page: 1,
    totalPages: 1,
    loading: false,
  });
  const railBusyRef = useRef(false);

  useEffect(() => {
    const block = details?.recommendations;
    railBusyRef.current = false;
    setRailState({
      items: block?.results || [],
      page: block?.page || 1,
      totalPages: block?.total_pages || 1,
      loading: false,
    });
  }, [details]);

  // Dizi TMDB'den çekildiğinde ve kullanıcı bu diziyi izlemişse (Firestore'da kaydı varsa),
  // yeni sezon/bölümler eklenmişse showEpisodeCount ve showSeasonCount'u sessizce güncelle.
  useEffect(() => {
    if (!user?.uid || !id || !details || !watched?.showDoc) return;
    refreshShowMeta(user.uid, id, details, watched.showDoc);
  }, [user?.uid, id, details, watched?.showDoc]);

  const loadMoreRail = useCallback(async () => {
    if (railBusyRef.current || railState.page >= railState.totalPages) return;
    railBusyRef.current = true;
    setRailState((cur) => ({ ...cur, loading: true }));
    try {
      const res = await axios.request({
        method: "GET",
        url: `https://api.themoviedb.org/3/tv/${id}/recommendations`,
        params: {
          language: tmdbLanguageOf(language),
          page: railState.page + 1,
        },
        headers: { accept: "application/json", Authorization: API_KEY },
      });
      const fresh = res.data?.results || [];
      setRailState((cur) => {
        const seen = new Set(cur.items.map((it) => it.id));
        return {
          items: [...cur.items, ...fresh.filter((it) => !seen.has(it.id))],
          page: res.data?.page || cur.page + 1,
          totalPages: res.data?.total_pages || cur.totalPages,
          loading: false,
        };
      });
    } catch {
      setRailState((cur) => ({ ...cur, loading: false }));
    } finally {
      railBusyRef.current = false;
    }
  }, [railState, id, language, API_KEY]);

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
    const getName = (l) =>
      ({
        favorites: t.tvShowsDetails?.favorites,
        watchList: t.tvShowsDetails?.watchList,
        watchedMovies: t.tvShowsDetails?.watchedMovies,
        watchedTv: t.tvShowsDetails?.watchedTv,
      }[l] || l);
    const toastRemove = () =>
      Toast.show({
        type: "warning",
        text1: i18nText(
          "autoI18n.tv_removed_from_list",
          "Dizi {{list}} listesinden kaldırıldı!",
          { list: getName(listType) }
        ),
      });
    const toastAdd = () =>
      Toast.show({
        type: "success",
        text1: i18nText(
          "autoI18n.tv_added_to_list",
          "Dizi {{list}} listesine eklendi!",
          { list: getName(listType) }
        ),
      });

    try {
      // Favoriler / izlenecekler / özel listeler: tek kapı (sıralı, iyimser,
      // hatada geri alınır). Hedef durum GÖRÜNEN durumdan türer.
      const desired = !listStates[listType];
      await setListMembership({
        uid: user.uid,
        listKey: listType,
        item: listItemFromDetails(details, type, { dateAdded: todayListDate() }),
        desired,
      });
      if (desired) toastAdd();
      else toastRemove();
    } catch (e) {
      showLibraryError(e, { source: "tv_detail_list" });
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
  /* ── Diziyi komple işaretle (sezonları çek → tek olay olarak yaz) ── */
  const addShowToFirestore = async (selDate = null) => {
    if (!user?.uid || !details?.seasons || !selDate) return;
    try {
      setIsLoading(true);
      closeModal();
      // Sezonların çekilmesi, "biri düşerse hiçbiri yazılmaz" kuralı ve yazma
      // services/libraryActions.markShowWatched'ta — hata kodu yerelleştirilir.
      const watchResult = await markShowWatched({
        uid: user.uid,
        details,
        watchDate: formatDateSave(selDate),
        apiKey: API_KEY,
        language,
      });
      const { status } = watchResult;
      if (status === "empty-show") {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.bolum_bilgisi_bulunamadi",
            "Bu dizinin bölüm bilgisi bulunamadı."
          ),
        });
        return;
      }
      // Günlük 24 saat sınırı yüzünden günlere yayıldıysa başarı toast'ı yerine bu söylenir.
      if (!showWatchSpreadNotice(watchResult)) {
        Toast.show({
          type: "success",
          text1: i18nText(
            "autoI18n.dizi_bolumleri_izlendi_olarak_isaretlendi",
            "Dizi bölümleri izlendi olarak işaretlendi"
          ),
        });
      }
    } catch (e) {
      showLibraryError(e, { source: "tv_detail_mark_show" });
    } finally {
      setIsLoading(false);
    }
  };

  const removeShowWatchEvent = async (event) => {
    if (!user?.uid || !details || !event?.id) return;
    try {
      setIsLoading(true);
      await removeTvWatch({ uid: user.uid, showId: details.id, eventId: event.id });
      Toast.show({
        type: "success",
        text1: i18nText(
          "autoI18n.izleme_kaydi_silindi",
          "Seçilen izleme kaydı silindi."
        ),
      });
      if (watched.watchEvents.length <= 1) setWatchHistoryVisible(false);
    } catch (e) {
      // Eskiden yalnız console.error: kullanıcı silmenin başarısız olduğunu görmüyordu.
      showLibraryError(e, { source: "tv_detail_remove_watch" });
    } finally {
      setIsLoading(false);
    }
  };

  /* ── renderVideo ── */

  const renderRecommendedTvShow = useCallback(
    ({ item }) => (
      <RecommendedTvShow item={item} navigation={navigation} theme={theme} />
    ),
    [navigation, theme]
  );

  const openReviewComposer = useCallback(() => {
    if (!details) return;
    const title = details.name || "";
    navigation.navigate("ShareContentScreen", {
      composePost: {
        composeKey: `tv-${id}-${Date.now()}`,
        postType: "review",
        title: title
          ? i18nText("autoI18n.inceleme_basligi", "{{title}} incelemesi", { title })
          : i18nText("autoI18n.yeni_inceleme", "Yeni inceleme"),
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
            year: details.first_air_date
              ? String(details.first_air_date).slice(0, 4)
              : "",
            genre_ids: details.genres?.map((g) => g.id).filter(Boolean) || [],
          },
        ],
      },
    });
  }, [details, getTmdbUrl, id, navigation]);

  const chatMedia = useMemo(() => {
    if (!details?.id) return null;
    return {
      id: details.id,
      media_type: "tv",
      title: details.name || "",
      poster_path: details.poster_path || null,
      vote_average: details.vote_average ?? null,
      vote_count: details.vote_count ?? null,
      overview: details.overview || null,
      release_date: details.first_air_date || null,
    };
  }, [details]);

  const sendToRecipient = useCallback((recipient) => {
    if (!chatMedia || !recipient) return;
    const sharedParams = {
      initialMedia: chatMedia,
      initialMediaKey: `tv-${chatMedia.id}-${Date.now()}`,
    };
    if (recipient.recipientType === "group") {
      navigation.navigate("ChatScreen", {
        groupId: recipient.id,
        groupName: recipient.name,
        groupAvatarIndex: recipient.avatarIndex,
        ...sharedParams,
      });
      return;
    }
    navigation.navigate("ChatScreen", {
      friendUid: recipient.uid,
      friendName: recipient.name,
      friendAvatarIndex: recipient.avatarIndex,
      ...sharedParams,
    });
  }, [chatMedia, navigation]);

  const aiRequest = useMemo(
    () => buildDetailAiRequest("tv", details?.name, details?.first_air_date, aiAction),
    [details?.name, details?.first_air_date, aiAction, language],
  );
  const aiAttachment = useMemo(() => {
    if (!details?.name) return null;
    return {
      mediaType: "tv",
      id,
      title: details.name,
      year: details.first_air_date ? String(details.first_air_date).slice(0, 4) : "",
      posterPath: details.poster_path || "",
      backdropPath: details.backdrop_path || "",
      runtimeMinutes: Number(details.episode_run_time?.find((value) => Number(value) > 0)) || 0,
      tagline: details.tagline || "",
      rating: details.vote_average || 0,
      originalTitle: details.original_name || details.name,
      overview: details.overview || "",
      genres: details.genres?.map((genre) => genre.name).filter(Boolean) || [],
      keywords: detailAiKeywords(details),
      cast: details.credits?.cast?.slice(0, 8).map((person) => person.name).filter(Boolean) || [],
      director:
        details.created_by?.[0]?.name ||
        details.credits?.crew?.find((person) => person.job === "Director")?.name ||
        "",
      providers:
        details["watch/providers"]?.results?.[providerRegion]?.flatrate
          ?.map((provider) => provider.provider_name)
          .filter(Boolean) || [],
    };
  }, [details, id, providerRegion]);
  const aiChatAttachment = useMemo(
    () => aiAction === DETAIL_AI_ACTION.SIMILAR && aiAttachment
      ? { ...aiAttachment, referenceOnly: true }
      : aiAttachment,
    [aiAction, aiAttachment],
  );

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
          {item.profile_path ? (
            <Image
              source={{ uri: getTmdbUrl(item.profile_path, "poster", 200) }}
              style={[styles.castImage, { borderColor: theme.border }]}
            />
          ) : (
            <View
              style={[
                styles.castImage,
                styles.castImagePlaceholder,
                { borderColor: theme.border, backgroundColor: theme.secondary },
              ]}
            >
              <FontAwesome
                name="user"
                size={CAST_PLACEHOLDER_ICON}
                color={theme.text.muted}
              />
            </View>
          )}
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
    [navigation, theme, getTmdbUrl]
  );

  if (loading) return <DetailsSkeleton />;
  if (!details)
    return (
      <DetailLoadError
        theme={theme}
        onRetry={() => setReloadKey((k) => k + 1)}
        onBack={() => navigation.goBack()}
      />
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
    flatrateProviders.map((p) => (p.provider_name || "").toLowerCase())
  );
  const rowNetworks = (details.networks || []).filter(
    (nw) => !providerNames.has((nw.name || "").toLowerCase())
  );
  const heroMetrics = computeDetailHeroMetrics({
    width,
    topInset: insets.top,
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <LocalBlurTarget attach={posterBlur.attach} backgroundColor={theme.primary} style={styles.container}>
      <ScreenDecor scope="details" iconOpacity={0.25} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HERO / BACKDROP YUVASI ── */}
        <DetailHeroStage
          uri={backdropUri("tv", details.id, details.backdrop_path)}
          theme={theme}
          topInset={insets.top}
          width={width}
          placeholderIcon="tv-outline"
          onPress={() => setBacdropModalVisible(true)}
        />

        {/* ── POSTER + INFO HEADER ── */}
        <View
          style={[
            styles.infoHeader,
            { marginTop: -heroMetrics.infoHeaderOverlap },
          ]}
        >
          <TouchableOpacity
            style={styles.posterShadow}
            onPress={() => setPosterModalVisible(true)}
            activeOpacity={0.92}
          >
            {posterUri("tv", details.id, details.poster_path) ? (
              <Image
                source={{
                  uri: posterUri("tv", details.id, details.poster_path),
                }}
                style={[styles.poster, { borderColor: alpha(theme.border, 0.5019607843137255) }]}
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
              // Başlık arka planın tema rengine solduğu sınırda duruyor; açık temada
              // koyu yazı görselin koyu kısmına binince okunmuyordu (T3 B11). Tema
              // yüzeyi renginde hale: açık temada açık, koyu temada koyu.
              style={[
                styles.title,
                {
                  color: theme.text.primary,
                  textShadowColor: theme.primary,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 4,
                },
              ]}
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
              <CertificationBadge mediaType="tv" details={details} region={providerRegion} />
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
            <ExternalRatingsRow imdbId={details.external_ids?.imdb_id} />
          </View>
        </View>

        {/* ── BODY ── */}
        <View style={styles.body}>
          {/* Liste işlemleri + genel dizi ilerlemesi */}
          <View style={styles.listActionsBlock}>
            <ListViewTv
              isSeasonWatched={isSeasonWatched}
              showWatchState={showWatchState}
              onMarkWatched={openModal}
              onUnmarkWatched={() => setWatchHistoryVisible(true)}
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
                    // Eylem satırındaki öteki simgelerle aynı (ListViewTv: 30, dar düzende 24).
                    size={30}
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
            <WatchProgressBar
              watched={watchedEpisodeCount}
              total={showTotalEpisodes}
              startColor={watchedColor}
              endColor={theme.accent}
              trackColor={theme.border}
              style={styles.showProgressTrack}
            />
          </View>

          <DetailActionCluster
            theme={theme}
            review={{
              title: i18nText("autoI18n.inceleme", "İnceleme"),
              subtitle: i18nText("autoI18n.hubda_paylas", "Hub'da paylaş"),
              icon: "create-outline",
              onPress: openReviewComposer,
            }}
            ai={{
              title: i18nText("autoI18n.yapay_zeka", "Yapay Zeka"),
              subtitle: i18nText("autoI18n.ai_action_subtitle", "Bilgi / Öneri"),
              icon: "sparkles-outline",
              onPress: () => setAiActionSheetVisible(true),
            }}
            send={{
              title: i18nText("autoI18n.gonder", "Gönder"),
              subtitle: i18nText("autoI18n.sohbete_gonder", "Sohbete gönder"),
              icon: "paper-plane-outline",
              onPress: () => setSendVisible(true),
            }}
          />

          <DetailFactsStrip
            theme={theme}
            facts={[
              { key: "seasons", icon: "layers-outline", value: details.number_of_seasons || 0, label: t.seasons },
              {
                key: "episodes",
                icon: "play-circle-outline",
                value: details.number_of_episodes || 0,
                trailing: watchedEpisodeCount > 0 ? ` / ${watchedEpisodeCount}` : null,
                label: t.episode,
                color: theme.colors?.blue,
              },
              { key: "date", icon: "calendar-outline", value: formatDate(details.first_air_date), label: t.tvShowsDetails?.airDate, color: theme.colors?.green },
            ]}
          />

          <DetailJournalPanel
            theme={theme}
            comment={{
              title: t.comments || i18nText("autoI18n.yorumlar", "Yorumlar"),
              subtitle: i18nText("autoI18n.tum_yorumlari_gor", "Tüm yorumları gör"),
              icon: "chatbubble-ellipses-outline",
              onPress: () => setCommentModalVisible(true),
            }}
            note={{
              title: i18nText("autoI18n.notum", "Notum"),
              subtitle: myMediaNote?.text || i18nText("autoI18n.bu_dizi_hakkinda_bir_not_ekle", "Bu dizi hakkında bir not ekle"),
              icon: myMediaNote ? "document-text" : "document-text-outline",
              onPress: () => {
                if (checkCanCreateMediaNote("tv", id)) setNoteSheetVisible(true);
              },
            }}
          />

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
                {Boolean(backdropUri("tv", details.id, details.backdrop_path)) && (
                  <Image
                    source={{
                      uri: backdropUri("tv", details.id, details.backdrop_path),
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
                  {Boolean(posterUri("tv", details.id, details.poster_path)) && (
                    <Image
                      source={{
                        uri: posterUri("tv", details.id, details.poster_path),
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
                      >
                        {i18nText(
                          "autoI18n.detayli_istatistikler",
                          "Detaylı İstatistikler"
                        )}
                      </Text>
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

          <DetailOverviewSection
            theme={theme}
            title={t.overview || i18nText("autoI18n.ozet", "Özet")}
            body={details.overview || i18nText("autoI18n.ozet_bulunmuyor", "Özet bulunmuyor.")}
            expanded={expandedCard === "overview"}
            progress={overviewAnim}
            onToggle={() => toggleCard("overview")}
            moreLabel={i18nText("autoI18n.devami", "devamı...")}
          />

          <DetailProviderRail
            theme={theme}
            title={t.watchProviders}
            providers={flatrateProviders}
            networks={rowNetworks}
            link={regionProviders?.link}
            getTmdbUrl={getTmdbUrl}
          />

          {/* ── VİDEOLAR ── */}
          <TrailerSection
            mediaType="tv"
            id={id}
            apiKey={API_KEY}
            originalLanguage={details.original_language}
          />

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
                    getWatchEvents={(sn) => watched.seasonWatchEvents(sn)}
                    theme={theme}
                  />
                  <GlassTouchable
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
                  </GlassTouchable>
                </>
              ) : (
                <>
                  {seasonList.map((season) => (
                    <SeasonItem
                      key={season.id}
                      season={season}
                      details={details}
                      navigation={navigation}
                      watchedCount={watched.seasonWatchedCount(
                        season.season_number
                      )}
                      watchEvents={watched.seasonWatchEvents(
                        season.season_number
                      )}
                    />
                  ))}
                  {seasonList.length > 5 && (
                    <GlassTouchable
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
                    </GlassTouchable>
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
          {railState.items.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.recommendedTvShows} theme={theme} />
              <PaginatedRail
                data={railState.items}
                renderItem={renderRecommendedTvShow}
                keyExtractor={(item) => item.id.toString()}
                onLoadMore={loadMoreRail}
                loadingMore={railState.loading}
                hasMore={railState.page < railState.totalPages}
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
      </LocalBlurTarget>


      {/* ─── ÜST OVERLAY BUTONLARI (her zaman tıklanabilir) ─── */}
      {/* iOS 26+: Liquid Glass; Android'de posteri bulanıklaştıran buzlu cam. */}
      <GlassIconButton
        variant="blur"
        blurTarget={posterBlur.target}
        size={38}
        icon="chevron-back"
        accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
        onPress={() => navigation.goBack()}
        style={[styles.backBtn, { top: insets.top + 8 }]}
      />

      <GlassIconButton
        variant="blur"
        blurTarget={posterBlur.target}
        size={38}
        icon="share-social-outline"
        iconSize={20}
        accessibilityLabel={i18nText("autoI18n.paylas", "Paylaş")}
        style={[styles.storyBtn, { top: insets.top + 8 }]}
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
      />

      {/* ═══ MODALS ═══ */}

      {/* Notum */}
      <MediaNoteSheet
        visible={noteSheetVisible}
        onClose={() => setNoteSheetVisible(false)}
        type="tv"
        mediaId={id}
        title={details?.name}
        posterPath={details?.poster_path}
      />

      {/* İzleme tarihi */}
      <WatchHistorySheet
        visible={watchHistoryVisible}
        onClose={() => setWatchHistoryVisible(false)}
        title={details?.name}
        events={watched.watchEvents}
        busy={isLoading}
        onAddAgain={() => {
          setWatchHistoryVisible(false);
          setTimeout(openModal, 300);
        }}
        onDeleteEvent={removeShowWatchEvent}
      />

      <WatchedDateSheet
        visible={modalVisible}
        onClose={closeModal}
        subtitle={i18nText(
          "autoI18n.bu_diziyi_ne_zaman_izlediniz",
          "Bu diziyi ne zaman izlediniz?"
        )}
        pickerSubtitle={i18nText(
          "autoI18n.bu_diziyi_ne_zaman_izlemeye_basladiniz",
          "Bu diziyi ne zaman izlemeye başladınız?"
        )}
        releaseDate={details?.first_air_date}
        minDate={details?.first_air_date}
        mediaType="tv"
        scope="show"
        mediaId={id}
        mediaTitle={details?.name}
        posterPath={details?.poster_path}
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
        posterPicker
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
          // Sezon listesi kapsam seçiciyi besler: kullanıcı bölüm sayfasına
          // girmeden buradan sezon/bölüm hedefleyip yorum yazabilir.
          seasons={details?.seasons}
          initialScope={commentScope}
        />
        <ModalToastHost visible={commentModalVisible} />
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
        <ModalToastHost visible={ratingModalVisible} />
      </Modal>

      <DetailAiActionSheet
        visible={aiActionSheetVisible}
        onClose={() => setAiActionSheetVisible(false)}
        onSelect={(action) => {
          setAiAction(action);
          setAiVisible(true);
        }}
      />

      <AIChatScreen
        visible={aiVisible}
        onClose={() => setAiVisible(false)}
        initialPrompt={aiRequest.prompt}
        initialDisplay={aiRequest.display}
        initialAttachment={aiChatAttachment}
      />
      <NewConversationSheet
        visible={sendVisible}
        onClose={() => setSendVisible(false)}
        onSelect={sendToRecipient}
        includeGroups
        title={i18nText("autoI18n.sohbete_gonder", "Sohbete gönder")}
        subtitle={i18nText("autoI18n.gonderilecek_kisiyi_veya_grubu_sec", "Göndermek istediğin arkadaşını veya grubu seç")}
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

  /* Hero overlay buttons */
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 50,
    elevation: 50,
  },
  storyBtn: {
    position: "absolute",
    right: 16,
    zIndex: 50,
    elevation: 50,
  },

  /* Info header */
  infoHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
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

  /* Body */
  body: { paddingHorizontal: 15 },

  listActionsBlock: { marginBottom: 10 },
  showProgressTrack: {
    marginTop: -4,
  },

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
    gap: 8,
    marginBottom: 16,
  },
  detailActionBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 70,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  detailActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  detailActionCopy: { minWidth: 0, alignItems: "center" },
  detailActionTitle: { fontSize: 11.5, fontWeight: "800", textAlign: "center" },
  detailActionSub: { fontSize: 9.5, fontWeight: "700", marginTop: 1, textAlign: "center" },

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
  castImagePlaceholder: { justifyContent: "center", alignItems: "center" },
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
  graphBackdrop: { ...StyleSheet.absoluteFill, resizeMode: "cover" },
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

  /* Yatay ray kartı */
  railItem: { width: width * 0.38 },
  railPoster: {
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
  stats: {
    position: "absolute",
    bottom: 8,
    left: 6,
    zIndex: 10,
  },

  /* Videos */

  /* Video modal */
});
