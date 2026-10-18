import { tmdbLanguageOf, tmdbRegionOf } from "../../utils/appLanguages";
import { alpha } from "@theme/colors";
import React, { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Linking,
  Modal,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import { DetailsSkeleton } from "../../components/Skeleton";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "@components/AppToast";
import useUserDataDomain from "../../hooks/useUserDataDomain";
import { remindersActions, remindersDomain } from "../../services/userData";
import WatchedDateSheet from "@components/detail/WatchedDateSheet";
import WatchHistorySheet from "@components/modals/WatchHistorySheet";
import MediaNoteSheet from "@components/detail/MediaNoteSheet";
import ListView from "../../components/ListView";
import PosterImage from "../../components/PosterImage";
import { useAppSettings, useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { useMediaNotes, mediaNoteItemKey } from "../../context/MediaNotesContext";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import SwipeCard from "@components/SwipeCard";
import ListBadges from "../../components/ListBadges";
import GlassIconButton from "../../components/common/GlassIconButton";
import { useListStatusContext } from "../../context/ListStatusContext";
import { PREDEFINED_MOVIE_LISTS } from "../../services/listItemsService";
import {
  markMovieWatched,
  removeMovieWatch,
  setListMembership,
} from "../../services/libraryActions";
import {
  customListHas,
  listItemFromDetails,
  movieWatchItemFromDetails,
} from "../../utils/libraryCore";
import { showLibraryError } from "../../utils/libraryErrorText";
import { todayListDate } from "../../utils/mediaFacts";
import { movieWatchEvents } from "../../utils/watchHistory";
import ScreenDecor from "../../components/ScreenDecor";
import { useAuth } from "../../context/AuthContext";
import { useDeviceNotifications } from "../../context/DeviceNotificationsContext";
import useReminderGate from "../../hooks/useReminderGate";
import CommentSheetModal from "@components/modals/CommentSheetModal";
import RatingSheetModal from "@components/modals/RatingSheetModal";
import RatingSummary from "@components/RatingSummary";
import ExternalRatingsRow from "@components/detail/ExternalRatingsRow";
import CertificationBadge from "../../components/detail/CertificationBadge";
import ImageGalleryModal from "@components/modals/ImageGalleryModal";
import TrailerSection from "@components/video/TrailerSection";
import PaginatedRail from "../../components/PaginatedRail";
import { i18nText } from "../../utils/i18nText";
import { captureError } from "../../services/crashReporting";
import { daysUntil, parseAirDate } from "../../utils/airDate";
import { getCachedValue, setCachedValue, TTL } from "../../utils/apiCache";
import { getReleaseState, RELEASE_STATE } from "../../utils/watchState";
import AIChatScreen from "@screens/chat/AIChatScreen";
import NewConversationSheet from "@components/chat/NewConversationSheet";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";


import ModalToastHost from "@components/toast/ModalToastHost";
const { width } = Dimensions.get("window");
const BACKDROP_HEIGHT = width * (9 / 16);
// Fotoğrafı olmayan oyuncu kartındaki ikon: kart genişliğinin (width * 0.2) ~%45'i.
const CAST_PLACEHOLDER_ICON = Math.round(width * 0.09);
// Yatay ray kartı: "Önerilen" ile "Seri" aynı genişliği paylaşıyor.
// Seri rayı getItemLayout hesabı için sayıya ihtiyaç duyuyor, bu yüzden ölçü
// stil içinde gömülü kalmak yerine buradan tek yerden veriliyor.
const RAIL_ITEM_WIDTH = width * 0.38;
const RAIL_ITEM_GAP = 10;

/* ─────────────────────────────────────────
   RecommendedMovieItem
───────────────────────────────────────── */
const RecommendedMovieItem = memo(function RecommendedMovieItem({
  item,
  navigation,
}) {
  const { theme } = useTheme();
  const { posterBadges } = useListLayoutSettings();
  const { openQuickActions } = useMediaQuickActions();
  const scale = React.useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.93,
      friction: 4,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.9}
        style={styles.railItem}
        onPress={() => navigation.push("MovieDetails", { id: item.id })}
        onLongPress={() =>
          openQuickActions({ item, mediaType: "movie", navigation })
        }
        delayLongPress={350}
      >
        <PosterImage
          path={item.poster_path}
          type="movie"
          size={200}
          iconSize={46}
          style={[styles.railPoster, { borderColor: alpha(theme.border, 0.3333333333333333) }]}
        />
        {/* Rating pill */}
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
        {/* List indicators */}
        <View style={styles.stats}>
          <ListBadges
            mediaId={item.id}
            mediaType="movie"
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

/* ─────────────────────────────────────────
   CollectionMovieItem — serinin (koleksiyonun) filmleri
───────────────────────────────────────── */
const CollectionMovieItem = memo(function CollectionMovieItem({
  item,
  order,
  isCurrent,
  navigation,
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { posterBadges } = useListLayoutSettings();
  const year = item.release_date ? String(item.release_date).slice(0, 4) : "";

  return (
    <TouchableOpacity
      activeOpacity={isCurrent ? 1 : 0.9}
      // Açık olan filme basmak aynı ekranı yığına tekrar iterdi.
      disabled={isCurrent}
      style={styles.railItem}
      onPress={() => navigation.push("MovieDetails", { id: item.id })}
    >
      <View>
        <PosterImage
          path={item.poster_path}
          type="movie"
          size={200}
          iconSize={46}
          style={[
            styles.railPoster,
            {
              borderColor: isCurrent ? theme.accent : alpha(theme.border, 0.3333333333333333),
              borderWidth: isCurrent ? 2 : 1,
            },
          ]}
        />
        {/* Seri sırası (kronolojik) */}
        <View
          style={[
            styles.collectionOrderBadge,
            { backgroundColor: isCurrent ? theme.accent : "rgba(0,0,0,0.72)" },
          ]}
        >
          <Text allowFontScaling={false} style={styles.collectionOrderText}>
            {order}
          </Text>
        </View>
        {isCurrent ? (
          <View
            style={[styles.collectionCurrentPill, { backgroundColor: theme.accent }]}
          >
            <Text allowFontScaling={false} style={styles.collectionCurrentText}>
              {t.collectionCurrent || "Bu film"}
            </Text>
          </View>
        ) : (
          <View style={styles.stats}>
            <ListBadges
              mediaId={item.id}
              mediaType="movie"
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
        )}
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.collectionTitle,
          { color: isCurrent ? theme.accent : theme.text.primary },
        ]}
      >
        {item.title}
      </Text>
      {posterBadges?.releaseDate !== false && year ? (
        <Text
          allowFontScaling={false}
          style={[styles.collectionYear, { color: theme.text.muted }]}
        >
          {year}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
});

/* ─────────────────────────────────────────
   Section header
───────────────────────────────────────── */
const SectionHeader = ({ title, right, theme }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
    <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
      {title}
    </Text>
    {right}
  </View>
);

/* ─────────────────────────────────────────
   Main screen
───────────────────────────────────────── */
export default function MovieDetails({ navigation, route }) {
  const insets = useSafeAreaInsets();
  // openComments: "Etkinliklerim → Yorumlarım" satırından gelindiğinde yorum
  // sayfası doğrudan açılır (dizi tarafındaki davranışın filmdeki karşılığı).
  const { id, openComments = false } = route.params;
  const { user } = useAuth();
  const { primeNotificationPermission } = useDeviceNotifications();
  const reminderGate = useReminderGate();
  const { language, t } = useLanguage();
  const providerRegion = tmdbRegionOf(language);
  const { theme } = useTheme();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullCast, setShowFullCast] = useState(false);
  const [commandModalVisible, setCommentModalVisible] = useState(!!openComments);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const { mediaNotes, checkCanCreateMediaNote } = useMediaNotes();
  const myMediaNote = mediaNotes.find((n) => n.id === mediaNoteItemKey("movie", id)) || null;

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

  const { API_KEY } = useAppSettings();
  const { getTmdbUrl } = useImageQualitySettings();

  const [modalVisible, setModalVisible] = useState(false);
  const [watchHistoryVisible, setWatchHistoryVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [sendVisible, setSendVisible] = useState(false);
  const [PosterModalVisible, setPosterModalVisible] = useState(false);
  const [backdropModalVisible, setBacdropModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Hatırlatıcı durumu YEREL kopyadan (services/userData): eskiden her detay
  // açılışında bu film için buluttan bir `onSnapshot` açılıyordu.
  const remindersView = useUserDataDomain(remindersDomain);
  const isReminderSet = id != null && remindersView.has("movies", id);

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  const formatDateSave = (timestamp) => {
    if (typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
      return timestamp.slice(0, 10);
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = parseAirDate(timestamp);
    if (!date) return "";
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  // Takvim günü farkı (bkz. utils/airDate.js) — "geçen süre" ile hesaplanırsa
  // yarın vizyona girecek film için "Bugün" yazıyordu.
  const calculateDateDifference = (airDate) => {
    if (!airDate) return null;
    const days = daysUntil(airDate);
    if (days === null) return null;
    if (days < 0) return { text: formatDate(airDate), isRemaining: false };
    const months = Math.floor(days / 30);
    const rem = days % 30;
    const text =
      months > 0
        ? rem > 0
          ? `${months} ${t.month} ${rem} ${t.days}`
          : `${months} ${t.month}`
        : days > 0
          ? `${days} ${t.days}`
          : t.today;
    return { text, isRemaining: true };
  };

  const handleConfirm = (date) =>
    updateMovieList("watchedMovies", "movie", date);

  useEffect(() => {
    // Aynı ekran örneği yeni id ile yeniden kullanılabildiği için geç gelen
    // eski yanıtın yeni filmi ezmemesi adına cancelled bayrağı gerekli.
    let cancelled = false;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const response = await axios.request({
          method: "GET",
          url: `https://api.themoviedb.org/3/movie/${id}`,
          params: {
            language: tmdbLanguageOf(language),
            append_to_response:
              "account_states,alternative_titles,changes,credits,external_ids,images,keywords,lists,recommendations,release_dates,translations,videos,watch/providers",
          },
          headers: { accept: "application/json", Authorization: API_KEY },
        });
        if (!cancelled) setDetails(response.data);
      } catch (error) {
        // Ham hata metni kullanıcıya değil Sentry'ye (bkz. captureError).
        captureError(error, { tags: { source: "movie_detail_fetch" } });
        if (!cancelled)
          Toast.show({
            type: "error",
            text1: i18nText("autoI18n.islem_tamamlanamadi", "İşlem tamamlanamadı"),
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [id, language]);

  // Önerilen filmler rayı: append_to_response yalnız ilk sayfayı getirir.
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

  const loadMoreRail = useCallback(async () => {
    if (railBusyRef.current || railState.page >= railState.totalPages) return;
    railBusyRef.current = true;
    setRailState((cur) => ({ ...cur, loading: true }));
    try {
      const res = await axios.request({
        method: "GET",
        url: `https://api.themoviedb.org/3/movie/${id}/recommendations`,
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

  // ── Seri / koleksiyon rayı ──
  // Film detayı yalnız `belongs_to_collection: {id, name, poster_path}` veriyor;
  // serinin filmleri için ayrı bir /collection/{id} isteği gerekiyor. Film
  // sekmesindeki küratörlü ray (screens/movie/MovieCollection.js) ile aynı
  // önbellek ailesi ve TTL kullanılıyor — anahtar öneki "movie_" olmalı, yoksa
  // "Verileri indir" ayarındaki film kategorisiyle bağı kopar.
  const [collection, setCollection] = useState(null);
  const collectionId = details?.belongs_to_collection?.id;

  useEffect(() => {
    let cancelled = false;
    setCollection(null);
    if (!collectionId) return;

    const lang = tmdbLanguageOf(language);
    const cacheKey = `movie_collection_detail_${collectionId}_${lang}`;

    const loadCollection = async () => {
      const cached = await getCachedValue(cacheKey, TTL.COLLECTION);
      if (cached) {
        if (!cancelled) setCollection(cached);
        return;
      }
      try {
        const res = await axios.request({
          method: "GET",
          url: `https://api.themoviedb.org/3/collection/${collectionId}`,
          params: { language: lang },
          headers: { accept: "application/json", Authorization: API_KEY },
        });
        const data = res.data;
        if (!Array.isArray(data?.parts) || !data.parts.length) return;
        if (!cancelled) setCollection(data);
        setCachedValue(cacheKey, data);
      } catch {
        // Seri rayı ikincil içerik: istek düşerse ray sessizce gizlenir,
        // detay ekranının kalanı etkilenmez.
      }
    };
    loadCollection();

    return () => {
      cancelled = true;
    };
  }, [collectionId, language, API_KEY]);

  // Kronolojik sıra (tarihsiz/bozuk tarihli filmler sona).
  const collectionParts = useMemo(() => {
    const parts = collection?.parts;
    if (!Array.isArray(parts)) return [];
    const releaseTime = (m) => {
      const ts = m?.release_date ? new Date(m.release_date).getTime() : NaN;
      return Number.isFinite(ts) ? ts : Infinity;
    };
    const list = parts
      .filter((p) => p && p.id)
      .slice()
      .sort((a, b) => {
        const da = releaseTime(a);
        const db = releaseTime(b);
        if (da === db) return 0;
        return da < db ? -1 : 1;
      });
    // Tek filmlik "seri" ray açmayı hak etmiyor (yalnız açık olan film kalır).
    return list.length > 1 ? list : [];
  }, [collection]);

  // Açık olan filmin seri içindeki yeri: hem işaretleme hem de uzun serilerde
  // (örn. James Bond) rayı doğru yerden başlatmak için gerekli.
  const currentPartIndex = useMemo(
    () => collectionParts.findIndex((p) => String(p.id) === String(id)),
    [collectionParts, id],
  );

  const renderCollectionMovie = useCallback(
    ({ item, index }) => (
      <CollectionMovieItem
        item={item}
        order={index + 1}
        isCurrent={String(item.id) === String(id)}
        navigation={navigation}
      />
    ),
    [id, navigation],
  );

  const collectionItemLayout = useCallback(
    (_data, index) => ({
      length: RAIL_ITEM_WIDTH,
      offset: (RAIL_ITEM_WIDTH + RAIL_ITEM_GAP) * index,
      index,
    }),
    [],
  );

  const addReminder = async () => {
    try {
      if (!user?.uid || !details) return;
      // Kaldırmak serbest; yeni film hatırlatması ücretsiz planda sınırlı.
      if (!isReminderSet && !reminderGate.checkAdd({ type: "movie" })) return;
      // Yerel kopyaya + kalıcı günlüğe anında yazılır, buluta arka planda gider.
      if (!isReminderSet) {
        remindersActions.setMovie(user.uid, {
          movieId: details.id || "",
          movieName: details.title || "",
          releaseDate: details.release_date || "",
          movieMinutes: details.runtime || 0,
          posterPath: details.poster_path || null,
          type: "movie",
          createdAt: formatDateSave(new Date()),
        });
      } else {
        remindersActions.removeMovie(user.uid, details.id);
      }
      Toast.show({
        type: isReminderSet ? "warning" : "success",
        text1: isReminderSet ? i18nText("autoI18n.hatirlatma_kaldirildi", "Hatırlatma kaldırıldı") : i18nText("autoI18n.hatirlatma_eklendi", "Hatırlatma eklendi"),
      });
      // Hatırlatma kuruldu ama OS izni yoksa bildirim ASLA düşmez — izin
      // sayfasını burada aç (gerek yoksa kendisi sessizce çıkıyor).
      if (!isReminderSet) primeNotificationPermission();
    } catch (error) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.hata_2", "Hata: ") + error.message });
    }
  };

  const { allLists, statusIndex, watchedMoviesItems } = useListStatusContext();
  const watchedMovieDoc = useMemo(
    () => (watchedMoviesItems || []).find((item) => String(item.id) === String(id)) || null,
    [watchedMoviesItems, id],
  );
  const watchEvents = useMemo(
    () => movieWatchEvents(watchedMovieDoc),
    [watchedMovieDoc],
  );

  const getListName = (l) =>
    ({
      favorites: t.favorites,
      watchList: t.watchList,
      watchedMovies: t.watchedMovies,
      watchedTv: t.watchedTv,
    })[l] || l;

  const updateMovieList = async (listType, type, date = null) => {
    if (!user?.uid || !details) return;
    closeModal();
    const toastRemove = () =>
      Toast.show({
        type: "warning",
        text1: i18nText("autoI18n.media_removed_from_list", "{{media}} {{list}} listesinden kaldırıldı!", {
          media: type === "movie" ? i18nText("autoI18n.film", "Film") : i18nText("autoI18n.dizi", "Dizi"),
          list: getListName(listType),
        }),
      });
    const toastAdd = () =>
      Toast.show({
        type: "success",
        text1: `${type === "movie" ? i18nText("autoI18n.film", "Film") : i18nText("autoI18n.dizi", "Dizi")} ${getListName(listType)} listesine eklendi!`,
      });

    try {
      // İzlendi: liste üyeliği değil izleme OLAYI (tekrar izleme desteklenir).
      if (listType === "watchedMovies") {
        if (!date) {
          Toast.show({ type: "warning", text1: i18nText("autoI18n.lutfen_bir_tarih_secin", "Lütfen bir tarih seçin.") });
          return;
        }
        const isRewatch = !!listStates.watchedMovies;
        setIsLoading(true);
        try {
          await markMovieWatched({
            uid: user.uid,
            movie: movieWatchItemFromDetails(details, { dateAdded: date }),
            watchDate: date,
          });
        } finally {
          setIsLoading(false);
        }
        Toast.show({
          type: "success",
          text1: isRewatch
            ? i18nText("autoI18n.tekrar_izleme_eklendi", "Tekrar izleme geçmişe eklendi.")
            : i18nText("autoI18n.film_izlendi_eklendi", "Film izlendi olarak eklendi."),
        });
        return;
      }

      // Favoriler / izlenecekler / özel listeler: tek kapı (sıralı, iyimser,
      // hatada geri alınır). Hedef durum GÖRÜNEN durumdan türer — art arda iki
      // dokunuş ekle→çıkar olur, ekle→ekle olmaz.
      const desired = !listStates[listType];
      await setListMembership({
        uid: user.uid,
        listKey: listType,
        item: listItemFromDetails(details, type, { dateAdded: date || todayListDate() }),
        desired,
      });
      if (desired) toastAdd();
      else toastRemove();
    } catch (error) {
      showLibraryError(error, { source: "movie_detail_list" });
    }
  };

  // listStates: öntanımlı (favorites/watchList/watchedMovies) subcollection
  // tabanlı statusIndex'ten (bekleyen işlemlerin bindirmesi dahil); özel listeler
  // kök dokümandaki dizilerden.
  const listStates = useMemo(() => {
    const s = {};
    const m = statusIndex?.movie?.[id] || {};
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
        if (Array.isArray(v)) s[k] = customListHas(allLists, k, id, "movie");
      });
    }
    return s;
  }, [allLists, statusIndex, id]);

  const renderCastMember = useCallback(({ item }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("ActorViewScreen", { personId: item.id })
      }
      activeOpacity={0.8}
    >
      <View style={styles.castItem}>
        {item.profile_path ? (
          <Image
            source={{ uri: getTmdbUrl(item.profile_path, 'poster', 200) }}
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
  ), [navigation, theme, getTmdbUrl]);

  const renderRecommendedMovie = useCallback(
    ({ item }) => <RecommendedMovieItem item={item} navigation={navigation} />,
    [navigation],
  );

  const openReviewComposer = useCallback(() => {
    if (!details) return;
    const title = details.title || "";
    navigation.navigate("ShareContentScreen", {
      composePost: {
        composeKey: `movie-${id}-${Date.now()}`,
        postType: "review",
        title: title ? `${title} incelemesi` : i18nText("autoI18n.yeni_inceleme", "Yeni inceleme"),
        content: "",
        selectedMedia: [
          {
            id: details.id,
            media_type: "movie",
            type: "movie",
            title,
            name: title,
            poster_path: details.poster_path,
            poster: details.poster_path
              ? getTmdbUrl(details.poster_path, "poster", 500)
              : null,
            release_date: details.release_date,
            year: details.release_date ? String(details.release_date).slice(0, 4) : "",
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
      media_type: "movie",
      title: details.title || "",
      poster_path: details.poster_path || null,
      vote_average: details.vote_average ?? null,
      vote_count: details.vote_count ?? null,
      overview: details.overview || null,
      release_date: details.release_date || null,
    };
  }, [details]);

  const sendToRecipient = useCallback((recipient) => {
    if (!chatMedia || !recipient) return;
    const sharedParams = {
      initialMedia: chatMedia,
      initialMediaKey: `movie-${chatMedia.id}-${Date.now()}`,
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

  const aiPrompt = useMemo(() => {
    if (!details?.title) return "";
    const year = details.release_date ? ` (${String(details.release_date).slice(0, 4)})` : "";
    return i18nText(
      "autoI18n.film_ai_prompt",
      "{{title}} filmi hakkında spoiler vermeden bilgi ver. Konusu, türü, öne çıkan oyuncuları, atmosferi, kimlere uygun olduğu ve neden izlenebileceğini kısa başlıklarla anlat.",
      { title: `${details.title}${year}` },
    );
  }, [details]);

  // Sohbet baloncuğunda uzun prompt yerine kısa istek + poster kartı görünür.
  const aiDisplay = i18nText(
    "autoI18n.film_ai_display",
    "Bu film hakkında bilgi verir misin?",
  );
  const aiAttachment = useMemo(() => {
    if (!details?.title) return null;
    return {
      mediaType: "movie",
      id,
      title: details.title,
      year: details.release_date ? String(details.release_date).slice(0, 4) : "",
      posterPath: details.poster_path || "",
      backdropPath: details.backdrop_path || "",
      runtimeMinutes: Number(details.runtime) > 0 ? Number(details.runtime) : 0,
      tagline: details.tagline || "",
      rating: details.vote_average || 0,
      originalTitle: details.original_title || details.title,
      overview: details.overview || "",
      genres: details.genres?.map((genre) => genre.name).filter(Boolean) || [],
      cast: details.credits?.cast?.slice(0, 8).map((person) => person.name).filter(Boolean) || [],
      director:
        details.credits?.crew?.find((person) => person.job === "Director")?.name || "",
      providers:
        details["watch/providers"]?.results?.[providerRegion]?.flatrate
          ?.map((provider) => provider.provider_name)
          .filter(Boolean) || [],
    };
  }, [details, id, providerRegion]);

  if (loading) return <DetailsSkeleton />;
  if (!details)
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.primary,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: theme.text.primary }}>{i18nText("autoI18n.yukleniyor", "Yükleniyor...")}</Text>
      </View>
    );

  const dateInfo = calculateDateDifference(details.release_date);
  // Yayın tarihi yok/geçersiz VE TMDB durumu da "yayınlandı" demiyorsa göz
  // butonu kilitlenir. `dateInfo` tam bu durumda null dönüyordu ve isRemaining
  // undefined kalıp içerik izlenebilir sanılıyordu (bkz. utils/watchState.js).
  const watchLocked =
    getReleaseState(details.release_date, details.status) ===
    RELEASE_STATE.UNKNOWN;

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <ScreenDecor scope="details" iconOpacity={0.25} />
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        style={styles.container}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HERO / BACKDROP ─── */}
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
              <Ionicons
                name="film-outline"
                size={64}
                color={theme.text.muted}
              />
            </View>
          )}
          {/* Deep gradient */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.15)", theme.primary]}
            locations={[0.3, 0.65, 1]}
            style={styles.heroGradient}
            pointerEvents="none"
          />
        </View>

        {/* ─── POSTER + INFO HEADER ─── */}
        <View style={styles.infoHeader}>
          {/* Poster */}
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

          {/* Title block */}
          <View style={styles.titleBlock}>
            <Text
              allowFontScaling={false}
              style={[styles.title, { color: theme.text.primary }]}
            >
              {details.title}
            </Text>
            {details.alternative_titles?.titles?.length > 0 && (
              <Text
                allowFontScaling={false}
                style={[styles.altTitle, { color: theme.text.muted }]}
              >
                {details.alternative_titles.titles[0].title}
              </Text>
            )}
            {details.tagline ? (
              <Text
                allowFontScaling={false}
                style={[styles.tagline, { color: theme.accent }]}
                numberOfLines={2}
              >
                "{details.tagline}"
              </Text>
            ) : null}

            {/* Genres */}
            <View style={styles.genreRow}>
              <CertificationBadge mediaType="movie" details={details} region={providerRegion} />
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
                mediaType="movie"
                mediaId={id}
                tmdbAvg={details.vote_average}
                tmdbCount={details.vote_count}
                releaseDate={details.release_date}
                onPressRate={() => setRatingModalVisible(true)}
              />
            </View>
            <ExternalRatingsRow imdbId={details.external_ids?.imdb_id || details.imdb_id} />
          </View>
        </View>

        {/* ─── BODY ─── */}
        <View style={styles.body}>
          {/* ListView */}
          <ListView
            isRemaining={dateInfo?.isRemaining}
            watchLocked={watchLocked}
            isReminderSet={isReminderSet}
            updateList={updateMovieList}
            updateWatchedList={openModal}
            openWatchedHistory={() => setWatchHistoryVisible(true)}
            addReminder={addReminder}
            navigation={navigation}
            listStates={listStates}
            isLoading={isLoading}
            type={"movie"}
            sharedItem={{
              id: details.id,
              type: "movie",
              name: details.title,
              imagePath: details.poster_path,
              minutes: details.runtime,
              genres: details.genres?.map((g) => g.name) || [],
            }}
          />

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

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setSendVisible(true)}
              style={[
                styles.detailActionBtn,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.detailActionIcon,
                  { backgroundColor: (theme.colors?.green || "#3CCB9A") + "20" },
                ]}
              >
                <Ionicons name="paper-plane-outline" size={17} color={theme.colors?.green || "#3CCB9A"} />
              </View>
              <View style={styles.detailActionCopy}>
                <Text allowFontScaling={false} style={[styles.detailActionTitle, { color: theme.text.primary }]}>
                  {i18nText("autoI18n.gonder", "Gönder")}
                </Text>
                <Text allowFontScaling={false} style={[styles.detailActionSub, { color: theme.text.muted }]} numberOfLines={1}>
                  {i18nText("autoI18n.sohbete_gonder", "Sohbete gönder")}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── STAT PILLS ── */}
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
                  name="calendar-outline"
                  size={16}
                  color={theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statVal, { color: theme.text.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {dateInfo?.text || "?"}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.date}
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
                  name="time-outline"
                  size={16}
                  color={theme.colors?.blue || theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statVal, { color: theme.text.primary }]}
              >
                {details.runtime ? `${details.runtime} dk` : "?"}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.duration}
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
                  name="cash-outline"
                  size={16}
                  color={theme.colors?.green || theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statVal, { color: theme.text.primary }]}
              >
                {details.revenue > 0
                  ? `${(details.revenue / 1_000_000).toFixed(0)}M$`
                  : "?"}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.revenue}
              </Text>
            </View>
          </View>

          {/* ── YORUMLAR BUTONU ── */}
          <SwipeCard
            leftButton={{ label: i18nText("autoI18n.sil", "Sil"), color: "#e53935" }}
            rightButton={{ label: i18nText("autoI18n.yanitla", "Yanıtla"), color: "#5aacf0" }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setCommentModalVisible(!commandModalVisible)}
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
                <AntDesign name="comment" size={18} color={theme.accent} />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.commentsBtnText, { color: theme.text.primary }]}
              >
                {t.comments || "Yorumlar"}
              </Text>
              <View style={styles.commentsRight}>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.text.muted}
                />
              </View>
            </TouchableOpacity>
          </SwipeCard>

          {/* ── NOTUM KARTI ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              // Ücretsiz planda 20 film notu: dolduysa not sayfası hiç açılmaz.
              if (checkCanCreateMediaNote("movie", id)) setNoteSheetVisible(true);
            }}
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
              <Ionicons
                name={myMediaNote ? "document-text" : "document-text-outline"}
                size={18}
                color={theme.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                allowFontScaling={false}
                style={[styles.commentsBtnText, { color: theme.text.primary }]}
              >
                {i18nText("autoI18n.notum", "Notum")}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{ fontSize: 12, marginTop: 2, color: theme.text.muted }}
              >
                {myMediaNote?.text ||
                  i18nText("autoI18n.bu_film_hakkinda_bir_not_ekle", "Bu film hakkında bir not ekle")}
              </Text>
            </View>
            <View style={styles.commentsRight}>
              <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
            </View>
          </TouchableOpacity>

          {/* ── EKSTERNAl LİNKLER ── */}
          {details.external_ids && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 24 }}
            >
              <View style={styles.externalLinks}>
                {[
                  {
                    key: "imdb_id",
                    url: (v) => `https://www.imdb.com/title/${v}`,
                    icon: "imdb",
                    label: "IMDb",
                  },
                  {
                    key: "facebook_id",
                    url: (v) => `https://www.facebook.com/${v}`,
                    icon: "facebook",
                    label: "Facebook",
                  },
                  {
                    key: "instagram_id",
                    url: (v) => `https://www.instagram.com/${v}`,
                    icon: "instagram",
                    label: "Instagram",
                  },
                  {
                    key: "twitter_id",
                    url: (v) => `https://twitter.com/${v}`,
                    icon: "twitter",
                    label: "Twitter",
                  },
                ].map(({ key, url, icon, label }) =>
                  details.external_ids[key] ? (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.extLink,
                        {
                          backgroundColor: theme.secondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() =>
                        Linking.openURL(url(details.external_ids[key]))
                      }
                      activeOpacity={0.8}
                    >
                      <FontAwesome5
                        name={icon}
                        size={15}
                        color={theme.accent}
                      />
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.extLinkText,
                          { color: theme.text.primary },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ) : null,
                )}
              </View>
            </ScrollView>
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

          {/* ── İZLEME PLATFORMLARI ── */}
          {"watch/providers" in details &&
            details["watch/providers"].results[providerRegion] && (
              <View style={styles.section}>
                <SectionHeader title={t.watchProviders} theme={theme} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.providersRow}>
                    {details["watch/providers"].results[providerRegion].flatrate?.map(
                      (p) => (
                        <View
                          key={p.provider_id}
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
                        </View>
                      ),
                    )}
                  </View>
                </ScrollView>
              </View>
            )}

          {/* ── VİDEOLAR ── */}
          <TrailerSection
            mediaType="movie"
            id={id}
            apiKey={API_KEY}
            originalLanguage={details.original_language}
          />

          {/* ── OYUNCULAR ── */}
          {details.credits?.cast.length > 0 && (
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

          {/* ── SERİ / KOLEKSİYON ── */}
          {collectionParts.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title={collection?.name || t.collectionSection || "Film Serisi"}
                theme={theme}
                right={
                  <Text
                    allowFontScaling={false}
                    style={[styles.seeAllText, { color: theme.text.muted }]}
                  >
                    {(t.movieScreens?.collectionFilmCount || "{count}").replace(
                      "{count}",
                      collectionParts.length,
                    )}
                  </Text>
                }
              />
              <FlatList
                data={collectionParts}
                renderItem={renderCollectionMovie}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: RAIL_ITEM_GAP }}
                // Açık olan film ilk karelerin dışındaysa ray onun bir öncesinden
                // başlar; aksi hâlde uzun serilerde işaretli kart hiç görünmez.
                initialScrollIndex={
                  currentPartIndex > 1 ? currentPartIndex - 1 : 0
                }
                getItemLayout={collectionItemLayout}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
              />
            </View>
          )}

          {/* ── ÖNERİLEN FİLMLER ── */}
          {railState.items.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.recommendedMovies} theme={theme} />
              <PaginatedRail
                data={railState.items}
                renderItem={renderRecommendedMovie}
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


      {/* ─── ÜST OVERLAY BUTONLARI (her zaman tıklanabilir) ─── */}
      {/* iOS 26+: Liquid Glass; diğer yerlerde eski koyu blur kutusu. */}
      <GlassIconButton
        variant="blur"
        size={38}
        icon="chevron-back"
        accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
        onPress={() => navigation.goBack()}
        style={[styles.backBtn, { top: insets.top + 8 }]}
      />

      <GlassIconButton
        variant="blur"
        size={38}
        icon="share-social-outline"
        iconSize={20}
        accessibilityLabel={i18nText("autoI18n.paylas", "Paylaş")}
        style={[styles.storyBtn, { top: insets.top + 8 }]}
        onPress={() =>
          navigation.navigate("StoryShareScreen", {
            id,
            type: "movie",
            title: details.title,
            year: details.release_date
              ? String(details.release_date).slice(0, 4)
              : "",
            rating: details.vote_average,
            genres: details.genres?.map((g) => g.name) || [],
            backdrop_path: details.backdrop_path,
            poster_path: details.poster_path,
            tagline: details.tagline || "",
          })
        }
      />

      {/* ═══════ MODALS ═══════ */}

      {/* Yorumlar */}
      <Modal
        animationType="none"
        transparent
        visible={commandModalVisible}
        onRequestClose={() => setCommentModalVisible(false)}
        statusBarTranslucent
      >
        <CommentSheetModal
          visible={commandModalVisible}
          onClose={() => setCommentModalVisible(false)}
          movieId={id}
          details={details}
        />
        <ModalToastHost visible={commandModalVisible} />
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
          mediaType="movie"
          mediaId={id}
          tmdbAvg={details.vote_average}
          tmdbCount={details.vote_count}
          details={details}
          releaseDate={details.release_date}
        />
        <ModalToastHost visible={ratingModalVisible} />
      </Modal>

      {/* Notum */}
      <MediaNoteSheet
        visible={noteSheetVisible}
        onClose={() => setNoteSheetVisible(false)}
        type="movie"
        mediaId={id}
        title={details?.title}
        posterPath={details?.poster_path}
      />

      {/* İzleme tarihi */}
      <WatchHistorySheet
        visible={watchHistoryVisible}
        onClose={() => setWatchHistoryVisible(false)}
        title={details?.title}
        events={watchEvents}
        busy={isLoading}
        onAddAgain={() => {
          setWatchHistoryVisible(false);
          setTimeout(openModal, 300);
        }}
        onDeleteEvent={async (event) => {
          if (!user?.uid || !details?.id) return;
          try {
            setIsLoading(true);
            await removeMovieWatch({ uid: user.uid, movieId: details.id, eventId: event.id });
            Toast.show({
              type: "success",
              text1: i18nText("autoI18n.izleme_kaydi_silindi", "Seçilen izleme kaydı silindi."),
            });
            if (watchEvents.length <= 1) setWatchHistoryVisible(false);
          } catch (error) {
            showLibraryError(error, { source: "movie_detail_remove_watch" });
          } finally {
            setIsLoading(false);
          }
        }}
      />

      <WatchedDateSheet
        visible={modalVisible}
        onClose={closeModal}
        subtitle={i18nText(
          "autoI18n.bu_filmi_ne_zaman_izlediniz",
          "Bu filmi ne zaman izlediniz?",
        )}
        pickerSubtitle={i18nText(
          "autoI18n.film_izleme_tarihini_sec",
          "Filmi izlediğiniz tarihi seçin",
        )}
        releaseDate={details?.release_date}
        minDate={details?.release_date}
        mediaType="movie"
        scope="movie"
        mediaId={id}
        mediaTitle={details?.title}
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
        mediaType="movie"
        imageType={PosterModalVisible ? "poster" : "backdrop"}
        initialImage={
          PosterModalVisible ? details.poster_path : details.backdrop_path
        }
      />

      <AIChatScreen
        visible={aiVisible}
        onClose={() => setAiVisible(false)}
        initialPrompt={aiPrompt}
        initialDisplay={aiDisplay}
        initialAttachment={aiAttachment}
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

/* ─────────────────────────────────────────
   Styles
───────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },

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

  /* Lottie snow */

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
  poster: { width: 110, height: 110 * 1.5, borderRadius: 14, borderWidth: 1.5 },
  noPoster: {
    width: 110,
    height: 110 * 1.5,
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
  altTitle: { fontSize: 12, fontStyle: "italic" },
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

  /* Comments btn */
  commentsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  commentsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  commentsBtnText: { fontSize: 15, fontWeight: "600" },
  commentsRight: { marginLeft: "auto" },

  /* External links */
  externalLinks: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  extLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  extLinkText: { fontSize: 13, fontWeight: "600" },

  /* Sections */
  section: { marginBottom: 28 },
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
  seeAllBtn: { paddingHorizontal: 4 },
  seeAllText: { fontSize: 13, fontWeight: "600" },

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

  /* Tags */

  /* Cast */
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

  /* Yatay ray kartı */
  railItem: { width: RAIL_ITEM_WIDTH },
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
  /* Collection */
  collectionOrderBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionOrderText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  collectionCurrentPill: {
    position: "absolute",
    bottom: 8,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  collectionCurrentText: { color: "#fff", fontSize: 10.5, fontWeight: "700" },
  collectionTitle: {
    marginTop: 7,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 17,
  },
  collectionYear: { marginTop: 1, fontSize: 11, fontWeight: "600" },
  /* Videos */

  /* Providers */
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

  /* Video modal */

});
